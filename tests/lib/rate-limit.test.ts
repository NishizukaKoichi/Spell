// Rate Limiting Tests - TKT-004
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

describe('Rate Limiting', () => {
  describe('checkRateLimit', () => {
    it('should allow first request within limit', async () => {
      const result = await checkRateLimit('test-user-1', {
        limit: 5,
        window: 60,
      });

      assert.equal(result.allowed, true);
      assert.equal(result.limit, 5);
      assert.ok(result.remaining >= 0);
      assert.ok(result.reset > Math.floor(Date.now() / 1000));
    });

    it('should track remaining requests', async () => {
      const config = { limit: 3, window: 60 };
      const key = 'test-user-track';

      const result1 = await checkRateLimit(key, config);
      assert.equal(result1.allowed, true);

      const result2 = await checkRateLimit(key, config);
      assert.equal(result2.allowed, true);
      assert.ok(result2.remaining < result1.remaining);
    });

    it('should use predefined rate limit configs', () => {
      assert.ok(RATE_LIMITS.api);
      assert.equal(RATE_LIMITS.api.limit, 1000);
      assert.equal(RATE_LIMITS.api.window, 3600);

      assert.ok(RATE_LIMITS.anonymous);
      assert.equal(RATE_LIMITS.anonymous.limit, 10);
      assert.equal(RATE_LIMITS.anonymous.window, 60);
    });
  });
});
