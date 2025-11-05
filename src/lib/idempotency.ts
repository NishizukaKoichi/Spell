import crypto from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';

type IdempotencyScope = string;

export type IdempotencyReplay = {
  status: number;
  body: unknown;
};

type InitResult =
  | { state: 'proceed'; requestHash: string }
  | { state: 'replay'; replay: IdempotencyReplay }
  | { state: 'pending' };

export class IdempotencyMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdempotencyMismatchError';
  }
}

const IDEMPOTENCY_UNIQUE_CONSTRAINT = 'P2002';

function stableStringify(input: unknown): string {
  const seen = new WeakSet();

  const stringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (seen.has(value as object)) {
      throw new TypeError('Cannot stringify circular structure');
    }

    seen.add(value as object);

    if (Array.isArray(value)) {
      const serialized = value.map((item) => stringify(item)).join(',');
      return `[${serialized}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => typeof v !== 'undefined')
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stringify(v)}`)
      .join(',');

    return `{${entries}}`;
  };

  return stringify(input);
}

export function hashRequestPayload(payload: unknown): string {
  const normalized = stableStringify(payload ?? null);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

export async function initIdempotencyKey(
  params: {
    key: string;
    endpoint: string;
    scope: IdempotencyScope;
    requestPayload: unknown;
  },
  client: PrismaClientOrTransaction = prisma
): Promise<InitResult> {
  const requestHash = hashRequestPayload(params.requestPayload);
  const db = client;

  try {
    await db.idempotencyKey.create({
      data: {
        key: params.key,
        endpoint: params.endpoint,
        scope: params.scope,
        requestHash,
      },
    });

    return { state: 'proceed', requestHash };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === IDEMPOTENCY_UNIQUE_CONSTRAINT
    ) {
      const existing = await db.idempotencyKey.findUnique({
        where: {
          key_endpoint_scope: {
            key: params.key,
            endpoint: params.endpoint,
            scope: params.scope,
          },
        },
      });

      if (!existing) {
        throw error;
      }

      if (existing.requestHash && existing.requestHash !== requestHash) {
        throw new IdempotencyMismatchError('Idempotency-Key reuse with different payload');
      }

      if (existing.responseStatus !== null && existing.responseBody !== null) {
        return {
          state: 'replay',
          replay: {
            status: existing.responseStatus,
            body: existing.responseBody,
          },
        };
      }

      return { state: 'pending' };
    }

    throw error;
  }
}

export async function persistIdempotencyResult(
  params: {
    key: string;
    endpoint: string;
    scope: IdempotencyScope;
    responseStatus: number;
    responseBody: unknown;
  },
  client: PrismaClientOrTransaction = prisma
): Promise<void> {
  await client.idempotencyKey.update({
    where: {
      key_endpoint_scope: {
        key: params.key,
        endpoint: params.endpoint,
        scope: params.scope,
      },
    },
    data: {
      responseStatus: params.responseStatus,
      responseBody: params.responseBody as Prisma.InputJsonValue,
    },
  });
}
