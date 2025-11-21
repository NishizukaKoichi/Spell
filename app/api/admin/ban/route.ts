import { NextRequest } from 'next/server'
import { assertAdminAccess, getUserIdFromHeaders } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { jsonError, jsonOk } from '@/lib/http'

type BanAction = 'ban' | 'unban'

export async function POST(request: NextRequest) {
  try {
    const adminId = getUserIdFromHeaders(request.headers)
    assertAdminAccess(adminId)

    const { userId, reason, action = 'ban' } = await request.json()

    if (!userId || typeof userId !== 'string') {
      return jsonError('USER_ID_REQUIRED', 'userId is required', 400)
    }

    if (action === 'ban' && (!reason || typeof reason !== 'string')) {
      return jsonError('REASON_REQUIRED', 'reason is required to ban a user', 400)
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return jsonError('USER_NOT_FOUND', 'User not found', 404)
    }

    if (action === 'unban') {
      await prisma.ban.delete({ where: { userId } }).catch(() => null)
      await prisma.user.update({ where: { id: userId }, data: { status: 'active' } })

      return jsonOk({ message: 'User unbanned' })
    }

    if (action !== 'ban') {
      return jsonError('UNSUPPORTED_ACTION', 'Unsupported action', 400)
    }

    await prisma.ban.upsert({
      where: { userId },
      create: { userId, reason },
      update: { reason }
    })

    await prisma.user.update({
      where: { id: userId },
      data: { status: 'banned' }
    })

    return jsonOk({ message: 'User banned' })
  } catch (error) {
    return jsonError(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
