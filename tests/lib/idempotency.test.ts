// Idempotency Tests - TKT-005
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import { hashRequestPayload, IdempotencyMismatchError } from '@/lib/idempotency';

describe('Idempotency', () => {
  describe('hashRequestPayload', () => {
    it('should generate consistent hashes for identical payloads', () => {
      const payload1 = { spell_key: 'test', input: { foo: 'bar' } };
      const payload2 = { spell_key: 'test', input: { foo: 'bar' } };

      const hash1 = hashRequestPayload(payload1);
      const hash2 = hashRequestPayload(payload2);

      assert.equal(hash1, hash2);
    });

    it('should generate different hashes for different payloads', () => {
      const payload1 = { spell_key: 'test', input: { foo: 'bar' } };
      const payload2 = { spell_key: 'test', input: { foo: 'baz' } };

      const hash1 = hashRequestPayload(payload1);
      const hash2 = hashRequestPayload(payload2);

      assert.notEqual(hash1, hash2);
    });

    it('should normalize object key order', () => {
      const payload1 = { b: 2, a: 1 };
      const payload2 = { a: 1, b: 2 };

      const hash1 = hashRequestPayload(payload1);
      const hash2 = hashRequestPayload(payload2);

      assert.equal(hash1, hash2);
    });

    it('should handle null and undefined', () => {
      const hash1 = hashRequestPayload(null);
      const hash2 = hashRequestPayload(undefined);

      assert.ok(hash1);
      assert.ok(hash2);
    });

    it('should handle nested objects', () => {
      const payload1 = { outer: { inner: { value: 42 } } };
      const payload2 = { outer: { inner: { value: 42 } } };

      const hash1 = hashRequestPayload(payload1);
      const hash2 = hashRequestPayload(payload2);

      assert.equal(hash1, hash2);
    });
  });

  describe('IdempotencyMismatchError', () => {
    it('should create error with correct name', () => {
      const error = new IdempotencyMismatchError('Test mismatch');

      assert.equal(error.name, 'IdempotencyMismatchError');
      assert.equal(error.message, 'Test mismatch');
      assert.ok(error instanceof Error);
    });
  });
});
