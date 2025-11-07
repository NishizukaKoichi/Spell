// Sigstore Verification Tests - TKT-021
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { verifySpellSignature } from '../verify';
import type { VerificationResult } from '../verify';

describe('Sigstore Verification', () => {
  describe('verifySpellSignature', () => {
    it('should reject invalid signature bundle', async () => {
      const tarBytes = Buffer.from('fake-tarball-content');
      const invalidBundle = {
        cert: '',
        rekorBundle: null,
      };

      const result = await verifySpellSignature(tarBytes, invalidBundle);

      expect(result.verified).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
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

      expect(result.signed_by).toBe('unknown');
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
      expect(result.signed_by).toContain('testowner/testrepo');
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
      expect(result.signed_at.getTime()).toBe(expectedDate.getTime());
    });
  });
});
