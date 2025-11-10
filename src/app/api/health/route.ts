// Health Check Endpoint - TKT-023
// SPEC Reference: Section 13 (Webhooks & Monitoring)

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { handleError, apiSuccess } from '@/lib/api-response';
import { createRequestLogger } from '@/lib/logger';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: 'pass' | 'fail';
      responseTime?: number;
      error?: string;
    };
    redis?: {
      status: 'pass' | 'fail';
      responseTime?: number;
      error?: string;
    };
  };
}

// GET /api/health - Basic health check
export async function GET(_req: NextRequest) {
  const requestLogger = createRequestLogger(randomUUID(), '/api/health', 'GET');

  try {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: {
          status: 'pass',
        },
      },
    };

    // Database health check
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      result.checks.database.responseTime = Date.now() - dbStart;

      if (result.checks.database.responseTime > 1000) {
        result.status = 'degraded';
        requestLogger.warn('Database response time is slow', {
          responseTime: result.checks.database.responseTime,
        });
      }
    } catch (error) {
      result.checks.database.status = 'fail';
      result.checks.database.error = error instanceof Error ? error.message : 'Unknown error';
      result.status = 'unhealthy';
      requestLogger.error('Database health check failed', error as Error);
    }

    // Redis health check (if configured)
    if (process.env.UPSTASH_REDIS_REST_URL) {
      result.checks.redis = { status: 'pass' };

      try {
        const { redis } = await import('@/lib/redis');
        const redisStart = Date.now();
        await redis.ping();
        result.checks.redis.responseTime = Date.now() - redisStart;

        if (result.checks.redis.responseTime > 1000) {
          result.status = result.status === 'healthy' ? 'degraded' : result.status;
          requestLogger.warn('Redis response time is slow', {
            responseTime: result.checks.redis.responseTime,
          });
        }
      } catch (error) {
        result.checks.redis.status = 'fail';
        result.checks.redis.error = error instanceof Error ? error.message : 'Unknown error';
        result.status = 'unhealthy';
        requestLogger.error('Redis health check failed', error as Error);
      }
    }

    const totalTime = Date.now() - startTime;
    requestLogger.info('Health check completed', {
      status: result.status,
      totalTime,
    });

    // Return appropriate HTTP status based on health
    const httpStatus = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;

    return apiSuccess(result, httpStatus);
  } catch (error) {
    requestLogger.error('Health check error', error as Error);
    return handleError(error);
  }
}
