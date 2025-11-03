import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'BUDGET_CAP_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_REPO'
  | 'WORKFLOW_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RATE_LIMITED'
  | 'ARTIFACT_EXPIRED'
  | 'TIMEOUT'
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
