import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimitMiddleware } from '@/lib/rate-limit';

// Validate API key and return user ID
async function validateApiKey(apiKey: string): Promise<string | null> {
  try {
    const key = await prisma.api_keys.findUnique({
      where: { key: apiKey },
      include: { users: true },
    });

    if (!key || key.status !== 'active') {
      return null;
    }

    // Update last used timestamp
    await prisma.api_keys.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date(), updatedAt: new Date() },
    });

    return key.userId;
  } catch (error) {
    console.error('API key validation error:', error);
    return null;
  }
}

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
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

    // Validate API key
    const userId = await validateApiKey(apiKey);
    if (!userId) {
      return NextResponse.json({ error: 'Invalid or inactive API key' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { spell_key, input } = body;

    if (!spell_key || typeof spell_key !== 'string') {
      return NextResponse.json(
        { error: 'spell_key is required and must be a string' },
        { status: 400 }
      );
    }

    // Find the spell
    const spell = await prisma.spell.findUnique({
      where: { key: spell_key },
    });

    if (!spell) {
      return NextResponse.json({ error: 'Spell not found' }, { status: 404 });
    }

    if (spell.status !== 'active') {
      return NextResponse.json({ error: 'Spell is not active' }, { status: 400 });
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
        const githubToken = process.env.GITHUB_TOKEN;
        const githubRepo = process.env.GITHUB_REPOSITORY;

        if (!githubToken || !githubRepo) {
          throw new Error('GitHub configuration missing');
        }

        // Trigger GitHub Actions workflow
        const [owner, repo] = githubRepo.split('/');
        const workflowResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/actions/workflows/spell-execution.yml/dispatches`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${githubToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/vnd.github.v3+json',
            },
            body: JSON.stringify({
              ref: 'main',
              inputs: {
                cast_id: cast.id,
                spell_key: spell.key,
                input_data: input ? JSON.stringify(input) : '{}',
              },
            }),
          }
        );

        if (!workflowResponse.ok) {
          console.error('Failed to trigger workflow:', await workflowResponse.text());
          // Update cast status to failed
          await prisma.cast.update({
            where: { id: cast.id },
            data: {
              status: 'failed',
              errorMessage: 'Failed to trigger execution workflow',
              finishedAt: new Date(),
            },
          });

          return NextResponse.json({ error: 'Failed to trigger spell execution' }, { status: 500 });
        }

        // Update cast status to running
        await prisma.cast.update({
          where: { id: cast.id },
          data: {
            status: 'running',
            startedAt: new Date(),
          },
        });
      } catch (error) {
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

        return NextResponse.json({ error: 'Failed to trigger spell execution' }, { status: 500 });
      }
    }

    return NextResponse.json(
      {
        cast_id: cast.id,
        spell_key: spell.key,
        spell_name: spell.name,
        status: cast.status,
        cost_cents: cast.costCents,
        created_at: cast.createdAt,
        message: 'Cast initiated successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Cast API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
