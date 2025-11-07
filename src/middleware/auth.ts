// API Authentication Middleware - TKT-003
// SPEC Reference: Section 14 (Authentication)

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

export interface AuthContext {
  user_id: string;
  role: 'consumer' | 'maker' | 'admin';
  scopes: string[];
  api_key_id?: string;
}

/**
 * Authenticates incoming requests via API key or session token.
 * Supports two authentication methods:
 * 1. API Key: Authorization: Bearer sk_...
 * 2. Session Token (JWT): Authorization: Bearer ey...
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<AuthContext | null> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    return null;
  }

  // API Key authentication (starts with sk_)
  if (authHeader.startsWith('Bearer sk_')) {
    const apiKey = authHeader.replace('Bearer ', '');
    return await authenticateApiKey(apiKey);
  }

  // Session token authentication (JWT starts with ey)
  if (authHeader.startsWith('Bearer ey')) {
    const token = authHeader.replace('Bearer ', '');
    return await authenticateSession(token);
  }

  return null;
}

/**
 * Authenticates using API key.
 * - Hashes the key with SHA-256
 * - Looks up in database
 * - Validates status and expiration
 * - Updates last_used_at timestamp
 */
async function authenticateApiKey(key: string): Promise<AuthContext | null> {
  const keyHash = createHash('sha256').update(key).digest('hex');

  try {
    const apiKey = await prisma.api_keys.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!apiKey) {
      return null;
    }

    // Check if key is revoked
    if (apiKey.revokedAt) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return null;
    }

    // Update last used timestamp (fire and forget)
    prisma.api_keys
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        // Ignore update errors
      });

    return {
      user_id: apiKey.userId,
      role: apiKey.user.role as 'consumer' | 'maker' | 'admin',
      scopes: apiKey.scopes,
      api_key_id: apiKey.id,
    };
  } catch (error) {
    console.error('API key authentication error:', error);
    return null;
  }
}

/**
 * Authenticates using session token (JWT).
 * This is used for browser-based UI authentication via NextAuth.
 */
async function authenticateSession(token: string): Promise<AuthContext | null> {
  try {
    // In production, verify JWT using NextAuth
    // For now, we'll implement basic JWT verification
    const payload = decodeJWT(token);

    if (!payload || !payload.sub) {
      return null;
    }

    // Look up user
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.deletedAt) {
      return null;
    }

    return {
      user_id: user.id,
      role: user.role as 'consumer' | 'maker' | 'admin',
      scopes: ['read', 'write'], // Session tokens have full scope
    };
  } catch (error) {
    console.error('Session authentication error:', error);
    return null;
  }
}

/**
 * Basic JWT decoder (not cryptographically verified).
 * In production, use NextAuth's getToken() or jose library.
 */
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
    return payload;
  } catch {
    return null;
  }
}

/**
 * Middleware to require authentication.
 * Returns 401 if not authenticated, 403 if missing required scopes.
 */
export function requireAuth(requiredScopes?: string[]) {
  return async (
    req: NextRequest,
    ctx: AuthContext | null
  ): Promise<NextResponse | null> => {
    if (!ctx) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // Check scopes if specified
    if (requiredScopes && requiredScopes.length > 0) {
      const hasScope = requiredScopes.some((s) => ctx.scopes.includes(s));
      if (!hasScope) {
        return NextResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient permissions',
              required_scopes: requiredScopes,
              user_scopes: ctx.scopes,
            },
          },
          { status: 403 }
        );
      }
    }

    return null; // Allow request
  };
}

/**
 * Middleware to require specific role.
 */
export function requireRole(role: 'consumer' | 'maker' | 'admin') {
  return async (
    req: NextRequest,
    ctx: AuthContext | null
  ): Promise<NextResponse | null> => {
    if (!ctx) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    if (ctx.role !== role && ctx.role !== 'admin') {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: `This endpoint requires ${role} role`,
          },
        },
        { status: 403 }
      );
    }

    return null;
  };
}

/**
 * Extract auth context from request headers.
 * Used by API route handlers after middleware has run.
 */
export function getAuthContext(req: NextRequest): AuthContext | null {
  const contextHeader = req.headers.get('x-auth-context');
  if (!contextHeader) {
    return null;
  }

  try {
    return JSON.parse(contextHeader);
  } catch {
    return null;
  }
}

/**
 * Attach auth context to request for downstream handlers.
 */
export function attachAuthContext(
  req: NextRequest,
  ctx: AuthContext
): NextRequest {
  const headers = new Headers(req.headers);
  headers.set('x-auth-context', JSON.stringify(ctx));

  return new NextRequest(req, { headers });
}
