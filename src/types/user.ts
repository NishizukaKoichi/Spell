// TKT-002: User Type Definitions
// SPEC Reference: Section 18 (Data Models)

/**
 * User Role
 * Defines the user's primary role in the platform
 */
export type UserRole = 'maker' | 'caster' | 'operator' | 'auditor';

/**
 * User Status
 * Represents the current account status
 */
export type UserStatus = 'active' | 'suspended' | 'deleted';

/**
 * User Domain Model
 * Represents a platform user
 */
export interface User {
  id: string;
  github_id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;

  // Privacy & Compliance
  ccpa_do_not_sell: boolean;
  consent_version?: string;
  consented_at?: string;

  // Billing
  stripe_customer_id?: string;

  created_at: string;
  updated_at: string;
}

/**
 * User Profile DTO
 * Public-facing user profile information
 */
export interface UserProfile {
  id: string;
  name?: string;
  avatar_url?: string;
  role: UserRole;
}

/**
 * User Settings DTO
 * User-controllable settings
 */
export interface UserSettings {
  ccpa_do_not_sell: boolean;
  consent_version?: string;
}
