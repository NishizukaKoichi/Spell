// Redis Client Setup - TKT-004
// SPEC Reference: Section 17 (Backpressure & Rate Limiting)

import { Redis } from '@upstash/redis';

/**
 * Upstash Redis client instance.
 * Uses environment variables for configuration:
 * - UPSTASH_REDIS_URL: Redis REST API URL
 * - UPSTASH_REDIS_TOKEN: Authentication token
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL || '',
  token: process.env.UPSTASH_REDIS_TOKEN || '',
});

/**
 * Check if Redis is configured and available.
 */
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN);
}

/**
 * Health check for Redis connection.
 * Returns true if Redis is reachable, false otherwise.
 */
export async function checkRedisHealth(): Promise<boolean> {
  if (!isRedisConfigured()) {
    return false;
  }

  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}
