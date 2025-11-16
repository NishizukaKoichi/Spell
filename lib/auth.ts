import { prisma } from '@/lib/prisma'
import {
  BannedUserError,
  extractBearerToken,
  USER_ID_HEADER,
  verifyJwt
} from '@/lib/auth-shared'

export { AuthError, InvalidTokenError } from '@/lib/auth-shared'

export async function verifyToken(token: string): Promise<string> {
  return verifyJwt(token)
}

export async function checkBanStatus(userId: string): Promise<boolean> {
  const ban = await prisma.ban.findUnique({
    where: { userId }
  })

  return ban !== null
}

export async function authenticateRequest(headers: Headers): Promise<string> {
  const forwardedUserId = headers.get(USER_ID_HEADER)

  if (forwardedUserId) {
    return forwardedUserId
  }

  const token = extractBearerToken(headers)
  const userId = await verifyToken(token)

  const isBanned = await checkBanStatus(userId)
  if (isBanned) {
    throw new BannedUserError()
  }

  return userId
}

export function getUserIdFromHeaders(headers: Headers): string {
  const userId = headers.get(USER_ID_HEADER)

  if (!userId) {
    throw new Error('Missing authenticated user context')
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
