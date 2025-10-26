import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// GET /api/casts - List user's casts
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const casts = await prisma.cast.findMany({
      where: { casterId: session.user.id },
      include: {
        spell: {
          select: { id: true, name: true, key: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ casts })
  } catch (error) {
    console.error('Error fetching casts:', error)
    return NextResponse.json({ error: 'Failed to fetch casts' }, { status: 500 })
  }
}

// POST /api/casts - Create new cast execution
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { spellId } = await request.json()

    // Check budget
    const budget = await prisma.budget.findUnique({
      where: { userId: session.user.id },
    })

    if (budget && budget.currentSpend >= budget.monthlyCap) {
      return NextResponse.json({ error: 'Budget cap exceeded' }, { status: 402 })
    }

    // Get spell
    const spell = await prisma.spell.findUnique({
      where: { id: spellId },
    })

    if (!spell) {
      return NextResponse.json({ error: 'Spell not found' }, { status: 404 })
    }

    // Create cast
    const cast = await prisma.cast.create({
      data: {
        spellId,
        casterId: session.user.id,
        costCents: Math.round(spell.priceAmount),
        status: 'queued',
        inputHash: 'placeholder', // TODO: hash input
      },
    })

    // Update budget
    if (budget) {
      await prisma.budget.update({
        where: { userId: session.user.id },
        data: {
          currentSpend: { increment: spell.priceAmount / 100 },
        },
      })
    }

    // TODO: Trigger actual execution (queue job)
    // For now, mark as succeeded after 1 second (mock)
    setTimeout(async () => {
      await prisma.cast.update({
        where: { id: cast.id },
        data: {
          status: 'succeeded',
          finishedAt: new Date(),
          duration: 1250,
        },
      })
    }, 1000)

    return NextResponse.json({ cast }, { status: 201 })
  } catch (error) {
    console.error('Error creating cast:', error)
    return NextResponse.json({ error: 'Failed to create cast' }, { status: 500 })
  }
}
