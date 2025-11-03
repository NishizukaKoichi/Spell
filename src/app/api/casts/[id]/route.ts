import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-response';
import { sendCastCompletedWebhook } from '@/lib/webhook';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Verify API secret for GitHub Actions
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.API_SECRET;

    if (!authHeader || !expectedSecret) {
      return apiError('UNAUTHORIZED', 401, 'Unauthorized');
    }

    const token = authHeader.replace('Bearer ', '');
    if (token !== expectedSecret) {
      return apiError('UNAUTHORIZED', 401, 'Unauthorized');
    }

    const body = await req.json();
    const { status, finishedAt, duration, artifactUrl, errorMessage, runId, runAttempt } = body;

    const updateData: any = {};

    if (status) updateData.status = status;
    if (finishedAt) updateData.finishedAt = new Date(finishedAt);
    if (duration !== undefined) updateData.duration = duration;
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

    // Send webhook if cast is completed or failed
    if (cast.status === 'completed' || (cast.status === 'failed' && cast.spell.webhookUrl)) {
      sendCastCompletedWebhook(cast);
    }

    return apiSuccess(cast);
  } catch (error) {
    console.error('Failed to update cast:', error);
    return apiError('INTERNAL', 500, 'Failed to update cast');
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
      return apiError('WORKFLOW_NOT_FOUND', 404, 'Cast not found');
    }

    return apiSuccess(cast);
  } catch (error) {
    console.error('Failed to fetch cast:', error);
    return apiError('INTERNAL', 500, 'Failed to fetch cast');
  }
}
