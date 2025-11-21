import { NextRequest } from 'next/server'
import { getUserIdFromHeaders } from '@/lib/auth'
import { createPortalSession } from '@/lib/stripe'
import { jsonError, jsonOk } from '@/lib/http'

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request.headers)
    const url = await createPortalSession(userId)

    return jsonOk({ url })
  } catch (error) {
    return jsonError(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
