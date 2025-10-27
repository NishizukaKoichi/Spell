import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const statusSchema = z.object({
  castId: z.string(),
  status: z.enum(['running', 'succeeded', 'failed']),
  artifactUrl: z.string().optional(),
  errorMessage: z.string().optional(),
  duration: z.number().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    const expectedToken = `Bearer ${process.env.API_SECRET || ''}`

    if (!authHeader || authHeader !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { castId, status, artifactUrl, errorMessage, duration } = statusSchema.parse(body)

    // Update cast status
    const cast = await prisma.cast.update({
      where: { id: castId },
      data: {
        status,
        artifactUrl,
        errorMessage,
        duration,
        finishedAt: status === 'succeeded' || status === 'failed' ? new Date() : undefined,
      },
    })

    return NextResponse.json({
      success: true,
      cast,
    })
  } catch (error) {
    console.error('Cast status webhook error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
