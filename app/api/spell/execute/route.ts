import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromHeaders } from '@/lib/auth'
import { executeSpell, type SpellExecutionErrorCode } from '@/lib/spell-engine'

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request.headers)
    const payload = await request.json()
    const spellId = payload?.spellId

    if (typeof spellId !== 'string' || spellId.length === 0) {
      return NextResponse.json(
        { error: 'spellId is required' },
        { status: 400 }
      )
    }

    const result = await executeSpell({
      userId,
      spellId,
      parameters: typeof payload?.parameters === 'object' && payload.parameters !== null
        ? payload.parameters
        : {}
    })

    if (result.status === 'success') {
      return NextResponse.json(result, { status: 200 })
    }

    const status = mapErrorCodeToStatus(result.errorCode)
    return NextResponse.json(
      {
        error: result.message,
        code: result.errorCode,
        billingRecordId: result.billingRecordId
      },
      { status }
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

function mapErrorCodeToStatus(code: SpellExecutionErrorCode): number {
  switch (code) {
    case 'SPELL_NOT_FOUND':
      return 404
    case 'VISIBILITY_DENIED':
      return 403
    case 'BILLING_FAILED':
      return 402
    case 'RUNTIME_ERROR':
    default:
      return 500
  }
}
