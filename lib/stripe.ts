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

export class MissingPaymentMethodError extends Error {
  constructor(message = 'No payment method on file') {
    super(message)
    this.name = 'MissingPaymentMethodError'
  }
}

export class PaymentMethodAlreadyExistsError extends Error {
  constructor(message = 'Payment method already on file') {
    super(message)
    this.name = 'PaymentMethodAlreadyExistsError'
  }
}

export class PaymentIntentOwnershipError extends Error {
  constructor(message = 'PaymentIntent does not belong to this user') {
    super(message)
    this.name = 'PaymentIntentOwnershipError'
  }
}

function assertStripeCustomer(
  customer: Stripe.Customer | Stripe.DeletedCustomer
): asserts customer is Stripe.Customer {
  if ('deleted' in customer && customer.deleted) {
    throw new Error('Stripe customer record has been deleted')
  }
}

function extractDefaultPaymentMethodId(customer: Stripe.Customer): string | null {
  const paymentMethod = customer.invoice_settings?.default_payment_method

  if (!paymentMethod) {
    return null
  }

  return typeof paymentMethod === 'string' ? paymentMethod : paymentMethod.id
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
  const customer = await getStripeClient().customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method']
  })

  assertStripeCustomer(customer)

  if (extractDefaultPaymentMethodId(customer)) {
    throw new PaymentMethodAlreadyExistsError()
  }

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
  const customer = await getStripeClient().customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method']
  })

  assertStripeCustomer(customer)

  const paymentMethodId = extractDefaultPaymentMethodId(customer)

  if (!paymentMethodId) {
    throw new MissingPaymentMethodError()
  }

  const paymentIntent = await getStripeClient().paymentIntents.create({
    amount,
    currency,
    customer: customerId,
    payment_method: paymentMethodId,
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

export async function confirmPaymentIntentForUser(
  userId: string,
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const customerId = await getOrCreateCustomer(userId)
  const stripe = getStripeClient()
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  if (!paymentIntent) {
    throw new Error('PaymentIntent not found')
  }

  const intentCustomer = paymentIntent.customer
  const intentCustomerId =
    typeof intentCustomer === 'string'
      ? intentCustomer
      : intentCustomer && 'id' in intentCustomer
        ? (intentCustomer as Stripe.Customer).id
        : null

  if (!intentCustomerId || intentCustomerId !== customerId) {
    throw new PaymentIntentOwnershipError()
  }

  return stripe.paymentIntents.confirm(paymentIntentId)
}
