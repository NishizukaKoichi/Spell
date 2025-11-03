import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateApiKey } from '@/lib/api-key';
import { GitHubAppError, GitHubConfigError, triggerWorkflowDispatch } from '@/lib/github-app';
import { rateLimitMiddleware } from '@/lib/rate-limit';

// POST /api/v1/cast - Public endpoint for casting spells with API key
export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting: 60 requests per minute per API key/IP
    const rateLimitError = await rateLimitMiddleware(req, 60, 60000);
    if (rateLimitError) {
      return rateLimitError;
    }

    // Get API key from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return apiError('UNAUTHORIZED', 401, 'Missing or invalid Authorization header');
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

    // Validate API key
    const validation = await validateApiKey(apiKey);
    if (!validation) {
      return apiError('UNAUTHORIZED', 401, 'Invalid or inactive API key');
    }
    const userId = validation.userId;

    // Parse request body
    const body = await req.json();
    const { spell_key, input } = body;

    if (!spell_key || typeof spell_key !== 'string') {
      return apiError('VALIDATION_ERROR', 422, 'spell_key is required and must be a string');
    }

    // Find the spell
    const spell = await prisma.spell.findUnique({
      where: { key: spell_key },
    });

    if (!spell) {
      return apiError('WORKFLOW_NOT_FOUND', 404, 'Spell not found');
    }

    if (spell.status !== 'active') {
      return apiError('VALIDATION_ERROR', 422, 'Spell is not active');
    }

    // Create a new cast
    const cast = await prisma.cast.create({
      data: {
        spellId: spell.id,
        casterId: userId,
        status: 'queued',
        costCents: Math.round(spell.priceAmount),
        inputHash: input ? JSON.stringify(input) : null,
      },
    });

    // If spell execution mode is "workflow", trigger GitHub Actions
    if (spell.executionMode === 'workflow') {
      try {
        await triggerWorkflowDispatch({
          cast_id: cast.id,
          spell_key: spell.key,
          input_data: input ? JSON.stringify(input) : '{}',
        });

        // Update cast status to running
        await prisma.cast.update({
          where: { id: cast.id },
          data: {
            status: 'running',
            startedAt: new Date(),
          },
        });
      } catch (error: unknown) {
        console.error('Workflow trigger error:', error);
        // Update cast status to failed
        await prisma.cast.update({
          where: { id: cast.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            finishedAt: new Date(),
          },
        });

        if (error instanceof GitHubAppError) {
          return apiError(error.code, error.status, error.message);
        }

        if (error instanceof GitHubConfigError) {
          return apiError('INTERNAL', 500, error.message);
        }

        return apiError('INTERNAL', 500, 'Failed to trigger spell execution');
      }
    }

    return apiSuccess(
      {
        cast_id: cast.id,
        spell_key: spell.key,
        spell_name: spell.name,
        status: cast.status,
        cost_cents: cast.costCents,
        created_at: cast.createdAt.toISOString(),
        message: 'Cast initiated successfully',
      },
      201
    );
  } catch (error) {
    console.error('Cast API error:', error);
    return apiError('INTERNAL', 500, 'Internal server error');
  }
}
