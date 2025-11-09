// API Key Revocation - TKT-009
// SPEC Reference: Section 7 (API Keys), Section 9 (Authentication)

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createRequestLogger } from '@/lib/logger';
import { ErrorCatalog, handleError } from '@/lib/api-response';
import { randomUUID } from 'crypto';

// DELETE /api/keys/[id] - Revoke an API key
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestLogger = createRequestLogger(randomUUID(), `/api/keys/${id}`, 'DELETE');

  try {
    const session = await auth();
    if (!session?.user?.id) {
      requestLogger.warn('Unauthorized API key deletion attempt', { keyId: id });
      throw ErrorCatalog.UNAUTHORIZED();
    }

    requestLogger.info('Revoking API key', {
      userId: session.user.id,
      keyId: id,
    });

    // Verify the key belongs to the user
    const apiKey = await prisma.api_keys.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!apiKey) {
      requestLogger.warn('API key not found or forbidden', {
        userId: session.user.id,
        keyId: id,
      });
      throw new Error('API_KEY_NOT_FOUND');
    }

    // Soft delete: mark as revoked instead of hard delete
    await prisma.api_keys.update({
      where: {
        id,
      },
      data: {
        status: 'revoked',
        updatedAt: new Date(),
      },
    });

    requestLogger.info('API key revoked successfully', {
      userId: session.user.id,
      keyId: id,
      keyPrefix: apiKey.keyPrefix,
    });

    return NextResponse.json({
      message: 'API key revoked successfully',
      id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'API_KEY_NOT_FOUND') {
      requestLogger.warn('API key not found', { keyId: id });
      return ErrorCatalog.VALIDATION_ERROR({
        id: ['API key not found or you do not have permission to revoke it'],
      }).toResponse();
    }

    requestLogger.error('Failed to revoke API key', error as Error, {
      userId: (await auth())?.user?.id,
      keyId: id,
    });
    return handleError(error);
  }
}
