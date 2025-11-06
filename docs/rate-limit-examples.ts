/**
 * Rate Limiting Configuration Examples
 *
 * This file contains examples of different rate limiting configurations.
 * Copy and adapt these examples to your needs.
 */

import {
  RateLimiter,
  MemoryStorage,
  RateLimitTier,
  RATE_LIMIT_TIERS,
  type RateLimitConfig,
} from '@/lib/rate-limit';

// =============================================================================
// Example 1: Basic In-Memory Rate Limiter (Default)
// =============================================================================
// Best for: Development, single-instance deployments
// =============================================================================

export const basicRateLimiter = new RateLimiter({
  interval: 60000, // 1 minute
  algorithm: 'sliding-window',
  storage: new MemoryStorage(),
});

// Usage in route handler:
// const result = await basicRateLimiter.check(100, 'user:123');
// if (!result.success) {
//   return new Response('Rate limited', { status: 429 });
// }

// =============================================================================
// Example 2: Fixed Window Rate Limiter (Lower Memory)
// =============================================================================
// Best for: High-traffic endpoints where memory is a concern
// =============================================================================

export const fixedWindowRateLimiter = new RateLimiter({
  interval: 60000,
  algorithm: 'fixed-window',
  storage: new MemoryStorage(),
});

// =============================================================================
// Example 3: Custom Time Windows
// =============================================================================
// Different time windows for different use cases
// =============================================================================

// Short burst protection (10 seconds)
export const burstProtectionLimiter = new RateLimiter({
  interval: 10000, // 10 seconds
  algorithm: 'sliding-window',
});

// Hourly rate limit
export const hourlyRateLimiter = new RateLimiter({
  interval: 3600000, // 1 hour
  algorithm: 'sliding-window',
});

// Daily rate limit
export const dailyRateLimiter = new RateLimiter({
  interval: 86400000, // 24 hours
  algorithm: 'fixed-window',
});

// =============================================================================
// Example 4: Multi-Tier Rate Limiting
// =============================================================================
// Apply different limits based on user tier
// =============================================================================

export class TieredRateLimiter {
  private limiter: RateLimiter;

  constructor(config?: RateLimitConfig) {
    this.limiter = new RateLimiter(config);
  }

  async checkForTier(tier: RateLimitTier, identifier: string) {
    const limit = RATE_LIMIT_TIERS[tier];
    return this.limiter.check(limit, identifier);
  }
}

// Usage:
// const tieredLimiter = new TieredRateLimiter();
// const result = await tieredLimiter.checkForTier(
//   RateLimitTier.AUTHENTICATED,
//   'user:123'
// );

// =============================================================================
// Example 5: Composite Rate Limiting (Multiple Windows)
// =============================================================================
// Check against multiple rate limits (e.g., per-second AND per-minute)
// =============================================================================

export class CompositeRateLimiter {
  private shortTermLimiter: RateLimiter;
  private longTermLimiter: RateLimiter;

  constructor() {
    // 10 requests per second
    this.shortTermLimiter = new RateLimiter({
      interval: 1000,
      algorithm: 'sliding-window',
    });

    // 100 requests per minute
    this.longTermLimiter = new RateLimiter({
      interval: 60000,
      algorithm: 'sliding-window',
    });
  }

  async check(identifier: string) {
    // Check short-term limit
    const shortResult = await this.shortTermLimiter.check(10, identifier);
    if (!shortResult.success) {
      return {
        ...shortResult,
        reason: 'Too many requests per second',
      };
    }

    // Check long-term limit
    const longResult = await this.longTermLimiter.check(100, identifier);
    if (!longResult.success) {
      return {
        ...longResult,
        reason: 'Too many requests per minute',
      };
    }

    return {
      success: true,
      limit: longResult.limit,
      remaining: Math.min(shortResult.remaining, longResult.remaining),
      reset: longResult.reset,
    };
  }
}

// =============================================================================
// Example 6: Per-Endpoint Rate Limiting
// =============================================================================
// Different limits for different endpoints
// =============================================================================

export class EndpointRateLimiter {
  private limiters = new Map<string, RateLimiter>();

  private getOrCreateLimiter(endpoint: string, limit: number): RateLimiter {
    if (!this.limiters.has(endpoint)) {
      this.limiters.set(
        endpoint,
        new RateLimiter({
          interval: 60000,
          algorithm: 'sliding-window',
        })
      );
    }
    return this.limiters.get(endpoint)!;
  }

  async check(endpoint: string, identifier: string, limit: number) {
    const limiter = this.getOrCreateLimiter(endpoint, limit);
    return limiter.check(limit, `${endpoint}:${identifier}`);
  }
}

// Usage:
// const endpointLimiter = new EndpointRateLimiter();
//
// // Different limits for different endpoints
// await endpointLimiter.check('/api/v1/cast', 'user:123', 60);
// await endpointLimiter.check('/api/v1/spells', 'user:123', 100);

// =============================================================================
// Example 7: Cost-Based Rate Limiting
// =============================================================================
// Rate limit based on request "cost" instead of count
// =============================================================================

export class CostBasedRateLimiter {
  private limiter: RateLimiter;
  private costs = new Map<string, number>();

  constructor() {
    this.limiter = new RateLimiter({
      interval: 60000,
      algorithm: 'sliding-window',
    });
  }

  async checkCost(identifier: string, cost: number, maxCost: number) {
    const currentCost = this.costs.get(identifier) || 0;

    if (currentCost + cost > maxCost) {
      return {
        success: false,
        limit: maxCost,
        remaining: 0,
        reset: Date.now() + 60000,
        currentCost,
      };
    }

    // Update cost
    this.costs.set(identifier, currentCost + cost);

    // Clean up old costs after interval
    setTimeout(() => {
      this.costs.delete(identifier);
    }, 60000);

    return {
      success: true,
      limit: maxCost,
      remaining: maxCost - (currentCost + cost),
      reset: Date.now() + 60000,
      currentCost: currentCost + cost,
    };
  }
}

// Usage:
// const costLimiter = new CostBasedRateLimiter();
//
// // Expensive operation costs 10 credits
// const result = await costLimiter.checkCost('user:123', 10, 100);
//
// // Cheap operation costs 1 credit
// const result2 = await costLimiter.checkCost('user:123', 1, 100);

// =============================================================================
// Example 8: Redis Storage (Production)
// =============================================================================
// For distributed deployments with multiple server instances
// =============================================================================

/*
// First, install Redis client:
// pnpm add ioredis

import Redis from 'ioredis';
import type { RateLimitStorage } from '@/lib/rate-limit';

export class RedisStorage implements RateLimitStorage {
  private client: Redis;

  constructor(redisUrl?: string) {
    this.client = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async get(key: string): Promise<number[]> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : [];
  }

  async set(key: string, value: number[], ttl = 60000): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'PX', ttl);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

// Usage:
export const productionRateLimiter = new RateLimiter({
  interval: 60000,
  algorithm: 'sliding-window',
  storage: new RedisStorage(),
});
*/

// =============================================================================
// Example 9: Graceful Degradation
// =============================================================================
// Rate limiter that fails open if storage is unavailable
// =============================================================================

export class GracefulRateLimiter {
  private limiter: RateLimiter;

  constructor(config?: RateLimitConfig) {
    this.limiter = new RateLimiter(config);
  }

  async check(limit: number, identifier: string) {
    try {
      return await this.limiter.check(limit, identifier);
    } catch (error) {
      console.error('Rate limiter error, failing open:', error);

      // Allow request but log the failure
      return {
        success: true,
        limit,
        remaining: limit,
        reset: Date.now() + 60000,
      };
    }
  }
}

// =============================================================================
// Example 10: Dynamic Rate Limits
// =============================================================================
// Adjust rate limits based on system load or user behavior
// =============================================================================

export class DynamicRateLimiter {
  private limiter: RateLimiter;
  private baseLimits: Record<RateLimitTier, number>;
  private multiplier = 1.0;

  constructor() {
    this.limiter = new RateLimiter({
      interval: 60000,
      algorithm: 'sliding-window',
    });
    this.baseLimits = { ...RATE_LIMIT_TIERS };
  }

  // Adjust limits based on system load
  setLoadMultiplier(multiplier: number) {
    this.multiplier = Math.max(0.1, Math.min(2.0, multiplier));
  }

  async check(tier: RateLimitTier, identifier: string) {
    const baseLimit = this.baseLimits[tier];
    const adjustedLimit = Math.floor(baseLimit * this.multiplier);
    return this.limiter.check(adjustedLimit, identifier);
  }

  // Call this periodically based on metrics
  adjustForLoad(cpuUsage: number, memoryUsage: number) {
    if (cpuUsage > 80 || memoryUsage > 80) {
      this.setLoadMultiplier(0.5); // Reduce limits by 50%
    } else if (cpuUsage < 30 && memoryUsage < 30) {
      this.setLoadMultiplier(1.5); // Increase limits by 50%
    } else {
      this.setLoadMultiplier(1.0); // Normal limits
    }
  }
}

// =============================================================================
// Example 11: IP-Based + User-Based Rate Limiting
// =============================================================================
// Check both IP and user limits
// =============================================================================

export class DualRateLimiter {
  private ipLimiter: RateLimiter;
  private userLimiter: RateLimiter;

  constructor() {
    // Stricter limits per IP
    this.ipLimiter = new RateLimiter({
      interval: 60000,
      algorithm: 'sliding-window',
    });

    // More generous limits per user
    this.userLimiter = new RateLimiter({
      interval: 60000,
      algorithm: 'sliding-window',
    });
  }

  async check(ip: string, userId?: string) {
    // Always check IP limit
    const ipResult = await this.ipLimiter.check(50, `ip:${ip}`);
    if (!ipResult.success) {
      return {
        ...ipResult,
        reason: 'IP rate limit exceeded',
      };
    }

    // If authenticated, also check user limit
    if (userId) {
      const userResult = await this.userLimiter.check(200, `user:${userId}`);
      if (!userResult.success) {
        return {
          ...userResult,
          reason: 'User rate limit exceeded',
        };
      }
      return userResult;
    }

    return ipResult;
  }
}

// =============================================================================
// Export all examples
// =============================================================================

export const examples = {
  basic: basicRateLimiter,
  fixedWindow: fixedWindowRateLimiter,
  burst: burstProtectionLimiter,
  hourly: hourlyRateLimiter,
  daily: dailyRateLimiter,
};
