import { NextRequest } from 'next/server'
import { getUserIdFromHeaders } from '@/lib/auth'
import {
  confirmPaymentIntentForUser,
  PaymentIntentOwnershipError
} from '@/lib/stripe'
import { jsonError, jsonOk } from '@/lib/http'

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromHeaders(request.headers)
    const { paymentIntentId } = await request.json()

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return jsonError('PAYMENT_INTENT_ID_REQUIRED', 'paymentIntentId is required', 400)
    }

    const paymentIntent = await confirmPaymentIntentForUser(userId, paymentIntentId)

    return jsonOk({
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount
    })
  } catch (error) {
    if (
      error instanceof PaymentIntentOwnershipError ||
      (error instanceof Error && error.message.includes('does not belong'))
    ) {
      return jsonError('INTENT_CUSTOMER_MISMATCH', error.message, 403)
    }

    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('No such payment_intent') ? 404 : 500

    return jsonError(
      status === 404 ? 'PAYMENT_INTENT_NOT_FOUND' : 'INTERNAL_ERROR',
      message,
      status
    )
  }
}
