import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import Stripe from 'stripe';

import {
  verifyStripeSignature,
  verifyGitHubSignature,
  WebhookSignatureError,
  WebhookConfigError,
  logWebhookSecurityEvent,
} from '@/lib/webhook';

// Mock console methods to suppress logs during tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeEach(() => {
  console.log = mock.fn();
  console.warn = mock.fn();
  console.error = mock.fn();
});

// Helper to generate valid GitHub signature
function generateGitHubSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return 'sha256=' + hmac.digest('hex');
}

// Helper to generate valid Stripe signature (simplified for testing)
function generateStripeSignature(payload: string, secret: string, timestamp: number): string {
  const signedPayload = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signedPayload);
  const signature = hmac.digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('verifyGitHubSignature', () => {
  const secret = 'test-webhook-secret';
  const payload = JSON.stringify({ action: 'completed', workflow_run: { id: 123 } });

  it('successfully verifies valid signature', () => {
    const signature = generateGitHubSignature(payload, secret);
    const result = verifyGitHubSignature(payload, signature, secret);
    assert.equal(result, true);
  });

  it('throws WebhookConfigError when secret is undefined', () => {
    const signature = generateGitHubSignature(payload, secret);
    assert.throws(
      () => verifyGitHubSignature(payload, signature, undefined),
      (err: Error) => {
        assert.ok(err instanceof WebhookConfigError);
        assert.equal(err.message, 'GitHub webhook secret not configured');
        assert.equal((err as WebhookConfigError).missingConfig, 'GITHUB_WEBHOOK_SECRET');
        return true;
      }
    );
  });

  it('throws WebhookSignatureError when signature is missing', () => {
    assert.throws(
      () => verifyGitHubSignature(payload, null, secret),
      (err: Error) => {
        assert.ok(err instanceof WebhookSignatureError);
        assert.equal(err.message, 'Missing x-hub-signature-256 header');
        assert.equal((err as WebhookSignatureError).provider, 'github');
        return true;
      }
    );
  });

  it('throws WebhookSignatureError when signature format is invalid', () => {
    const invalidSignature = 'invalid-format-signature';
    assert.throws(
      () => verifyGitHubSignature(payload, invalidSignature, secret),
      (err: Error) => {
        assert.ok(err instanceof WebhookSignatureError);
        assert.equal(err.message, 'Invalid GitHub signature format');
        assert.equal((err as WebhookSignatureError).provider, 'github');
        return true;
      }
    );
  });

  it('throws WebhookSignatureError when signature is incorrect', () => {
    const wrongSecret = 'wrong-secret';
    const signature = generateGitHubSignature(payload, wrongSecret);

    assert.throws(
      () => verifyGitHubSignature(payload, signature, secret),
      (err: Error) => {
        assert.ok(err instanceof WebhookSignatureError);
        assert.equal(err.message, 'GitHub signature verification failed');
        assert.equal((err as WebhookSignatureError).provider, 'github');
        return true;
      }
    );
  });

  it('throws WebhookSignatureError when signature length is invalid', () => {
    const invalidSignature = 'sha256=invalidlength';

    assert.throws(
      () => verifyGitHubSignature(payload, invalidSignature, secret),
      (err: Error) => {
        assert.ok(err instanceof WebhookSignatureError);
        assert.equal((err as WebhookSignatureError).provider, 'github');
        return true;
      }
    );
  });

  it('logs security events for successful verification', () => {
    const signature = generateGitHubSignature(payload, secret);
    verifyGitHubSignature(payload, signature, secret);

    // Verify console.log was called with security event
    assert.equal((console.log as any).mock.calls.length > 0, true);
  });

  it('logs security events for failed verification', () => {
    const wrongSecret = 'wrong-secret';
    const signature = generateGitHubSignature(payload, wrongSecret);

    assert.throws(() => verifyGitHubSignature(payload, signature, secret));

    // Verify console.warn was called with security event
    assert.equal((console.warn as any).mock.calls.length > 0, true);
  });
});

describe('verifyStripeSignature', () => {
  const secret = 'whsec_test123';
  const stripeSecretKey = 'sk_test_123';

  // Set environment variable for Stripe
  process.env.STRIPE_SECRET_KEY = stripeSecretKey;

  it('throws WebhookConfigError when secret is undefined', () => {
    const payload = JSON.stringify({ id: 'evt_123', type: 'payment_intent.succeeded' });
    const signature = 'test-signature';

    assert.throws(
      () => verifyStripeSignature(payload, signature, undefined),
      (err: Error) => {
        assert.ok(err instanceof WebhookConfigError);
        assert.equal(err.message, 'Stripe webhook secret not configured');
        assert.equal((err as WebhookConfigError).missingConfig, 'STRIPE_WEBHOOK_SECRET');
        return true;
      }
    );
  });

  it('throws WebhookSignatureError when signature is missing', () => {
    const payload = JSON.stringify({ id: 'evt_123', type: 'payment_intent.succeeded' });

    assert.throws(
      () => verifyStripeSignature(payload, null, secret),
      (err: Error) => {
        assert.ok(err instanceof WebhookSignatureError);
        assert.equal(err.message, 'Missing stripe-signature header');
        assert.equal((err as WebhookSignatureError).provider, 'stripe');
        return true;
      }
    );
  });

  it('throws WebhookSignatureError when signature is invalid', () => {
    const payload = JSON.stringify({ id: 'evt_123', type: 'payment_intent.succeeded' });
    const invalidSignature = 't=123456789,v1=invalid';

    assert.throws(
      () => verifyStripeSignature(payload, invalidSignature, secret),
      (err: Error) => {
        assert.ok(err instanceof WebhookSignatureError);
        assert.equal(err.message, 'Stripe signature verification failed');
        assert.equal((err as WebhookSignatureError).provider, 'stripe');
        assert.ok((err as WebhookSignatureError).details);
        return true;
      }
    );
  });

  it('logs security events for failed verification', () => {
    const payload = JSON.stringify({ id: 'evt_123', type: 'payment_intent.succeeded' });
    const invalidSignature = 't=123456789,v1=invalid';

    assert.throws(() => verifyStripeSignature(payload, invalidSignature, secret));

    // Verify console.warn was called with security event
    assert.equal((console.warn as any).mock.calls.length > 0, true);
  });

  // Note: Testing successful Stripe signature verification would require either:
  // 1. Mocking the Stripe library's constructEvent method
  // 2. Using actual Stripe test fixtures with valid signatures
  // 3. Using Stripe's test helpers
  //
  // For real-world testing, you should use integration tests with Stripe's webhook
  // testing tools or mock the stripe.webhooks.constructEvent method.
});

describe('logWebhookSecurityEvent', () => {
  it('logs success events with console.log', () => {
    // Restore console.log temporarily to test it
    console.log = originalConsoleLog;
    const logSpy = mock.fn();
    console.log = logSpy;

    logWebhookSecurityEvent({
      provider: 'stripe',
      event: 'verification_success',
    });

    assert.equal(logSpy.mock.calls.length, 1);
    assert.ok(logSpy.mock.calls[0].arguments[0].includes('STRIPE'));
    assert.ok(logSpy.mock.calls[0].arguments[0].includes('verified successfully'));
  });

  it('logs failure events with console.warn', () => {
    // Restore console.warn temporarily to test it
    console.warn = originalConsoleWarn;
    const warnSpy = mock.fn();
    console.warn = warnSpy;

    logWebhookSecurityEvent({
      provider: 'github',
      event: 'verification_failed',
      reason: 'Invalid signature',
    });

    assert.equal(warnSpy.mock.calls.length, 1);
    assert.ok(warnSpy.mock.calls[0].arguments[0].includes('GITHUB'));
    assert.ok(warnSpy.mock.calls[0].arguments[0].includes('verification_failed'));
  });

  it('includes timestamp in log data', () => {
    console.warn = originalConsoleWarn;
    const warnSpy = mock.fn();
    console.warn = warnSpy;

    const testTimestamp = new Date('2025-01-01T00:00:00Z');
    logWebhookSecurityEvent({
      provider: 'github',
      event: 'missing_signature',
      timestamp: testTimestamp,
    });

    assert.equal(warnSpy.mock.calls.length, 1);
    const logData = warnSpy.mock.calls[0].arguments[1];
    assert.equal(logData.timestamp.toISOString(), testTimestamp.toISOString());
  });

  it('logs config errors appropriately', () => {
    console.warn = originalConsoleWarn;
    const warnSpy = mock.fn();
    console.warn = warnSpy;

    logWebhookSecurityEvent({
      provider: 'stripe',
      event: 'config_error',
      reason: 'STRIPE_WEBHOOK_SECRET not configured',
    });

    assert.equal(warnSpy.mock.calls.length, 1);
    const logMessage = warnSpy.mock.calls[0].arguments[0];
    assert.ok(logMessage.includes('config_error'));
  });
});

describe('WebhookSignatureError', () => {
  it('creates error with correct properties', () => {
    const error = new WebhookSignatureError(
      'Test error',
      'stripe',
      'Test details'
    );

    assert.equal(error.name, 'WebhookSignatureError');
    assert.equal(error.message, 'Test error');
    assert.equal(error.provider, 'stripe');
    assert.equal(error.details, 'Test details');
    assert.ok(error instanceof Error);
  });

  it('works without details parameter', () => {
    const error = new WebhookSignatureError('Test error', 'github');

    assert.equal(error.name, 'WebhookSignatureError');
    assert.equal(error.message, 'Test error');
    assert.equal(error.provider, 'github');
    assert.equal(error.details, undefined);
  });
});

describe('WebhookConfigError', () => {
  it('creates error with correct properties', () => {
    const error = new WebhookConfigError(
      'Config missing',
      'WEBHOOK_SECRET'
    );

    assert.equal(error.name, 'WebhookConfigError');
    assert.equal(error.message, 'Config missing');
    assert.equal(error.missingConfig, 'WEBHOOK_SECRET');
    assert.ok(error instanceof Error);
  });
});

// Cleanup after all tests
process.on('beforeExit', () => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});
