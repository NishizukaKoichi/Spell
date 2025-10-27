import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

import { z } from 'zod'
import { Prisma } from '@prisma/client'

// GET /api/spells - List spells with filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const tag = searchParams.get('tag')
  const mode = searchParams.get('mode')
  const search = searchParams.get('q')

  try {
    const spells = await prisma.spell.findMany({
      where: {
        status: 'active',
        ...(tag && { tags: { has: tag } }),
        ...(mode && { executionMode: mode }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { totalCasts: 'desc' },
      take: 20,
    })

    return NextResponse.json({ spells })
  } catch (error) {
    console.error('Error fetching spells:', error)
    return NextResponse.json({ error: 'Failed to fetch spells' }, { status: 500 })
  }
}

// POST /api/spells - Create new spell (authenticated)
const createSpellSchema = z.object({
  key: z.string().regex(/^[a-z0-9\-.]+$/),
  name: z.string().min(3).max(100),
  description: z.string().max(500),
  longDescription: z.string().optional(),
  priceModel: z.enum(['flat', 'metered', 'one_time']),
  priceAmount: z.number().min(0),
  executionMode: z.enum(['workflow', 'service', 'clone']),
  tags: z.array(z.string()).max(10),
  inputSchema: z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validated = createSpellSchema.parse(body)

    const spell = await prisma.spell.create({
      data: {
        key: validated.key,
        name: validated.name,
        description: validated.description,
        longDescription: validated.longDescription,
        priceModel: validated.priceModel,
        priceAmount: validated.priceAmount,
        executionMode: validated.executionMode,
        tags: validated.tags,
        inputSchema: validated.inputSchema as Prisma.InputJsonValue | undefined,
        authorId: session.user.id,
      },
    })

    return NextResponse.json({ spell }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating spell:', error)
    return NextResponse.json({ error: 'Failed to create spell' }, { status: 500 })
  }
}
