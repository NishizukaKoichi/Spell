import { describe, it, expect, beforeEach, jest } from '@jest/globals'

const mockGetUserIdFromHeaders = jest.fn()
const mockCreateCheckoutSession = jest.fn()

class MockPaymentMethodAlreadyExistsError extends Error {}

jest.mock('@/lib/auth', () => ({
  getUserIdFromHeaders: (headers: Headers) => mockGetUserIdFromHeaders(headers)
}))

jest.mock('@/lib/stripe', () => ({
  createCheckoutSession: (userId: string) => mockCreateCheckoutSession(userId),
  PaymentMethodAlreadyExistsError: MockPaymentMethodAlreadyExistsError
}))

const { POST } = require('@/app/api/billing/checkout-url/route')

describe('POST /api/billing/checkout-url', () => {
  beforeEach(() => {
    mockGetUserIdFromHeaders.mockReset()
    mockCreateCheckoutSession.mockReset()
  })

  it('returns checkout url for authenticated user', async () => {
    mockGetUserIdFromHeaders.mockReturnValue('user-123')
    mockCreateCheckoutSession.mockResolvedValue('https://checkout.stripe.com/test')

    const request = {
      headers: new Headers()
    } as any

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ url: 'https://checkout.stripe.com/test' })
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith('user-123')
  })

  it('returns 409 when payment method already exists', async () => {
    mockGetUserIdFromHeaders.mockReturnValue('user-123')
    mockCreateCheckoutSession.mockRejectedValue(
      new MockPaymentMethodAlreadyExistsError('Payment method already on file')
    )

    const request = {
      headers: new Headers()
    } as any

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('PAYMENT_METHOD_EXISTS')
  })
})
