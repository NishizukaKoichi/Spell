import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromHeaders } from '@/lib/auth'
import { executeSpell } from '@/lib/spell-engine'

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request.headers)
    const { spellId, parameters } = await request.json()

    if (!spellId || typeof spellId !== 'string') {
      return NextResponse.json(
        { error: 'spellId is required' },
        { status: 400 }
      )
    }

    const result = await executeSpell({
      userId,
      spellId,
      parameters: typeof parameters === 'object' && parameters !== null ? parameters : {}
    })

    const status = result.success ? 200 : 400
    return NextResponse.json(result, { status })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
