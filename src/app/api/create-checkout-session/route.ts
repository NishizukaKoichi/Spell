import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import {
  IdempotencyMismatchError,
  initIdempotencyKey,
  persistIdempotencyResult,
} from '@/lib/idempotency';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get('idempotency-key');

    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Idempotency-Key header is required' }, { status: 400 });
    }

    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { spellId } = await req.json();

    if (!spellId) {
      return NextResponse.json({ error: 'spellId is required' }, { status: 400 });
    }

    const initResult = await initIdempotencyKey({
      key: idempotencyKey,
      endpoint: 'POST /api/create-checkout-session',
      scope: session.user.id,
      requestPayload: { spellId },
    });

    if (initResult.state === 'replay') {
      return NextResponse.json(initResult.replay.body, { status: initResult.replay.status });
    }

    if (initResult.state === 'pending') {
      return NextResponse.json({ error: 'Request is already being processed' }, { status: 409 });
    }

    // Get spell details
    const spell = await prisma.spell.findUnique({
      where: { id: spellId },
    });

    if (!spell) {
      return NextResponse.json({ error: 'Spell not found' }, { status: 404 });
    }

    // Create Stripe checkout session
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
            unit_amount: spell.priceAmountCents, // Stripe expects cents
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
      customer_email: session.user.email,
    });

    const responseBody = {
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    };

    await persistIdempotencyResult({
      key: idempotencyKey,
      endpoint: 'POST /api/create-checkout-session',
      scope: session.user.id,
      responseStatus: 200,
      responseBody,
    });

    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof IdempotencyMismatchError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error('Checkout session error:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
