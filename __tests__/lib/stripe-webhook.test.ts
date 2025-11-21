import { describe, it, expect, beforeEach, jest } from '@jest/globals'

jest.mock('@/lib/prisma', () => jest.requireActual('../../__mocks__/lib/prisma'))
jest.mock('@/lib/stripe', () => ({
  getStripeClient: jest.fn(() => ({
    webhooks: {
      constructEvent: jest.fn((_payload: string) => ({
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { object: { customer: 'cus_123', metadata: { userId: 'user-123' } } }
      }))
    }
  }))
}))

const {
  prisma,
  resetPrismaMock
} = jest.requireMock('@/lib/prisma') as {
  prisma: {
    stripeWebhookEvent: {
      findUnique: jest.Mock
      create: jest.Mock
      update: jest.Mock
    }
    user: {
      update: jest.Mock
      updateMany: jest.Mock
    }
    billingRecord: {
      findFirst: jest.Mock
      update: jest.Mock
    }
  }
  resetPrismaMock: () => void
}

const { constructStripeEvent, handleStripeEvent } = require('@/lib/stripe-webhook') as typeof import('@/lib/stripe-webhook')

describe('Stripe webhook helpers', () => {
  beforeEach(() => {
    resetPrismaMock()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  describe('constructStripeEvent', () => {
    it('throws if webhook secret missing', () => {
      delete process.env.STRIPE_WEBHOOK_SECRET

      expect(() => constructStripeEvent('{}', 'sig')).toThrow('STRIPE_WEBHOOK_SECRET is not configured')
    })

    it('returns event when secret set', () => {
      const event = constructStripeEvent('{}', 'sig')
      expect(event.id).toBe('evt_123')
    })
  })

  describe('handleStripeEvent', () => {
    const baseEvent = {
      id: 'evt_123',
      type: 'checkout.session.completed',
      data: { object: { customer: 'cus_123', metadata: { userId: 'user-123' } } }
    } as any

    it('skips already processed events', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue({ id: 'existing' })

      await handleStripeEvent(baseEvent)

      expect(prisma.stripeWebhookEvent.create).not.toHaveBeenCalled()
    })

    it('processes checkout session completion', async () => {
      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null)
      prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'rec_1' })

      await handleStripeEvent(baseEvent)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { stripeCustomerId: 'cus_123' }
      })
      expect(prisma.stripeWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'rec_1' },
        data: expect.objectContaining({ processedAt: expect.any(Date) })
      })
    })

    it('updates billing record on payment intent events', async () => {
      const paymentEvent = {
        id: 'evt_pi',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } }
      } as any

      prisma.stripeWebhookEvent.findUnique.mockResolvedValue(null)
      prisma.stripeWebhookEvent.create.mockResolvedValue({ id: 'rec_2' })
      prisma.billingRecord.findFirst.mockResolvedValue({ id: 'billing-1', status: 'failed' })

      await handleStripeEvent(paymentEvent)

      expect(prisma.billingRecord.update).toHaveBeenCalledWith({
        where: { id: 'billing-1' },
        data: { status: 'succeeded' }
      })
    })
  })
})
