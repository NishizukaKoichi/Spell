import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SpellRuntime, SpellVisibility } from '@prisma/client'

const visibilityValues = new Set(Object.values(SpellVisibility))
const runtimeValues = new Set(Object.values(SpellRuntime))

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
      visibility = SpellVisibility.PUBLIC,
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
      return NextResponse.json({ error: 'runtime must be BUILTIN, API, or WASM' }, { status: 400 })
    }

    if (typeof config !== 'object' || config === null) {
      return NextResponse.json({ error: 'config must be an object' }, { status: 400 })
    }

    if (typeof priceAmount !== 'number' || priceAmount < 0) {
      return NextResponse.json({ error: 'priceAmount must be a positive number' }, { status: 400 })
    }

    if (typeof visibility !== 'string' || !visibilityValues.has(visibility as SpellVisibility)) {
      return NextResponse.json({ error: 'visibility must be PUBLIC, TEAM, or PRIVATE' }, { status: 400 })
    }

    if (typeof metadata !== 'object' || metadata === null) {
      return NextResponse.json({ error: 'metadata must be an object' }, { status: 400 })
    }

    const spell = await prisma.spell.create({
      data: {
        slug,
        description,
        runtime: runtime as SpellRuntime,
        config,
        priceAmount,
        visibility: visibility as SpellVisibility,
        createdBy: userId
      }
    })

    if (runtime === SpellRuntime.WASM || wasmBinary) {
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
