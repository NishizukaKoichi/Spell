# Rate Limiting

This document describes the global rate limiting system implemented in the Spell platform.

## Overview

The platform uses a comprehensive rate limiting system to protect against abuse and ensure fair usage across all users. Rate limiting is applied globally through middleware and uses a sliding window algorithm for accurate enforcement.

## Features

- **Global Middleware**: Rate limiting is applied automatically to all routes through Next.js middleware
- **Sliding Window Algorithm**: More accurate than fixed windows, prevents burst attacks at window boundaries
- **Multiple Storage Backends**: In-memory storage (default) with support for Redis for distributed deployments
- **Tiered Limits**: Different rate limits based on authentication method and user status
- **Standard Headers**: Full HTTP rate limiting header support (X-RateLimit-*)
- **Graceful Degradation**: System continues to work even if rate limiting fails

## Rate Limit Tiers

The platform implements five distinct rate limit tiers:

| Tier | Requests/Minute | Description |
|------|-----------------|-------------|
| **Anonymous** | 20 | Unauthenticated users identified by IP address |
| **Authenticated** | 100 | Users authenticated via session (logged in) |
| **API Key** | 60 | Requests using API key authentication |
| **Admin** | 500 | Admin users with elevated privileges |
| **Webhook** | 1000 | Webhook endpoints (trusted integrations) |

### Tier Selection

The system automatically selects the appropriate tier based on:

1. **API Key** (highest priority): Detected via `Authorization: Bearer <token>` or `x-api-key` header
2. **Session**: Authenticated user session from NextAuth
3. **IP Address** (fallback): For anonymous users, identified by `x-forwarded-for` or `x-real-ip` headers

## HTTP Headers

### Response Headers (All Requests)

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-11-06T12:34:56.789Z
```

### Additional Headers (Rate Limited Requests)

```
HTTP/1.1 429 Too Many Requests
Retry-After: 42
```

## Rate Limiting Algorithms

### Sliding Window (Default)

The sliding window algorithm tracks individual request timestamps within a moving time window. This provides:

- **Accurate enforcement**: No burst attacks at window boundaries
- **Fair distribution**: Requests are counted precisely
- **Higher memory usage**: Each request timestamp is stored

### Fixed Window

The fixed window algorithm counts requests in discrete time periods:

- **Lower memory usage**: Only stores count and reset time
- **Simple implementation**: Easier to understand and debug
- **Boundary issues**: Allows bursts at window transitions (not recommended for production)

## Configuration

### Changing Rate Limits

Rate limits are defined in `/src/lib/rate-limit.ts`:

```typescript
export const RATE_LIMIT_TIERS: Record<RateLimitTier, number> = {
  [RateLimitTier.ANONYMOUS]: 20,
  [RateLimitTier.AUTHENTICATED]: 100,
  [RateLimitTier.API_KEY]: 60,
  [RateLimitTier.ADMIN]: 500,
  [RateLimitTier.WEBHOOK]: 1000,
};
```

### Configuring the Rate Limiter

The global rate limiter is configured in `/src/middleware.ts`:

```typescript
const globalRateLimiter = new RateLimiter({
  interval: 60000, // 1 minute window
  algorithm: 'sliding-window',
  storage: new MemoryStorage(), // or RedisStorage for distributed
});
```

### Exempt Routes

Some routes are automatically exempt from rate limiting:

- Static assets: `/_next/`, `/static/`, `.css`, `.js`, `.png`, etc.
- Health checks: `/api/health`, `/health`
- Webhooks: `/api/webhooks/*` (they may have their own rate limiting)

To modify exempt routes, edit the `isRateLimitExempt()` function in `/src/lib/rate-limit.ts`.

## Storage Backends

### In-Memory Storage (Default)

Best for:
- Single-instance deployments
- Development environments
- Simple setups

Limitations:
- Not shared across multiple server instances
- Data lost on server restart
- Limited by server memory

```typescript
import { MemoryStorage, RateLimiter } from '@/lib/rate-limit';

const limiter = new RateLimiter({
  storage: new MemoryStorage(),
});
```

### Redis Storage (Production)

Best for:
- Multi-instance deployments (load balanced)
- Production environments
- Persistent rate limit data

To implement Redis storage:

1. Install Redis client:
```bash
pnpm add ioredis
```

2. Update the `RedisStorage` class in `/src/lib/rate-limit.ts`:
```typescript
import Redis from 'ioredis';

class RedisStorage implements RateLimitStorage {
  private client: Redis;

  constructor(client: Redis) {
    this.client = client;
  }

  async get(key: string): Promise<number[]> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : [];
  }

  async set(key: string, value: number[], ttl = 60000): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'PX', ttl);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
```

3. Configure in middleware:
```typescript
import Redis from 'ioredis';
import { RedisStorage } from '@/lib/rate-limit';

const redis = new Redis(process.env.REDIS_URL);
const storage = new RedisStorage(redis);
const globalRateLimiter = new RateLimiter({ storage });
```

## API Error Response

When rate limited, API endpoints return:

```json
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

## Testing

Comprehensive tests are available in `/tests/lib/rate-limit.test.ts`.

Run tests:
```bash
npm test
```

Test categories:
- Sliding window algorithm
- Fixed window algorithm
- Memory storage
- Identifier extraction
- Exempt routes
- Header application
- Integration scenarios

## Usage Examples

### Making API Requests

#### With API Key
```bash
curl -H "Authorization: Bearer your-api-key" \
     -H "Content-Type: application/json" \
     https://api.example.com/api/v1/cast
```

#### With Session (Cookie)
```bash
curl -b cookies.txt \
     -H "Content-Type: application/json" \
     https://api.example.com/api/spells
```

### Handling Rate Limits in Client Code

```javascript
async function makeRequest(url, options) {
  const response = await fetch(url, options);

  // Check rate limit headers
  const limit = response.headers.get('X-RateLimit-Limit');
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');

  console.log(`Rate limit: ${remaining}/${limit}, resets at ${reset}`);

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    console.error(`Rate limited! Retry after ${retryAfter} seconds`);

    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return makeRequest(url, options);
  }

  return response;
}
```

## Monitoring and Debugging

### Enable Debug Logging

Rate limiting errors are logged to the console:

```typescript
// In middleware.ts
catch (error) {
  console.error('Rate limiting error:', error);
}
```

### Check Rate Limit Status

You can check your current rate limit status by inspecting response headers on any API request:

```bash
curl -I -H "Authorization: Bearer your-api-key" \
     https://api.example.com/api/v1/cast
```

Look for:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2025-11-06T12:45:00.000Z
```

### Common Issues

#### Rate limit too restrictive
- Increase the limit in `RATE_LIMIT_TIERS`
- Consider upgrading user to a higher tier
- Implement request batching in client

#### Rate limit not enforced
- Check if route is in exempt list
- Verify middleware is running (check console logs)
- Ensure identifier is being extracted correctly

#### Inconsistent across instances
- Use Redis storage instead of in-memory
- Ensure all instances share the same Redis server
- Check Redis connection and TTL settings

## Performance Considerations

### Memory Usage

- **Sliding Window**: ~40 bytes per request stored (timestamp = 8 bytes + overhead)
- **Fixed Window**: ~24 bytes per identifier (reset time + counter)

For 1000 active users making max requests:
- Sliding Window: ~4 MB (1000 users × 100 requests × 40 bytes)
- Fixed Window: ~24 KB (1000 users × 24 bytes)

### CPU Usage

- Minimal overhead: ~0.1ms per request
- Most operations are O(n) where n = requests in window
- Automatic cleanup prevents memory leaks

### Recommendations

- Use **sliding window** for security-critical endpoints
- Use **fixed window** for high-traffic, less-critical endpoints
- Use **Redis** for production deployments with multiple instances
- Monitor memory usage and adjust cleanup intervals as needed

## Security Best Practices

1. **Use HTTPS**: Rate limiting alone doesn't prevent attacks on insecure connections
2. **Validate Input**: Rate limiting doesn't replace input validation
3. **Monitor Patterns**: Watch for distributed attacks across multiple IPs
4. **Layer Defenses**: Combine with DDoS protection, WAF, etc.
5. **Adjust Limits**: Fine-tune based on actual usage patterns
6. **Log Violations**: Track rate limit violations for security analysis

## Future Enhancements

Potential improvements to consider:

- [ ] Dynamic rate limits based on user subscription tier
- [ ] Exponential backoff for repeat offenders
- [ ] Distributed rate limiting with Redis
- [ ] Rate limit analytics dashboard
- [ ] Per-endpoint custom limits
- [ ] Cost-based rate limiting (not just request count)
- [ ] IP reputation scoring
- [ ] Temporary rate limit increases for trusted users

## Support

For questions or issues:
- Check the test files for usage examples
- Review the source code comments
- Open an issue in the project repository
