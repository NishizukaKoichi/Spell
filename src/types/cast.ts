// TKT-002: Cast Type Definitions
// SPEC Reference: Section 7 (Execution Modes), Section 18 (Data Models)

import type { ExecutionMode } from './execution';

/**
 * Cast Request DTO
 * Used when creating a new cast execution
 */
export interface CastRequest {
  spell_id: string;
  inputs: Record<string, unknown>;
  mode?: ExecutionMode;
  budget_cap?: number;
  idempotency_key: string;
}

/**
 * Cast Status
 * Represents the current state of a cast execution
 */
export type CastStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'timeout';

/**
 * Billing Status
 * Represents the current billing state of a cast
 */
export type BillingStatus = 'pending' | 'charged' | 'refunded';

/**
 * Cast Domain Model
 * Represents a single execution of a Spell
 */
export interface Cast {
  id: string;
  spell_key: string;
  spell_version: string;
  caster_id: string;

  input_hash: string;
  mode: ExecutionMode;
  status: CastStatus;

  run_url?: string;
  artifact_url?: string;
  error_message?: string;

  started_at?: string;
  finished_at?: string;
  duration_ms?: number;

  cost_cents: number;
  billing_status: BillingStatus;

  created_at: string;
  updated_at: string;
}

/**
 * Cast Response DTO
 * Returned when querying cast status
 */
export interface CastResponse {
  id: string;
  spell: {
    key: string;
    name: string;
    version: string;
  };
  status: CastStatus;
  artifact_url?: string;
  error_message?: string;
  cost_cents: number;
  duration_ms?: number;
  created_at: string;
  finished_at?: string;
}

/**
 * Cast Event (for streaming)
 * Server-Sent Events payload
 */
export interface CastEvent {
  type: 'status' | 'progress' | 'artifact' | 'error' | 'complete';
  cast_id: string;
  timestamp: string;
  data: {
    status?: CastStatus;
    progress?: number;
    message?: string;
    artifact_url?: string;
    error?: string;
  };
}
