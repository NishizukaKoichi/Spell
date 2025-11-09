// Sigstore Verification Tests - TKT-021
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { verifySpellSignature } from '../verify';

describe('Sigstore Verification', () => {
  describe('verifySpellSignature', () => {
    it('should reject invalid signature bundle', async () => {
      const tarBytes = Buffer.from('fake-tarball-content');
      const invalidBundle = {
        cert: '',
        rekorBundle: undefined,
      };

      const result = await verifySpellSignature(tarBytes, invalidBundle);

      assert.equal(result.verified, false);
      assert.ok(result.errors);
      assert.ok(result.errors.length > 0);
    });

    it('should return unknown signer for missing cert', async () => {
      const tarBytes = Buffer.from('fake-tarball-content');
      const bundleWithoutCert = {
        cert: '',
        rekorBundle: {
          Payload: {
            logIndex: 12345,
            logID: 'test-log-id',
            integratedTime: 1700000000,
          },
        },
      };

      const result = await verifySpellSignature(tarBytes, bundleWithoutCert);

      assert.equal(result.signed_by, 'unknown');
    });

    it('should extract GitHub identity from valid cert', async () => {
      const tarBytes = Buffer.from('fake-tarball-content');
      const bundle = {
        cert: 'https://github.com/testowner/testrepo/.github/workflows/publish.yml',
        rekorBundle: {
          Payload: {
            logIndex: 12345,
            logID: 'test-log-id',
            integratedTime: 1700000000,
            bodyHash: 'test-hash',
          },
        },
      };

      const result = await verifySpellSignature(tarBytes, bundle);

      // Will fail signature verification but should extract identity
      assert.ok(result.signed_by.includes('testowner/testrepo'));
    });

    it('should parse timestamp correctly', async () => {
      const tarBytes = Buffer.from('fake-tarball-content');
      const testTime = 1700000000; // Unix timestamp
      const bundle = {
        cert: 'https://github.com/owner/repo',
        rekorBundle: {
          Payload: {
            logIndex: 12345,
            logID: 'test-log-id',
            integratedTime: testTime,
          },
        },
      };

      const result = await verifySpellSignature(tarBytes, bundle);

      const expectedDate = new Date(testTime * 1000);
      assert.equal(result.signed_at.getTime(), expectedDate.getTime());
    });
  });
});
