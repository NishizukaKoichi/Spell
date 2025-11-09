// API Keys Management - TKT-007
// SPEC Reference: Section 7 (API Keys), Section 9 (Authentication)

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { hashApiKey } from '@/lib/api-key';
import { createRequestLogger } from '@/lib/logger';
import { ErrorCatalog, handleError } from '@/lib/api-response';
import { randomUUID } from 'crypto';

// Generate a secure API key
function generateApiKey(): string {
  const prefix = 'sk_live_';
  const randomPart = randomBytes(32).toString('base64url');
  return `${prefix}${randomPart}`;
}

// GET /api/keys - List user's API keys
export async function GET(_req: NextRequest) {
  const requestLogger = createRequestLogger(randomUUID(), '/api/keys', 'GET');

  try {
    const session = await auth();
    if (!session?.user?.id) {
      requestLogger.warn('Unauthorized API keys list attempt');
      throw ErrorCatalog.UNAUTHORIZED();
    }

    requestLogger.info('Fetching API keys', { userId: session.user.id });

    const apiKeys = await prisma.api_keys.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        status: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Mask the keys for security (show only prefix)
    const maskedKeys = apiKeys.map(
      (key: {
        id: string;
        name: string;
        keyPrefix: string;
        status: string;
        lastUsedAt: Date | null;
        createdAt: Date;
      }) => ({
        ...key,
        key: `${key.keyPrefix}...`,
      })
    );

    requestLogger.info('API keys fetched successfully', {
      userId: session.user.id,
      count: maskedKeys.length,
    });

    return NextResponse.json({ apiKeys: maskedKeys });
  } catch (error) {
    requestLogger.error('Failed to fetch API keys', error as Error, {
      userId: (await auth())?.user?.id,
    });
    return handleError(error);
  }
}

// POST /api/keys - Create a new API key
export async function POST(req: NextRequest) {
  const requestLogger = createRequestLogger(randomUUID(), '/api/keys', 'POST');

  try {
    const session = await auth();
    if (!session?.user?.id) {
      requestLogger.warn('Unauthorized API key creation attempt');
      throw ErrorCatalog.UNAUTHORIZED();
    }

    const body = await req.json();
    const { name } = body;

    // Validate request body
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      requestLogger.warn('Invalid API key creation request', { name });
      throw ErrorCatalog.VALIDATION_ERROR({
        name: ['API key name is required and must be a non-empty string'],
      });
    }

    if (name.trim().length > 100) {
      throw ErrorCatalog.VALIDATION_ERROR({
        name: ['API key name must not exceed 100 characters'],
      });
    }

    requestLogger.info('Creating API key', {
      userId: session.user.id,
      name: name.trim(),
    });

    // Check if user already has 5 or more active keys (rate limiting)
    const existingKeysCount = await prisma.api_keys.count({
      where: {
        userId: session.user.id,
        status: 'active',
      },
    });

    if (existingKeysCount >= 5) {
      requestLogger.warn('API key limit exceeded', {
        userId: session.user.id,
        existingKeysCount,
      });
      throw ErrorCatalog.VALIDATION_ERROR({
        limit: ['Maximum of 5 active API keys allowed. Please revoke an existing key first.'],
      });
    }

    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 8);

    const newKey = await prisma.api_keys.create({
      data: {
        id: randomBytes(16).toString('hex'),
        userId: session.user.id,
        name: name.trim(),
        keyHash,
        keyPrefix,
        scopes: ['read', 'write'],
        status: 'active',
        updatedAt: new Date(),
      },
    });

    requestLogger.info('API key created successfully', {
      userId: session.user.id,
      keyId: newKey.id,
      keyPrefix: newKey.keyPrefix,
    });

    // Return the full key only once (on creation)
    return NextResponse.json(
      {
        apiKey: {
          id: newKey.id,
          name: newKey.name,
          key: apiKey, // Full key returned only on creation
          status: newKey.status,
          createdAt: newKey.createdAt,
        },
        message:
          "API key created successfully. Make sure to copy it now - you won't be able to see it again!",
      },
      { status: 201 }
    );
  } catch (error) {
    requestLogger.error('Failed to create API key', error as Error, {
      userId: (await auth())?.user?.id,
    });
    return handleError(error);
  }
}
