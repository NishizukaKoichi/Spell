import { NextRequest } from 'next/server';

import { apiError } from '@/lib/api-response';
import { validateApiKey } from '@/lib/api-key';
import { rateLimitMiddleware, RateLimitConfig } from '@/lib/rate-limit';

type MiddlewareResult<T> =
  | { ok: true; value: T }
  | { ok: false; response: Response };

export async function requireApiKey(
  req: NextRequest
): Promise<MiddlewareResult<{ userId: string; keyId: string }>> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, response: apiError('UNAUTHORIZED', 401, 'Missing or invalid Authorization header') };
  }

  const apiKey = authHeader.substring(7);
  const validation = await validateApiKey(apiKey);
  if (!validation) {
    return { ok: false, response: apiError('UNAUTHORIZED', 401, 'Invalid or inactive API key') };
  }

  return { ok: true, value: validation };
}

export async function enforceRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  identifier?: string
): Promise<Response | null> {
  const middleware = rateLimitMiddleware(config);
  return middleware(req, identifier ? { user_id: identifier, role: 'consumer', scopes: [] } : null);
}

export function requireIdempotencyKey(req: NextRequest): MiddlewareResult<string> {
  const idempotencyKey = req.headers.get('idempotency-key');
  if (!idempotencyKey) {
    return {
      ok: false,
      response: apiError('VALIDATION_ERROR', 400, 'Idempotency-Key header is required'),
    };
  }
  return { ok: true, value: idempotencyKey };
}
