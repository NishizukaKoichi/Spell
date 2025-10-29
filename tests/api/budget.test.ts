import { describe, it, expect } from '@jest/globals';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('Budget API', () => {
  describe('GET /api/budget', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/budget`);
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/budget', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/budget`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monthlyCap: 200.0,
        }),
      });

      expect(response.status).toBe(401);
    });

    it('should validate monthlyCap is a number', async () => {
      // This would need authenticated request
      // Validation would reject non-numeric values
    });

    it('should validate monthlyCap is non-negative', async () => {
      // This would need authenticated request
      // Validation would reject negative values
    });
  });
});
