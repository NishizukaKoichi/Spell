// Cast Result Endpoint - TKT-018
// SPEC Reference: Section 11 (Cast Execution - Results)

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { ErrorCatalog, handleError, apiSuccess } from '@/lib/api-response';
import { createRequestLogger } from '@/lib/logger';

// GET /api/casts/:id/result - Get cast execution result (TKT-018)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestLogger = createRequestLogger(randomUUID(), `/api/casts/${id}/result`, 'GET');

  try {
    requestLogger.info('Fetching cast result', { castId: id });

    const cast = await prisma.cast.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        artifactUrl: true,
        errorMessage: true,
        finishedAt: true,
        durationMs: true,
        costCents: true,
        spell: {
          select: {
            id: true,
            name: true,
            key: true,
          },
        },
      },
    });

    if (!cast) {
      requestLogger.warn('Cast not found', { castId: id });
      throw ErrorCatalog.VALIDATION_ERROR({
        id: ['Cast not found'],
      });
    }

    // Check if cast has finished
    if (cast.status === 'queued' || cast.status === 'running') {
      requestLogger.info('Cast still in progress', {
        castId: id,
        status: cast.status,
      });

      return apiSuccess({
        cast_id: cast.id,
        spell_key: cast.spell.key,
        spell_name: cast.spell.name,
        status: cast.status,
        message: 'Cast is still in progress. Please try again later.',
        result_available: false,
      });
    }

    // Cast has finished - return result
    if (cast.status === 'failed') {
      requestLogger.info('Cast failed, returning error message', {
        castId: id,
        errorMessage: cast.errorMessage,
      });

      return apiSuccess({
        cast_id: cast.id,
        spell_key: cast.spell.key,
        spell_name: cast.spell.name,
        status: cast.status,
        error_message: cast.errorMessage,
        finished_at: cast.finishedAt?.toISOString(),
        duration_ms: cast.durationMs,
        cost_cents: cast.costCents,
        result_available: false,
      });
    }

    // Cast succeeded - return artifact URL
    requestLogger.info('Cast succeeded, returning artifact URL', {
      castId: id,
      artifactUrl: cast.artifactUrl,
    });

    return apiSuccess({
      cast_id: cast.id,
      spell_key: cast.spell.key,
      spell_name: cast.spell.name,
      status: cast.status,
      artifact_url: cast.artifactUrl,
      finished_at: cast.finishedAt?.toISOString(),
      duration_ms: cast.durationMs,
      cost_cents: cast.costCents,
      result_available: true,
    });
  } catch (error) {
    requestLogger.error('Failed to fetch cast result', error as Error, { castId: id });
    return handleError(error);
  }
}
