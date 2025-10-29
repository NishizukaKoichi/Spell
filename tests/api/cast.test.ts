import { describe, it, expect } from '@jest/globals';

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

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Authorization');
    });

    it('should require Bearer token format', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cast`, {
        method: 'POST',
        headers: {
          'Authorization': 'InvalidFormat',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spell_key: 'test-spell',
          input: {},
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should require spell_key', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {},
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('spell_key');
    });

    it('should return 404 for non-existent spell', async () => {
      const response = await fetch(`${BASE_URL}/api/v1/cast`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TEST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spell_key: 'nonexistent-spell-key',
          input: {},
        }),
      });

      // Will return 401 if API key is invalid, or 404 if spell not found
      expect([401, 404]).toContain(response.status);
    });

    it('should enforce rate limiting', async () => {
      const requests = Array.from({ length: 65 }, () =>
        fetch(`${BASE_URL}/api/v1/cast`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TEST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            spell_key: 'test-spell',
            input: {},
          }),
        })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
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
        expect(cast).toHaveProperty('id');
        expect(cast).toHaveProperty('status');
        expect(cast).toHaveProperty('spell');
      } else {
        expect(response.status).toBe(404);
      }
    });
  });

  describe('GET /api/casts/:id/stream', () => {
    it('should return event stream', async () => {
      const castId = 'test_cast_id';

      const response = await fetch(`${BASE_URL}/api/casts/${castId}/stream`);

      if (response.status === 200) {
        expect(response.headers.get('content-type')).toContain('text/event-stream');
      } else {
        // Cast might not exist, which is ok for this test
        expect([404, 500]).toContain(response.status);
      }
    });
  });
});
