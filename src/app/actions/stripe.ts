'use server';

import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

export async function createCheckoutSession(spellId: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const spell = await prisma.spell.findUnique({
    where: { id: spellId },
  });

  if (!spell) {
    throw new Error('Spell not found');
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: spell.priceCurrency.toLowerCase(),
          product_data: {
            name: spell.name,
            description: spell.description,
          },
          unit_amount: spell.priceAmountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      spellId: spell.id,
      userId: session.user.id,
    },
    success_url: `${process.env.NEXTAUTH_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/spells/${spell.id}?payment=cancelled`,
    customer_email: session.user.email || undefined,
  });

  return { url: checkoutSession.url, sessionId: checkoutSession.id };
}

export async function createPaymentMethod(paymentMethodId: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // In a real implementation, you would:
  // 1. Create or retrieve a Stripe customer
  // 2. Attach the payment method to the customer
  // 3. Store the customer ID in your database

  return { success: true, paymentMethodId };
}

export async function getPaymentMethods() {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // In a real implementation, you would:
  // 1. Retrieve the user's Stripe customer ID from database
  // 2. List payment methods attached to that customer
  // 3. Return the payment methods

  return { paymentMethods: [] };
}

export async function deletePaymentMethod(_paymentMethodId: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // In a real implementation, you would:
  // 1. Verify the payment method belongs to the user
  // 2. Detach the payment method from the customer

  return { success: true };
}

export async function createSetupIntent() {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // In a real implementation, you would:
  // 1. Create a Stripe Setup Intent
  // 2. Return the client secret

  const setupIntent = await stripe.setupIntents.create({
    payment_method_types: ['card'],
  });

  return { clientSecret: setupIntent.client_secret };
}

export async function removePaymentMethod(paymentMethodId: string) {
  return deletePaymentMethod(paymentMethodId);
}
