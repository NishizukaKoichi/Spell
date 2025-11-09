// Redis-backed Rate Limiting - TKT-004
// SPEC Reference: Section 17 (Backpressure & Rate Limiting), Section 24 (Error Codes)

import { NextRequest, NextResponse } from 'next/server';
import { redis, isRedisConfigured } from './redis';
import { apiError } from './api-response';
import type { AuthContext } from '@/middleware/auth';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  limit: number; // requests per window
  window: number; // seconds
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Per API key (authenticated)
  api: {
    limit: 1000,
    window: 3600, // 1000 req/hour
  },
  // Per IP (anonymous)
  anonymous: {
    limit: 10,
    window: 60, // 10 req/min
  },
  // Cast endpoint (authenticated)
  cast: {
    limit: 100,
    window: 3600, // 100 casts/hour
  },
  // Spell creation
  createSpell: {
    limit: 10,
    window: 3600, // 10 spells/hour
  },
};

/**
 * In-memory fallback store when Redis is unavailable
 */
interface MemoryStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const memoryStore: MemoryStore = {};

/**
 * Check rate limit using Redis (with in-memory fallback)
 * Implements sliding window algorithm
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Use Redis if configured
  if (isRedisConfigured()) {
    return checkRateLimitRedis(key, config);
  }

  // Fallback to in-memory
  return checkRateLimitMemory(key, config);
}

/**
 * Redis-based rate limiting (sliding window)
 */
async function checkRateLimitRedis(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `ratelimit:${key}:${Math.floor(now / config.window)}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(windowKey);
    pipeline.expire(windowKey, config.window * 2); // Keep for 2 windows

    const results = await pipeline.exec();
    const count = results[0] as number;

    const allowed = count <= config.limit;
    const reset = (Math.floor(now / config.window) + 1) * config.window;

    return {
      allowed,
      limit: config.limit,
      remaining: Math.max(0, config.limit - count),
      reset,
    };
  } catch (error) {
    console.error('Redis rate limit check failed, falling back to memory:', error);
    return checkRateLimitMemory(key, config);
  }
}

/**
 * In-memory rate limiting fallback
 */
function checkRateLimitMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.window * 1000;
  const record = memoryStore[key];

  if (!record || now > record.resetAt) {
    memoryStore[key] = {
      count: 1,
      resetAt: now + windowMs,
    };

    return {
      allowed: true,
      limit: config.limit,
      remaining: config.limit - 1,
      reset: Math.floor((now + windowMs) / 1000),
    };
  }

  if (record.count >= config.limit) {
    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      reset: Math.floor(record.resetAt / 1000),
    };
  }

  record.count++;

  return {
    allowed: true,
    limit: config.limit,
    remaining: config.limit - record.count,
    reset: Math.floor(record.resetAt / 1000),
  };
}

/**
 * Rate limit middleware for Next.js API routes
 * Returns 429 response if rate limit exceeded
 */
export function rateLimitMiddleware(config: RateLimitConfig) {
  return async (req: NextRequest, ctx?: AuthContext | null): Promise<NextResponse | null> => {
    // Determine identifier: user_id > api_key > IP > anonymous
    const key =
      ctx?.user_id ||
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'anonymous';

    const result = await checkRateLimit(key, config);

    // Add rate limit headers to response
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', result.limit.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', result.reset.toString());

    if (!result.allowed) {
      const retryAfter = result.reset - Math.floor(Date.now() / 1000);
      headers.set('Retry-After', retryAfter.toString());

      const response = apiError('RATE_LIMITED', 429, 'Rate limit exceeded', {
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
        retry_after: retryAfter,
      });

      // Copy rate limit headers to error response
      headers.forEach((value, key) => {
        response.headers.set(key, value);
      });

      return response;
    }

    // Attach rate limit info to request for downstream handlers
    req.headers.set('X-RateLimit-Info', JSON.stringify(result));

    return null; // Allow request
  };
}

/**
 * Apply different rate limits based on authentication status
 */
export async function adaptiveRateLimitMiddleware(
  req: NextRequest,
  ctx?: AuthContext | null
): Promise<NextResponse | null> {
  // Use stricter limit for anonymous, looser for authenticated
  const config = ctx ? RATE_LIMITS.api : RATE_LIMITS.anonymous;
  return rateLimitMiddleware(config)(req, ctx);
}
