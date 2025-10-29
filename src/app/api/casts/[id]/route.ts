import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendCastCompletedWebhook } from '@/lib/webhook';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Verify API secret for GitHub Actions
    const authHeader = req.headers.get('authorization');
    const expectedSecret = process.env.API_SECRET;

    if (!authHeader || !expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    if (token !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { status, finishedAt, duration, artifactUrl, errorMessage } = body;

    const updateData: any = {};

    if (status) updateData.status = status;
    if (finishedAt) updateData.finishedAt = new Date(finishedAt);
    if (duration !== undefined) updateData.duration = duration;
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

    return NextResponse.json(cast);
  } catch (error) {
    console.error('Failed to update cast:', error);
    return NextResponse.json({ error: 'Failed to update cast' }, { status: 500 });
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
      return NextResponse.json({ error: 'Cast not found' }, { status: 404 });
    }

    return NextResponse.json(cast);
  } catch (error) {
    console.error('Failed to fetch cast:', error);
    return NextResponse.json({ error: 'Failed to fetch cast' }, { status: 500 });
  }
}
