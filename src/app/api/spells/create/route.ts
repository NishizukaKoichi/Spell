// POST /api/spells/create - Create spell - TKT-010
// SPEC Reference: Section 10 (Spell Management)

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createRequestLogger } from '@/lib/logger';
import { ErrorCatalog, handleError, apiSuccess } from '@/lib/api-response';
import { uploadSpellCode } from '@/lib/storage';

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
      code,
      runtime,
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
      requestLogger.warn('Missing required fields', {
        name,
        key,
        description,
        priceAmountCents,
        tags,
      });
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

    // Validate code and runtime if provided
    if (code && !runtime) {
      requestLogger.warn('Code provided without runtime');
      throw ErrorCatalog.VALIDATION_ERROR({
        runtime: ['Runtime is required when code is provided'],
      });
    }

    if (runtime && !code) {
      requestLogger.warn('Runtime provided without code');
      throw ErrorCatalog.VALIDATION_ERROR({
        code: ['Code is required when runtime is provided'],
      });
    }

    const validRuntimes = ['wasm', 'node', 'nodejs', 'python', 'deno'];
    if (runtime && !validRuntimes.includes(runtime)) {
      requestLogger.warn('Invalid runtime', { runtime });
      throw ErrorCatalog.VALIDATION_ERROR({
        runtime: [`Runtime must be one of: ${validRuntimes.join(', ')}`],
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

    // Upload spell code if provided
    let codeUrl: string | null = null;
    let codeHash: string | null = null;

    if (code && runtime) {
      requestLogger.info('Uploading spell code', { spellKey: key, runtime });

      try {
        const uploadResult = await uploadSpellCode({
          spellKey: key,
          code,
          runtime,
        });

        codeUrl = uploadResult.codeUrl;
        codeHash = uploadResult.codeHash;

        requestLogger.info('Spell code uploaded successfully', {
          spellKey: key,
          codeUrl,
          codeHash,
        });
      } catch (error) {
        requestLogger.error('Failed to upload spell code', error as Error, {
          spellKey: key,
          runtime,
        });
        throw ErrorCatalog.INTERNAL('Failed to upload spell code');
      }
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
        codeUrl,
        runtime: runtime || null,
        codeHash,
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

    return apiSuccess(
      {
        spell,
        message: 'Spell created successfully',
      },
      201
    );
  } catch (error) {
    requestLogger.error('Failed to create spell', error as Error, {
      userId: (await auth())?.user?.id,
    });
    return handleError(error);
  }
}
