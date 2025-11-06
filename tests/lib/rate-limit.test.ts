import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import {
  RateLimiter,
  MemoryStorage,
  getRateLimitIdentifier,
  isRateLimitExempt,
  RATE_LIMIT_TIERS,
  RateLimitTier,
  applyRateLimitHeaders,
} from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

describe('RateLimiter', () => {
  describe('Sliding Window Algorithm', () => {
    it('allows first request and decrements remaining tokens', async () => {
      const limiter = new RateLimiter({ interval: 1000, algorithm: 'sliding-window' });
      const token = 'token-success';

      const result = await limiter.check(5, token);

      assert.equal(result.success, true);
      assert.equal(result.limit, 5);
      assert.equal(result.remaining, 4);
      assert.ok(result.reset > Date.now());
    });

    it('blocks requests that exceed the provided limit', async () => {
      const limiter = new RateLimiter({ interval: 1000, algorithm: 'sliding-window' });
      const token = 'token-limit';

      await limiter.check(2, token);
      await limiter.check(2, token);
      const result = await limiter.check(2, token);

      assert.equal(result.success, false);
      assert.equal(result.limit, 2);
      assert.equal(result.remaining, 0);
      assert.ok(result.reset > Date.now());
    });

    it('resets usage once the interval has passed', async () => {
      const storage = new MemoryStorage();
      const limiter = new RateLimiter({ interval: 1000, storage, algorithm: 'sliding-window' });
      const token = 'token-reset';
      const now = 1_000_000;
      const originalNow = Date.now;

      try {
        Date.now = () => now;
        await limiter.check(2, token);

        Date.now = () => now + 500;
        await limiter.check(2, token);

        // Both requests should still be in the window
        const blockedResult = await limiter.check(2, token);
        assert.equal(blockedResult.success, false);

        // Move past the window
        Date.now = () => now + 1500;
        const result = await limiter.check(2, token);

        assert.equal(result.success, true);
        assert.equal(result.remaining, 1);
      } finally {
        Date.now = originalNow;
        storage.destroy();
      }
    });

    it('handles sliding window correctly', async () => {
      const storage = new MemoryStorage();
      const limiter = new RateLimiter({ interval: 1000, storage, algorithm: 'sliding-window' });
      const token = 'token-sliding';
      const now = 1_000_000;
      const originalNow = Date.now;

      try {
        // Make 3 requests at t=0
        Date.now = () => now;
        await limiter.check(3, token);
        await limiter.check(3, token);
        await limiter.check(3, token);

        // Fourth request should be blocked
        const blocked = await limiter.check(3, token);
        assert.equal(blocked.success, false);

        // Move forward 600ms (first request still in window)
        Date.now = () => now + 600;
        const stillBlocked = await limiter.check(3, token);
        assert.equal(stillBlocked.success, false);

        // Move forward to 1100ms (first request expired)
        Date.now = () => now + 1100;
        const allowed = await limiter.check(3, token);
        assert.equal(allowed.success, true);
        assert.equal(allowed.remaining, 2); // 2 old requests + 1 new = 3
      } finally {
        Date.now = originalNow;
        storage.destroy();
      }
    });
  });

  describe('Fixed Window Algorithm', () => {
    it('allows first request in new window', async () => {
      const limiter = new RateLimiter({ interval: 1000, algorithm: 'fixed-window' });
      const token = 'fixed-token-1';

      const result = await limiter.check(5, token);

      assert.equal(result.success, true);
      assert.equal(result.limit, 5);
      assert.equal(result.remaining, 4);
    });

    it('blocks requests in same window after limit', async () => {
      const storage = new MemoryStorage();
      const limiter = new RateLimiter({ interval: 1000, storage, algorithm: 'fixed-window' });
      const token = 'fixed-token-2';

      await limiter.check(2, token);
      await limiter.check(2, token);
      const result = await limiter.check(2, token);

      assert.equal(result.success, false);
      storage.destroy();
    });

    it('resets counter at window boundary', async () => {
      const storage = new MemoryStorage();
      const limiter = new RateLimiter({ interval: 1000, storage, algorithm: 'fixed-window' });
      const token = 'fixed-token-3';
      const now = 1_000_000;
      const originalNow = Date.now;

      try {
        Date.now = () => now;
        const first = await limiter.check(2, token);
        assert.equal(first.remaining, 1);

        const second = await limiter.check(2, token);
        assert.equal(second.remaining, 0);

        // Move past window boundary
        Date.now = () => now + 1100;
        const third = await limiter.check(2, token);
        assert.equal(third.success, true);
        assert.equal(third.remaining, 1);
      } finally {
        Date.now = originalNow;
        storage.destroy();
      }
    });
  });

  describe('MemoryStorage', () => {
    it('stores and retrieves data correctly', () => {
      const storage = new MemoryStorage();
      const key = 'test-key';
      const data = [100, 200, 300];

      storage.set(key, data);
      const retrieved = storage.get(key);

      assert.deepEqual(retrieved, data);
      storage.destroy();
    });

    it('respects TTL and expires data', () => {
      const storage = new MemoryStorage();
      const key = 'test-ttl';
      const data = [100];
      const now = Date.now();
      const originalNow = Date.now;

      try {
        Date.now = () => now;
        storage.set(key, data, 1000);

        Date.now = () => now + 500;
        const stillThere = storage.get(key);
        assert.deepEqual(stillThere, data);

        Date.now = () => now + 1100;
        const expired = storage.get(key);
        assert.deepEqual(expired, []);
      } finally {
        Date.now = originalNow;
        storage.destroy();
      }
    });

    it('deletes data', () => {
      const storage = new MemoryStorage();
      const key = 'test-delete';
      const data = [100];

      storage.set(key, data);
      assert.deepEqual(storage.get(key), data);

      storage.delete(key);
      assert.deepEqual(storage.get(key), []);
      storage.destroy();
    });
  });

  describe('getRateLimitIdentifier', () => {
    it('identifies API key from Authorization header', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          authorization: 'Bearer test-api-key-123',
        },
      });

      const { identifier, tier } = getRateLimitIdentifier(req);

      assert.equal(identifier, 'api:test-api-key-123');
      assert.equal(tier, RateLimitTier.API_KEY);
    });

    it('identifies API key from x-api-key header (legacy)', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'x-api-key': 'legacy-key-456',
        },
      });

      const { identifier, tier } = getRateLimitIdentifier(req);

      assert.equal(identifier, 'api:legacy-key-456');
      assert.equal(tier, RateLimitTier.API_KEY);
    });

    it('identifies authenticated user from session', () => {
      const req = new NextRequest('http://localhost:3000/api/test');
      const auth = { user: { id: 'user-123' } };

      const { identifier, tier } = getRateLimitIdentifier(req, auth);

      assert.equal(identifier, 'user:user-123');
      assert.equal(tier, RateLimitTier.AUTHENTICATED);
    });

    it('falls back to IP address for anonymous users', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'x-forwarded-for': '192.168.1.100, 10.0.0.1',
        },
      });

      const { identifier, tier } = getRateLimitIdentifier(req);

      assert.equal(identifier, 'ip:192.168.1.100');
      assert.equal(tier, RateLimitTier.ANONYMOUS);
    });

    it('handles x-real-ip header', () => {
      const req = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'x-real-ip': '203.0.113.42',
        },
      });

      const { identifier, tier } = getRateLimitIdentifier(req);

      assert.equal(identifier, 'ip:203.0.113.42');
      assert.equal(tier, RateLimitTier.ANONYMOUS);
    });
  });

  describe('isRateLimitExempt', () => {
    it('exempts static assets', () => {
      assert.equal(isRateLimitExempt('/_next/static/chunk.js'), true);
      assert.equal(isRateLimitExempt('/static/image.png'), true);
      assert.equal(isRateLimitExempt('/favicon.ico'), true);
      assert.equal(isRateLimitExempt('/styles.css'), true);
    });

    it('exempts health check endpoints', () => {
      assert.equal(isRateLimitExempt('/api/health'), true);
      assert.equal(isRateLimitExempt('/health'), true);
    });

    it('exempts webhook endpoints', () => {
      assert.equal(isRateLimitExempt('/api/webhooks/github'), true);
      assert.equal(isRateLimitExempt('/api/webhooks/stripe'), true);
    });

    it('does not exempt regular API routes', () => {
      assert.equal(isRateLimitExempt('/api/users'), false);
      assert.equal(isRateLimitExempt('/api/v1/cast'), false);
      assert.equal(isRateLimitExempt('/dashboard'), false);
    });
  });

  describe('applyRateLimitHeaders', () => {
    it('adds rate limit headers to response', () => {
      const response = NextResponse.next();
      const result = {
        success: true,
        limit: 100,
        remaining: 75,
        reset: Date.now() + 60000,
      };

      const updatedResponse = applyRateLimitHeaders(response, result);

      assert.equal(updatedResponse.headers.get('X-RateLimit-Limit'), '100');
      assert.equal(updatedResponse.headers.get('X-RateLimit-Remaining'), '75');
      assert.ok(updatedResponse.headers.has('X-RateLimit-Reset'));
    });

    it('adds Retry-After header when rate limited', () => {
      const response = NextResponse.next();
      const result = {
        success: false,
        limit: 100,
        remaining: 0,
        reset: Date.now() + 30000,
      };

      const updatedResponse = applyRateLimitHeaders(response, result);

      assert.ok(updatedResponse.headers.has('Retry-After'));
      const retryAfter = parseInt(updatedResponse.headers.get('Retry-After') || '0');
      assert.ok(retryAfter > 0 && retryAfter <= 30);
    });
  });

  describe('Rate Limit Tiers', () => {
    it('has correct tier limits', () => {
      assert.equal(RATE_LIMIT_TIERS[RateLimitTier.ANONYMOUS], 20);
      assert.equal(RATE_LIMIT_TIERS[RateLimitTier.AUTHENTICATED], 100);
      assert.equal(RATE_LIMIT_TIERS[RateLimitTier.API_KEY], 60);
      assert.equal(RATE_LIMIT_TIERS[RateLimitTier.ADMIN], 500);
      assert.equal(RATE_LIMIT_TIERS[RateLimitTier.WEBHOOK], 1000);
    });
  });

  describe('Integration Tests', () => {
    it('enforces different limits for different tiers', async () => {
      const storage = new MemoryStorage();
      const limiter = new RateLimiter({ interval: 60000, storage });

      // Anonymous user with low limit
      const anonymousLimit = RATE_LIMIT_TIERS[RateLimitTier.ANONYMOUS];
      for (let i = 0; i < anonymousLimit; i++) {
        const result = await limiter.check(anonymousLimit, 'ip:192.168.1.1');
        assert.equal(result.success, true, `Request ${i + 1} should succeed`);
      }

      // Next request should fail
      const blocked = await limiter.check(anonymousLimit, 'ip:192.168.1.1');
      assert.equal(blocked.success, false);

      // Authenticated user with higher limit should still work
      const authLimit = RATE_LIMIT_TIERS[RateLimitTier.AUTHENTICATED];
      const authResult = await limiter.check(authLimit, 'user:123');
      assert.equal(authResult.success, true);

      storage.destroy();
    });

    it('isolates different identifiers', async () => {
      const storage = new MemoryStorage();
      const limiter = new RateLimiter({ interval: 60000, storage });
      const limit = 2;

      // Use up limit for user1
      await limiter.check(limit, 'user:1');
      await limiter.check(limit, 'user:1');
      const user1Blocked = await limiter.check(limit, 'user:1');
      assert.equal(user1Blocked.success, false);

      // user2 should still have full limit
      const user2Result = await limiter.check(limit, 'user:2');
      assert.equal(user2Result.success, true);
      assert.equal(user2Result.remaining, 1);

      storage.destroy();
    });
  });
});
