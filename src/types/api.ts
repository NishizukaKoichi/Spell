// TKT-002: API Type Definitions
// SPEC Reference: Section 19 (API Schema)

/**
 * Standard API Error Response
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    retry_after?: number;
    details?: Record<string, unknown>;
  };
}

/**
 * Paginated Response Wrapper
 * Generic wrapper for paginated API responses
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/**
 * API Success Response
 * Generic success response structure
 */
export interface ApiSuccess<T> {
  data: T;
}

/**
 * Health Check Response
 */
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  version: string;
  timestamp: string;
  services?: {
    database?: 'ok' | 'down';
    cache?: 'ok' | 'down';
    queue?: 'ok' | 'down';
  };
}

/**
 * Common Error Codes
 */
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  INVALID_API_KEY: 'invalid_api_key',

  // Request Validation
  VALIDATION_ERROR: 'validation_error',
  INVALID_INPUT: 'invalid_input',
  MISSING_REQUIRED_FIELD: 'missing_required_field',

  // Resource Errors
  NOT_FOUND: 'not_found',
  ALREADY_EXISTS: 'already_exists',
  CONFLICT: 'conflict',

  // Rate Limiting & Quotas
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  BUDGET_EXCEEDED: 'budget_exceeded',
  QUOTA_EXCEEDED: 'quota_exceeded',

  // Server Errors
  INTERNAL_ERROR: 'internal_error',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  TIMEOUT: 'timeout',

  // Spell-specific
  SPELL_NOT_FOUND: 'spell_not_found',
  SPELL_SUSPENDED: 'spell_suspended',
  CAST_FAILED: 'cast_failed',
  INVALID_SPELL_MANIFEST: 'invalid_spell_manifest',

  // Idempotency
  IDEMPOTENCY_KEY_REUSED: 'idempotency_key_reused',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
