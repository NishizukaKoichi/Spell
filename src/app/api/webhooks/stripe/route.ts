// Stripe Webhook Handler - TKT-021
// SPEC Reference: Section 13 (Webhooks & Monitoring)

import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { parseStripeWebhookEvent, StripeWebhookError } from '@/lib/stripe-webhook';
import { ErrorCatalog, handleError, apiSuccess } from '@/lib/api-response';
import { createRequestLogger } from '@/lib/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

export async function POST(req: NextRequest) {
  const requestLogger = createRequestLogger(randomUUID(), '/webhooks/stripe', 'POST');

  try {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    requestLogger.info('Stripe webhook received', {
      hasSignature: !!signature,
    });

    let event: Stripe.Event;
    try {
      event = parseStripeWebhookEvent(body, signature, undefined, stripe);
    } catch (error) {
      if (error instanceof StripeWebhookError) {
        requestLogger.warn('Stripe webhook verification failed', {
          status: error.status,
          message: error.message,
        });
        throw ErrorCatalog.UNAUTHORIZED();
      }
      throw error;
    }

    requestLogger.info('Processing Stripe event', {
      eventType: event.type,
      eventId: event.id,
    });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const { spellId, userId } = session.metadata as {
          spellId: string;
          userId: string;
        };

        requestLogger.info('Checkout session completed', {
          sessionId: session.id,
          spellId,
          userId,
          amount: session.amount_total,
        });

        // Create a cast for the purchased spell
        const spell = await prisma.spell.findUnique({
          where: { id: spellId },
          select: { key: true },
        });

        if (!spell) {
          requestLogger.warn('Spell not found in checkout session', { spellId });
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

        requestLogger.info('Cast created from checkout session', {
          spellId,
          userId,
        });
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        requestLogger.warn('Payment intent failed', {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
        });
        break;
      }

      default:
        requestLogger.info('Unhandled event type', { eventType: event.type });
    }

    return apiSuccess({ received: true });
  } catch (error) {
    requestLogger.error('Stripe webhook handler error', error as Error);
    return handleError(error);
  }
}
