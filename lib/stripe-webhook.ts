import { Prisma, BillingStatus } from '@prisma/client'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { getStripeClient } from '@/lib/stripe'

const HANDLED_EVENT_TYPES = new Set<string>([
  'checkout.session.completed',
  'payment_intent.succeeded',
  'payment_intent.payment_failed'
])

export function constructStripeEvent(payload: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }

  return getStripeClient().webhooks.constructEvent(payload, signature, secret)
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { eventId: event.id }
  })

  if (existing) {
    return
  }

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    await prisma.stripeWebhookEvent.create({
      data: {
        eventId: event.id,
        type: event.type,
        payload: event.data.object as unknown as Prisma.InputJsonValue,
        processedAt: new Date()
      }
    })
    return
  }

  const stored = await prisma.stripeWebhookEvent.create({
    data: {
      eventId: event.id,
      type: event.type,
      payload: event.data.object as unknown as Prisma.InputJsonValue
    }
  })

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'payment_intent.succeeded':
        await handlePaymentIntent(event.data.object as Stripe.PaymentIntent, 'succeeded')
        break
      case 'payment_intent.payment_failed':
        await handlePaymentIntent(event.data.object as Stripe.PaymentIntent, 'failed')
        break
      default:
        break
    }

    await prisma.stripeWebhookEvent.update({
      where: { id: stored.id },
      data: { processedAt: new Date(), errorMessage: null }
    })
  } catch (error) {
    await prisma.stripeWebhookEvent.update({
      where: { id: stored.id },
      data: { errorMessage: error instanceof Error ? error.message : 'Unknown error' }
    })
    throw error
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const customerId = extractCustomerId(session.customer)

  if (!customerId) {
    return
  }

  const userId = session.metadata?.userId

  if (userId) {
    try {
      await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId }
      })
    } catch {
      // user might not exist locally; ignore to keep webhook idempotent
    }
    return
  }

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: { stripeCustomerId: customerId }
  })
}

async function handlePaymentIntent(paymentIntent: Stripe.PaymentIntent, status: BillingStatus) {
  const billingRecord = await prisma.billingRecord.findFirst({
    where: { paymentIntentId: paymentIntent.id }
  })

  if (!billingRecord) {
    return
  }

  if (billingRecord.status === status) {
    return
  }

  await prisma.billingRecord.update({
    where: { id: billingRecord.id },
    data: { status }
  })
}

function extractCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | null {
  if (!customer) {
    return null
  }

  if (typeof customer === 'string') {
    return customer
  }

  if ('deleted' in customer && customer.deleted) {
    return null
  }

  return customer.id
}
