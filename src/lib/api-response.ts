// API Response & Error Catalog - TKT-006
// SPEC Reference: Section 24 (Error Codes), Section 29 (Error Catalog)

import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'BUDGET_CAP_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'FORBIDDEN_REPO'
  | 'SPELL_NOT_FOUND'
  | 'WORKFLOW_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RATE_LIMITED'
  | 'ARTIFACT_EXPIRED'
  | 'TIMEOUT'
  | 'PAYMENT_REQUIRED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL';

interface ErrorPayload {
  code: ApiErrorCode;
  message: string;
  [key: string]: unknown;
}

/**
 * Returns a standardized API error response following the public spec.
 */
export function apiError(
  code: ApiErrorCode,
  status: number,
  message: string,
  details: Record<string, unknown> = {}
) {
  const body: { error: ErrorPayload } = {
    error: {
      code,
      message,
      ...details,
    },
  };

  return NextResponse.json(body, { status });
}

/**
 * Wraps data in a consistent success envelope.
 */
export function apiSuccess<T>(data: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, { status, headers });
}

/**
 * Custom error class for Spell Platform errors
 */
export class SpellError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public httpStatus: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SpellError';
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && this.details),
      },
    };
  }

  toResponse(): NextResponse {
    return NextResponse.json(this.toJSON(), { status: this.httpStatus });
  }
}

/**
 * Error Catalog - Factory functions for common errors
 */
export const ErrorCatalog = {
  // Authentication & Authorization (401, 403)
  UNAUTHORIZED: (msg = 'Authentication required') => new SpellError('UNAUTHORIZED', msg, 401),

  FORBIDDEN: (msg = 'Insufficient permissions') => new SpellError('FORBIDDEN', msg, 403),

  FORBIDDEN_REPO: (repo: string) =>
    new SpellError(
      'FORBIDDEN_REPO',
      `Repository ${repo} not accessible. Install GitHub App and grant permissions.`,
      403,
      { repo }
    ),

  // Payment & Budget (402)
  BUDGET_CAP_EXCEEDED: (current: number, cap: number, estimate: number) =>
    new SpellError('BUDGET_CAP_EXCEEDED', 'Budget cap exceeded', 402, {
      current_usage: current,
      cap,
      estimate,
      retry_after: 86400,
    }),

  PAYMENT_REQUIRED: (msg = 'Payment method required') =>
    new SpellError('PAYMENT_REQUIRED', msg, 402),

  // Not Found (404)
  SPELL_NOT_FOUND: (key: string) =>
    new SpellError('SPELL_NOT_FOUND', `Spell ${key} not found`, 404, { key }),

  WORKFLOW_NOT_FOUND: (workflowId: string) =>
    new SpellError('WORKFLOW_NOT_FOUND', `Workflow ${workflowId} not found in repository`, 404, {
      workflow_id: workflowId,
    }),

  // Gone (410)
  ARTIFACT_EXPIRED: (runId: string) =>
    new SpellError('ARTIFACT_EXPIRED', 'Artifact has expired (TTL exceeded)', 410, {
      run_id: runId,
    }),

  // Conflict (409)
  IDEMPOTENCY_CONFLICT: (key: string) =>
    new SpellError(
      'IDEMPOTENCY_CONFLICT',
      'Duplicate idempotency key with different request body',
      409,
      { idempotency_key: key }
    ),

  // Validation (422)
  VALIDATION_ERROR: (errors: Record<string, string[]>) =>
    new SpellError('VALIDATION_ERROR', 'Input validation failed', 422, {
      validation_errors: errors,
    }),

  // Rate Limiting (429)
  RATE_LIMITED: (retryAfter: number) =>
    new SpellError('RATE_LIMITED', 'Rate limit exceeded', 429, { retry_after: retryAfter }),

  // Server Errors (5xx)
  INTERNAL: (msg = 'Internal server error') => new SpellError('INTERNAL', msg, 500),

  TIMEOUT: (maxSeconds: number) =>
    new SpellError('TIMEOUT', `Execution timeout after ${maxSeconds}s`, 504, {
      timeout_sec: maxSeconds,
    }),

  SERVICE_UNAVAILABLE: (msg = 'Service temporarily unavailable') =>
    new SpellError('SERVICE_UNAVAILABLE', msg, 503),
};

/**
 * Global error handler for unknown errors
 */
export function handleError(error: unknown): NextResponse {
  if (error instanceof SpellError) {
    return error.toResponse();
  }

  // Unknown error
  console.error('Unhandled error:', error);
  const internalError = ErrorCatalog.INTERNAL();
  return internalError.toResponse();
}
