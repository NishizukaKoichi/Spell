import { NextRequest, NextResponse } from 'next/server'
import { constructStripeEvent, handleStripeEvent } from '@/lib/stripe-webhook'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const rawBody = await request.text()

  try {
    const event = constructStripeEvent(rawBody, signature)
    await handleStripeEvent(event)

    return NextResponse.json({ received: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('STRIPE_WEBHOOK_SECRET')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (isStripeSignatureError(error)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

function isStripeSignatureError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'name' in error &&
    error.name === 'StripeSignatureVerificationError'
  )
}
