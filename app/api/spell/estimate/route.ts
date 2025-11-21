import { NextRequest } from 'next/server'
import { getUserIdFromHeaders } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { jsonError, jsonOk } from '@/lib/http'

interface SpellAccess {
  createdBy: string
  visibility: 'public' | 'team' | 'private'
}

function canAccessSpell(userId: string, spell: SpellAccess) {
  if (spell.visibility === 'public') {
    return true
  }

  if (spell.visibility === 'private') {
    return spell.createdBy === userId
  }

  // TODO: add TEAM membership check when implemented
  return spell.createdBy === userId
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request.headers)
    const { spellId } = await request.json()

    if (!spellId || typeof spellId !== 'string') {
      return jsonError('SPELL_ID_REQUIRED', 'spellId is required', 400)
    }

    const spell = await prisma.spell.findUnique({
      where: { id: spellId },
      select: {
        id: true,
        priceAmount: true,
        visibility: true,
        createdBy: true
      }
    })

    if (!spell) {
      return jsonError('SPELL_NOT_FOUND', 'Spell not found', 404)
    }

    if (!canAccessSpell(userId, spell)) {
      return jsonError('VISIBILITY_DENIED', 'Access denied', 403)
    }

    return jsonOk({
      spellId: spell.id,
      priceAmount: spell.priceAmount,
      currency: 'usd'
    })
  } catch (error) {
    return jsonError(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
