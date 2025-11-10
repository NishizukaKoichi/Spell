import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { createRequestLogger } from '@/lib/logger';
import { parseStripeWebhookEvent, StripeWebhookError } from '@/lib/stripe-webhook';

export async function POST(req: NextRequest) {
  const log = createRequestLogger('stripe-webhook', '/api/webhooks/stripe', 'POST');
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  let event: Stripe.Event;
  try {
    event = parseStripeWebhookEvent(body, signature);
  } catch (error) {
    const err = error as StripeWebhookError;
    log.warn('Stripe webhook verification failed', err);
    return NextResponse.json({ error: err.message }, { status: err.status });
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
          log.error('Spell not found for checkout session', new Error(`spellId=${spellId}`));
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
        log.warn(`Payment failed: ${paymentIntent.id}`);
        break;
      }

      default:
      // Unhandled event type
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error('Stripe webhook handler error', error as Error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
