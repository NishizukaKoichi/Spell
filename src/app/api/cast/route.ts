import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-response';
import { GitHubAppError, GitHubConfigError, triggerWorkflowDispatch } from '@/lib/github-app';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return apiError('UNAUTHORIZED', 401, 'Unauthorized');
    }

    const { spellId, input } = await req.json();

    if (!spellId) {
      return apiError('VALIDATION_ERROR', 422, 'spellId is required');
    }

    // Find the spell
    const spell = await prisma.spell.findUnique({
      where: { id: spellId },
    });

    if (!spell) {
      return apiError('WORKFLOW_NOT_FOUND', 404, 'Spell not found');
    }

    if (spell.status !== 'active') {
      return apiError('VALIDATION_ERROR', 422, 'Spell is not active');
    }

    // Create input hash for caching
    const inputHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(input || {}))
      .digest('hex');

    // Create cast record
    const cast = await prisma.cast.create({
      data: {
        spellId,
        casterId: session.user.id,
        status: 'queued',
        inputHash,
        costCents: spell.priceAmountCents,
      },
    });

    // Trigger GitHub Actions workflow
    // TODO: Implement GitHub Actions trigger
    try {
      await triggerWorkflowDispatch({
        cast_id: cast.id,
        spell_key: spell.key,
        input_data: JSON.stringify(input || {}),
      });

      // Update cast status to running
      await prisma.cast.update({
        where: { id: cast.id },
        data: {
          status: 'running',
          startedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error triggering workflow:', error);
      await prisma.cast.update({
        where: { id: cast.id },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      if (error instanceof GitHubAppError) {
        return apiError(error.code, error.status, error.message);
      }

      if (error instanceof GitHubConfigError) {
        return apiError('INTERNAL', 500, error.message);
      }

      return apiError('INTERNAL', 500, 'Failed to trigger execution workflow');
    }

    // Update spell cast count
    await prisma.spell.update({
      where: { id: spellId },
      data: {
        totalCasts: { increment: 1 },
      },
    });

    return apiSuccess({
      cast,
      message: 'Cast initiated successfully',
    });
  } catch (error) {
    console.error('Cast error:', error);
    return apiError('INTERNAL', 500, 'Failed to initiate cast');
  }
}
