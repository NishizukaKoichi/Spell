import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromHeaders } from '@/lib/auth'
import {
  confirmPaymentIntentForUser,
  PaymentIntentOwnershipError
} from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request.headers)
    const { paymentIntentId } = await request.json()

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return NextResponse.json(
        { error: 'paymentIntentId is required' },
        { status: 400 }
      )
    }

    const paymentIntent = await confirmPaymentIntentForUser(userId, paymentIntentId)

    return NextResponse.json({
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount
    })
  } catch (error) {
    if (
      error instanceof PaymentIntentOwnershipError ||
      (error instanceof Error && error.message.includes('does not belong'))
    ) {
      return NextResponse.json(
        { error: error.message, code: 'INTENT_CUSTOMER_MISMATCH' },
        { status: 403 }
      )
    }

    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('No such payment_intent') ? 404 : 500

    return NextResponse.json({ error: message }, { status })
  }
}
