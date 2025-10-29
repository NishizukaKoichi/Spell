import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { spellId, input } = await req.json();

    if (!spellId) {
      return NextResponse.json({ error: 'spellId is required' }, { status: 400 });
    }

    // Find the spell
    const spell = await prisma.spell.findUnique({
      where: { id: spellId },
    });

    if (!spell) {
      return NextResponse.json({ error: 'Spell not found' }, { status: 404 });
    }

    if (spell.status !== 'active') {
      return NextResponse.json({ error: 'Spell is not active' }, { status: 400 });
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
        costCents: spell.priceAmount,
      },
    });

    // Trigger GitHub Actions workflow
    // TODO: Implement GitHub Actions trigger
    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = process.env.GITHUB_REPO_OWNER;
    const repoName = process.env.GITHUB_REPO_NAME;

    if (githubToken && repoOwner && repoName) {
      try {
        const workflowResponse = await fetch(
          `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/spell-execution.yml/dispatches`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${githubToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({
              ref: 'main',
              inputs: {
                cast_id: cast.id,
                spell_key: spell.key,
                input_data: JSON.stringify(input || {}),
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
            },
          });
        } else {
          // Update cast status to running
          await prisma.cast.update({
            where: { id: cast.id },
            data: {
              status: 'running',
              startedAt: new Date(),
            },
          });
        }
      } catch (error) {
        console.error('Error triggering workflow:', error);
        await prisma.cast.update({
          where: { id: cast.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }

    // Update spell cast count
    await prisma.spell.update({
      where: { id: spellId },
      data: {
        totalCasts: { increment: 1 },
      },
    });

    return NextResponse.json({
      cast,
      message: 'Cast initiated successfully',
    });
  } catch (error) {
    console.error('Cast error:', error);
    return NextResponse.json({ error: 'Failed to initiate cast' }, { status: 500 });
  }
}
