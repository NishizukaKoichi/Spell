import { prisma } from '@/lib/prisma';

export interface ApiKeyValidationResult {
  userId: string;
  keyId: string;
}

/**
 * Validates the provided API key and updates usage metadata.
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyValidationResult | null> {
  try {
    const key = await prisma.api_keys.findUnique({
      where: { keyHash: apiKey },
      include: { users: true },
    });

    if (!key || key.status !== 'active') {
      return null;
    }

    await prisma.api_keys.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date(), updatedAt: new Date() },
    });

    return {
      userId: key.userId,
      keyId: key.id,
    };
  } catch (error) {
    console.error('API key validation error:', error);
    return null;
  }
}
