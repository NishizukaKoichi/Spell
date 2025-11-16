import { NextRequest, NextResponse } from 'next/server'
import {
  BannedUserError,
  buildAuthErrorPayload,
  extractBearerToken,
  USER_ID_HEADER,
  verifyJwt
} from '@/lib/auth-shared'

const INTERNAL_SECRET_HEADER = 'x-internal-auth-secret'
const INTERNAL_BAN_PATH = '/api/internal/auth/ban-check'

function getInternalSecret(): string {
  const secret = process.env.INTERNAL_AUTH_SECRET

  if (!secret) {
    throw new Error('INTERNAL_AUTH_SECRET is not configured')
  }

  return secret
}

async function ensureUserNotBanned(userId: string, request: NextRequest): Promise<void> {
  const response = await fetch(new URL(INTERNAL_BAN_PATH, request.nextUrl.origin), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [INTERNAL_SECRET_HEADER]: getInternalSecret()
    },
    body: JSON.stringify({ userId })
  })

  if (!response.ok) {
    throw new Error('Failed to verify ban status')
  }

  const payload = (await response.json()) as { banned?: boolean }

  if (payload.banned) {
    throw new BannedUserError()
  }
}

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname.startsWith(INTERNAL_BAN_PATH)) {
    return NextResponse.next()
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete(USER_ID_HEADER)

  try {
    const token = extractBearerToken(requestHeaders)
    const userId = await verifyJwt(token)

    await ensureUserNotBanned(userId, request)

    requestHeaders.set(USER_ID_HEADER, userId)
    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    })
  } catch (error) {
    const { status, body } = buildAuthErrorPayload(error)
    return NextResponse.json(body, { status })
  }
}

export const config = {
  matcher: ['/api/:path*']
}
