import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

// Generate a secure API key
function generateApiKey(): string {
  const prefix = 'sk_live_';
  const randomPart = randomBytes(32).toString('base64url');
  return `${prefix}${randomPart}`;
}

// GET /api/keys - List user's API keys
export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKeys = await prisma.api_keys.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        key: true,
        status: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Mask the keys for security (show only last 4 characters)
    const maskedKeys = apiKeys.map(
      (key: {
        id: string;
        name: string;
        key: string;
        status: string;
        lastUsedAt: Date | null;
        createdAt: Date;
      }) => ({
        ...key,
        key: `${key.key.substring(0, 8)}...${key.key.slice(-4)}`,
        fullKey: undefined, // Don't send full key
      })
    );

    return NextResponse.json({ apiKeys: maskedKeys });
  } catch (error) {
    console.error('Failed to fetch API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

// POST /api/keys - Create a new API key
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check if user already has 5 or more active keys (rate limiting)
    const existingKeysCount = await prisma.api_keys.count({
      where: {
        userId: session.user.id,
        status: 'active',
      },
    });

    if (existingKeysCount >= 5) {
      return NextResponse.json({ error: 'Maximum of 5 active API keys allowed' }, { status: 400 });
    }

    const apiKey = generateApiKey();

    const newKey = await prisma.api_keys.create({
      data: {
        id: randomBytes(16).toString('hex'),
        userId: session.user.id,
        name: name.trim(),
        key: apiKey,
        status: 'active',
        updatedAt: new Date(),
      },
    });

    // Return the full key only once (on creation)
    return NextResponse.json({
      apiKey: {
        id: newKey.id,
        name: newKey.name,
        key: apiKey, // Full key returned only on creation
        status: newKey.status,
        createdAt: newKey.createdAt,
      },
      message:
        "API key created successfully. Make sure to copy it now - you won't be able to see it again!",
    });
  } catch (error) {
    console.error('Failed to create API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
