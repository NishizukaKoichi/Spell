import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromHeaders } from '@/lib/auth'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request.headers)
    const url = await createCheckoutSession(userId)

    return NextResponse.json({ url })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
