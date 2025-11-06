# Webhook Security Documentation

This document describes the webhook signature verification implementation for the Spell platform.

## Overview

The platform receives webhooks from two external services:
- **Stripe**: Payment processing events (checkout completion, payment failures)
- **GitHub**: Workflow execution status updates

Both webhook endpoints implement cryptographic signature verification to ensure requests are authentic and haven't been tampered with.

## Architecture

### Core Components

1. **`src/lib/webhook.ts`**: Central webhook security library containing:
   - Signature verification functions
   - Custom error types
   - Security event logging

2. **`src/app/api/webhooks/stripe/route.ts`**: Stripe webhook endpoint
3. **`src/app/api/webhooks/github/route.ts`**: GitHub webhook endpoint
4. **`tests/lib/webhook.test.ts`**: Comprehensive test suite

## Security Features

### Stripe Webhook Verification

The Stripe webhook uses the official Stripe SDK's `constructEvent` method which:

- Verifies the `stripe-signature` header
- Validates the signature using HMAC SHA-256
- Checks timestamp to prevent replay attacks (5-minute tolerance)
- Parses and returns the verified event object

**Configuration Required:**
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Implementation:**
```typescript
import { verifyStripeSignature } from '@/lib/webhook';

const event = verifyStripeSignature(
  rawBody,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET
);
```

### GitHub Webhook Verification

GitHub webhooks use HMAC SHA-256 signature verification:

- Computes HMAC of the raw request body using the webhook secret
- Compares signatures using timing-safe comparison (prevents timing attacks)
- Validates signature format (must start with `sha256=`)

**Configuration Required:**
```bash
GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

**Implementation:**
```typescript
import { verifyGitHubSignature } from '@/lib/webhook';

verifyGitHubSignature(
  rawBody,
  signature,
  process.env.GITHUB_WEBHOOK_SECRET
);
```

## Error Handling

### Custom Error Types

#### `WebhookSignatureError`
Thrown when signature verification fails.

```typescript
class WebhookSignatureError extends Error {
  provider: 'stripe' | 'github';
  details?: string;
}
```

**HTTP Response:** `401 Unauthorized`

#### `WebhookConfigError`
Thrown when required configuration is missing.

```typescript
class WebhookConfigError extends Error {
  missingConfig: string;
}
```

**HTTP Response:** `500 Internal Server Error`

### Error Response Examples

**Missing Signature:**
```json
{
  "error": "Missing stripe-signature header"
}
```

**Invalid Signature:**
```json
{
  "error": "Stripe signature verification failed"
}
```

**Configuration Error:**
```json
{
  "error": "Webhook secret not configured"
}
```

## Security Logging

All webhook verification attempts are logged for security monitoring:

### Successful Verification
```
[Webhook Security] STRIPE webhook verified successfully
{
  provider: 'stripe',
  timestamp: '2025-01-15T10:30:00.000Z'
}
```

### Failed Verification
```
[Webhook Security] GITHUB webhook verification_failed
{
  provider: 'github',
  event: 'verification_failed',
  reason: 'Signature mismatch',
  timestamp: '2025-01-15T10:30:00.000Z'
}
```

### Configuration Errors
```
[Webhook Security] STRIPE webhook config_error
{
  provider: 'stripe',
  event: 'config_error',
  reason: 'STRIPE_WEBHOOK_SECRET not configured'
}
```

## Testing

### Running Tests

```bash
pnpm test
# or specifically:
node --import tsx --test tests/lib/webhook.test.ts
```

### Test Coverage

The test suite covers:

**GitHub Signature Verification:**
- ✓ Successful verification with valid signature
- ✓ Missing signature header
- ✓ Invalid signature format
- ✓ Incorrect signature (wrong secret)
- ✓ Signature length mismatch
- ✓ Missing webhook secret configuration
- ✓ Security event logging

**Stripe Signature Verification:**
- ✓ Missing signature header
- ✓ Invalid signature
- ✓ Missing webhook secret configuration
- ✓ Security event logging

**Error Types:**
- ✓ WebhookSignatureError properties
- ✓ WebhookConfigError properties

**Security Logging:**
- ✓ Success events logged with console.log
- ✓ Failure events logged with console.warn
- ✓ Timestamp inclusion in logs

## Best Practices

### 1. Secure Secret Storage
- Never commit webhook secrets to version control
- Use environment variables for all secrets
- Rotate secrets periodically
- Use different secrets for development/staging/production

### 2. Monitoring
- Monitor security logs for failed verification attempts
- Alert on unusual patterns (multiple failures from same IP)
- Track verification success rates

### 3. Rate Limiting
Consider implementing rate limiting on webhook endpoints to prevent:
- Brute force signature attacks
- DDoS attempts
- Resource exhaustion

### 4. Request Validation
Always validate:
- Request body size (prevent memory exhaustion)
- Content-Type headers
- Event type before processing
- Required fields in payload

## Webhook Setup

### Stripe Webhook Configuration

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events to listen for:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
4. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### GitHub Webhook Configuration

1. Go to GitHub repository → Settings → Webhooks
2. Add webhook: `https://your-domain.com/api/webhooks/github`
3. Content type: `application/json`
4. Select events: `Workflow runs`
5. Generate and save secret to `GITHUB_WEBHOOK_SECRET`

## Troubleshooting

### "Missing signature header"
- **Cause:** Request missing required signature header
- **Solution:** Verify webhook is configured correctly in provider dashboard
- **Check:** Request headers include `stripe-signature` or `x-hub-signature-256`

### "Invalid signature"
- **Cause:** Signature doesn't match computed signature
- **Solution:**
  - Verify webhook secret matches provider configuration
  - Check that raw request body is being read (not parsed JSON)
  - Ensure no middleware is modifying the request body

### "Webhook secret not configured"
- **Cause:** Environment variable not set
- **Solution:** Add `STRIPE_WEBHOOK_SECRET` or `GITHUB_WEBHOOK_SECRET` to `.env`

### Stripe Timestamp Errors
- **Cause:** Request timestamp too old (>5 minutes)
- **Solution:**
  - Check server time synchronization (NTP)
  - Verify network latency isn't excessive
  - Review Stripe webhook retry logic

## Security Considerations

### Replay Attack Prevention

**Stripe:** Built-in timestamp validation (5-minute window)

**GitHub:** Consider implementing:
- Request ID tracking (deduplicate based on delivery ID)
- Timestamp validation (reject old requests)
- Nonce-based validation

### Timing Attack Prevention

Both implementations use `crypto.timingSafeEqual()` for signature comparison, which prevents timing attacks by ensuring constant-time comparison.

### Man-in-the-Middle Protection

- Always use HTTPS for webhook endpoints
- Verify TLS certificates
- Enable HSTS headers

## Future Enhancements

Potential improvements to consider:

1. **Request ID Deduplication**
   - Store processed request IDs
   - Reject duplicate deliveries

2. **Advanced Rate Limiting**
   - Per-IP rate limits
   - Adaptive rate limiting based on patterns

3. **Webhook Analytics Dashboard**
   - Success/failure rates
   - Average processing time
   - Alert on anomalies

4. **Webhook Testing Tools**
   - Local webhook testing proxy
   - Signature generation utilities
   - Replay tools for debugging

## References

- [Stripe Webhook Security](https://stripe.com/docs/webhooks/signatures)
- [GitHub Webhook Security](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [OWASP Webhook Security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html)
