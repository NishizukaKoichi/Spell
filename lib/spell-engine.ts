import { prisma } from './prisma'
import { createPaymentIntent } from './stripe'
import { SpellRuntime, Spell, BillingStatus } from '@prisma/client'

export interface SpellExecutionInput {
  userId: string
  spellId: string
  parameters: Record<string, unknown>
}

export interface SpellExecutionResult {
  success: boolean
  output?: unknown
  error?: string
  billingRecordId?: string
}

/**
 * Execute a spell with billing and runtime handling
 */
export async function executeSpell(input: SpellExecutionInput): Promise<SpellExecutionResult> {
  const { userId, spellId, parameters } = input

  // Get spell
  const spell = await prisma.spell.findUnique({
    where: { id: spellId }
  })

  if (!spell) {
    return {
      success: false,
      error: 'Spell not found'
    }
  }

  // Check visibility
  if (!canAccessSpell(userId, spell)) {
    return {
      success: false,
      error: 'Access denied'
    }
  }

  // Handle billing if spell has a price
  let billingRecordId: string | undefined

  if (spell.priceAmount > 0) {
    try {
      const paymentIntent = await createPaymentIntent(
        userId,
        spell.priceAmount,
        'usd'
      )

      // Create billing record
      const billingRecord = await prisma.billingRecord.create({
        data: {
          userId,
          spellId: spell.id,
          amount: spell.priceAmount,
          currency: 'usd',
          paymentIntentId: paymentIntent.id,
          status: BillingStatus.SUCCEEDED
        }
      })

      billingRecordId = billingRecord.id
    } catch (error) {
      // Create failed billing record
      await prisma.billingRecord.create({
        data: {
          userId,
          spellId: spell.id,
          amount: spell.priceAmount,
          currency: 'usd',
          paymentIntentId: 'failed',
          status: BillingStatus.FAILED
        }
      })

      return {
        success: false,
        error: 'Payment failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }

  // Execute spell based on runtime
  try {
    const output = await executeSpellRuntime(spell, parameters)

    return {
      success: true,
      output,
      billingRecordId
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
      billingRecordId
    }
  }
}

/**
 * Check if user can access spell based on visibility
 */
function canAccessSpell(userId: string, spell: Spell): boolean {
  if (spell.visibility === 'PUBLIC') {
    return true
  }

  if (spell.visibility === 'PRIVATE') {
    return spell.createdBy === userId
  }

  // TEAM visibility - TODO: implement team membership check
  return spell.createdBy === userId
}

/**
 * Execute spell based on runtime type
 */
async function executeSpellRuntime(
  spell: Spell,
  parameters: Record<string, unknown>
): Promise<unknown> {
  switch (spell.runtime) {
    case SpellRuntime.BUILTIN:
      return executeBuiltinSpell(spell, parameters)

    case SpellRuntime.API:
      return executeApiSpell(spell, parameters)

    case SpellRuntime.WASM:
      return executeWasmSpell(spell, parameters)

    default:
      throw new Error('Unknown runtime type')
  }
}

/**
 * Execute builtin spell
 */
async function executeBuiltinSpell(
  spell: Spell,
  parameters: Record<string, unknown>
): Promise<unknown> {
  const config = spell.config as { handler: string }

  // Built-in spell handlers would be registered here
  // For now, return a simple echo
  return {
    type: 'builtin',
    handler: config.handler,
    parameters,
    timestamp: new Date().toISOString()
  }
}

/**
 * Execute API spell
 */
async function executeApiSpell(
  spell: Spell,
  parameters: Record<string, unknown>
): Promise<unknown> {
  const config = spell.config as {
    url: string
    method: string
    headers?: Record<string, string>
  }

  const response = await fetch(config.url, {
    method: config.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...config.headers
    },
    body: JSON.stringify(parameters)
  })

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Execute WASM spell
 */
async function executeWasmSpell(
  spell: Spell,
  parameters: Record<string, unknown>
): Promise<unknown> {
  // Get WASM artifact
  const artifact = await prisma.runeArtifact.findFirst({
    where: { spellId: spell.id },
    orderBy: { createdAt: 'desc' }
  })

  if (!artifact || !artifact.wasmBinary) {
    throw new Error('WASM binary not found')
  }

  // Load and execute WASM module
  // This is a simplified version - real implementation would use wasmtime or similar
  const module = await WebAssembly.instantiate(artifact.wasmBinary)

  // Call the main export with parameters
  // This would need proper WASM interface handling
  return {
    type: 'wasm',
    parameters,
    result: 'WASM execution (placeholder)'
  }
}

/**
 * Estimate spell execution cost
 */
export async function estimateSpellCost(spellId: string): Promise<{
  priceAmount: number
  currency: string
}> {
  const spell = await prisma.spell.findUnique({
    where: { id: spellId }
  })

  if (!spell) {
    throw new Error('Spell not found')
  }

  return {
    priceAmount: spell.priceAmount,
    currency: 'usd'
  }
}
