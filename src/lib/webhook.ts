import crypto from 'crypto';
import Stripe from 'stripe';

/**
 * Custom error types for webhook signature verification
 */
export class WebhookSignatureError extends Error {
  constructor(
    message: string,
    public readonly provider: 'stripe' | 'github',
    public readonly details?: string
  ) {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

export class WebhookConfigError extends Error {
  constructor(
    message: string,
    public readonly missingConfig: string
  ) {
    super(message);
    this.name = 'WebhookConfigError';
  }
}

/**
 * Webhook security event logger
 */
export function logWebhookSecurityEvent(event: {
  provider: 'stripe' | 'github';
  event: 'verification_success' | 'verification_failed' | 'missing_signature' | 'config_error';
  reason?: string;
  timestamp?: Date;
  headers?: Record<string, string | null>;
}): void {
  const logData = {
    ...event,
    timestamp: event.timestamp || new Date(),
    level: event.event === 'verification_success' ? 'info' : 'warn',
  };

  if (event.event === 'verification_success') {
    console.log(`[Webhook Security] ${event.provider.toUpperCase()} webhook verified successfully`, {
      provider: event.provider,
      timestamp: logData.timestamp.toISOString(),
    });
  } else {
    console.warn(`[Webhook Security] ${event.provider.toUpperCase()} webhook ${event.event}`, logData);
  }
}

/**
 * Verify Stripe webhook signature
 *
 * Uses Stripe's constructEvent method which:
 * - Verifies the signature header
 * - Checks the timestamp to prevent replay attacks
 * - Parses and returns the event object
 *
 * @param payload - Raw request body as string
 * @param signature - Stripe signature from stripe-signature header
 * @param secret - Webhook secret from Stripe dashboard
 * @returns Parsed Stripe event
 * @throws WebhookSignatureError if verification fails
 * @throws WebhookConfigError if secret is not configured
 */
export function verifyStripeSignature(
  payload: string,
  signature: string | null,
  secret: string | undefined
): Stripe.Event {
  // Validate configuration
  if (!secret) {
    logWebhookSecurityEvent({
      provider: 'stripe',
      event: 'config_error',
      reason: 'STRIPE_WEBHOOK_SECRET not configured',
    });
    throw new WebhookConfigError(
      'Stripe webhook secret not configured',
      'STRIPE_WEBHOOK_SECRET'
    );
  }

  // Validate signature header presence
  if (!signature) {
    logWebhookSecurityEvent({
      provider: 'stripe',
      event: 'missing_signature',
      reason: 'stripe-signature header not present',
    });
    throw new WebhookSignatureError(
      'Missing stripe-signature header',
      'stripe',
      'No signature provided in request headers'
    );
  }

  // Verify signature and construct event
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-10-29.clover',
  });

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, secret);

    logWebhookSecurityEvent({
      provider: 'stripe',
      event: 'verification_success',
      headers: {
        'event-type': event.type,
        'event-id': event.id,
      },
    });

    return event;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    logWebhookSecurityEvent({
      provider: 'stripe',
      event: 'verification_failed',
      reason: errorMessage,
    });

    throw new WebhookSignatureError(
      'Stripe signature verification failed',
      'stripe',
      errorMessage
    );
  }
}

/**
 * Verify GitHub webhook signature
 *
 * Uses HMAC SHA-256 to verify the webhook signature:
 * - Computes HMAC of payload using webhook secret
 * - Uses timing-safe comparison to prevent timing attacks
 * - Validates signature format (must start with 'sha256=')
 *
 * @param payload - Raw request body as string
 * @param signature - GitHub signature from x-hub-signature-256 header
 * @param secret - Webhook secret configured in GitHub
 * @returns true if signature is valid
 * @throws WebhookSignatureError if verification fails
 * @throws WebhookConfigError if secret is not configured
 */
export function verifyGitHubSignature(
  payload: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  // Validate configuration
  if (!secret) {
    logWebhookSecurityEvent({
      provider: 'github',
      event: 'config_error',
      reason: 'GITHUB_WEBHOOK_SECRET not configured',
    });
    throw new WebhookConfigError(
      'GitHub webhook secret not configured',
      'GITHUB_WEBHOOK_SECRET'
    );
  }

  // Validate signature header presence
  if (!signature) {
    logWebhookSecurityEvent({
      provider: 'github',
      event: 'missing_signature',
      reason: 'x-hub-signature-256 header not present',
    });
    throw new WebhookSignatureError(
      'Missing x-hub-signature-256 header',
      'github',
      'No signature provided in request headers'
    );
  }

  // Validate signature format
  if (!signature.startsWith('sha256=')) {
    logWebhookSecurityEvent({
      provider: 'github',
      event: 'verification_failed',
      reason: 'Invalid signature format (must start with sha256=)',
    });
    throw new WebhookSignatureError(
      'Invalid GitHub signature format',
      'github',
      'Signature must start with "sha256="'
    );
  }

  // Extract signature hash
  const expectedSignature = signature.slice(7);

  // Compute HMAC
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const calculatedSignature = hmac.digest('hex');

  // Timing-safe comparison
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(calculatedSignature)
    );

    if (isValid) {
      logWebhookSecurityEvent({
        provider: 'github',
        event: 'verification_success',
      });
    } else {
      logWebhookSecurityEvent({
        provider: 'github',
        event: 'verification_failed',
        reason: 'Signature mismatch',
      });
      throw new WebhookSignatureError(
        'GitHub signature verification failed',
        'github',
        'Computed signature does not match provided signature'
      );
    }

    return isValid;
  } catch (err) {
    // timingSafeEqual can throw if buffer lengths don't match
    if (err instanceof WebhookSignatureError) {
      throw err;
    }

    logWebhookSecurityEvent({
      provider: 'github',
      event: 'verification_failed',
      reason: 'Signature length mismatch or invalid format',
    });

    throw new WebhookSignatureError(
      'GitHub signature verification failed',
      'github',
      'Invalid signature format or length'
    );
  }
}

/**
 * Outgoing webhook payload types and delivery functions
 */
interface WebhookPayload {
  event: 'cast.succeeded' | 'cast.failed';
  cast: {
    id: string;
    status: string;
    spellId: string;
    spellName: string;
    casterId: string;
    startedAt: Date | null;
    finishedAt: Date | null;
    duration: number | null;
    costCents: number;
    artifactUrl: string | null;
    errorMessage: string | null;
    createdAt: Date;
  };
  timestamp: string;
}

export async function deliverWebhook(
  webhookUrl: string,
  payload: WebhookPayload,
  retries = 3
): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Spell-Platform-Webhook/1.0',
          'X-Spell-Event': payload.event,
          'X-Spell-Cast-ID': payload.cast.id,
          'X-Spell-Delivery-Attempt': attempt.toString(),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        return true;
      }

      console.warn(
        `Webhook delivery failed (attempt ${attempt}/${retries}): ${response.status} ${response.statusText}`
      );

      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        console.error(`Webhook delivery failed with client error: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error(`Webhook delivery error (attempt ${attempt}/${retries}):`, error);
    }

    // Wait before retrying (exponential backoff)
    if (attempt < retries) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.error(`Webhook delivery failed after ${retries} attempts`);
  return false;
}

export async function sendCastStatusWebhook(cast: {
  id: string;
  status: string;
  spellId: string;
  casterId: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  duration: number | null;
  costCents: number;
  artifactUrl: string | null;
  errorMessage: string | null;
  createdAt: Date;
  spell: {
    name: string;
    webhookUrl: string | null;
  };
}): Promise<void> {
  if (!cast.spell.webhookUrl) {
    return;
  }

  const event = cast.status === 'succeeded' ? 'cast.succeeded' : 'cast.failed';

  const payload: WebhookPayload = {
    event,
    cast: {
      id: cast.id,
      status: cast.status,
      spellId: cast.spellId,
      spellName: cast.spell.name,
      casterId: cast.casterId,
      startedAt: cast.startedAt,
      finishedAt: cast.finishedAt,
      duration: cast.duration,
      costCents: cast.costCents,
      artifactUrl: cast.artifactUrl,
      errorMessage: cast.errorMessage,
      createdAt: cast.createdAt,
    },
    timestamp: new Date().toISOString(),
  };

  // Fire and forget - don't block the main flow
  deliverWebhook(cast.spell.webhookUrl, payload).catch((error) => {
    console.error('Failed to deliver webhook:', error);
  });
}
