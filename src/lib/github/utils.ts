import crypto from 'crypto';

import type { ApiErrorCode } from '@/lib/api-response';

export function base64UrlEncode(input: Buffer | string) {
  const buffer = typeof input === 'string' ? Buffer.from(input) : input;
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function normalizePrivateKey(rawKey: string) {
  const key = rawKey.includes('BEGIN')
    ? rawKey
    : `-----BEGIN PRIVATE KEY-----\n${rawKey}\n-----END PRIVATE KEY-----`;
  return key.replace(/\\n/g, '\n');
}

export function createAppJwt(appId: string, privateKey: string) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(data);
  signer.end();

  const signature = signer.sign(privateKey);
  return `${data}.${base64UrlEncode(signature)}`;
}

export function mapStatusToCode(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN_REPO';
    case 404:
      return 'WORKFLOW_NOT_FOUND';
    case 409:
      return 'IDEMPOTENCY_CONFLICT';
    case 410:
      return 'ARTIFACT_EXPIRED';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    case 504:
      return 'TIMEOUT';
    default:
      return 'INTERNAL';
  }
}

export async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
