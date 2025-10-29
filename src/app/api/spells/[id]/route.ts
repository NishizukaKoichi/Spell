import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/config';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const spell = await prisma.spell.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!spell) {
      return NextResponse.json({ error: 'Spell not found' }, { status: 404 });
    }

    return NextResponse.json(spell);
  } catch (error) {
    console.error('Failed to fetch spell:', error);
    return NextResponse.json({ error: 'Failed to fetch spell' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const spell = await prisma.spell.findUnique({
      where: { id },
    });

    if (!spell) {
      return NextResponse.json({ error: 'Spell not found' }, { status: 404 });
    }

    if (spell.authorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      description,
      longDescription,
      priceModel,
      priceAmount,
      category,
      tags,
      status,
      webhookUrl,
      inputSchema,
      outputSchema,
    } = body;

    const updatedSpell = await prisma.spell.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(longDescription !== undefined && { longDescription }),
        ...(priceModel && { priceModel }),
        ...(priceAmount !== undefined && { priceAmount }),
        ...(category !== undefined && { category }),
        ...(tags && { tags }),
        ...(status && { status }),
        ...(webhookUrl !== undefined && { webhookUrl }),
        ...(inputSchema !== undefined && { inputSchema }),
        ...(outputSchema !== undefined && { outputSchema }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updatedSpell);
  } catch (error) {
    console.error('Failed to update spell:', error);
    return NextResponse.json({ error: 'Failed to update spell' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const spell = await prisma.spell.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            casts: true,
          },
        },
      },
    });

    if (!spell) {
      return NextResponse.json({ error: 'Spell not found' }, { status: 404 });
    }

    if (spell.authorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete by setting status to inactive if there are casts
    if (spell._count.casts > 0) {
      await prisma.spell.update({
        where: { id },
        data: {
          status: 'inactive',
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        message: 'Spell archived (soft deleted due to existing casts)',
      });
    }

    // Hard delete if no casts
    await prisma.spell.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Spell deleted' });
  } catch (error) {
    console.error('Failed to delete spell:', error);
    return NextResponse.json({ error: 'Failed to delete spell' }, { status: 500 });
  }
}
