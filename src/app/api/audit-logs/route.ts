import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/audit-logs - Fetch audit logs with filtering and pagination
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 50, max: 100)
 * - action: Filter by action type
 * - resource: Filter by resource type
 * - status: Filter by status (success/failure)
 * - startDate: Filter logs from this date (ISO string)
 * - endDate: Filter logs until this date (ISO string)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const action = searchParams.get('action');
    const resource = searchParams.get('resource');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: {
      userId: string;
      action?: string;
      resource?: string;
      status?: string;
      createdAt?: {
        gte?: Date;
        lte?: Date;
      };
    } = {
      userId: session.user.id,
    };

    if (action) {
      where.action = action;
    }

    if (resource) {
      where.resource = resource;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Fetch logs with pagination
    const [logs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          status: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
