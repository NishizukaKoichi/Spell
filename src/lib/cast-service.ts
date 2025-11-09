import { prisma } from '@/lib/prisma';
import { ApiErrorCode } from '@/lib/api-response';
import { checkBudget } from '@/lib/budget';
import {
  IdempotencyReplay,
  initIdempotencyKey,
} from '@/lib/idempotency';

type ServiceError = {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
  headers?: Record<string, string>;
};

export type CreateCastResult =
  | { kind: 'replay'; replay: IdempotencyReplay }
  | { kind: 'pending' }
  | { kind: 'error'; error: ServiceError }
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

export interface CreateCastParams {
  userId: string;
  spellKey: string;
  rawInput: Record<string, unknown> | undefined;
  serializedInput: string;
  inputHash: string | null;
  idempotencyKey: string;
}

/**
 * Handles the transactional portion of cast creation:
 * - idempotency coordination
 * - spell lookup & validation
 * - budget enforcement
 * - cast record creation
 */
export async function createQueuedCastTransaction(
  params: CreateCastParams
): Promise<CreateCastResult> {
  const { userId, spellKey, rawInput, inputHash, idempotencyKey } = params;

  return prisma.$transaction<CreateCastResult>(async (tx) => {
    const requestPayload = { spell_key: spellKey, input: rawInput };

    const initResult = await initIdempotencyKey(
      {
        key: idempotencyKey,
        endpoint: 'POST /api/v1/cast',
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
      where: { key: spellKey },
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
        inputHash: inputHash ?? '',
        spellKey: spell.key,
        spellVersion: '1',
        idempotencyKey,
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
}
