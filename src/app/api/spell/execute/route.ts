import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

import { createRequestLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  ensureBuiltinSpellRecords,
  executeSpell,
  SpellNotFoundError,
  SpellDefinition,
} from '@/core/spell';

function parseJsonBody(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
}

async function logExecution(params: {
  userId: string;
  spell: SpellDefinition;
  status: 'succeeded' | 'failed';
  costCents: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorMessage?: string;
}) {
  await prisma.spellExecutionLog.create({
    data: {
      userId: params.userId,
      spellKey: params.spell.key,
      spellVersion: params.spell.version,
      costCents: params.costCents,
      status: params.status,
      input: params.input as unknown as Prisma.InputJsonValue,
      output: params.output as unknown as Prisma.InputJsonValue | undefined,
      errorMessage: params.errorMessage,
    },
  });
}

export async function POST(req: NextRequest) {
  const requestLogger = createRequestLogger(randomUUID(), '/api/spell/execute', 'POST');

  let body: Record<string, unknown> | null = null;
  try {
    const rawBody = await req.json();
    body = parseJsonBody(rawBody);
  } catch (error) {
    requestLogger.error(
      'Invalid JSON payload for spell execute',
      error instanceof Error ? error : undefined
    );
    return Response.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    );
  }

  const spellId = typeof body.spell_id === 'string' ? body.spell_id : undefined;
  if (!spellId) {
    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: '`spell_id` is required.' } },
      { status: 422 }
    );
  }

  const inputs = parseJsonBody(body.inputs ?? {});
  const userId = req.headers.get('x-user-id') ?? 'anonymous-user';

  await ensureBuiltinSpellRecords();

  let spellDefinition: SpellDefinition | null = null;
  try {
    const execution = await executeSpell(spellId, inputs, { userId });
    spellDefinition = execution.definition;

    await logExecution({
      userId,
      spell: execution.definition,
      status: 'succeeded',
      costCents: execution.definition.priceCents,
      input: inputs,
      output: execution.result.output,
    });

    requestLogger.info('Spell executed successfully', {
      spell: execution.definition.key,
      userId,
      costCents: execution.definition.priceCents,
    });

    return Response.json(
      {
        spell_id: execution.definition.key,
        status: 'succeeded',
        cost_cents: execution.definition.priceCents,
        result: execution.result.output,
      },
      { status: 200 }
    );
  } catch (error) {
    if (spellDefinition) {
      await logExecution({
        userId,
        spell: spellDefinition,
        status: 'failed',
        costCents: spellDefinition.priceCents,
        input: inputs,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    if (error instanceof SpellNotFoundError) {
      requestLogger.warn('Spell not found for execution', { spellId });
      return Response.json(
        { error: { code: 'SPELL_NOT_FOUND', message: error.message } },
        { status: 404 }
      );
    }

    requestLogger.error('Spell execution failed', error instanceof Error ? error : undefined);
    return Response.json(
      { error: { code: 'INTERNAL', message: 'Failed to execute spell.' } },
      { status: 500 }
    );
  }
}
