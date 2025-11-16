import { NextRequest, NextResponse } from 'next/server'
import { checkBanStatus } from '@/lib/auth'

const INTERNAL_SECRET_HEADER = 'x-internal-auth-secret'

function getInternalSecret(): string {
  const secret = process.env.INTERNAL_AUTH_SECRET

  if (!secret) {
    throw new Error('INTERNAL_AUTH_SECRET is not configured')
  }

  return secret
}

export async function POST(request: NextRequest) {
  try {
    const providedSecret = request.headers.get(INTERNAL_SECRET_HEADER)

    if (providedSecret !== getInternalSecret()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId } = await request.json()

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const banned = await checkBanStatus(userId)
    return NextResponse.json({ banned })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
