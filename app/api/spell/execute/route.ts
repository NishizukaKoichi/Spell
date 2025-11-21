import { NextRequest } from 'next/server'
import { getUserIdFromHeaders } from '@/lib/auth'
import { jsonError, jsonOk } from '@/lib/http'
import { executeSpell, type SpellExecutionErrorCode } from '@/lib/spell-engine'

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request.headers)
    const payload = await request.json()
    const spellId = payload?.spellId

    if (typeof spellId !== 'string' || spellId.length === 0) {
      return jsonError('SPELL_ID_REQUIRED', 'spellId is required', 400)
    }

    const result = await executeSpell({
      userId,
      spellId,
      parameters: typeof payload?.parameters === 'object' && payload.parameters !== null
        ? payload.parameters
        : {}
    })

    if (result.ok) {
      return jsonOk(result.result, 200)
    }

    const status = mapErrorCodeToStatus(result.error.code)
    return jsonError(result.error.code, result.error.message, status, {
      billingRecordId: result.billingRecordId
    })
  } catch (error) {
    return jsonError(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Internal server error',
      500
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
