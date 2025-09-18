-- PlanetScale schema for Spell Platform core tables
-- Generated from docs/ARCHITECTURE.md section 5.

CREATE TABLE IF NOT EXISTS tenants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  slug VARCHAR(64) UNIQUE NOT NULL,
  plan ENUM('free','pro','enterprise') DEFAULT 'free',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  gh_user_id BIGINT NOT NULL,
  email VARCHAR(320),
  role ENUM('maker','caster','operator','auditor') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_tenant (tenant_id, gh_user_id),
  KEY idx_users_tenant (tenant_id)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS spells (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  spell_key VARCHAR(255) NOT NULL,
  version VARCHAR(32) NOT NULL DEFAULT 'v1',
  name VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  visibility ENUM('public','unlisted','private') NOT NULL DEFAULT 'private',
  execution_mode ENUM('workflow','service','clone') NOT NULL,
  pricing_json JSON NOT NULL,
  input_schema_json JSON NOT NULL,
  repo_ref VARCHAR(255),
  workflow_id VARCHAR(255),
  template_repo VARCHAR(255),
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_spell (tenant_id, spell_key, version),
  KEY idx_vis_time (visibility, published_at),
  KEY idx_tenant_vis_pub (tenant_id, visibility, published_at)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS casts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  spell_id BIGINT NOT NULL,
  caster_user_id BIGINT NOT NULL,
  run_id CHAR(27) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  mode ENUM('workflow','service','clone') NOT NULL,
  status ENUM('queued','running','succeeded','failed','canceled') NOT NULL,
  estimate_cents INT NOT NULL DEFAULT 0,
  cost_cents INT DEFAULT NULL,
  region VARCHAR(64) DEFAULT 'auto',
  timeout_sec INT NOT NULL DEFAULT 60,
  budget_cap_cents INT DEFAULT NULL,
  input_hash CHAR(64) NOT NULL,
  started_at TIMESTAMP NULL,
  finished_at TIMESTAMP NULL,
  canceled_at TIMESTAMP NULL,
  p95_ms INT DEFAULT NULL,
  error_rate DOUBLE DEFAULT NULL,
  artifact_url TEXT,
  artifact_sha256 CHAR(64) DEFAULT NULL,
  artifact_size_bytes BIGINT UNSIGNED DEFAULT NULL,
  artifact_expires_at TIMESTAMP NULL,
  logs_url TEXT,
  failure_reason TEXT,
  gh_run_id BIGINT DEFAULT NULL,
  sse_channel VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cast_run (run_id),
  UNIQUE KEY uq_cast_idem (tenant_id, idempotency_key),
  KEY idx_cast_spell_time (spell_id, created_at),
  KEY idx_cast_status_time (status, created_at),
  KEY idx_cast_caster_time (caster_user_id, created_at)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS billing_ledger (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  cast_id BIGINT DEFAULT NULL,
  spell_id BIGINT DEFAULT NULL,
  kind ENUM('estimate','charge','refund','credit','finalize') NOT NULL,
  amount_cents INT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  occurred_at TIMESTAMP NOT NULL,
  meta_json JSON NOT NULL,
  external_id VARCHAR(191) DEFAULT NULL,
  source ENUM('stripe','system','admin') NOT NULL DEFAULT 'stripe',
  reason ENUM('estimate','usage','finalize','refund','credit','adjustment') NOT NULL DEFAULT 'usage',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_billing_external (external_id),
  KEY idx_billing_tenant_time (tenant_id, occurred_at),
  KEY idx_billing_cast (cast_id),
  KEY idx_billing_spell (spell_id)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS artifacts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  cast_id BIGINT NOT NULL,
  location TEXT NOT NULL,
  content_type VARCHAR(127) DEFAULT NULL,
  size_bytes BIGINT UNSIGNED DEFAULT NULL,
  sha256 CHAR(64) NOT NULL,
  ttl_expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_artifacts_sha (sha256)
) ENGINE = InnoDB;

-- Helper views or additional indexes can be added in follow-up migrations.

