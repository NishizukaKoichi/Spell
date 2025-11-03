import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSpellSchema,
  validateRequest,
} from '@/lib/validation';

describe('validateRequest', () => {
  it('returns success with validated data when schema passes', () => {
    const validSpell = {
      name: 'Test Spell',
      key: 'test-spell',
      description: 'A spell used only for validation tests.',
      longDescription: 'Detailed description about the test spell.',
      category: 'testing',
      priceModel: 'one_time' as const,
      priceAmount: 99.5,
      executionMode: 'workflow' as const,
      tags: ['jest', 'validation'],
      webhookUrl: 'https://example.com/webhook',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
    };

    const result = validateRequest(createSpellSchema, validSpell);
    assert.equal(result.success, true);
    if (result.success) {
      assert.deepEqual(result.data, validSpell);
    }
  });

  it('returns formatted errors when schema validation fails', () => {
    const invalidSpell = {
      name: 'No',
      key: 'invalid key',
      description: 'short',
      priceModel: 'one_time',
      priceAmount: -10,
      executionMode: 'workflow',
    };

    const result = validateRequest(createSpellSchema, invalidSpell);
    assert.equal(result.success, false);
    if (!result.success) {
      const errors = result.errors.join(' | ');
      assert.ok(errors.includes('name: String must contain at least 3 character(s)'));
      assert.ok(
        errors.includes('key: Key must contain only alphanumeric characters, hyphens, and underscores')
      );
      assert.ok(errors.includes('description: String must contain at least 10 character(s)'));
      assert.ok(errors.includes('priceAmount: Number must be greater than or equal to 0'));
    }
  });

  it('returns generic error when schema parsing throws unexpected error', () => {
    const faultySchema = {
      parse() {
        throw new Error('unexpected');
      },
    } as any;

    const result = validateRequest(faultySchema, {});

    assert.deepEqual(result, {
      success: false,
      errors: ['Invalid request data'],
    });
  });
});
