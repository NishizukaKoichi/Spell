// API Key Management - TKT-003
// SPEC Reference: Section 19 (Key Lifecycle Management)

import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

export interface ApiKeyCreateOptions {
  userId: string;
  name?: string;
  scopes?: string[];
  expiresAt?: Date;
}

export interface ApiKeyInfo {
  id: string;
  apiKey: string; // Only returned on creation
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Generates a cryptographically secure API key.
 * Format: sk_live_<32 random bytes in base64>
 */
export function generateApiKey(): string {
  const randomPart = randomBytes(32).toString('base64url');
  return `sk_live_${randomPart}`;
}

/**
 * Hashes an API key using SHA-256.
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Creates a new API key for a user.
 * Returns the full API key (only time it's visible).
 */
export async function createApiKey(
  options: ApiKeyCreateOptions
): Promise<ApiKeyInfo> {
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = apiKey.substring(0, 12); // "sk_live_XXXX"

  const defaultScopes = ['read', 'write'];
  const scopes = options.scopes || defaultScopes;

  const record = await prisma.api_keys.create({
    data: {
      userId: options.userId,
      keyHash,
      keyPrefix,
      name: options.name,
      scopes,
      expiresAt: options.expiresAt,
    },
  });

  return {
    id: record.id,
    apiKey, // Only returned here!
    keyPrefix: record.keyPrefix,
    keyHash: record.keyHash,
    scopes: record.scopes,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt || undefined,
  };
}

/**
 * Lists all API keys for a user (without revealing full keys).
 */
export async function listApiKeys(userId: string) {
  const keys = await prisma.api_keys.findMany({
    where: {
      userId,
      revokedAt: null, // Only active keys
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      scopes: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
    },
  });

  return keys;
}

/**
 * Revokes an API key.
 */
export async function revokeApiKey(keyId: string, userId: string) {
  const key = await prisma.api_keys.findFirst({
    where: {
      id: keyId,
      userId, // Ensure user owns the key
    },
  });

  if (!key) {
    throw new Error('API key not found');
  }

  if (key.revokedAt) {
    throw new Error('API key already revoked');
  }

  await prisma.api_keys.update({
    where: { id: keyId },
    data: {
      revokedAt: new Date(),
    },
  });
}

/**
 * Validates an API key without database lookup.
 * Just checks format.
 */
export function validateApiKeyFormat(apiKey: string): boolean {
  // Format: sk_live_<base64url>
  const regex = /^sk_live_[A-Za-z0-9_-]{43}$/;
  return regex.test(apiKey);
}

/**
 * Rotates an API key by creating a new one and revoking the old.
 * Returns new key info.
 */
export async function rotateApiKey(
  oldKeyId: string,
  userId: string
): Promise<ApiKeyInfo> {
  const oldKey = await prisma.api_keys.findFirst({
    where: {
      id: oldKeyId,
      userId,
    },
  });

  if (!oldKey) {
    throw new Error('API key not found');
  }

  // Create new key with same scopes
  const newKey = await createApiKey({
    userId,
    name: oldKey.name ? `${oldKey.name} (rotated)` : undefined,
    scopes: oldKey.scopes,
    expiresAt: oldKey.expiresAt || undefined,
  });

  // Revoke old key
  await prisma.api_keys.update({
    where: { id: oldKeyId },
    data: {
      revokedAt: new Date(),
    },
  });

  return newKey;
}
