import { jwtVerify, JWTPayload } from 'jose'

export const AUTHORIZATION_HEADER = 'Authorization'
export const USER_ID_HEADER = 'x-spell-user-id'
export const BEARER_PREFIX = 'Bearer '

export type AuthErrorCode =
  | 'AUTH_MISSING_HEADER'
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_BANNED'
  | 'AUTH_INTERNAL_ERROR'

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly statusCode: number
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export class MissingAuthHeaderError extends AuthError {
  constructor() {
    super('Missing or invalid Authorization header', 'AUTH_MISSING_HEADER', 401)
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message = 'Token verification failed') {
    super(message, 'AUTH_INVALID_TOKEN', 401)
  }
}

export class BannedUserError extends AuthError {
  constructor() {
    super('User is banned', 'AUTH_BANNED', 403)
  }
}

type SpellAuthPayload = JWTPayload & {
  sub?: string
}

function requireEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is not configured`)
  }

  return value
}

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(requireEnv('JWT_SECRET'))
}

function getJwtIssuer(): string {
  return requireEnv('JWT_ISSUER')
}

function getJwtAudience(): string | string[] {
  const raw = requireEnv('JWT_AUDIENCE')
  return raw.includes(',') ? raw.split(',').map((aud) => aud.trim()).filter(Boolean) : raw
}

export function extractBearerToken(headers: Headers): string {
  const authHeader = headers.get(AUTHORIZATION_HEADER)

  if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
    throw new MissingAuthHeaderError()
  }

  return authHeader.substring(BEARER_PREFIX.length)
}

export async function verifyJwt(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify<SpellAuthPayload>(token, getJwtSecret(), {
      issuer: getJwtIssuer(),
      audience: getJwtAudience()
    })

    if (!payload.sub) {
      throw new InvalidTokenError('Invalid token: missing sub claim')
    }

    return payload.sub
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      throw error
    }
    throw new InvalidTokenError()
  }
}

export function buildAuthErrorPayload(error: unknown): {
  status: number
  body: { error: string; code: AuthErrorCode }
} {
  if (error instanceof AuthError) {
    return {
      status: error.statusCode,
      body: {
        error: error.message,
        code: error.code
      }
    }
  }

  return {
    status: 500,
    body: {
      error: 'Internal server error',
      code: 'AUTH_INTERNAL_ERROR'
    }
  }
}
