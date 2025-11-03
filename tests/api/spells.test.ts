import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
let testApiKey: string;
let testSpellId: string;

describe('Spells API', () => {
  before(async () => {
    // Setup: Create test API key
    // Note: This would require authentication setup in real tests
  });

  after(async () => {
    // Cleanup: Remove test data
  });

  describe('GET /api/spells', () => {
    it('should return list of spells', async () => {
      const response = await fetch(`${BASE_URL}/api/spells`);
      assert.equal(response.status, 200);

      const data = await response.json();
      assert.ok(Object.hasOwn(data, 'spells'));
      assert.ok(Array.isArray(data.spells));
    });

    it('should filter by category', async () => {
      const response = await fetch(`${BASE_URL}/api/spells?category=ai-ml`);
      assert.equal(response.status, 200);

      const data = await response.json();
      data.spells.forEach((spell: any) => {
        assert.equal(spell.category, 'ai-ml');
      });
    });

    it('should search by query', async () => {
      const response = await fetch(`${BASE_URL}/api/spells?search=pdf`);
      assert.equal(response.status, 200);

      const data = await response.json();
      data.spells.forEach((spell: any) => {
        const matchesSearch =
          spell.name.toLowerCase().includes('pdf') ||
          spell.description.toLowerCase().includes('pdf');
        assert.equal(matchesSearch, true);
      });
    });
  });

  describe('GET /api/spells/:id', () => {
    it('should return spell details', async (t: TestContext) => {
      // First get a spell ID
      const listResponse = await fetch(`${BASE_URL}/api/spells`);
      const listData = await listResponse.json();
      const spellId = listData.spells[0]?.id;

      if (!spellId) {
        t.skip('No spells available for testing');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/spells/${spellId}`);
      assert.equal(response.status, 200);

      const spell = await response.json();
      assert.ok(Object.hasOwn(spell, 'id'));
      assert.ok(Object.hasOwn(spell, 'name'));
      assert.ok(Object.hasOwn(spell, 'description'));
      assert.ok(Object.hasOwn(spell, 'priceModel'));
      assert.ok(Object.hasOwn(spell, 'priceAmount'));
    });

    it('should return 404 for non-existent spell', async () => {
      const response = await fetch(`${BASE_URL}/api/spells/nonexistent_id`);
      assert.equal(response.status, 404);

      const data = await response.json();
      assert.ok(Object.hasOwn(data, 'error'));
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

      assert.equal(response.status, 401);
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

      assert.equal(response.status, 401);
    });
  });

  describe('DELETE /api/spells/:id', () => {
    it('should require authentication', async () => {
      const response = await fetch(`${BASE_URL}/api/spells/some_id`, {
        method: 'DELETE',
      });

      assert.equal(response.status, 401);
    });
  });
});
