import { NextRequest } from 'next/server'
import { getUserIdFromHeaders } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { jsonError, jsonOk } from '@/lib/http'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const userId = getUserIdFromHeaders(request.headers)

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        stripeCustomerId: true,
        createdAt: true
      }
    })

    if (!user) {
      return jsonError('USER_NOT_FOUND', 'User not found', 404)
    }

    return jsonOk(user)
  } catch (error) {
    return jsonError(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
