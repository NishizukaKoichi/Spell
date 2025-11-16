import { jwtVerify, JWTPayload } from 'jose'
import { prisma } from '@/lib/prisma'

export interface AuthPayload extends JWTPayload {
  sub: string // user_id
}

/**
 * Verify JWT token and return user_id
 */
export async function verifyToken(token: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET)

  try {
    const { payload } = await jwtVerify(token, secret)

    if (!payload.sub) {
      throw new Error('Invalid token: missing sub claim')
    }

    return payload.sub
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid token: missing sub claim') {
      throw error
    }
    throw new Error('Token verification failed')
  }
}

/**
 * Check if user is banned
 */
export async function checkBanStatus(userId: string): Promise<boolean> {
  const ban = await prisma.ban.findUnique({
    where: { userId }
  })

  return ban !== null
}

/**
 * Get user from request headers
 */
export async function authenticateRequest(headers: Headers): Promise<string> {
  const authHeader = headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const token = authHeader.substring(7)
  const userId = await verifyToken(token)

  // Check if user is banned
  const isBanned = await checkBanStatus(userId)
  if (isBanned) {
    throw new Error('User is banned')
  }

  return userId
}

export function assertAdminAccess(userId: string): void {
  const adminIds = process.env.ADMIN_USER_IDS
    ? process.env.ADMIN_USER_IDS.split(',').map((id) => id.trim()).filter(Boolean)
    : []

  if (!adminIds.includes(userId)) {
    throw new Error('Admin privileges required')
  }
}
