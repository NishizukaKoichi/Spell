# Rate Limiting Quick Reference

## At a Glance

Global rate limiting is automatically applied to all API routes and non-static pages.

### Default Limits

```
Anonymous Users:     20 req/min   (identified by IP)
Authenticated Users: 100 req/min  (session-based)
API Keys:           60 req/min   (Bearer token)
Admin Users:        500 req/min  (elevated privileges)
Webhooks:           1000 req/min (trusted sources)
```

### Response Headers

Every API response includes:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-11-06T12:34:56.789Z
```

### Rate Limited Response

```json
HTTP/1.1 429 Too Many Requests
Retry-After: 42

{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "limit": 100,
    "reset": "2025-11-06T12:34:56.789Z",
    "retry_after": 42
  }
}
```

## Configuration Files

- **Rate limits**: `/src/lib/rate-limit.ts` - `RATE_LIMIT_TIERS`
- **Middleware**: `/src/middleware.ts` - Global application
- **Tests**: `/tests/lib/rate-limit.test.ts` - Full test suite
- **Documentation**: `/docs/RATE_LIMITING.md` - Complete guide

## Common Tasks

### Change Rate Limits

Edit `/src/lib/rate-limit.ts`:
```typescript
export const RATE_LIMIT_TIERS: Record<RateLimitTier, number> = {
  [RateLimitTier.ANONYMOUS]: 30,      // Changed from 20
  [RateLimitTier.AUTHENTICATED]: 150, // Changed from 100
  // ...
};
```

### Exempt a Route

Edit `/src/lib/rate-limit.ts`:
```typescript
export function isRateLimitExempt(pathname: string): boolean {
  const exemptPatterns = [
    /^\/_next\//,
    /^\/api\/webhooks\//,
    /^\/api\/my-special-endpoint$/, // Add your pattern
  ];
  return exemptPatterns.some((pattern) => pattern.test(pathname));
}
```

### Switch Algorithm

Edit `/src/middleware.ts`:
```typescript
const globalRateLimiter = new RateLimiter({
  interval: 60000,
  algorithm: 'fixed-window', // Change from 'sliding-window'
});
```

### Add Redis Storage

1. Install: `pnpm add ioredis`
2. Implement `RedisStorage` class in `/src/lib/rate-limit.ts`
3. Configure in `/src/middleware.ts`:
```typescript
import Redis from 'ioredis';
import { RedisStorage } from '@/lib/rate-limit';

const redis = new Redis(process.env.REDIS_URL);
const globalRateLimiter = new RateLimiter({
  storage: new RedisStorage(redis),
});
```

## Testing

```bash
# Run all tests
npm test

# Run only rate limit tests
npm test -- --grep "RateLimiter"
```

## Monitoring

Check rate limit status:
```bash
curl -I https://api.example.com/api/v1/cast \
  -H "Authorization: Bearer your-api-key"
```

Look for headers:
- `X-RateLimit-Limit`: Your rate limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: When limit resets

## Client Example

```javascript
async function apiRequest(url, options) {
  const response = await fetch(url, options);

  // Log rate limit status
  console.log('Rate Limit:', {
    limit: response.headers.get('X-RateLimit-Limit'),
    remaining: response.headers.get('X-RateLimit-Remaining'),
    reset: response.headers.get('X-RateLimit-Reset'),
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    throw new Error(`Rate limited. Retry after ${retryAfter}s`);
  }

  return response.json();
}
```

## Troubleshooting

### Issue: Rate limit not applied
- Check if route is exempt in `isRateLimitExempt()`
- Verify middleware is running (check logs)
- Ensure route is not in public routes list

### Issue: Rate limit too strict
- Increase limit in `RATE_LIMIT_TIERS`
- Use API key instead of anonymous access
- Implement request batching

### Issue: Different limits across servers
- Use Redis storage instead of in-memory
- Ensure all servers connect to same Redis instance

## Architecture

```
Request
  ↓
Middleware (middleware.ts)
  ↓
isRateLimitExempt() → Exempt? → Continue
  ↓ No
getRateLimitIdentifier() → Identify user/IP
  ↓
RateLimiter.check() → Within limit?
  ↓ No                 ↓ Yes
429 Response     Add headers → Continue
```

## Files Modified/Created

- **Modified**: `/src/lib/rate-limit.ts` - Enhanced rate limiter
- **Modified**: `/src/middleware.ts` - Global rate limiting
- **Modified**: `/src/app/api/v1/cast/route.ts` - Removed redundant rate limiting
- **Modified**: `/tests/lib/rate-limit.test.ts` - Comprehensive tests
- **Created**: `/docs/RATE_LIMITING.md` - Full documentation
- **Created**: `/docs/RATE_LIMITING_QUICKSTART.md` - Quick reference

## Support

For detailed information, see `/docs/RATE_LIMITING.md`.
