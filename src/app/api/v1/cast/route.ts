import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiErrorCode, apiError, apiSuccess } from '@/lib/api-response';
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

const IDEMPOTENCY_ENDPOINT = 'POST /api/v1/cast';

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

// POST /api/v1/cast - Public endpoint for casting spells with API key
export async function POST(req: NextRequest) {
  try {
    const apiKeyResult = await requireApiKey(req);
    if (!apiKeyResult.ok) {
      return apiKeyResult.response;
    }
    const userId = apiKeyResult.value.userId;

    // Apply rate limiting after identifying userId
    const rateLimitResponse = await enforceRateLimit(
      req,
      {
        limit: 60,
        window: 60,
      },
      userId
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const idempotencyResult = requireIdempotencyKey(req);
    if (!idempotencyResult.ok) {
      return idempotencyResult.response;
    }
    const idempotencyKey = idempotencyResult.value;

    // Parse request body
    const body = await req.json();
    const { spell_key, input } = body;

    if (!spell_key || typeof spell_key !== 'string') {
      return apiError('VALIDATION_ERROR', 422, 'spell_key is required and must be a string');
    }

    const serializedInput = input ? JSON.stringify(input) : '{}';
    const inputHash = input ? serializedInput : null;

    const transactionResult = await createQueuedCastTransaction({
      userId,
      spellKey: spell_key,
      rawInput: input,
      serializedInput,
      inputHash,
      idempotencyKey,
    });

    if (transactionResult.kind === 'replay') {
      return new Response(JSON.stringify(transactionResult.replay.body), {
        status: transactionResult.replay.status,
        headers: {
          'Content-Type': 'application/json',
          'Idempotent-Replayed': 'true',
        },
      });
    }

    if (transactionResult.kind === 'pending') {
      return apiError('IDEMPOTENCY_CONFLICT', 409, 'Request is already being processed');
    }

    if (transactionResult.kind === 'error') {
      const { error } = transactionResult;
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

    const { cast, spell } = transactionResult;

    if (spell.executionMode === 'workflow') {
      try {
        const cfg = getGitHubWorkflowConfig();

        await triggerWorkflowDispatch({
          cast_id: cast.id,
          spell_key: spell.key,
          input_data: serializedInput,
          code_url: spell.codeUrl || undefined,
          runtime: spell.runtime || undefined,
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
      } catch (error: unknown) {
        console.error('Workflow trigger error:', error);

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

    return apiSuccess(successBody, 201);
  } catch (error) {
    if (error instanceof IdempotencyMismatchError) {
      return apiError('IDEMPOTENCY_CONFLICT', 409, error.message);
    }

    console.error('Cast API error:', error);
    return apiError('INTERNAL', 500, 'Internal server error');
  }
}
