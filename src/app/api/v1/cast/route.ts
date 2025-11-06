import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ApiErrorCode, apiError, apiSuccess } from '@/lib/api-response';
import { validateApiKey } from '@/lib/api-key';
import {
  GitHubAppError,
  GitHubConfigError,
  triggerWorkflowDispatch,
  getLatestWorkflowRun,
  getGitHubWorkflowConfig,
} from '@/lib/github-app';
import { checkBudget, estimateExecutionCost } from '@/lib/budget';
import {
  initIdempotencyKey,
  persistIdempotencyResult,
  IdempotencyReplay,
  IdempotencyMismatchError,
} from '@/lib/idempotency';
import { executeSpell } from '@/lib/execution/router';

const IDEMPOTENCY_ENDPOINT = 'POST /api/v1/cast';

type ErrorResult = {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
  headers?: Record<string, string>;
};

type TransactionResult =
  | { kind: 'replay'; replay: IdempotencyReplay }
  | { kind: 'pending' }
  | { kind: 'error'; error: ErrorResult }
  | {
      kind: 'success';
      cast: {
        id: string;
        status: string;
        costCents: number;
        createdAt: Date;
      };
      spell: {
        id: string;
        key: string;
        name: string;
        executionMode: string;
        priceAmountCents: number;
      };
    };

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
  const idempotencyKey = req.headers.get('idempotency-key');

  try {
    // Note: Rate limiting is now handled globally by middleware.ts
    // API keys get 60 requests/minute by default via the global rate limiter
    // The global middleware will apply the appropriate tier based on authentication method

    // Get API key from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return apiError('UNAUTHORIZED', 401, 'Missing or invalid Authorization header');
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

    // Validate API key
    const validation = await validateApiKey(apiKey);
    if (!validation) {
      return apiError('UNAUTHORIZED', 401, 'Invalid or inactive API key');
    }
    const userId = validation.userId;

    if (!idempotencyKey) {
      return apiError('VALIDATION_ERROR', 400, 'Idempotency-Key header is required');
    }

    // Parse request body
    const body = await req.json();
    const { spell_key, input } = body;

    if (!spell_key || typeof spell_key !== 'string') {
      return apiError('VALIDATION_ERROR', 422, 'spell_key is required and must be a string');
    }

    const serializedInput = input ? JSON.stringify(input) : '{}';
    const inputHash = input ? serializedInput : null;

    const transactionResult = await prisma.$transaction<TransactionResult>(async (tx) => {
      const requestPayload = { spell_key, input };

      const initResult = await initIdempotencyKey(
        {
          key: idempotencyKey,
          endpoint: IDEMPOTENCY_ENDPOINT,
          scope: userId,
          requestPayload,
        },
        tx
      );

      if (initResult.state === 'replay') {
        return { kind: 'replay', replay: initResult.replay };
      }

      if (initResult.state === 'pending') {
        return { kind: 'pending' };
      }

      const spell = await tx.spell.findUnique({
        where: { key: spell_key },
        select: {
          id: true,
          key: true,
          name: true,
          status: true,
          executionMode: true,
          priceAmountCents: true,
        },
      });

      if (!spell) {
        return {
          kind: 'error',
          error: {
            status: 404,
            code: 'WORKFLOW_NOT_FOUND',
            message: 'Spell not found',
          },
        };
      }

      if (spell.status !== 'active') {
        return {
          kind: 'error',
          error: {
            status: 422,
            code: 'VALIDATION_ERROR',
            message: 'Spell is not active',
          },
        };
      }

      const budgetCheck = await checkBudget(userId, spell.priceAmountCents, tx);

      if (!budgetCheck.allowed) {
        return {
          kind: 'error',
          error: {
            status: 402,
            code: 'BUDGET_CAP_EXCEEDED',
            message:
              budgetCheck.reason ??
              'Budget cap exceeded. Please increase your monthly cap to run this spell.',
            details: {
              budget: budgetCheck.budget,
              estimated_cost_cents: spell.priceAmountCents,
            },
            headers: {
              'Retry-After': budgetCheck.retryAfter ? budgetCheck.retryAfter.toString() : '86400',
            },
          },
        };
      }

      const cast = await tx.cast.create({
        data: {
          spellId: spell.id,
          casterId: userId,
          status: 'queued',
          costCents: spell.priceAmountCents,
          inputHash,
        },
        select: {
          id: true,
          status: true,
          costCents: true,
          createdAt: true,
        },
      });

      await tx.spell.update({
        where: { id: spell.id },
        data: {
          totalCasts: { increment: 1 },
        },
      });

      return {
        kind: 'success',
        cast,
        spell: {
          id: spell.id,
          key: spell.key,
          name: spell.name,
          executionMode: spell.executionMode,
          priceAmountCents: spell.priceAmountCents,
        },
      };
    });

    if (transactionResult.kind === 'replay') {
      return new Response(JSON.stringify(transactionResult.replay.body), {
        status: transactionResult.replay.status,
        headers: { 'Content-Type': 'application/json' },
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

    // Execute spell using execution router
    // The router will determine whether to use WASM or GitHub Actions
    try {
      const executionResult = await executeSpell(spell.id, cast.id, {
        input,
        allowFallback: true, // Allow fallback to GitHub Actions if WASM fails
      });

      // Update cast with execution results
      if (executionResult.success) {
        await prisma.cast.update({
          where: { id: cast.id },
          data: {
            status: executionResult.engine === 'wasm' ? 'completed' : 'running',
            costCents: executionResult.costCents,
            duration: executionResult.executionTimeMs,
            ...(executionResult.engine === 'wasm'
              ? {
                  finishedAt: new Date(),
                }
              : {
                  startedAt: new Date(),
                }),
          },
        });
      } else {
        await prisma.cast.update({
          where: { id: cast.id },
          data: {
            status: 'failed',
            errorMessage: executionResult.error || 'Unknown error',
            finishedAt: new Date(),
            costCents: executionResult.costCents,
          },
        });

        const responseBody = {
          error: {
            code: 'INTERNAL' as ApiErrorCode,
            message: executionResult.error || 'Failed to execute spell',
          },
        };

        await persistIdempotencySafe({
          key: idempotencyKey,
          endpoint: IDEMPOTENCY_ENDPOINT,
          scope: userId,
          responseStatus: 500,
          responseBody,
        });

        return new Response(JSON.stringify(responseBody), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error: unknown) {
      console.error('Spell execution error:', error);

      await prisma.cast.update({
        where: { id: cast.id },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          finishedAt: new Date(),
        },
      });

      const responseBody = {
        error: {
          code: 'INTERNAL' as ApiErrorCode,
          message: 'Failed to execute spell',
        },
      };

      await persistIdempotencySafe({
        key: idempotencyKey,
        endpoint: IDEMPOTENCY_ENDPOINT,
        scope: userId,
        responseStatus: 500,
        responseBody,
      });

      return new Response(JSON.stringify(responseBody), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
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
