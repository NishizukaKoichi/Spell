import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { RateLimiter } from '@/lib/rate-limit';

describe('RateLimiter', () => {
  it('allows first request and decrements remaining tokens', () => {
    const limiter = new RateLimiter({ interval: 1000 });
    const token = 'token-success';

    const result = limiter.check(5, token);

    assert.equal(result.success, true);
    assert.equal(result.limit, 5);
    assert.equal(result.remaining, 4);
    assert.ok(result.reset > Date.now());
  });

  it('blocks requests that exceed the provided limit', () => {
    const limiter = new RateLimiter({ interval: 1000 });
    const token = 'token-limit';

    limiter.check(2, token);
    limiter.check(2, token);
    const result = limiter.check(2, token);

    assert.equal(result.success, false);
    assert.equal(result.limit, 2);
    assert.equal(result.remaining, 0);
    assert.ok(result.reset > Date.now());
  });

  it('resets usage once the interval has passed', () => {
    const limiter = new RateLimiter({ interval: 1000 });
    const token = 'token-reset';
    const now = 1_000_000;
    const originalNow = Date.now;

    try {
      Date.now = () => now;
      limiter.check(2, token);

      Date.now = () => now + 500;
      limiter.check(2, token);

      Date.now = () => now + 1500;
      const result = limiter.check(2, token);

      assert.equal(result.success, true);
      assert.equal(result.remaining, 1);
      assert.equal(result.reset, now + 1500 + 1000);
    } finally {
      Date.now = originalNow;
    }
  });
});
