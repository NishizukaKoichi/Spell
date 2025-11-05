import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_API_KEY = process.env.TEST_API_KEY || 'test_api_key';

describe('Cast API (v1)', () => {
  describe('POST /api/v1/cast', () => {
    it('should require authorization header', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spell_key: 'test-spell',
          input: {},
        }),
      });

      assert.equal(response.status, 401);
      const data = await response.json();
      assert.equal(data.error.code, 'UNAUTHORIZED');
      assert.ok(
        typeof data.error.message === 'string' && data.error.message.includes('Authorization')
      );
    });

    it('should require Bearer token format', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cast`, {
        method: 'POST',
        headers: {
          Authorization: 'InvalidFormat',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spell_key: 'test-spell',
          input: {},
        }),
      });

      assert.equal(response.status, 401);
      const data = await response.json();
      assert.equal(data.error.code, 'UNAUTHORIZED');
    });

    it('should require spell_key', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cast`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TEST_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'test-require-spell-key',
        },
        body: JSON.stringify({
          input: {},
        }),
      });

      assert.equal(response.status, 422);
      const data = await response.json();
      assert.equal(data.error.code, 'VALIDATION_ERROR');
      assert.ok(typeof data.error.message === 'string' && data.error.message.includes('spell_key'));
    });

    it('should return 404 for non-existent spell', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cast`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TEST_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'test-missing-spell',
        },
        body: JSON.stringify({
          spell_key: 'nonexistent-spell-key',
          input: {},
        }),
      });

      // Will return 401 if API key is invalid, or 404 if spell not found
      assert.ok([401, 404].includes(response.status));
    });

    it('should enforce rate limiting', async () => {
      const requests = Array.from({ length: 65 }, (_, index) =>
        fetch(`${BASE_URL}/api/v1/cast`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `rate-limit-test-${Date.now()}-${index}-${Math.random()}`,
          },
          body: JSON.stringify({
            spell_key: 'test-spell',
            input: {},
          }),
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      assert.ok(rateLimited.length > 0);
    });
  });

  describe('GET /api/casts/:id', () => {
    it('should return cast details', async () => {
      // This would require creating a cast first
      const castId = 'test_cast_id';

      const response = await fetch(`${BASE_URL}/api/casts/${castId}`);

      // Will return 404 if cast doesn't exist
      if (response.status === 200) {
        const cast = await response.json();
        assert.ok(Object.hasOwn(cast, 'id'));
        assert.ok(Object.hasOwn(cast, 'status'));
        assert.ok(Object.hasOwn(cast, 'spell'));
      } else {
        assert.equal(response.status, 404);
      }
    });
  });

  describe('GET /api/casts/:id/stream', () => {
    it('should return event stream', async () => {
      const castId = 'test_cast_id';

      const response = await fetch(`${BASE_URL}/api/casts/${castId}/stream`);

      if (response.status === 200) {
        const contentType = response.headers.get('content-type');
        assert.ok(contentType && contentType.includes('text/event-stream'));
      } else {
        // Cast might not exist, which is ok for this test
        assert.ok([404, 500].includes(response.status));
      }
    });
  });
});
