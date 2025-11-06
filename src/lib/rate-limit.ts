import { NextRequest, NextResponse } from 'next/server';
import { apiError } from './api-response';

/**
 * Storage interface for rate limit data
 * Allows for different storage backends (in-memory, Redis, etc.)
 */
export interface RateLimitStorage {
  /**
   * Get the current usage for a token
   * @returns Array of timestamps representing request times
   */
  get(key: string): Promise<number[]> | number[];

  /**
   * Set the usage data for a token
   */
  set(key: string, value: number[], ttl?: number): Promise<void> | void;

  /**
   * Delete a key from storage
   */
  delete(key: string): Promise<void> | void;
}

/**
 * In-memory storage implementation
 * Good for single-instance deployments or development
 */
class MemoryStorage implements RateLimitStorage {
  private store = new Map<string, { data: number[]; expiresAt: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get(key: string): number[] {
    const entry = this.store.get(key);
    if (!entry) return [];
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return [];
    }
    return entry.data;
  }

  set(key: string, value: number[], ttl = 60000): void {
    this.store.set(key, {
      data: value,
      expiresAt: Date.now() + ttl,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

/**
 * Redis storage implementation (placeholder for future implementation)
 * Good for multi-instance deployments
 */
class RedisStorage implements RateLimitStorage {
  private client: unknown; // Redis client type

  constructor(client?: unknown) {
    this.client = client;
    if (!client) {
      throw new Error('Redis client is required for RedisStorage');
    }
  }

  async get(key: string): Promise<number[]> {
    // TODO: Implement Redis get
    // const value = await this.client.get(key);
    // return value ? JSON.parse(value) : [];
    return [];
  }

  async set(key: string, value: number[], ttl = 60000): Promise<void> {
    // TODO: Implement Redis set with TTL
    // await this.client.set(key, JSON.stringify(value), 'PX', ttl);
  }

  async delete(key: string): Promise<void> {
    // TODO: Implement Redis delete
    // await this.client.del(key);
  }
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of unique tokens to track (LRU eviction)
   * @default 500
   */
  uniqueTokenPerInterval?: number;

  /**
   * Time window in milliseconds
   * @default 60000 (1 minute)
   */
  interval?: number;

  /**
   * Storage backend to use
   * @default new MemoryStorage()
   */
  storage?: RateLimitStorage;

  /**
   * Algorithm to use for rate limiting
   * - 'fixed-window': Simple fixed time window
   * - 'sliding-window': More accurate sliding window (recommended)
   * @default 'sliding-window'
   */
  algorithm?: 'fixed-window' | 'sliding-window';
}

/**
 * Rate limit tier definitions
 */
export enum RateLimitTier {
  ANONYMOUS = 'anonymous',
  AUTHENTICATED = 'authenticated',
  API_KEY = 'api_key',
  ADMIN = 'admin',
  WEBHOOK = 'webhook',
}

/**
 * Rate limit tier configurations
 * Requests per minute for each tier
 */
export const RATE_LIMIT_TIERS: Record<RateLimitTier, number> = {
  [RateLimitTier.ANONYMOUS]: 20,
  [RateLimitTier.AUTHENTICATED]: 100,
  [RateLimitTier.API_KEY]: 60,
  [RateLimitTier.ADMIN]: 500,
  [RateLimitTier.WEBHOOK]: 1000,
};

/**
 * Rate limiter with support for multiple algorithms and storage backends
 */
export class RateLimiter {
  private interval: number;
  private storage: RateLimitStorage;
  private algorithm: 'fixed-window' | 'sliding-window';

  constructor(config: RateLimitConfig = {}) {
    this.interval = config.interval || 60000; // 1 minute default
    this.storage = config.storage || new MemoryStorage();
    this.algorithm = config.algorithm || 'sliding-window';
  }

  /**
   * Check if a request should be rate limited
   * @param limit - Maximum number of requests allowed
   * @param token - Unique identifier for the rate limit (e.g., user ID, IP address)
   * @returns Rate limit result
   */
  async check(limit: number, token: string): Promise<RateLimitResult> {
    const now = Date.now();
    const key = `ratelimit:${token}`;

    if (this.algorithm === 'sliding-window') {
      return this.checkSlidingWindow(limit, key, now);
    } else {
      return this.checkFixedWindow(limit, key, now);
    }
  }

  /**
   * Sliding window rate limiting
   * More accurate as it tracks individual request timestamps
   */
  private async checkSlidingWindow(
    limit: number,
    key: string,
    now: number
  ): Promise<RateLimitResult> {
    const timestamps = await this.storage.get(key);
    const windowStart = now - this.interval;

    // Filter out timestamps outside the current window
    const validTimestamps = timestamps.filter((ts) => ts > windowStart);

    // Calculate reset time (when the oldest request will expire)
    const reset = validTimestamps.length > 0 ? validTimestamps[0] + this.interval : now + this.interval;

    if (validTimestamps.length >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset,
      };
    }

    // Add current timestamp and save
    validTimestamps.push(now);
    await this.storage.set(key, validTimestamps, this.interval);

    return {
      success: true,
      limit,
      remaining: limit - validTimestamps.length,
      reset,
    };
  }

  /**
   * Fixed window rate limiting
   * Simpler but can allow bursts at window boundaries
   */
  private async checkFixedWindow(
    limit: number,
    key: string,
    now: number
  ): Promise<RateLimitResult> {
    const timestamps = await this.storage.get(key);
    const resetAt = timestamps.length > 0 ? timestamps[0] : now + this.interval;

    // Check if window has expired
    if (timestamps.length === 0 || now > resetAt) {
      await this.storage.set(key, [now + this.interval, 1], this.interval);
      return {
        success: true,
        limit,
        remaining: limit - 1,
        reset: now + this.interval,
      };
    }

    const count = (timestamps[1] as number) || 0;

    if (count >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: resetAt,
      };
    }

    // Increment count
    await this.storage.set(key, [resetAt, count + 1], resetAt - now);

    return {
      success: true,
      limit,
      remaining: limit - count - 1,
      reset: resetAt,
    };
  }
}

/**
 * Get rate limit identifier from request
 * Priority: API Key > Session User ID > IP Address
 */
export function getRateLimitIdentifier(req: NextRequest, auth?: { user?: { id?: string } }): {
  identifier: string;
  tier: RateLimitTier;
} {
  // Check for API key in Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7);
    return {
      identifier: `api:${apiKey}`,
      tier: RateLimitTier.API_KEY,
    };
  }

  // Check for API key in x-api-key header (legacy)
  const apiKeyHeader = req.headers.get('x-api-key');
  if (apiKeyHeader) {
    return {
      identifier: `api:${apiKeyHeader}`,
      tier: RateLimitTier.API_KEY,
    };
  }

  // Check for authenticated session
  if (auth?.user?.id) {
    return {
      identifier: `user:${auth.user.id}`,
      tier: RateLimitTier.AUTHENTICATED,
    };
  }

  // Fall back to IP address for anonymous users
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  return {
    identifier: `ip:${ip}`,
    tier: RateLimitTier.ANONYMOUS,
  };
}

/**
 * Check if a route should be exempt from rate limiting
 */
export function isRateLimitExempt(pathname: string): boolean {
  const exemptPatterns = [
    // Static assets
    /^\/_next\//,
    /^\/static\//,
    /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|woff|woff2|ttf)$/,
    // Health checks
    /^\/api\/health$/,
    /^\/health$/,
    // Webhooks (they have their own rate limits or are trusted)
    /^\/api\/webhooks\//,
  ];

  return exemptPatterns.some((pattern) => pattern.test(pathname));
}

/**
 * Apply rate limit headers to a response
 */
export function applyRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  const resetIso = new Date(result.reset).toISOString();
  const retryAfterSeconds = Math.ceil((result.reset - Date.now()) / 1000);

  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', resetIso);

  if (!result.success) {
    response.headers.set('Retry-After', retryAfterSeconds.toString());
  }

  return response;
}

/**
 * Legacy middleware function for backward compatibility
 * @deprecated Use the new global rate limiting middleware instead
 */
export async function rateLimitMiddleware(
  req: NextRequest,
  limit: number = 100,
  interval: number = 60000
): Promise<NextResponse | null> {
  const identifier =
    req.headers.get('x-api-key') ||
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'anonymous';

  const rateLimiter = new RateLimiter({ interval });
  const result = await rateLimiter.check(limit, identifier);

  if (!result.success) {
    const resetIso = new Date(result.reset).toISOString();
    const retryAfterSeconds = Math.ceil((result.reset - Date.now()) / 1000);
    const response = apiError('RATE_LIMITED', 429, 'Rate limit exceeded', {
      limit: result.limit,
      reset: resetIso,
      retry_after: retryAfterSeconds,
    });
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', resetIso);
    response.headers.set('Retry-After', retryAfterSeconds.toString());
    return response;
  }

  return null;
}

// Export storage implementations for advanced usage
export { MemoryStorage, RedisStorage };
