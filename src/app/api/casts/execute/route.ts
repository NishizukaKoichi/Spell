import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getExecutionService } from '@/lib/execution/factory'
import { z } from 'zod'

const executeSchema = z.object({
  spellId: z.string(),
  input: z.record(z.unknown()).optional().default({}),
})

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    const { spellId, input } = executeSchema.parse(body)

    // Get spell
    const spell = await prisma.spell.findUnique({
      where: { id: spellId },
    })

    if (!spell) {
      return NextResponse.json({ error: 'Spell not found' }, { status: 404 })
    }

    if (spell.status !== 'active') {
      return NextResponse.json({ error: 'Spell is not active' }, { status: 400 })
    }

    // Check user budget
    const budget = await prisma.budget.findUnique({
      where: { userId: user.id },
    })

    if (budget && budget.used >= budget.cap) {
      return NextResponse.json({ error: 'Budget exceeded' }, { status: 402 })
    }

    // Create cast record
    const cast = await prisma.cast.create({
      data: {
        spellId: spell.id,
        casterId: user.id,
        status: 'queued',
        costCents: spell.priceAmount,
      },
    })

    // Execute spell asynchronously
    const executionService = getExecutionService(spell.executionMode as any)
    const executionResult = await executionService.execute({
      castId: cast.id,
      spellId: spell.id,
      spellKey: spell.key,
      executionMode: spell.executionMode as any,
      input,
      userId: user.id,
    })

    // Update cast with execution result
    const updatedCast = await prisma.cast.update({
      where: { id: cast.id },
      data: {
        status: executionResult.status,
        duration: executionResult.duration,
        artifactUrl: executionResult.artifactUrl,
        errorMessage: executionResult.errorMessage,
        startedAt: new Date(),
        finishedAt:
          executionResult.status === 'succeeded' || executionResult.status === 'failed'
            ? new Date()
            : null,
      },
    })

    // Update budget
    if (executionResult.status === 'succeeded' || executionResult.status === 'running') {
      await prisma.budget.upsert({
        where: { userId: user.id },
        update: {
          used: {
            increment: spell.priceAmount,
          },
        },
        create: {
          userId: user.id,
          cap: 10000, // $100 default cap
          used: spell.priceAmount,
        },
      })
    }

    // Update spell stats
    await prisma.spell.update({
      where: { id: spell.id },
      data: {
        totalCasts: {
          increment: 1,
        },
      },
    })

    return NextResponse.json({
      cast: updatedCast,
      message: 'Cast executed successfully',
    })
  } catch (error) {
    console.error('Cast execution error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
