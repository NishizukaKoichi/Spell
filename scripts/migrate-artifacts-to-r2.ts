#!/usr/bin/env tsx

/**
 * Migration Script: Migrate GitHub Artifacts to Cloudflare R2
 *
 * This script migrates existing GitHub artifact URLs to R2 storage.
 * It will:
 * 1. Find all casts with GitHub artifact URLs but no R2 storage key
 * 2. Download artifacts from GitHub (if still available)
 * 3. Upload to R2
 * 4. Update database records
 * 5. Log migration events
 *
 * Usage:
 *   tsx scripts/migrate-artifacts-to-r2.ts [options]
 *
 * Options:
 *   --dry-run       Run without making changes (default: false)
 *   --batch-size    Number of casts to process per batch (default: 10)
 *   --limit         Maximum number of casts to migrate (default: unlimited)
 */

import { prisma } from '../src/lib/prisma';
import { downloadGitHubArtifact } from '../src/lib/github-app';
import { uploadArtifact } from '../src/lib/storage';
import { logArtifactUploaded } from '../src/lib/audit-log';

interface MigrationStats {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    castId: string;
    error: string;
  }>;
}

interface MigrationOptions {
  dryRun: boolean;
  batchSize: number;
  limit?: number;
}

/**
 * Parse GitHub artifact URL to extract run ID and artifact ID
 */
function parseGitHubArtifactUrl(url: string): {
  runId: number;
  artifactId: number;
} | null {
  // Format: /api/v1/github/runs/{runId}/artifacts/{artifactId}
  const match = url.match(/\/api\/v1\/github\/runs\/(\d+)\/artifacts\/(\d+)/);
  if (!match) {
    return null;
  }

  return {
    runId: parseInt(match[1], 10),
    artifactId: parseInt(match[2], 10),
  };
}

/**
 * Migrate a single cast's artifacts to R2
 */
async function migrateCast(
  castId: string,
  artifactUrl: string,
  casterId: string,
  dryRun: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Parse artifact URL
    const parsed = parseGitHubArtifactUrl(artifactUrl);
    if (!parsed) {
      return {
        success: false,
        error: 'Invalid GitHub artifact URL format',
      };
    }

    if (dryRun) {
      console.log(
        `[DRY RUN] Would migrate cast ${castId} (Run: ${parsed.runId}, Artifact: ${parsed.artifactId})`
      );
      return { success: true };
    }

    // Download artifact from GitHub
    console.log(`Downloading artifact ${parsed.artifactId} for cast ${castId}...`);
    const artifactBuffer = await downloadGitHubArtifact(
      process.env.GITHUB_REPO_OWNER || '',
      process.env.GITHUB_REPO_NAME || '',
      parsed.artifactId
    );

    // Upload to R2
    const filename = 'output.zip';
    console.log(`Uploading to R2: ${filename} (${artifactBuffer.length} bytes)...`);
    const storageKey = await uploadArtifact({
      castId,
      filename,
      content: artifactBuffer,
      contentType: 'application/zip',
      metadata: {
        migrated: 'true',
        originalUrl: artifactUrl,
        githubArtifactId: parsed.artifactId.toString(),
        githubRunId: parsed.runId.toString(),
      },
    });

    // Update database
    await prisma.cast.update({
      where: { id: castId },
      data: {
        artifactStorageKey: storageKey,
        artifactSize: artifactBuffer.length,
        artifactContentType: 'application/zip',
        artifactUrl: `/api/artifacts/${castId}/${filename}`,
      },
    });

    // Log migration
    await logArtifactUploaded(
      casterId,
      castId,
      filename,
      artifactBuffer.length,
      storageKey
    );

    console.log(`Successfully migrated cast ${castId} to R2: ${storageKey}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to migrate cast ${castId}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Run migration
 */
async function runMigration(options: MigrationOptions): Promise<MigrationStats> {
  const { dryRun, batchSize, limit } = options;

  console.log('='.repeat(80));
  console.log('Artifact Migration to Cloudflare R2');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Limit: ${limit || 'unlimited'}`);
  console.log('='.repeat(80));
  console.log('');

  const stats: MigrationStats = {
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // Find casts with GitHub artifact URLs but no R2 storage key
  const castsToMigrate = await prisma.cast.findMany({
    where: {
      artifactUrl: {
        not: null,
        contains: '/api/v1/github/runs/',
      },
      artifactStorageKey: null,
    },
    select: {
      id: true,
      artifactUrl: true,
      casterId: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  stats.total = castsToMigrate.length;

  console.log(`Found ${stats.total} casts to migrate\n`);

  if (stats.total === 0) {
    console.log('No casts need migration. Exiting.');
    return stats;
  }

  // Process in batches
  for (let i = 0; i < castsToMigrate.length; i += batchSize) {
    const batch = castsToMigrate.slice(i, i + batchSize);
    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(castsToMigrate.length / batchSize)}`);
    console.log('-'.repeat(80));

    for (const cast of batch) {
      if (!cast.artifactUrl) {
        stats.skipped++;
        continue;
      }

      const result = await migrateCast(cast.id, cast.artifactUrl, cast.casterId, dryRun);

      if (result.success) {
        stats.successful++;
      } else {
        stats.failed++;
        if (result.error) {
          stats.errors.push({
            castId: cast.id,
            error: result.error,
          });
        }
      }

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('Migration Summary');
  console.log('='.repeat(80));
  console.log(`Total casts: ${stats.total}`);
  console.log(`Successful: ${stats.successful}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log('='.repeat(80));

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    console.log('-'.repeat(80));
    stats.errors.forEach((e) => {
      console.log(`Cast ${e.castId}: ${e.error}`);
    });
  }

  return stats;
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(args.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1] || '10'),
    limit: args.find((arg) => arg.startsWith('--limit='))
      ? parseInt(args.find((arg) => arg.startsWith('--limit='))!.split('=')[1])
      : undefined,
  };

  try {
    const stats = await runMigration(options);

    if (options.dryRun) {
      console.log('\nThis was a dry run. No changes were made.');
      console.log('Run without --dry-run to perform the actual migration.');
    }

    // Exit with error code if there were failures
    if (stats.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\nFatal error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
