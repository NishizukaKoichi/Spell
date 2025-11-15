import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { executeSpell, estimateSpellCost } from '@/lib/spell-engine'
import { prisma } from '@/lib/prisma'
import { createPaymentIntent } from '@/lib/stripe'
import { SpellRuntime, SpellVisibility, BillingStatus } from '@prisma/client'

// Mock dependencies
jest.mock('@/lib/prisma')
jest.mock('@/lib/stripe')

const mockSpell = {
  id: 'spell-123',
  slug: 'test-spell',
  description: 'Test spell',
  runtime: SpellRuntime.BUILTIN,
  config: { handler: 'test-handler' },
  priceAmount: 0,
  visibility: SpellVisibility.PUBLIC,
  createdBy: 'user-123',
  createdAt: new Date()
}

describe('Spell Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('executeSpell', () => {
    it('should execute free public spell successfully', async () => {
      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue(mockSpell)

      const result = await executeSpell({
        userId: 'user-456',
        spellId: 'spell-123',
        parameters: { input: 'test' }
      })

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
      expect(result.billingRecordId).toBeUndefined()
    })

    it('should return error for non-existent spell', async () => {
      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await executeSpell({
        userId: 'user-123',
        spellId: 'non-existent',
        parameters: {}
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Spell not found')
    })

    it('should enforce visibility for private spells', async () => {
      const privateSpell = {
        ...mockSpell,
        visibility: SpellVisibility.PRIVATE,
        createdBy: 'owner-user'
      }

      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue(privateSpell)

      const result = await executeSpell({
        userId: 'different-user',
        spellId: 'spell-123',
        parameters: {}
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Access denied')
    })

    it('should allow owner to execute private spell', async () => {
      const privateSpell = {
        ...mockSpell,
        visibility: SpellVisibility.PRIVATE,
        createdBy: 'owner-user'
      }

      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue(privateSpell)

      const result = await executeSpell({
        userId: 'owner-user',
        spellId: 'spell-123',
        parameters: {}
      })

      expect(result.success).toBe(true)
    })

    it('should handle billing for paid spells', async () => {
      const paidSpell = {
        ...mockSpell,
        priceAmount: 500 // 500 cents = $5
      }

      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue(paidSpell)
      ;(createPaymentIntent as jest.Mock).mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded'
      })
      ;(prisma.billingRecord.create as jest.Mock).mockResolvedValue({
        id: 'billing-123',
        userId: 'user-123',
        spellId: 'spell-123',
        amount: 500,
        currency: 'usd',
        paymentIntentId: 'pi_test_123',
        status: BillingStatus.SUCCEEDED
      })

      const result = await executeSpell({
        userId: 'user-123',
        spellId: 'spell-123',
        parameters: {}
      })

      expect(result.success).toBe(true)
      expect(result.billingRecordId).toBe('billing-123')
      expect(createPaymentIntent).toHaveBeenCalledWith('user-123', 500, 'usd')
    })

    it('should create failed billing record when payment fails', async () => {
      const paidSpell = {
        ...mockSpell,
        priceAmount: 500
      }

      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue(paidSpell)
      ;(createPaymentIntent as jest.Mock).mockRejectedValue(
        new Error('Insufficient funds')
      )
      ;(prisma.billingRecord.create as jest.Mock).mockResolvedValue({
        id: 'billing-failed-123',
        status: BillingStatus.FAILED
      })

      const result = await executeSpell({
        userId: 'user-123',
        spellId: 'spell-123',
        parameters: {}
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Payment failed')
      expect(prisma.billingRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: BillingStatus.FAILED,
          paymentIntentId: 'failed'
        })
      })
    })

    it('should execute BUILTIN runtime spell', async () => {
      const builtinSpell = {
        ...mockSpell,
        runtime: SpellRuntime.BUILTIN,
        config: { handler: 'echo' }
      }

      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue(builtinSpell)

      const result = await executeSpell({
        userId: 'user-123',
        spellId: 'spell-123',
        parameters: { message: 'hello' }
      })

      expect(result.success).toBe(true)
      expect(result.output).toMatchObject({
        type: 'builtin',
        handler: 'echo',
        parameters: { message: 'hello' }
      })
    })

    it('should execute API runtime spell', async () => {
      const apiSpell = {
        ...mockSpell,
        runtime: SpellRuntime.API,
        config: {
          url: 'https://api.example.com/process',
          method: 'POST'
        }
      }

      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue(apiSpell)

      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: 'success' })
      }) as jest.Mock

      const result = await executeSpell({
        userId: 'user-123',
        spellId: 'spell-123',
        parameters: { input: 'test' }
      })

      expect(result.success).toBe(true)
      expect(result.output).toEqual({ result: 'success' })
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/process',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ input: 'test' })
        })
      )
    })

    it('should handle API runtime errors', async () => {
      const apiSpell = {
        ...mockSpell,
        runtime: SpellRuntime.API,
        config: {
          url: 'https://api.example.com/process',
          method: 'POST'
        }
      }

      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue(apiSpell)

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error'
      }) as jest.Mock

      const result = await executeSpell({
        userId: 'user-123',
        spellId: 'spell-123',
        parameters: {}
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('API call failed')
    })

    it('should execute WASM runtime spell', async () => {
      const wasmSpell = {
        ...mockSpell,
        runtime: SpellRuntime.WASM,
        config: { version: '1.0' }
      }

      const wasmBinary = new Uint8Array([0, 97, 115, 109]) // Mock WASM binary

      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue(wasmSpell)
      ;(prisma.runeArtifact.findFirst as jest.Mock).mockResolvedValue({
        id: 'artifact-123',
        spellId: 'spell-123',
        wasmBinary: Buffer.from(wasmBinary),
        metadata: {},
        createdAt: new Date()
      })

      const result = await executeSpell({
        userId: 'user-123',
        spellId: 'spell-123',
        parameters: { input: 'test' }
      })

      expect(result.success).toBe(true)
      expect(result.output).toMatchObject({
        type: 'wasm',
        parameters: { input: 'test' }
      })
    })

    it('should handle missing WASM artifact', async () => {
      const wasmSpell = {
        ...mockSpell,
        runtime: SpellRuntime.WASM
      }

      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue(wasmSpell)
      ;(prisma.runeArtifact.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await executeSpell({
        userId: 'user-123',
        spellId: 'spell-123',
        parameters: {}
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('WASM binary not found')
    })
  })

  describe('estimateSpellCost', () => {
    it('should return spell cost for free spell', async () => {
      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue({
        ...mockSpell,
        priceAmount: 0
      })

      const result = await estimateSpellCost('spell-123')

      expect(result).toEqual({
        priceAmount: 0,
        currency: 'usd'
      })
    })

    it('should return spell cost for paid spell', async () => {
      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue({
        ...mockSpell,
        priceAmount: 1000 // $10
      })

      const result = await estimateSpellCost('spell-123')

      expect(result).toEqual({
        priceAmount: 1000,
        currency: 'usd'
      })
    })

    it('should throw error for non-existent spell', async () => {
      ;(prisma.spell.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(estimateSpellCost('non-existent')).rejects.toThrow(
        'Spell not found'
      )
    })
  })
})
