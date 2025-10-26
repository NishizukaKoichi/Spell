import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    let budget = await prisma.budget.findUnique({
      where: { userId: session.user.id },
    })

    // Create default budget if doesn't exist
    if (!budget) {
      budget = await prisma.budget.create({
        data: {
          userId: session.user.id,
          monthlyCap: 100.0,
          currentSpend: 0,
        },
      })
    }

    return NextResponse.json({ budget })
  } catch (error) {
    console.error('Error fetching budget:', error)
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { monthlyCap } = await request.json()

    const budget = await prisma.budget.upsert({
      where: { userId: session.user.id },
      update: { monthlyCap },
      create: {
        userId: session.user.id,
        monthlyCap,
        currentSpend: 0,
      },
    })

    return NextResponse.json({ budget })
  } catch (error) {
    console.error('Error updating budget:', error)
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 })
  }
}
