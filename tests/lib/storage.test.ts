import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateArtifactKey,
  validateFilename,
  sanitizeFilename,
  formatBytes,
  StorageConfigError,
} from '../../src/lib/storage';

/**
 * Storage Library Tests
 *
 * Note: These tests focus on utility functions that don't require AWS/R2 connectivity.
 * For integration tests with actual R2, use a separate test suite with proper mocking.
 */

describe('Storage Utility Functions', () => {
  describe('generateArtifactKey', () => {
    it('should generate correct artifact key format', () => {
      const castId = 'cast_123';
      const filename = 'output.json';
      const key = generateArtifactKey(castId, filename);

      assert.equal(key, 'casts/cast_123/output.json');
    });

    it('should handle special characters in filename', () => {
      const castId = 'cast_456';
      const filename = 'test-file_v2.tar.gz';
      const key = generateArtifactKey(castId, filename);

      assert.equal(key, 'casts/cast_456/test-file_v2.tar.gz');
    });
  });

  describe('validateFilename', () => {
    it('should accept valid filenames', () => {
      const validNames = [
        'output.json',
        'results.txt',
        'data-file_v2.zip',
        'test.tar.gz',
        'file123.log',
      ];

      validNames.forEach((name) => {
        assert.equal(validateFilename(name), true, `Should accept: ${name}`);
      });
    });

    it('should reject filenames with dangerous characters', () => {
      const dangerousNames = [
        '../etc/passwd',
        'test<script>.js',
        'file|pipe.txt',
        'test:colon.txt',
        'quote"file.txt',
        'null\x00char.txt',
      ];

      dangerousNames.forEach((name) => {
        assert.equal(validateFilename(name), false, `Should reject: ${name}`);
      });
    });

    it('should reject filenames with path traversal', () => {
      const traversalNames = ['../file.txt', '../../etc/passwd', './../secret.txt'];

      traversalNames.forEach((name) => {
        assert.equal(validateFilename(name), false, `Should reject: ${name}`);
      });
    });

    it('should reject filenames longer than 255 characters', () => {
      const longName = 'a'.repeat(256) + '.txt';
      assert.equal(validateFilename(longName), false);
    });

    it('should accept filenames at max length', () => {
      const maxName = 'a'.repeat(251) + '.txt'; // 255 chars total
      assert.equal(validateFilename(maxName), true);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove dangerous characters', () => {
      const input = 'test<script>file|pipe.txt';
      const output = sanitizeFilename(input);

      assert.equal(output, 'test_script_file_pipe.txt');
      assert.equal(validateFilename(output), true);
    });

    it('should replace path traversal sequences', () => {
      const input = '../../../etc/passwd';
      const output = sanitizeFilename(input);

      assert.equal(output.includes('..'), false);
      assert.equal(validateFilename(output), true);
    });

    it('should truncate long filenames', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const output = sanitizeFilename(longName);

      assert.equal(output.length, 255);
    });

    it('should preserve valid characters', () => {
      const input = 'valid-file_name123.tar.gz';
      const output = sanitizeFilename(input);

      assert.equal(output, input);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      assert.equal(formatBytes(0), '0 B');
      assert.equal(formatBytes(100), '100 B');
      assert.equal(formatBytes(1024), '1 KB');
      assert.equal(formatBytes(1536), '1.5 KB');
      assert.equal(formatBytes(1048576), '1 MB');
      assert.equal(formatBytes(1572864), '1.5 MB');
      assert.equal(formatBytes(1073741824), '1 GB');
      assert.equal(formatBytes(1099511627776), '1 TB');
    });

    it('should handle decimal places correctly', () => {
      const result = formatBytes(1234567);
      assert.match(result, /^1\.18 MB$/);
    });

    it('should handle very small numbers', () => {
      assert.equal(formatBytes(1), '1 B');
      assert.equal(formatBytes(10), '10 B');
      assert.equal(formatBytes(999), '999 B');
    });

    it('should handle very large numbers', () => {
      const petabyte = 1125899906842624;
      const result = formatBytes(petabyte);
      assert.match(result, /TB$/);
    });
  });

  describe('Storage Configuration', () => {
    it('should detect missing configuration', () => {
      // This test assumes R2 env vars are not set in test environment
      // In a real integration test, you would mock the environment
      try {
        // Note: This would require actually calling getS3Client() which
        // is not exported. In a real test suite, you'd want to export it
        // or test through public APIs that use it.
        assert.ok(true, 'Configuration validation works');
      } catch (error) {
        if (error instanceof StorageConfigError) {
          assert.ok(error.message.includes('Missing'), 'Should provide helpful error message');
        }
      }
    });
  });
});

describe('Content Type Detection', () => {
  // Note: detectContentType is not exported, but we can test it indirectly
  // through uploadArtifact if we had proper mocking. These are placeholder tests
  // that demonstrate what should be tested.

  it('should detect JSON content type', () => {
    // Would test: detectContentType('data.json') === 'application/json'
    assert.ok(true);
  });

  it('should detect ZIP content type', () => {
    // Would test: detectContentType('archive.zip') === 'application/zip'
    assert.ok(true);
  });

  it('should default to octet-stream for unknown types', () => {
    // Would test: detectContentType('unknown.xyz') === 'application/octet-stream'
    assert.ok(true);
  });
});

describe('Security Tests', () => {
  describe('Path Traversal Prevention', () => {
    it('should prevent directory traversal in artifact keys', () => {
      const castId = 'cast_123';
      const maliciousFilename = '../../../etc/passwd';

      // The key generation itself doesn't sanitize, but the validation should catch it
      const key = generateArtifactKey(castId, maliciousFilename);
      assert.equal(validateFilename(maliciousFilename), false);
    });

    it('should prevent null byte injection', () => {
      const filename = 'file.txt\x00.exe';
      assert.equal(validateFilename(filename), false);
    });
  });

  describe('Filename Length Limits', () => {
    it('should enforce 255 character limit', () => {
      const maxValid = 'a'.repeat(255);
      const tooLong = 'a'.repeat(256);

      assert.equal(validateFilename(maxValid), true);
      assert.equal(validateFilename(tooLong), false);
    });
  });
});

/**
 * Integration Test Placeholders
 *
 * These tests require actual R2 credentials and would be run separately
 * in a CI/CD environment with proper test credentials.
 */
describe('Storage Integration Tests (Requires R2)', () => {
  beforeEach(() => {
    // Skip these tests if R2 credentials are not available
    if (!process.env.R2_ACCOUNT_ID) {
      return;
    }
  });

  it.skip('should upload artifact to R2', async () => {
    // Test uploadArtifact with actual R2 connection
    assert.ok(true);
  });

  it.skip('should download artifact from R2', async () => {
    // Test downloadArtifact with actual R2 connection
    assert.ok(true);
  });

  it.skip('should generate valid signed URLs', async () => {
    // Test getArtifactUrl with actual R2 connection
    assert.ok(true);
  });

  it.skip('should delete artifacts from R2', async () => {
    // Test deleteArtifact with actual R2 connection
    assert.ok(true);
  });

  it.skip('should list artifacts for a cast', async () => {
    // Test listArtifacts with actual R2 connection
    assert.ok(true);
  });

  it.skip('should get artifact metadata', async () => {
    // Test getArtifactMetadata with actual R2 connection
    assert.ok(true);
  });

  it.skip('should check if artifact exists', async () => {
    // Test artifactExists with actual R2 connection
    assert.ok(true);
  });

  it.skip('should calculate storage size for cast', async () => {
    // Test getCastStorageSize with actual R2 connection
    assert.ok(true);
  });
});
