import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-response';
import { listArtifacts, deleteAllArtifactsForCast, formatBytes } from '@/lib/storage';
import { logArtifactDeleted, getRequestContext } from '@/lib/audit-log';

/**
 * GET /api/artifacts
 *
 * List user's artifacts with metadata
 *
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 *
 * Authentication: Required
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const skip = (page - 1) * limit;

    // Get user's casts with artifacts
    const [casts, totalCount] = await Promise.all([
      prisma.cast.findMany({
        where: {
          casterId: session.user.id,
          artifactStorageKey: {
            not: null,
          },
        },
        select: {
          id: true,
          status: true,
          artifactUrl: true,
          artifactStorageKey: true,
          artifactSize: true,
          artifactContentType: true,
          createdAt: true,
          finishedAt: true,
          spell: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.cast.count({
        where: {
          casterId: session.user.id,
          artifactStorageKey: {
            not: null,
          },
        },
      }),
    ]);

    // Calculate total storage used
    const totalStorageBytes = await prisma.cast.aggregate({
      where: {
        casterId: session.user.id,
        artifactSize: {
          not: null,
        },
      },
      _sum: {
        artifactSize: true,
      },
    });

    const artifacts = casts.map((cast) => ({
      castId: cast.id,
      spellName: cast.spell.name,
      spellDescription: cast.spell.description,
      status: cast.status,
      artifactUrl: cast.artifactUrl,
      size: cast.artifactSize,
      sizeFormatted: cast.artifactSize ? formatBytes(cast.artifactSize) : null,
      contentType: cast.artifactContentType,
      createdAt: cast.createdAt,
      finishedAt: cast.finishedAt,
    }));

    return apiSuccess({
      artifacts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      storage: {
        totalBytes: totalStorageBytes._sum.artifactSize || 0,
        totalFormatted: formatBytes(totalStorageBytes._sum.artifactSize || 0),
      },
    });
  } catch (error) {
    console.error('[Artifacts List] Error:', error);
    return apiError('INTERNAL', 500, 'Failed to list artifacts');
  }
}

/**
 * DELETE /api/artifacts
 *
 * Delete artifacts for specified casts
 *
 * Body:
 * - castIds: string[] - Array of cast IDs to delete artifacts for
 *
 * Authentication: Required
 * Authorization: User must own the casts
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const body = await request.json();
    const { castIds } = body;

    if (!Array.isArray(castIds) || castIds.length === 0) {
      return apiError('VALIDATION_ERROR', 400, 'castIds array is required');
    }

    // Verify all casts belong to the user
    const casts = await prisma.cast.findMany({
      where: {
        id: {
          in: castIds,
        },
        casterId: session.user.id,
      },
      select: {
        id: true,
        artifactStorageKey: true,
      },
    });

    if (casts.length !== castIds.length) {
      return apiError(
        'FORBIDDEN',
        403,
        'Some casts do not exist or you do not have permission to delete them'
      );
    }

    // Delete artifacts from R2 and update database
    const deletionResults = await Promise.allSettled(
      casts.map(async (cast) => {
        if (!cast.artifactStorageKey) {
          return { castId: cast.id, deleted: false, reason: 'No artifact stored' };
        }

        try {
          // Delete from R2
          await deleteAllArtifactsForCast(cast.id);

          // Update database
          await prisma.cast.update({
            where: { id: cast.id },
            data: {
              artifactStorageKey: null,
              artifactSize: null,
              artifactContentType: null,
              artifactUrl: null,
            },
          });

          // Log deletion
          const { ipAddress, userAgent } = getRequestContext(request);
          await logArtifactDeleted(
            session.user.id,
            cast.id,
            'all artifacts',
            ipAddress,
            userAgent
          );

          return { castId: cast.id, deleted: true };
        } catch (error) {
          console.error(`[Artifacts Delete] Failed to delete artifacts for cast ${cast.id}:`, error);
          return {
            castId: cast.id,
            deleted: false,
            reason: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    const results = deletionResults.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return { castId: 'unknown', deleted: false, reason: 'Promise rejected' };
    });

    const successCount = results.filter((r) => r.deleted).length;
    const failureCount = results.length - successCount;

    return apiSuccess({
      message: `Deleted artifacts for ${successCount} cast(s)`,
      successCount,
      failureCount,
      results,
    });
  } catch (error) {
    console.error('[Artifacts Delete] Error:', error);
    return apiError('INTERNAL', 500, 'Failed to delete artifacts');
  }
}
