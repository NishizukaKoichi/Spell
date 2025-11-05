import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-response';
import { GitHubAppError, GitHubConfigError, triggerWorkflowDispatch } from '@/lib/github-app';
import { NATS, runWasmTemplate } from '@/lib/runtime';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    // Temporary: bypass auth for testing
    // if (!session?.user) {
    //   return apiError('UNAUTHORIZED', 401, 'Unauthorized');
    // }

    const { spellId, input } = await req.json();
    const userId = session?.user?.id || 'cmh8ix0470000s4orjbnhdr3l'; // Default to first user for testing

    if (!spellId) {
      return apiError('VALIDATION_ERROR', 422, 'spellId is required');
    }

    // Find the spell (select only essential fields to avoid DB schema issues)
    const spell = await prisma.spell.findUnique({
      where: { id: spellId },
      select: {
        id: true,
        key: true,
        status: true,
      },
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
        casterId: userId,
        status: 'queued',
        inputHash,
        costCents: 0, // Default to 0 for testing
      },
    });

    // Publish to NATS for async processing
    await NATS.publish('cast.started', {
      castId: cast.id,
      spellId: spell.id,
      spellKey: spell.key,
      inputs: input || {},
      userId: userId,
    });

    // Update spell cast count
    await prisma.spell.update({
      where: { id: spellId },
      data: {
        totalCasts: { increment: 1 },
      },
    });

    // Return 202 Accepted - processing queued
    return new Response(
      JSON.stringify({
        status: 'queued',
        castId: cast.id,
        message: 'Cast queued for processing',
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Cast error:', error);
    return apiError('INTERNAL', 500, 'Failed to initiate cast');
  }
}
