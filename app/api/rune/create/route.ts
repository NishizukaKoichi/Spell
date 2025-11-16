import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type SpellVisibility = 'public' | 'team' | 'private'
type SpellRuntime = 'builtin' | 'api' | 'wasm'

const visibilityValues = new Set<SpellVisibility>(['public', 'team', 'private'])
const runtimeValues = new Set<SpellRuntime>(['builtin', 'api', 'wasm'])

export async function POST(request: NextRequest) {
  try {
    const userId = await authenticateRequest(request.headers)
    const body = await request.json()
    const {
      slug,
      description,
      runtime,
      config,
      priceAmount = 0,
      visibility = 'public',
      wasmBinary,
      metadata = {}
    } = body

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'description is required' }, { status: 400 })
    }

    if (!runtime || typeof runtime !== 'string' || !runtimeValues.has(runtime as SpellRuntime)) {
      return NextResponse.json({ error: 'runtime must be builtin, api, or wasm' }, { status: 400 })
    }

    if (typeof config !== 'object' || config === null) {
      return NextResponse.json({ error: 'config must be an object' }, { status: 400 })
    }

    if (typeof priceAmount !== 'number' || priceAmount < 0) {
      return NextResponse.json({ error: 'priceAmount must be a positive number' }, { status: 400 })
    }

    if (typeof visibility !== 'string' || !visibilityValues.has(visibility as SpellVisibility)) {
      return NextResponse.json({ error: 'visibility must be public, team, or private' }, { status: 400 })
    }

    if (typeof metadata !== 'object' || metadata === null) {
      return NextResponse.json({ error: 'metadata must be an object' }, { status: 400 })
    }

    const normalizedRuntime = runtime as SpellRuntime
    const normalizedVisibility = visibility as SpellVisibility

    const spell = await prisma.spell.create({
      data: {
        slug,
        description,
        runtime: normalizedRuntime,
        config,
        priceAmount,
        visibility: normalizedVisibility,
        createdBy: userId
      }
    })

    if (normalizedRuntime === 'wasm' || wasmBinary) {
      await prisma.runeArtifact.create({
        data: {
          spellId: spell.id,
          wasmBinary: wasmBinary ? Buffer.from(wasmBinary, 'base64') : undefined,
          metadata
        }
      })
    }

    return NextResponse.json({
      spellId: spell.id,
      slug: spell.slug,
      visibility: spell.visibility
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'slug already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
