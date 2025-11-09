// Error Catalog Tests - TKT-006
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import { SpellError, ErrorCatalog, handleError } from '@/lib/api-response';

describe('Error Catalog', () => {
  describe('SpellError', () => {
    it('should create error with code, message, and status', () => {
      const error = new SpellError('INTERNAL', 'Test error', 500);

      assert.equal(error.code, 'INTERNAL');
      assert.equal(error.message, 'Test error');
      assert.equal(error.httpStatus, 500);
      assert.equal(error.name, 'SpellError');
    });

    it('should include details in toJSON()', () => {
      const error = new SpellError('VALIDATION_ERROR', 'Validation failed', 422, {
        validation_errors: { field: ['Required'] },
      });

      const json = error.toJSON();

      assert.deepEqual(json, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          validation_errors: { field: ['Required'] },
        },
      });
    });

    it('should create NextResponse with toResponse()', () => {
      const error = new SpellError('UNAUTHORIZED', 'Auth required', 401);
      const response = error.toResponse();

      assert.equal(response.status, 401);
    });
  });

  describe('ErrorCatalog', () => {
    it('should create UNAUTHORIZED error with default message', () => {
      const error = ErrorCatalog.UNAUTHORIZED();

      assert.equal(error.code, 'UNAUTHORIZED');
      assert.equal(error.message, 'Authentication required');
      assert.equal(error.httpStatus, 401);
    });

    it('should create FORBIDDEN error with custom message', () => {
      const error = ErrorCatalog.FORBIDDEN('No access');

      assert.equal(error.code, 'FORBIDDEN');
      assert.equal(error.message, 'No access');
      assert.equal(error.httpStatus, 403);
    });

    it('should create FORBIDDEN_REPO error with repo details', () => {
      const error = ErrorCatalog.FORBIDDEN_REPO('owner/repo');

      assert.equal(error.code, 'FORBIDDEN_REPO');
      assert.ok(error.message.includes('owner/repo'));
      assert.equal(error.httpStatus, 403);
      assert.deepEqual(error.details, { repo: 'owner/repo' });
    });

    it('should create BUDGET_CAP_EXCEEDED error with usage details', () => {
      const error = ErrorCatalog.BUDGET_CAP_EXCEEDED(8000, 10000, 3000);

      assert.equal(error.code, 'BUDGET_CAP_EXCEEDED');
      assert.equal(error.httpStatus, 402);
      assert.deepEqual(error.details, {
        current_usage: 8000,
        cap: 10000,
        estimate: 3000,
        retry_after: 86400,
      });
    });

    it('should create SPELL_NOT_FOUND error with key', () => {
      const error = ErrorCatalog.SPELL_NOT_FOUND('test-spell');

      assert.equal(error.code, 'SPELL_NOT_FOUND');
      assert.ok(error.message.includes('test-spell'));
      assert.equal(error.httpStatus, 404);
      assert.deepEqual(error.details, { key: 'test-spell' });
    });

    it('should create WORKFLOW_NOT_FOUND error with workflow_id', () => {
      const error = ErrorCatalog.WORKFLOW_NOT_FOUND('workflow.yml');

      assert.equal(error.code, 'WORKFLOW_NOT_FOUND');
      assert.equal(error.httpStatus, 404);
      assert.deepEqual(error.details, { workflow_id: 'workflow.yml' });
    });

    it('should create ARTIFACT_EXPIRED error with run_id', () => {
      const error = ErrorCatalog.ARTIFACT_EXPIRED('123456');

      assert.equal(error.code, 'ARTIFACT_EXPIRED');
      assert.equal(error.httpStatus, 410);
      assert.deepEqual(error.details, { run_id: '123456' });
    });

    it('should create IDEMPOTENCY_CONFLICT error with key', () => {
      const error = ErrorCatalog.IDEMPOTENCY_CONFLICT('abc-123');

      assert.equal(error.code, 'IDEMPOTENCY_CONFLICT');
      assert.equal(error.httpStatus, 409);
      assert.deepEqual(error.details, { idempotency_key: 'abc-123' });
    });

    it('should create VALIDATION_ERROR with validation errors', () => {
      const validationErrors = {
        email: ['Invalid format'],
        age: ['Must be positive'],
      };
      const error = ErrorCatalog.VALIDATION_ERROR(validationErrors);

      assert.equal(error.code, 'VALIDATION_ERROR');
      assert.equal(error.httpStatus, 422);
      assert.deepEqual(error.details, { validation_errors: validationErrors });
    });

    it('should create RATE_LIMITED error with retry_after', () => {
      const error = ErrorCatalog.RATE_LIMITED(60);

      assert.equal(error.code, 'RATE_LIMITED');
      assert.equal(error.httpStatus, 429);
      assert.deepEqual(error.details, { retry_after: 60 });
    });

    it('should create INTERNAL error with default message', () => {
      const error = ErrorCatalog.INTERNAL();

      assert.equal(error.code, 'INTERNAL');
      assert.equal(error.message, 'Internal server error');
      assert.equal(error.httpStatus, 500);
    });

    it('should create TIMEOUT error with timeout_sec', () => {
      const error = ErrorCatalog.TIMEOUT(300);

      assert.equal(error.code, 'TIMEOUT');
      assert.ok(error.message.includes('300'));
      assert.equal(error.httpStatus, 504);
      assert.deepEqual(error.details, { timeout_sec: 300 });
    });

    it('should create SERVICE_UNAVAILABLE error', () => {
      const error = ErrorCatalog.SERVICE_UNAVAILABLE();

      assert.equal(error.code, 'SERVICE_UNAVAILABLE');
      assert.equal(error.httpStatus, 503);
    });
  });

  describe('handleError', () => {
    it('should handle SpellError', () => {
      const error = new SpellError('UNAUTHORIZED', 'Test', 401);
      const response = handleError(error);

      assert.equal(response.status, 401);
    });

    it('should handle unknown errors as INTERNAL', () => {
      const error = new Error('Unknown error');
      const response = handleError(error);

      assert.equal(response.status, 500);
    });

    it('should handle non-Error values as INTERNAL', () => {
      const response = handleError('string error');

      assert.equal(response.status, 500);
    });
  });
});
