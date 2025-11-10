import { createRequestLogger } from '@/lib/logger';

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

import { createRequestLogger } from '@/lib/logger';

export async function deliverWebhook(
  webhookUrl: string,
  payload: WebhookPayload,
  retries = 3
): Promise<boolean> {
  const log = createRequestLogger('webhook', webhookUrl, 'POST');
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
        log.info('Webhook delivered', { attempt });
        return true;
      }

      log.warn('Webhook delivery failed', {
        attempt,
        status: response.status,
        statusText: response.statusText,
      });

      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        log.error('Webhook delivery aborted due to client error', {
          status: response.status,
        });
        return false;
      }
    } catch (error) {
      log.error('Webhook delivery error', error as Error, { attempt });
    }

    // Wait before retrying (exponential backoff)
    if (attempt < retries) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  log.error('Webhook delivery failed after max retries', new Error('webhook-delivery-failed'), {
    retries,
  });
  return false;
}

export async function sendCastStatusWebhook(cast: {
  id: string;
  status: string;
  spellId: string;
  casterId: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
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
      duration: cast.durationMs,
      costCents: cast.costCents,
      artifactUrl: cast.artifactUrl,
      errorMessage: cast.errorMessage,
      createdAt: cast.createdAt,
    },
    timestamp: new Date().toISOString(),
  };

  // Fire and forget - don't block the main flow
  deliverWebhook(cast.spell.webhookUrl, payload).catch((error) => {
    createRequestLogger('webhook', cast.spell.webhookUrl!, 'POST').error(
      'Failed to deliver webhook',
      error as Error
    );
  });
}
