import { prisma } from './prisma';
import { deleteAllArtifactsForCast, getCastStorageSize, formatBytes } from './storage';
import { logArtifactDeleted } from './audit-log';

/**
 * Cleanup options
 */
export interface CleanupOptions {
  dryRun?: boolean; // If true, only report what would be deleted
  batchSize?: number; // Number of casts to process in each batch
}

/**
 * Cleanup result
 */
export interface CleanupResult {
  castsProcessed: number;
  artifactsDeleted: number;
  bytesFreed: number;
  errors: Array<{ castId: string; error: string }>;
}

/**
 * Clean up artifacts older than specified days
 *
 * @param daysOld - Delete artifacts older than this many days
 * @param options - Cleanup options
 */
export async function cleanupOldArtifacts(
  daysOld = 90,
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  const { dryRun = false, batchSize = 100 } = options;

  console.log(`[Artifact Cleanup] Starting cleanup of artifacts older than ${daysOld} days...`);
  console.log(`[Artifact Cleanup] Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result: CleanupResult = {
    castsProcessed: 0,
    artifactsDeleted: 0,
    bytesFreed: 0,
    errors: [],
  };

  try {
    // Find casts with artifacts older than cutoff date
    const oldCasts = await prisma.cast.findMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        artifactStorageKey: {
          not: null,
        },
      },
      select: {
        id: true,
        artifactStorageKey: true,
        artifactSize: true,
        casterId: true,
        spell: {
          select: {
            name: true,
          },
        },
      },
      take: batchSize,
    });

    console.log(`[Artifact Cleanup] Found ${oldCasts.length} casts with old artifacts`);

    for (const cast of oldCasts) {
      try {
        result.castsProcessed++;

        // Calculate storage size if not stored
        const size = cast.artifactSize || (await getCastStorageSize(cast.id));
        result.bytesFreed += size;

        if (!dryRun) {
          // Delete artifacts from R2
          const deletedCount = await deleteAllArtifactsForCast(cast.id);
          result.artifactsDeleted += deletedCount;

          // Update database
          await prisma.cast.update({
            where: { id: cast.id },
            data: {
              artifactStorageKey: null,
              artifactSize: null,
              artifactContentType: null,
            },
          });

          // Log deletion
          await logArtifactDeleted(
            'system',
            cast.id,
            'all artifacts (cleanup)',
            null,
            'artifact-cleanup'
          );

          console.log(
            `[Artifact Cleanup] Deleted artifacts for cast ${cast.id} (${formatBytes(size)})`
          );
        } else {
          console.log(
            `[Artifact Cleanup] Would delete artifacts for cast ${cast.id} (${formatBytes(size)})`
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          castId: cast.id,
          error: errorMessage,
        });
        console.error(`[Artifact Cleanup] Failed to process cast ${cast.id}:`, error);
      }
    }

    console.log(`[Artifact Cleanup] Completed!`);
    console.log(`[Artifact Cleanup] Processed: ${result.castsProcessed} casts`);
    console.log(`[Artifact Cleanup] Deleted: ${result.artifactsDeleted} artifacts`);
    console.log(`[Artifact Cleanup] Freed: ${formatBytes(result.bytesFreed)}`);
    console.log(`[Artifact Cleanup] Errors: ${result.errors.length}`);

    return result;
  } catch (error) {
    console.error('[Artifact Cleanup] Fatal error:', error);
    throw error;
  }
}

/**
 * Clean up artifacts from failed casts older than specified days
 *
 * @param daysOld - Delete artifacts from failed casts older than this many days
 * @param options - Cleanup options
 */
export async function cleanupFailedCasts(
  daysOld = 7,
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  const { dryRun = false, batchSize = 100 } = options;

  console.log(`[Artifact Cleanup] Starting cleanup of failed cast artifacts older than ${daysOld} days...`);
  console.log(`[Artifact Cleanup] Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result: CleanupResult = {
    castsProcessed: 0,
    artifactsDeleted: 0,
    bytesFreed: 0,
    errors: [],
  };

  try {
    // Find failed casts with artifacts older than cutoff date
    const failedCasts = await prisma.cast.findMany({
      where: {
        status: 'failed',
        createdAt: {
          lt: cutoffDate,
        },
        artifactStorageKey: {
          not: null,
        },
      },
      select: {
        id: true,
        artifactStorageKey: true,
        artifactSize: true,
        casterId: true,
        errorMessage: true,
      },
      take: batchSize,
    });

    console.log(`[Artifact Cleanup] Found ${failedCasts.length} failed casts with artifacts`);

    for (const cast of failedCasts) {
      try {
        result.castsProcessed++;

        // Calculate storage size if not stored
        const size = cast.artifactSize || (await getCastStorageSize(cast.id));
        result.bytesFreed += size;

        if (!dryRun) {
          // Delete artifacts from R2
          const deletedCount = await deleteAllArtifactsForCast(cast.id);
          result.artifactsDeleted += deletedCount;

          // Update database
          await prisma.cast.update({
            where: { id: cast.id },
            data: {
              artifactStorageKey: null,
              artifactSize: null,
              artifactContentType: null,
            },
          });

          // Log deletion
          await logArtifactDeleted(
            'system',
            cast.id,
            'all artifacts (failed cast cleanup)',
            null,
            'artifact-cleanup'
          );

          console.log(
            `[Artifact Cleanup] Deleted artifacts for failed cast ${cast.id} (${formatBytes(size)})`
          );
        } else {
          console.log(
            `[Artifact Cleanup] Would delete artifacts for failed cast ${cast.id} (${formatBytes(size)})`
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          castId: cast.id,
          error: errorMessage,
        });
        console.error(`[Artifact Cleanup] Failed to process cast ${cast.id}:`, error);
      }
    }

    console.log(`[Artifact Cleanup] Completed!`);
    console.log(`[Artifact Cleanup] Processed: ${result.castsProcessed} casts`);
    console.log(`[Artifact Cleanup] Deleted: ${result.artifactsDeleted} artifacts`);
    console.log(`[Artifact Cleanup] Freed: ${formatBytes(result.bytesFreed)}`);
    console.log(`[Artifact Cleanup] Errors: ${result.errors.length}`);

    return result;
  } catch (error) {
    console.error('[Artifact Cleanup] Fatal error:', error);
    throw error;
  }
}

/**
 * Get storage usage analytics per user
 *
 * @param topN - Return top N users by storage usage
 */
export async function getStorageUsageByUser(topN = 10) {
  const usage = await prisma.cast.groupBy({
    by: ['casterId'],
    where: {
      artifactSize: {
        not: null,
      },
    },
    _sum: {
      artifactSize: true,
    },
    _count: {
      id: true,
    },
    orderBy: {
      _sum: {
        artifactSize: 'desc',
      },
    },
    take: topN,
  });

  // Fetch user details
  const userIds = usage.map((u) => u.casterId);
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return usage.map((u) => {
    const user = userMap.get(u.casterId);
    return {
      userId: u.casterId,
      userEmail: user?.email || 'Unknown',
      userName: user?.name || 'Unknown',
      totalBytes: u._sum.artifactSize || 0,
      totalFormatted: formatBytes(u._sum.artifactSize || 0),
      castCount: u._count.id,
    };
  });
}

/**
 * Get total storage usage across all users
 */
export async function getTotalStorageUsage() {
  const total = await prisma.cast.aggregate({
    where: {
      artifactSize: {
        not: null,
      },
    },
    _sum: {
      artifactSize: true,
    },
    _count: {
      id: true,
    },
  });

  return {
    totalBytes: total._sum.artifactSize || 0,
    totalFormatted: formatBytes(total._sum.artifactSize || 0),
    castCount: total._count.id,
  };
}

/**
 * Estimate storage costs
 *
 * Cloudflare R2 pricing (as of 2024):
 * - Storage: $0.015 per GB-month
 * - Class A operations (writes): $4.50 per million
 * - Class B operations (reads): $0.36 per million
 *
 * @param storageBytes - Total storage in bytes
 * @param monthlyWrites - Estimated monthly write operations
 * @param monthlyReads - Estimated monthly read operations
 */
export function estimateStorageCosts(
  storageBytes: number,
  monthlyWrites = 0,
  monthlyReads = 0
) {
  const storageGB = storageBytes / (1024 * 1024 * 1024);
  const storageCost = storageGB * 0.015; // $0.015 per GB-month

  const writeCost = (monthlyWrites / 1_000_000) * 4.5; // $4.50 per million
  const readCost = (monthlyReads / 1_000_000) * 0.36; // $0.36 per million

  const totalCost = storageCost + writeCost + readCost;

  return {
    storageCostPerMonth: storageCost,
    writeCostPerMonth: writeCost,
    readCostPerMonth: readCost,
    totalCostPerMonth: totalCost,
    storageGB,
  };
}
