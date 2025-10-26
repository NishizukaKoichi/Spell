import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const spell = await prisma.spell.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
    })

    if (!spell) {
      return NextResponse.json({ error: 'Spell not found' }, { status: 404 })
    }

    return NextResponse.json({ spell })
  } catch (error) {
    console.error('Error fetching spell:', error)
    return NextResponse.json({ error: 'Failed to fetch spell' }, { status: 500 })
  }
}
