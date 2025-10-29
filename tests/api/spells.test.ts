import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
let testApiKey: string;
let testSpellId: string;

describe('Spells API', () => {
  beforeAll(async () => {
    // Setup: Create test API key
    // Note: This would require authentication setup in real tests
  });

  afterAll(async () => {
    // Cleanup: Remove test data
  });

  describe('GET /api/spells', () => {
    it('should return list of spells', async () => {
      const response = await fetch(`${BASE_URL}/api/spells`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('spells');
      expect(Array.isArray(data.spells)).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await fetch(`${BASE_URL}/api/spells?category=ai-ml`);
      expect(response.status).toBe(200);

      const data = await response.json();
      data.spells.forEach((spell: any) => {
        expect(spell.category).toBe('ai-ml');
      });
    });

    it('should search by query', async () => {
      const response = await fetch(`${BASE_URL}/api/spells?search=pdf`);
      expect(response.status).toBe(200);

      const data = await response.json();
      data.spells.forEach((spell: any) => {
        const matchesSearch =
          spell.name.toLowerCase().includes('pdf') ||
          spell.description.toLowerCase().includes('pdf');
        expect(matchesSearch).toBe(true);
      });
    });
  });

  describe('GET /api/spells/:id', () => {
    it('should return spell details', async () => {
      // First get a spell ID
      const listResponse = await fetch(`${BASE_URL}/api/spells`);
      const listData = await listResponse.json();
      const spellId = listData.spells[0]?.id;

      if (!spellId) {
        console.warn('No spells available for testing');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/spells/${spellId}`);
      expect(response.status).toBe(200);

      const spell = await response.json();
      expect(spell).toHaveProperty('id');
      expect(spell).toHaveProperty('name');
      expect(spell).toHaveProperty('description');
      expect(spell).toHaveProperty('priceModel');
      expect(spell).toHaveProperty('priceAmount');
    });

    it('should return 404 for non-existent spell', async () => {
      const response = await fetch(`${BASE_URL}/api/spells/nonexistent_id`);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('POST /api/spells/create', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/spells/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Spell',
          key: 'test-spell',
          description: 'A test spell for unit testing',
          priceModel: 'one_time',
          priceAmount: 1.0,
          executionMode: 'workflow',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/spells/:id', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/spells/some_id`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/spells/:id', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/spells/some_id`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(401);
    });
  });
});
