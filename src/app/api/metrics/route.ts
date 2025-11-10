// Metrics Endpoint - TKT-024
// SPEC Reference: Section 13 (Webhooks & Monitoring)

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { ErrorCatalog, handleError, apiSuccess } from '@/lib/api-response';
import { createRequestLogger } from '@/lib/logger';

interface SystemMetrics {
  timestamp: string;
  platform: {
    totalUsers: number;
    totalSpells: number;
    totalCasts: number;
    totalApiKeys: number;
  };
  casts: {
    byStatus: {
      queued: number;
      running: number;
      succeeded: number;
      failed: number;
    };
    last24h: number;
    last7d: number;
  };
  revenue: {
    totalCents: number;
    last24hCents: number;
    last7dCents: number;
  };
  performance: {
    avgCastDurationMs: number | null;
    avgCostCents: number | null;
  };
}

// GET /api/metrics - Platform metrics (admin only)
export async function GET(_req: NextRequest) {
  const requestLogger = createRequestLogger(randomUUID(), '/api/metrics', 'GET');

  try {
    const session = await auth();

    // Check if user is authenticated and has admin/operator role
    if (!session?.user) {
      requestLogger.warn('Unauthorized metrics access attempt');
      throw ErrorCatalog.UNAUTHORIZED();
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || (user.role !== 'operator' && user.role !== 'maker')) {
      requestLogger.warn('Forbidden metrics access attempt', {
        userId: session.user.id,
        role: user?.role,
      });
      throw ErrorCatalog.FORBIDDEN();
    }

    requestLogger.info('Fetching platform metrics', {
      userId: session.user.id,
      role: user.role,
    });

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch all metrics in parallel
    const [
      totalUsers,
      totalSpells,
      totalCasts,
      totalApiKeys,
      castsByStatus,
      castsLast24h,
      castsLast7d,
      revenueLast24h,
      revenueLast7d,
      totalRevenue,
      performanceStats,
    ] = await Promise.all([
      prisma.user.count({ where: { status: 'active' } }),
      prisma.spell.count(),
      prisma.cast.count(),
      prisma.api_keys.count({ where: { revokedAt: null } }),

      // Casts by status
      prisma.cast.groupBy({
        by: ['status'],
        _count: true,
      }),

      // Casts in last 24h
      prisma.cast.count({
        where: { createdAt: { gte: last24h } },
      }),

      // Casts in last 7d
      prisma.cast.count({
        where: { createdAt: { gte: last7d } },
      }),

      // Revenue last 24h
      prisma.cast.aggregate({
        _sum: { costCents: true },
        where: { createdAt: { gte: last24h } },
      }),

      // Revenue last 7d
      prisma.cast.aggregate({
        _sum: { costCents: true },
        where: { createdAt: { gte: last7d } },
      }),

      // Total revenue
      prisma.cast.aggregate({
        _sum: { costCents: true },
      }),

      // Performance stats
      prisma.cast.aggregate({
        _avg: {
          durationMs: true,
          costCents: true,
        },
        where: { status: 'succeeded' },
      }),
    ]);

    const metrics: SystemMetrics = {
      timestamp: now.toISOString(),
      platform: {
        totalUsers,
        totalSpells,
        totalCasts,
        totalApiKeys,
      },
      casts: {
        byStatus: {
          queued: 0,
          running: 0,
          succeeded: 0,
          failed: 0,
        },
        last24h: castsLast24h,
        last7d: castsLast7d,
      },
      revenue: {
        totalCents: totalRevenue._sum.costCents || 0,
        last24hCents: revenueLast24h._sum.costCents || 0,
        last7dCents: revenueLast7d._sum.costCents || 0,
      },
      performance: {
        avgCastDurationMs: performanceStats._avg.durationMs,
        avgCostCents: performanceStats._avg.costCents,
      },
    };

    // Map cast status counts
    for (const group of castsByStatus) {
      const status = group.status as keyof typeof metrics.casts.byStatus;
      if (status in metrics.casts.byStatus) {
        metrics.casts.byStatus[status] = group._count;
      }
    }

    requestLogger.info('Metrics fetched successfully', {
      userId: session.user.id,
    });

    return apiSuccess(metrics);
  } catch (error) {
    requestLogger.error('Failed to fetch metrics', error as Error, {
      userId: (await auth())?.user?.id,
    });
    return handleError(error);
  }
}
