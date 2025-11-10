// Cast Detail Operations - TKT-017
// SPEC Reference: Section 11 (Cast Execution)

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { ErrorCatalog, handleError, apiSuccess } from '@/lib/api-response';
import { sendCastStatusWebhook } from '@/lib/webhook';
import { createRequestLogger } from '@/lib/logger';

// PATCH /api/casts/:id - Update cast status (called by GitHub Actions)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestLogger = createRequestLogger(randomUUID(), `/api/casts/${id}`, 'PATCH');

  try {
    // Verify API secret for GitHub Actions
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.API_SECRET;

    if (!authHeader || !expectedSecret) {
      requestLogger.warn('Missing authorization or API secret', { castId: id });
      throw ErrorCatalog.UNAUTHORIZED();
    }

    const token = authHeader.replace('Bearer ', '');
    if (token !== expectedSecret) {
      requestLogger.warn('Invalid API secret', { castId: id });
      throw ErrorCatalog.UNAUTHORIZED();
    }

    const body = await req.json();
    const { status, finishedAt, durationMs, artifactUrl, errorMessage, runId, runAttempt } = body;

    requestLogger.info('Updating cast status', {
      castId: id,
      status,
      runId,
    });

    const updateData: Record<string, unknown> = {};

    if (status) updateData.status = status;
    if (finishedAt) updateData.finishedAt = new Date(finishedAt);
    if (durationMs !== undefined) updateData.durationMs = durationMs;
    if (runId) {
      updateData.githubRunId = String(runId);
      if (!artifactUrl) {
        updateData.artifactUrl = `/api/v1/github/runs/${encodeURIComponent(
          String(runId)
        )}/artifacts`;
      }
    }
    if (runAttempt !== undefined) {
      updateData.githubRunAttempt = Number(runAttempt);
    }
    if (artifactUrl) updateData.artifactUrl = artifactUrl;
    if (errorMessage) updateData.errorMessage = errorMessage;

    const cast = await prisma.cast.update({
      where: { id },
      data: updateData,
      include: {
        spell: {
          select: {
            name: true,
            webhookUrl: true,
          },
        },
      },
    });

    // Send webhook if cast succeeded or failed
    if (cast.status === 'succeeded' || (cast.status === 'failed' && cast.spell.webhookUrl)) {
      sendCastStatusWebhook(cast);
      requestLogger.info('Webhook sent for cast status update', {
        castId: id,
        status: cast.status,
      });
    }

    requestLogger.info('Cast updated successfully', {
      castId: id,
      status: cast.status,
    });

    return apiSuccess(cast);
  } catch (error) {
    requestLogger.error('Failed to update cast', error as Error, { castId: id });
    return handleError(error);
  }
}

// GET /api/casts/:id - Get cast details (TKT-017)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestLogger = createRequestLogger(randomUUID(), `/api/casts/${id}`, 'GET');

  try {
    requestLogger.info('Fetching cast details', { castId: id });

    const cast = await prisma.cast.findUnique({
      where: { id },
      include: {
        spell: true,
        caster: {
          select: {
            id: true,
            name: true,
            email: true,
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

    requestLogger.info('Cast fetched successfully', {
      castId: id,
      status: cast.status,
    });

    return apiSuccess(cast);
  } catch (error) {
    requestLogger.error('Failed to fetch cast', error as Error, { castId: id });
    return handleError(error);
  }
}
