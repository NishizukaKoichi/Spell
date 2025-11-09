// TKT-002: Spell Type Definitions
// SPEC Reference: Section 5 (Spell Definition), Section 7 (Manifest Format), Section 18 (Data Models)
// Note: This file contains both Prisma model types (camelCase) and domain model types (snake_case)

import type {
  ExecutionMode,
  WorkflowExecution,
  ServiceExecution,
  CloneExecution,
} from './execution';

/**
 * JSON Schema type
 * Represents a JSON Schema for input/output validation
 */
export type JSONSchema = Record<string, unknown>;

/**
 * Pricing Model
 */
export type PricingModel = 'flat' | 'metered' | 'one_time';

/**
 * Metered Dimension
 */
export type MeteredDimension = 'casts' | 'compute_ms' | 'egress_mb';

/**
 * Spell Visibility
 */
export type SpellVisibility = 'public' | 'unlisted' | 'private';

/**
 * Spell Status
 */
export type SpellStatus = 'draft' | 'published' | 'suspended';

/**
 * SBOM Format
 */
export type SBOMFormat = 'spdx-json' | 'cyclonedx-json';

/**
 * Pricing Configuration
 */
export interface PricingConfig {
  model: PricingModel;
  currency: string;
  flat_cents?: number;
  base_cents?: number;
  metered?: {
    dimension: MeteredDimension;
    price_per_unit_cents: number;
  };
}

/**
 * Execution Configuration
 */
export interface ExecutionConfig {
  mode: ExecutionMode;
  workflow?: WorkflowExecution;
  service?: ServiceExecution;
  clone?: CloneExecution;
}

/**
 * Supply Chain Metadata
 */
export interface SupplyChainMetadata {
  sbom_included: boolean;
  sbom_format?: SBOMFormat;
  sbom_url?: string;
  dependency_scan_passed: boolean;
  signature_url?: string;
}

/**
 * Spell Domain Model (snake_case - for business logic)
 * Complete representation of a Spell according to SPEC
 */
export interface SpellDomain {
  id: string;
  key: string;
  name: string;
  version: string;
  description: string;
  author_id: string;

  execution: ExecutionConfig;
  pricing: PricingConfig;

  inputs: JSONSchema;
  outputs?: JSONSchema;

  tags: string[];
  category?: string;
  visibility: SpellVisibility;

  // Supply Chain
  supply_chain: SupplyChainMetadata;

  status: SpellStatus;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Spell Prisma Model (camelCase - matches database schema)
 * Used when working with Prisma queries
 */
export interface Spell {
  id: string;
  key: string;
  name: string;
  description: string;
  longDescription?: string | null;
  version: string;
  priceModel: string;
  priceAmountCents: number;
  priceCurrency: string;
  executionMode: string;
  executionConfig?: unknown;
  tags: string[];
  category?: string | null;
  rating: number;
  totalCasts: number;
  inputSchema?: unknown;
  outputSchema?: unknown;
  webhookUrl?: string | null;
  authorId: string;

  // Supply Chain
  sbomIncluded: boolean;
  sbomFormat?: string | null;
  sbomUrl?: string | null;
  dependencyScanPassed: boolean;
  signatureUrl?: string | null;

  // Metadata
  repository?: string | null;
  license?: string | null;
  visibility: string;

  status: string;
  publishedAt?: Date | null;
  suspendedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Relations (optional, populated by Prisma includes)
  _count?: {
    casts: number;
    reviews: number;
  };
}

/**
 * Spell Response DTO
 * Public-facing spell information
 */
export interface SpellResponse {
  id: string;
  key: string;
  name: string;
  version: string;
  description: string;
  author: {
    id: string;
    name?: string;
    avatar_url?: string;
  };
  execution_mode: ExecutionMode;
  pricing: {
    model: PricingModel;
    currency: string;
    amount_cents?: number;
  };
  tags: string[];
  category?: string;
  visibility: SpellVisibility;
  total_casts?: number;
  average_rating?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Spell Create Request DTO
 */
export interface SpellCreateRequest {
  key: string;
  name: string;
  version: string;
  description: string;
  execution: ExecutionConfig;
  pricing: PricingConfig;
  inputs: JSONSchema;
  outputs?: JSONSchema;
  tags: string[];
  category?: string;
  visibility: SpellVisibility;
}

/**
 * Spell Update Request DTO
 */
export interface SpellUpdateRequest {
  name?: string;
  description?: string;
  tags?: string[];
  category?: string;
  visibility?: SpellVisibility;
  status?: SpellStatus;
}

/**
 * Spell Manifest
 * YAML manifest structure for spell packages
 */
export interface SpellManifest {
  spell: {
    key: string;
    name: string;
    version: string;
    description: string;
  };
  execution: ExecutionConfig;
  pricing: PricingConfig;
  inputs: JSONSchema;
  outputs?: JSONSchema;
  tags?: string[];
  category?: string;
  visibility?: SpellVisibility;
  supply_chain?: Partial<SupplyChainMetadata>;
}
