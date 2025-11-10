// POST /api/spells/create - Create spell - TKT-010
// SPEC Reference: Section 10 (Spell Management)

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createRequestLogger } from '@/lib/logger';
import { ErrorCatalog, handleError, apiSuccess } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  const requestLogger = createRequestLogger(randomUUID(), '/api/spells/create', 'POST');

  try {
    const session = await auth();

    if (!session?.user) {
      requestLogger.warn('Unauthorized spell creation attempt');
      throw ErrorCatalog.UNAUTHORIZED();
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

    requestLogger.info('Creating spell', {
      userId: session.user.id,
      spellKey: key,
      name,
    });

    // Validation
    const missingFields: Record<string, string[]> = {};
    if (!name) missingFields.name = ['Name is required'];
    if (!key) missingFields.key = ['Key is required'];
    if (!description) missingFields.description = ['Description is required'];
    if (priceAmountCents === undefined) missingFields.priceAmountCents = ['Price is required'];
    if (!tags) missingFields.tags = ['Tags are required'];

    if (Object.keys(missingFields).length > 0) {
      requestLogger.warn('Missing required fields', { name, key, description, priceAmountCents, tags });
      throw ErrorCatalog.VALIDATION_ERROR(missingFields);
    }

    if (!Number.isInteger(priceAmountCents) || priceAmountCents < 0) {
      requestLogger.warn('Invalid priceAmountCents', { priceAmountCents });
      throw ErrorCatalog.VALIDATION_ERROR({
        priceAmountCents: ['Price must be a non-negative integer'],
      });
    }

    if (tags.length === 0) {
      requestLogger.warn('No tags provided');
      throw ErrorCatalog.VALIDATION_ERROR({
        tags: ['At least one tag is required'],
      });
    }

    // Check if spell key already exists
    const existingSpell = await prisma.spell.findUnique({
      where: { key },
    });

    if (existingSpell) {
      requestLogger.warn('Spell key already exists', { key });
      throw ErrorCatalog.VALIDATION_ERROR({
        key: ['A spell with this key already exists'],
      });
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

    requestLogger.info('Spell created successfully', {
      userId: session.user.id,
      spellId: spell.id,
      spellKey: spell.key,
    });

    return apiSuccess({
      spell,
      message: 'Spell created successfully',
    }, 201);
  } catch (error) {
    requestLogger.error('Failed to create spell', error as Error, {
      userId: (await auth())?.user?.id,
    });
    return handleError(error);
  }
}
