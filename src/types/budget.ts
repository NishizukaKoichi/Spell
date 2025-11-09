// TKT-002: Budget Type Definitions
// SPEC Reference: Section 18 (Data Models), Section 10 (Budget Management)

/**
 * Budget Domain Model
 * Represents spending limits and tracking for a user
 */
export interface Budget {
  id: string;
  user_id: string;

  // Budget Limits
  monthly_cents?: number;
  total_cents?: number;

  // Current Usage
  current_month_cents: number;
  total_cents_spent: number;

  // Period Tracking
  period_start: string;
  period_end?: string;

  // Status
  cap_exceeded: boolean;

  created_at: string;
  updated_at: string;
}

/**
 * Budget Check Result DTO
 * Result of checking if a cast is within budget
 */
export interface BudgetCheckResult {
  allowed: boolean;
  current_usage: number;
  estimated_cost: number;
  cap: number;
  remaining: number;
}

/**
 * Budget Update Request DTO
 * Used to update budget limits
 */
export interface BudgetUpdateRequest {
  monthly_cents?: number;
  total_cents?: number;
}

/**
 * Budget Usage Response DTO
 * Current budget usage information
 */
export interface BudgetUsageResponse {
  monthly_limit?: number;
  total_limit?: number;
  current_month_usage: number;
  total_usage: number;
  remaining_monthly?: number;
  remaining_total?: number;
  cap_exceeded: boolean;
  period_start: string;
  period_end?: string;
}
