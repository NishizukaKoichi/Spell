import { prisma } from '@/lib/prisma'
import { createPaymentIntent } from '@/lib/stripe'
import { Spell } from '@prisma/client'

const BILLING_CURRENCY = 'usd'

export interface SpellExecutionInput {
  userId: string
  spellId: string
  parameters: Record<string, unknown>
}

export type SpellExecutionErrorCode =
  | 'SPELL_NOT_FOUND'
  | 'VISIBILITY_DENIED'
  | 'BILLING_FAILED'
  | 'RUNTIME_ERROR'

export type SpellExecutionResult =
  | {
      status: 'success'
      output: unknown
      billingRecordId?: string
    }
  | {
      status: 'error'
      errorCode: SpellExecutionErrorCode
      message: string
      billingRecordId?: string
    }

function failure(
  errorCode: SpellExecutionErrorCode,
  message: string,
  billingRecordId?: string
): SpellExecutionResult {
  return {
    status: 'error',
    errorCode,
    message,
    billingRecordId
  }
}

/**
 * Execute a spell with billing and runtime handling
 */
export async function executeSpell(input: SpellExecutionInput): Promise<SpellExecutionResult> {
  const { userId, spellId, parameters } = input
  const spell = await prisma.spell.findUnique({
    where: { id: spellId }
  })

  if (!spell) {
    return failure('SPELL_NOT_FOUND', 'Spell not found')
  }

  if (!canAccessSpell(userId, spell)) {
    return failure('VISIBILITY_DENIED', 'Access denied')
  }

  const safeParameters =
    typeof parameters === 'object' && parameters !== null ? parameters : ({} as Record<string, unknown>)

  let billingRecordId: string | undefined

  if (spell.priceAmount > 0) {
    const chargeResult = await chargeSpell({
      userId,
      spell,
      amount: spell.priceAmount
    })

    if (!chargeResult.ok) {
      return chargeResult.error
    }

    billingRecordId = chargeResult.billingRecordId
  }

  try {
    const output = await executeSpellRuntime(spell, safeParameters)

    return {
      status: 'success',
      output,
      billingRecordId
    }
  } catch (error) {
    return failure(
      'RUNTIME_ERROR',
      error instanceof Error ? error.message : 'Execution failed',
      billingRecordId
    )
  }
}

/**
 * Check if user can access spell based on visibility
 */
function canAccessSpell(userId: string, spell: Spell): boolean {
  if (spell.visibility === 'public') {
    return true
  }

  if (spell.visibility === 'private') {
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
    case 'builtin':
      return executeBuiltinSpell(spell, parameters)

    case 'api':
      return executeApiSpell(spell, parameters)

    case 'wasm':
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
  const artifact = await prisma.artifact.findFirst({
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
    currency: BILLING_CURRENCY
  }
}

type ChargeSuccess = {
  ok: true
  billingRecordId: string
}

type ChargeFailure = {
  ok: false
  error: SpellExecutionResult
}

async function chargeSpell({
  userId,
  spell,
  amount
}: {
  userId: string
  spell: Spell
  amount: number
}): Promise<ChargeSuccess | ChargeFailure> {
  try {
    const paymentIntent = await createPaymentIntent(userId, amount, BILLING_CURRENCY)

    const billingRecord = await prisma.billingRecord.create({
      data: {
        userId,
        spellId: spell.id,
        amount,
        currency: BILLING_CURRENCY,
        paymentIntentId: paymentIntent.id,
        status: 'succeeded'
      }
    })

    return {
      ok: true,
      billingRecordId: billingRecord.id
    }
  } catch (error) {
    await prisma.billingRecord.create({
      data: {
        userId,
        spellId: spell.id,
        amount,
        currency: BILLING_CURRENCY,
        paymentIntentId: 'failed',
        status: 'failed'
      }
    })

    return {
      ok: false,
      error: failure(
        'BILLING_FAILED',
        'Payment failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      )
    }
  }
}
