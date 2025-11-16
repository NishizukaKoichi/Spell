import { describe, it, expect, beforeEach, jest } from '@jest/globals'

jest.mock('@/lib/prisma', () => jest.requireActual('../../__mocks__/lib/prisma'))

const createStripeMockInstance = () => ({
  customers: {
    create: jest.fn(),
    retrieve: jest.fn()
  },
  checkout: {
    sessions: {
      create: jest.fn()
    }
  },
  paymentIntents: {
    create: jest.fn()
  },
  billingPortal: {
    sessions: {
      create: jest.fn()
    }
  }
})

const stripeMockInstance = createStripeMockInstance()

const resetStripeMock = () => {
  stripeMockInstance.customers.create.mockReset()
  stripeMockInstance.customers.retrieve.mockReset()
  stripeMockInstance.checkout.sessions.create.mockReset()
  stripeMockInstance.paymentIntents.create.mockReset()
  stripeMockInstance.billingPortal.sessions.create.mockReset()
}

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => stripeMockInstance)
}))

process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

const {
  prisma,
  resetPrismaMock
} = jest.requireMock('@/lib/prisma') as {
  prisma: {
    user: {
      findUnique: jest.Mock
      update: jest.Mock
    }
  }
  resetPrismaMock: () => void
}

const stripeLib = require('@/lib/stripe') as typeof import('@/lib/stripe')
const {
  getOrCreateCustomer,
  createCheckoutSession,
  createPaymentIntent,
  createPortalSession
} = stripeLib

describe('Stripe Integration', () => {
  beforeEach(() => {
    resetPrismaMock()
    resetStripeMock()
  })

  describe('getOrCreateCustomer', () => {
    it('should return existing Stripe customer ID', async () => {
      const userId = 'user-123'
      const customerId = 'cus_existing'

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        stripeCustomerId: customerId,
        status: 'ACTIVE'
      })

      const result = await getOrCreateCustomer(userId)

      expect(result).toBe(customerId)
      expect(prisma.user.update).not.toHaveBeenCalled()
    })

    it('should create new Stripe customer if not exists', async () => {
      const userId = 'user-new'
      const newCustomerId = 'cus_new123'

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        stripeCustomerId: null,
        status: 'ACTIVE'
      })

      stripeMockInstance.customers.create.mockResolvedValue({
        id: newCustomerId
      })

      ;(prisma.user.update as jest.Mock).mockResolvedValue({
        id: userId,
        stripeCustomerId: newCustomerId
      })

      const result = await getOrCreateCustomer(userId)

      expect(stripeMockInstance.customers.create).toHaveBeenCalledWith({
        metadata: { userId }
      })
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { stripeCustomerId: newCustomerId }
      })
      expect(result).toBe(newCustomerId)
    })

    it('should throw error if user not found', async () => {
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(getOrCreateCustomer('non-existent')).rejects.toThrow(
        'User not found'
      )
    })
  })

  describe('createCheckoutSession', () => {
    it('should create Stripe checkout session', async () => {
      const userId = 'user-123'
      const customerId = 'cus_123'
      const checkoutUrl = 'https://checkout.stripe.com/session123'

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        stripeCustomerId: customerId
      })

      stripeMockInstance.checkout.sessions.create.mockResolvedValue({
        url: checkoutUrl
      })

      const result = await createCheckoutSession(userId)

      expect(result).toBe(checkoutUrl)
      expect(stripeMockInstance.checkout.sessions.create).toHaveBeenCalledWith({
        customer: customerId,
        mode: 'setup',
        success_url: 'http://localhost:3000/billing/success',
        cancel_url: 'http://localhost:3000/billing/cancel'
      })
    })
  })

  describe('createPaymentIntent', () => {
    it('should create payment intent with existing payment method', async () => {
      const userId = 'user-123'
      const customerId = 'cus_123'
      const paymentMethodId = 'pm_123'
      const amount = 1000

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        stripeCustomerId: customerId
      })

      stripeMockInstance.customers.retrieve.mockResolvedValue({
        id: customerId,
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      })

      stripeMockInstance.paymentIntents.create.mockResolvedValue({
        id: 'pi_123',
        status: 'succeeded',
        amount
      })

      const result = await createPaymentIntent(userId, amount, 'usd')

      expect(result.id).toBe('pi_123')
      expect(stripeMockInstance.paymentIntents.create).toHaveBeenCalledWith({
        amount,
        currency: 'usd',
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        }
      })
    })

    it('should throw error if no payment method on file', async () => {
      const userId = 'user-123'
      const customerId = 'cus_123'

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        stripeCustomerId: customerId
      })

      stripeMockInstance.customers.retrieve.mockResolvedValue({
        id: customerId,
        invoice_settings: {
          default_payment_method: null
        }
      })

      await expect(createPaymentIntent(userId, 1000)).rejects.toThrow(
        'No payment method on file'
      )
    })
  })

  describe('createPortalSession', () => {
    it('should create billing portal session', async () => {
      const userId = 'user-123'
      const customerId = 'cus_123'
      const portalUrl = 'https://billing.stripe.com/portal/session123'

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: userId,
        stripeCustomerId: customerId
      })

      stripeMockInstance.billingPortal.sessions.create.mockResolvedValue({
        url: portalUrl
      })

      const result = await createPortalSession(userId)

      expect(result).toBe(portalUrl)
      expect(stripeMockInstance.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: customerId,
        return_url: 'http://localhost:3000/billing'
      })
    })
  })
})
