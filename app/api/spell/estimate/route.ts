import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromHeaders } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
      return NextResponse.json(
        { error: 'spellId is required' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: 'Spell not found' },
        { status: 404 }
      )
    }

    if (!canAccessSpell(userId, spell)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      spellId: spell.id,
      priceAmount: spell.priceAmount,
      currency: 'usd'
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
