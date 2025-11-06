import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import {
  verifyStripeSignature,
  WebhookSignatureError,
  WebhookConfigError,
} from '@/lib/webhook';
import { logPaymentSuccess, logPaymentFailed, logInvalidSignature } from '@/lib/audit-log';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  // Verify webhook signature
  let event: Stripe.Event;

  try {
    event = verifyStripeSignature(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    if (err instanceof WebhookConfigError) {
      console.error('[Stripe Webhook] Configuration error:', err.message);
      return NextResponse.json(
        { error: 'Webhook configuration error' },
        { status: 500 }
      );
    }

    if (err instanceof WebhookSignatureError) {
      console.error('[Stripe Webhook] Signature verification failed:', err.details);
      await logInvalidSignature('POST /api/webhooks/stripe', undefined, err.message);
      return NextResponse.json(
        { error: err.message },
        { status: 401 }
      );
    }

    console.error('[Stripe Webhook] Unexpected error during verification:', err);
    return NextResponse.json(
      { error: 'Webhook verification failed' },
      { status: 500 }
    );
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
        const cast = await prisma.cast.create({
          data: {
            spellId,
            casterId: userId,
            status: 'queued',
            costCents: session.amount_total || 0,
          },
        });

        // Update spell total casts
        await prisma.spell.update({
          where: { id: spellId },
          data: { totalCasts: { increment: 1 } },
        });

        // Log payment success
        await logPaymentSuccess(userId, session.id, spellId, session.amount_total || 0, {
          castId: cast.id,
          paymentIntent: session.payment_intent,
        });

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error('Payment failed:', paymentIntent.id);

        // Extract metadata if available
        const metadata = paymentIntent.metadata as { spellId?: string; userId?: string } | undefined;
        if (metadata?.userId && metadata?.spellId) {
          await logPaymentFailed(
            metadata.userId,
            paymentIntent.id,
            metadata.spellId,
            paymentIntent.last_payment_error?.message || 'Payment failed'
          );
        }

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
