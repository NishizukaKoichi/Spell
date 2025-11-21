import { describe, it, expect, beforeEach, jest } from '@jest/globals'

const constructStripeEvent = jest.fn()
const handleStripeEventMock = jest.fn()

jest.mock('@/lib/stripe-webhook', () => ({
  constructStripeEvent: (payload: string, signature: string) =>
    constructStripeEvent(payload, signature),
  handleStripeEvent: (event: any) => handleStripeEventMock(event)
}))

const { POST } = require('@/app/api/billing/webhook/route')

describe('POST /api/billing/webhook', () => {
  beforeEach(() => {
    constructStripeEvent.mockReset()
    handleStripeEventMock.mockReset()
  })

  function buildRequest(body: string, headers: Record<string, string> = {}) {
    return {
      text: async () => body,
      headers: new Headers(headers)
    } as any
  }

  it('returns 400 when signature header missing', async () => {
    const response = await POST(buildRequest('{}'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Missing stripe-signature header')
  })

  it('verifies signature and handles event', async () => {
    const event = { id: 'evt_test' }
    constructStripeEvent.mockReturnValue(event)
    handleStripeEventMock.mockResolvedValue(undefined)

    const response = await POST(
      buildRequest('{}', {
        'stripe-signature': 'sig'
      })
    )

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ received: true })
    expect(constructStripeEvent).toHaveBeenCalledWith('{}', 'sig')
    expect(handleStripeEventMock).toHaveBeenCalledWith(event)
  })

  it('returns 400 on invalid signature', async () => {
    const error = new Error('Invalid signature')
    ;(error as any).name = 'StripeSignatureVerificationError'
    constructStripeEvent.mockImplementation(() => {
      throw error
    })

    const response = await POST(
      buildRequest('{}', {
        'stripe-signature': 'sig'
      })
    )

    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Invalid signature')
  })
})
