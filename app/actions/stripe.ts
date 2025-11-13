'use server';

import { stripe } from '@/lib/stripe';

export async function createSetupIntent() {
  try {
    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ['card'],
    });

    return { clientSecret: setupIntent.client_secret };
  } catch (error) {
    console.error('[v0] Error creating setup intent:', error);
    throw new Error('Failed to create setup intent');
  }
}

export async function getPaymentMethods() {
  try {
    // In a real app, you would get the customer ID from the authenticated user
    // For demo purposes, we'll return mock data
    return {
      paymentMethods: [
        {
          id: 'pm_demo_1',
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025,
          },
        },
      ],
    };
  } catch (error) {
    console.error('[v0] Error fetching payment methods:', error);
    throw new Error('Failed to fetch payment methods');
  }
}

export async function removePaymentMethod(paymentMethodId: string) {
  try {
    await stripe.paymentMethods.detach(paymentMethodId);
    return { success: true };
  } catch (error) {
    console.error('[v0] Error removing payment method:', error);
    throw new Error('Failed to remove payment method');
  }
}
