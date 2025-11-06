import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { logSpellCreated } from '@/lib/audit-log';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      key,
      description,
      longDescription,
      category,
      priceModel,
      priceAmountCents,
      executionMode,
      tags,
      webhookUrl,
      inputSchema,
      outputSchema,
    } = body;

    // Validation
    if (!name || !key || !description || priceAmountCents === undefined || !tags) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!Number.isInteger(priceAmountCents) || priceAmountCents < 0) {
      return NextResponse.json(
        { error: 'priceAmountCents must be a non-negative integer' },
        { status: 400 }
      );
    }

    if (tags.length === 0) {
      return NextResponse.json({ error: 'At least one tag is required' }, { status: 400 });
    }

    // Check if spell key already exists
    const existingSpell = await prisma.spell.findUnique({
      where: { key },
    });

    if (existingSpell) {
      return NextResponse.json({ error: 'A spell with this key already exists' }, { status: 409 });
    }

    // Create spell
    const spell = await prisma.spell.create({
      data: {
        name,
        key,
        description,
        longDescription: longDescription || null,
        category: category || null,
        priceModel,
        priceAmountCents,
        priceCurrency: 'USD',
        executionMode: executionMode || 'workflow',
        tags,
        webhookUrl: webhookUrl || null,
        inputSchema: inputSchema || null,
        outputSchema: outputSchema || null,
        authorId: session.user.id,
        version: '1.0.0',
        status: 'active',
        rating: 0,
        totalCasts: 0,
      },
    });

    // Log spell creation
    await logSpellCreated(session.user.id, spell.id, spell.name, {
      key: spell.key,
      priceModel: spell.priceModel,
      priceAmountCents: spell.priceAmountCents,
      executionMode: spell.executionMode,
      category: spell.category,
    });

    return NextResponse.json({
      spell,
      message: 'Spell created successfully',
    });
  } catch (error) {
    console.error('Create spell error:', error);
    return NextResponse.json({ error: 'Failed to create spell' }, { status: 500 });
  }
}
