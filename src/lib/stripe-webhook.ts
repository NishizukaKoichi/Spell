import Stripe from 'stripe';

import { stripe } from '@/lib/stripe';

export class StripeWebhookError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'StripeWebhookError';
  }
}

export function parseStripeWebhookEvent(
  rawBody: string,
  signature: string | null,
  secret = process.env.STRIPE_WEBHOOK_SECRET,
  stripeClient: Stripe = stripe
): Stripe.Event {
  if (!secret) {
    throw new StripeWebhookError('Stripe webhook secret is not configured', 500);
  }

  if (!signature) {
    throw new StripeWebhookError('No signature provided', 400);
  }

  try {
    return stripeClient.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    throw new StripeWebhookError('Invalid Stripe signature', 400);
  }
}
