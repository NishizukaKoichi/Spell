// Spell Detail Operations - TKT-011
// SPEC Reference: Section 10 (Spell Management)

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/config';
import { createRequestLogger } from '@/lib/logger';
import { ErrorCatalog, handleError, apiSuccess } from '@/lib/api-response';

// GET /api/spells/[id] - Get spell details
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestLogger = createRequestLogger(randomUUID(), `/api/spells/${id}`, 'GET');

  try {
    requestLogger.info('Fetching spell details', { spellId: id });

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
      requestLogger.warn('Spell not found', { spellId: id });
      throw ErrorCatalog.VALIDATION_ERROR({
        id: ['Spell not found'],
      });
    }

    requestLogger.info('Spell fetched successfully', { spellId: id, spellKey: spell.key });

    return apiSuccess(spell);
  } catch (error) {
    requestLogger.error('Failed to fetch spell', error as Error, { spellId: id });
    return handleError(error);
  }
}

// PATCH /api/spells/[id] - Update spell
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestLogger = createRequestLogger(randomUUID(), `/api/spells/${id}`, 'PATCH');

  try {
    const session = await auth();
    if (!session?.user?.id) {
      requestLogger.warn('Unauthorized spell update attempt', { spellId: id });
      throw ErrorCatalog.UNAUTHORIZED();
    }

    requestLogger.info('Updating spell', { userId: session.user.id, spellId: id });

    const spell = await prisma.spell.findUnique({
      where: { id },
    });

    if (!spell) {
      requestLogger.warn('Spell not found', { spellId: id });
      throw ErrorCatalog.VALIDATION_ERROR({
        id: ['Spell not found'],
      });
    }

    if (spell.authorId !== session.user.id) {
      requestLogger.warn('Forbidden: User is not spell author', {
        userId: session.user.id,
        spellId: id,
        authorId: spell.authorId,
      });
      throw ErrorCatalog.VALIDATION_ERROR({
        id: ['You do not have permission to update this spell'],
      });
    }

    const body = await req.json();
    const {
      name,
      description,
      longDescription,
      priceModel,
      priceAmountCents,
      category,
      tags,
      status,
      webhookUrl,
      inputSchema,
      outputSchema,
    } = body;

    // Validate priceAmountCents if provided
    if (
      priceAmountCents !== undefined &&
      (!Number.isInteger(priceAmountCents) || priceAmountCents < 0)
    ) {
      requestLogger.warn('Invalid priceAmountCents', { priceAmountCents });
      throw ErrorCatalog.VALIDATION_ERROR({
        priceAmountCents: ['Price must be a non-negative integer'],
      });
    }

    const updatedSpell = await prisma.spell.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(longDescription !== undefined && { longDescription }),
        ...(priceModel && { priceModel }),
        ...(priceAmountCents !== undefined && { priceAmountCents }),
        ...(category !== undefined && { category }),
        ...(tags && { tags }),
        ...(status && { status }),
        ...(webhookUrl !== undefined && { webhookUrl }),
        ...(inputSchema !== undefined && { inputSchema }),
        ...(outputSchema !== undefined && { outputSchema }),
        updatedAt: new Date(),
      },
    });

    requestLogger.info('Spell updated successfully', {
      userId: session.user.id,
      spellId: id,
      spellKey: updatedSpell.key,
    });

    return apiSuccess(updatedSpell);
  } catch (error) {
    requestLogger.error('Failed to update spell', error as Error, {
      userId: (await auth())?.user?.id,
      spellId: id,
    });
    return handleError(error);
  }
}

// DELETE /api/spells/[id] - Delete spell
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestLogger = createRequestLogger(randomUUID(), `/api/spells/${id}`, 'DELETE');

  try {
    const session = await auth();
    if (!session?.user?.id) {
      requestLogger.warn('Unauthorized spell deletion attempt', { spellId: id });
      throw ErrorCatalog.UNAUTHORIZED();
    }

    requestLogger.info('Deleting spell', { userId: session.user.id, spellId: id });

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
      requestLogger.warn('Spell not found', { spellId: id });
      throw ErrorCatalog.VALIDATION_ERROR({
        id: ['Spell not found'],
      });
    }

    if (spell.authorId !== session.user.id) {
      requestLogger.warn('Forbidden: User is not spell author', {
        userId: session.user.id,
        spellId: id,
        authorId: spell.authorId,
      });
      throw ErrorCatalog.VALIDATION_ERROR({
        id: ['You do not have permission to delete this spell'],
      });
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

      requestLogger.info('Spell archived (soft deleted)', {
        userId: session.user.id,
        spellId: id,
        castsCount: spell._count.casts,
      });

      return apiSuccess({
        message: 'Spell archived (soft deleted due to existing casts)',
      });
    }

    // Hard delete if no casts
    await prisma.spell.delete({
      where: { id },
    });

    requestLogger.info('Spell deleted (hard delete)', {
      userId: session.user.id,
      spellId: id,
    });

    return apiSuccess({ message: 'Spell deleted' });
  } catch (error) {
    requestLogger.error('Failed to delete spell', error as Error, {
      userId: (await auth())?.user?.id,
      spellId: id,
    });
    return handleError(error);
  }
}
