// Idempotency Key Management - TKT-005
// SPEC Reference: Section 6 (Idempotency), Section 24 (Error Codes)

import crypto from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { redis, isRedisConfigured } from '@/lib/redis';

type IdempotencyScope = string;

/**
 * Redis cache TTL for idempotency results (24 hours)
 */
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

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

/**
 * Generate Redis cache key for idempotency
 */
function getRedisKey(key: string, endpoint: string, scope: string): string {
  return `idempotency:${scope}:${endpoint}:${key}`;
}

/**
 * Check Redis cache for idempotency result
 */
async function checkRedisCache(
  key: string,
  endpoint: string,
  scope: string
): Promise<IdempotencyReplay | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  try {
    const redisKey = getRedisKey(key, endpoint, scope);
    const cached = await redis.get(redisKey);

    if (cached && typeof cached === 'object' && 'status' in cached && 'body' in cached) {
      return cached as IdempotencyReplay;
    }

    return null;
  } catch (error) {
    console.error('Redis cache check failed:', error);
    return null;
  }
}

/**
 * Store idempotency result in Redis cache
 */
async function storeRedisCache(
  key: string,
  endpoint: string,
  scope: string,
  replay: IdempotencyReplay
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    const redisKey = getRedisKey(key, endpoint, scope);
    await redis.setex(redisKey, IDEMPOTENCY_TTL_SECONDS, replay);
  } catch (error) {
    console.error('Redis cache store failed:', error);
  }
}

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

  // Check Redis cache first for fast path
  const cachedReplay = await checkRedisCache(params.key, params.endpoint, params.scope);
  if (cachedReplay) {
    return { state: 'replay', replay: cachedReplay };
  }

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
        const replay = {
          status: existing.responseStatus,
          body: existing.responseBody,
        };

        // Cache in Redis for future requests
        await storeRedisCache(params.key, params.endpoint, params.scope, replay);

        return { state: 'replay', replay };
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
  // Only cache successful responses (2xx status codes)
  const shouldCache = params.responseStatus >= 200 && params.responseStatus < 300;

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

  // Store in Redis cache if successful
  if (shouldCache) {
    await storeRedisCache(params.key, params.endpoint, params.scope, {
      status: params.responseStatus,
      body: params.responseBody,
    });
  }
}
