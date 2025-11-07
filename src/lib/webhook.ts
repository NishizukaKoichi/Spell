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
    console.error('Failed to deliver webhook:', error);
  });
}
