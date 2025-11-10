import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { spellId, userId } = session.metadata as {
          spellId: string;
          userId: string;
        };

        // Create a cast for the purchased spell
        const spell = await prisma.spell.findUnique({
          where: { id: spellId },
          select: { key: true },
        });

        if (!spell) {
          console.error('Spell not found:', spellId);
          break;
        }

        await prisma.cast.create({
          data: {
            spellId,
            casterId: userId,
            status: 'queued',
            costCents: session.amount_total || 0,
            spellKey: spell.key,
            spellVersion: '1',
            inputHash: '',
            idempotencyKey: `stripe_${session.id}`,
          },
        });

        // Update spell total casts
        await prisma.spell.update({
          where: { id: spellId },
          data: { totalCasts: { increment: 1 } },
        });

        // Payment successful
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error('Payment failed:', paymentIntent.id);
        break;
      }

      default:
      // Unhandled event type
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
