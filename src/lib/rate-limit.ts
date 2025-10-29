import { NextRequest, NextResponse } from 'next/server';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

export interface RateLimitConfig {
  uniqueTokenPerInterval?: number;
  interval?: number;
}

export class RateLimiter {
  private tokenCount: number;
  private interval: number;
  private store: RateLimitStore;

  constructor(config: RateLimitConfig = {}) {
    this.tokenCount = config.uniqueTokenPerInterval || 10;
    this.interval = config.interval || 60000; // 1 minute default
    this.store = store;
  }

  check(
    limit: number,
    token: string
  ): {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  } {
    const now = Date.now();
    const record = this.store[token];

    if (!record || now > record.resetAt) {
      this.store[token] = {
        count: 1,
        resetAt: now + this.interval,
      };

      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: now + this.interval,
      };
    }

    if (record.count >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: record.resetAt,
      };
    }

    record.count++;

    return {
      success: true,
      limit,
      remaining: limit - record.count,
      reset: record.resetAt,
    };
  }
}

export async function rateLimitMiddleware(
  req: NextRequest,
  limit: number = 100,
  interval: number = 60000
): Promise<NextResponse | null> {
  // Use IP address or API key as identifier
  const identifier =
    req.headers.get('x-api-key') ||
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'anonymous';

  const rateLimiter = new RateLimiter({
    uniqueTokenPerInterval: 500,
    interval,
  });

  const result = rateLimiter.check(limit, identifier);

  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        limit: result.limit,
        reset: new Date(result.reset).toISOString(),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': new Date(result.reset).toISOString(),
          'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null; // No rate limit error, proceed with request
}
