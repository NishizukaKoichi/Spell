import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

let stripeSingleton: Stripe | null = null

export function getStripeClient(): Stripe {
  if (stripeSingleton) {
    return stripeSingleton
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not defined')
  }

  stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia'
  })

  return stripeSingleton
}

/**
 * Get or create Stripe customer for user
 */
export async function getOrCreateCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    throw new Error('User not found')
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId
  }

  // Create new Stripe customer
  const customer = await getStripeClient().customers.create({
    metadata: {
      userId
    }
  })

  // Update user with Stripe customer ID
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id }
  })

  return customer.id
}

/**
 * Create checkout session for adding payment method
 */
export async function createCheckoutSession(userId: string): Promise<string> {
  const customerId = await getOrCreateCustomer(userId)

  const session = await getStripeClient().checkout.sessions.create({
    customer: customerId,
    mode: 'setup',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/cancel`,
  })

  return session.url!
}

/**
 * Create payment intent for spell execution
 */
export async function createPaymentIntent(
  userId: string,
  amount: number,
  currency: string = 'usd'
): Promise<Stripe.PaymentIntent> {
  const customerId = await getOrCreateCustomer(userId)

  // Get default payment method
  const customer = await getStripeClient().customers.retrieve(customerId) as Stripe.Customer

  if (!customer.invoice_settings?.default_payment_method) {
    throw new Error('No payment method on file')
  }

  const paymentIntent = await getStripeClient().paymentIntents.create({
    amount,
    currency,
    customer: customerId,
    payment_method: customer.invoice_settings.default_payment_method as string,
    confirm: true,
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never'
    }
  })

  return paymentIntent
}

/**
 * Create customer portal session
 */
export async function createPortalSession(userId: string): Promise<string> {
  const customerId = await getOrCreateCustomer(userId)

  const session = await getStripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  })

  return session.url
}
