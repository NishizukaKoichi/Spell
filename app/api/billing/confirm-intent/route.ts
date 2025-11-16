import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import { getStripeClient } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    await authenticateRequest(request.headers)
    const { paymentIntentId } = await request.json()

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return NextResponse.json(
        { error: 'paymentIntentId is required' },
        { status: 400 }
      )
    }

    const paymentIntent = await getStripeClient().paymentIntents.confirm(paymentIntentId)

    return NextResponse.json({
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('No such payment_intent') ? 404 : 500

    return NextResponse.json({ error: message }, { status })
  }
}
