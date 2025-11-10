// Cast Execution Endpoints - TKT-016/017
// SPEC Reference: Section 11 (Cast Execution)

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createRequestLogger } from '@/lib/logger';
import { ErrorCatalog, handleError, apiSuccess, ApiErrorCode } from '@/lib/api-response';
import { requireApiKey, enforceRateLimit, requireIdempotencyKey } from '@/lib/api-middleware';
import {
  GitHubAppError,
  GitHubConfigError,
  triggerWorkflowDispatch,
  getLatestWorkflowRun,
  getGitHubWorkflowConfig,
} from '@/lib/github-app';
import { createQueuedCastTransaction } from '@/lib/cast-service';
import { persistIdempotencyResult, IdempotencyMismatchError } from '@/lib/idempotency';

const IDEMPOTENCY_ENDPOINT = 'POST /api/casts';

async function persistIdempotencySafe(params: {
  key: string;
  endpoint: string;
  scope: string;
  responseStatus: number;
  responseBody: unknown;
}) {
  try {
    await persistIdempotencyResult(params);
  } catch (error) {
    console.error('Failed to persist idempotency result:', error);
  }
}

// POST /api/casts - Execute cast (TKT-016)
export async function POST(req: NextRequest) {
  const requestLogger = createRequestLogger(randomUUID(), '/api/casts', 'POST');

  try {
    // API Key authentication
    const apiKeyResult = await requireApiKey(req);
    if (!apiKeyResult.ok) {
      requestLogger.warn('API key validation failed');
      return apiKeyResult.response;
    }
    const userId = apiKeyResult.value.userId;

    requestLogger.info('Cast execution requested', { userId });

    // Rate limiting
    const rateLimitResponse = await enforceRateLimit(
      req,
      {
        limit: 60,
        window: 60,
      },
      userId
    );
    if (rateLimitResponse) {
      requestLogger.warn('Rate limit exceeded', { userId });
      return rateLimitResponse;
    }

    // Idempotency key
    const idempotencyResult = requireIdempotencyKey(req);
    if (!idempotencyResult.ok) {
      requestLogger.warn('Idempotency key missing', { userId });
      return idempotencyResult.response;
    }
    const idempotencyKey = idempotencyResult.value;

    // Parse request body
    const body = await req.json();
    const { spell_key, input } = body;

    if (!spell_key || typeof spell_key !== 'string') {
      requestLogger.warn('Invalid spell_key', { userId });
      throw ErrorCatalog.VALIDATION_ERROR({
        spell_key: ['spell_key is required and must be a string'],
      });
    }

    const serializedInput = input ? JSON.stringify(input) : '{}';
    const inputHash = input ? serializedInput : null;

    // Create cast transaction (handles spell lookup, budget check, idempotency)
    const transactionResult = await createQueuedCastTransaction({
      userId,
      spellKey: spell_key,
      rawInput: input,
      serializedInput,
      inputHash,
      idempotencyKey,
    });

    // Handle idempotency replay
    if (transactionResult.kind === 'replay') {
      requestLogger.info('Idempotent request replayed', { userId, spellKey: spell_key });
      return new Response(JSON.stringify(transactionResult.replay.body), {
        status: transactionResult.replay.status,
        headers: {
          'Content-Type': 'application/json',
          'Idempotent-Replayed': 'true',
        },
      });
    }

    // Handle pending idempotency
    if (transactionResult.kind === 'pending') {
      requestLogger.warn('Request already being processed', { userId, spellKey: spell_key });
      throw ErrorCatalog.IDEMPOTENCY_CONFLICT(idempotencyKey);
    }

    // Handle transaction errors (spell not found, budget exceeded, etc.)
    if (transactionResult.kind === 'error') {
      const { error } = transactionResult;
      requestLogger.warn('Cast transaction failed', { userId, spellKey: spell_key, error });

      const responseBody = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ?? {}),
        },
      };
      const response = new Response(JSON.stringify(responseBody), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      });

      if (error.headers) {
        for (const [key, value] of Object.entries(error.headers)) {
          response.headers.set(key, value);
        }
      }

      await persistIdempotencySafe({
        key: idempotencyKey,
        endpoint: IDEMPOTENCY_ENDPOINT,
        scope: userId,
        responseStatus: error.status,
        responseBody,
      });

      return response;
    }

    // Success - trigger workflow if needed
    const { cast, spell } = transactionResult;

    requestLogger.info('Cast created successfully', {
      userId,
      castId: cast.id,
      spellKey: spell.key,
      executionMode: spell.executionMode,
    });

    if (spell.executionMode === 'workflow') {
      try {
        const cfg = getGitHubWorkflowConfig();

        await triggerWorkflowDispatch({
          cast_id: cast.id,
          spell_key: spell.key,
          input_data: serializedInput,
        });

        const runId = await getLatestWorkflowRun(cfg.workflowFile, 5000);

        await prisma.cast.update({
          where: { id: cast.id },
          data: {
            status: 'running',
            startedAt: new Date(),
            githubRunId: runId ? runId.toString() : null,
          },
        });

        requestLogger.info('Workflow triggered successfully', {
          userId,
          castId: cast.id,
          githubRunId: runId,
        });
      } catch (error: unknown) {
        requestLogger.error('Workflow trigger failed', error as Error, {
          userId,
          castId: cast.id,
        });

        await prisma.cast.update({
          where: { id: cast.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            finishedAt: new Date(),
          },
        });

        let responseStatus = 500;
        let responseCode: ApiErrorCode = 'INTERNAL';
        let responseMessage = 'Failed to trigger spell execution';

        if (error instanceof GitHubAppError) {
          responseStatus = error.status;
          responseCode = error.code;
          responseMessage = error.message;
        } else if (error instanceof GitHubConfigError) {
          responseMessage = error.message;
        }

        const responseBody = {
          error: {
            code: responseCode,
            message: responseMessage,
          },
        };

        await persistIdempotencySafe({
          key: idempotencyKey,
          endpoint: IDEMPOTENCY_ENDPOINT,
          scope: userId,
          responseStatus,
          responseBody,
        });

        return new Response(JSON.stringify(responseBody), {
          status: responseStatus,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const successBody = {
      cast_id: cast.id,
      spell_key: spell.key,
      spell_name: spell.name,
      status: cast.status,
      cost_cents: cast.costCents,
      created_at: cast.createdAt.toISOString(),
      message: 'Cast initiated successfully',
    };

    await persistIdempotencySafe({
      key: idempotencyKey,
      endpoint: IDEMPOTENCY_ENDPOINT,
      scope: userId,
      responseStatus: 201,
      responseBody: successBody,
    });

    requestLogger.info('Cast execution completed successfully', {
      userId,
      castId: cast.id,
    });

    return apiSuccess(successBody, 201);
  } catch (error) {
    if (error instanceof IdempotencyMismatchError) {
      requestLogger.error('Idempotency conflict', error);
      return handleError(error);
    }

    requestLogger.error('Cast API error', error as Error, {
      userId: (await auth())?.user?.id,
    });
    return handleError(error);
  }
}

// GET /api/casts - List user's casts
export async function GET(req: NextRequest) {
  const requestLogger = createRequestLogger(randomUUID(), '/api/casts', 'GET');

  try {
    const session = await auth();

    if (!session?.user) {
      requestLogger.warn('Unauthorized casts list attempt');
      throw ErrorCatalog.UNAUTHORIZED();
    }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    requestLogger.info('Fetching casts', {
      userId: session.user.id,
      page,
      limit,
    });

    const [casts, total] = await Promise.all([
      prisma.cast.findMany({
        where: { casterId: session.user.id },
        include: {
          spell: {
            select: {
              id: true,
              name: true,
              key: true,
              executionMode: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cast.count({ where: { casterId: session.user.id } }),
    ]);

    requestLogger.info('Casts fetched successfully', {
      userId: session.user.id,
      count: casts.length,
      total,
    });

    return apiSuccess({
      casts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    requestLogger.error('Failed to fetch casts', error as Error, {
      userId: (await auth())?.user?.id,
    });
    return handleError(error);
  }
}
