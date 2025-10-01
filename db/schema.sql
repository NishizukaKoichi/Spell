-- =======================
-- Spell Platform Phase 0
-- Postgres 16+ Schema
-- =======================

-- =======================
-- Tenants（課金境界）
-- =======================
CREATE TABLE tenants(
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  region TEXT DEFAULT 'auto',
  monthly_cap_cents INT,
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK(plan IN ('free','pro','enterprise'))
);

CREATE INDEX idx_tenants_stripe ON tenants(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- =======================
-- Users（GitHub identity）
-- =======================
CREATE TABLE users(
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- GitHub identity
  gh_user_id BIGINT NOT NULL,
  gh_username TEXT NOT NULL,
  gh_avatar_url TEXT,
  email TEXT,

  -- Role
  role TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, gh_user_id),
  CHECK(role IN ('maker','caster','operator','auditor'))
);

CREATE INDEX idx_users_gh ON users(gh_user_id);
CREATE INDEX idx_users_tenant ON users(tenant_id, created_at DESC);

-- =======================
-- WebAuthn Credentials
-- =======================
CREATE TABLE webauthn_credentials(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- WebAuthn core
  credential_id TEXT UNIQUE NOT NULL,
  public_key BYTEA NOT NULL,
  sign_count BIGINT NOT NULL DEFAULT 0,
  aaguid TEXT,

  -- Metadata
  device_name TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, credential_id)
);

CREATE INDEX idx_webauthn_user ON webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_cred ON webauthn_credentials(credential_id);

-- =======================
-- Recovery Codes（パスキー紛失時のバックアップ）
-- =======================
CREATE TABLE recovery_codes(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,  -- bcrypt hash
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK(NOT used OR used_at IS NOT NULL)
);

CREATE INDEX idx_recovery_user ON recovery_codes(user_id, used);

-- =======================
-- WebAuthn Challenges（5分TTL）
-- =======================
CREATE TABLE webauthn_challenges(
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  challenge TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL,  -- 'registration' | 'authentication'
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK(kind IN ('registration','authentication'))
);

CREATE INDEX idx_challenges_expiry
  ON webauthn_challenges(expires_at)
  WHERE NOT used;

CREATE INDEX idx_challenges_cleanup
  ON webauthn_challenges(created_at)
  WHERE used OR expires_at < NOW();

-- =======================
-- Spells
-- =======================
CREATE TABLE spells(
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Identification
  key TEXT NOT NULL,  -- com.example.resize
  version TEXT NOT NULL DEFAULT 'v1',
  name TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Execution
  execution_mode TEXT NOT NULL,  -- 'wasm'|'workflow'|'clone'
  wasm_hash TEXT,                -- SHA256 of WASM binary
  wasm_size_bytes BIGINT,
  repo_ref TEXT,                 -- github.com/user/repo@ref
  workflow_id TEXT,              -- .github/workflows/spell.yml
  template_repo TEXT,            -- github.com/user/template

  -- Input schema (JSON Schema)
  input_schema JSONB NOT NULL,

  -- Pricing
  pricing_json JSONB NOT NULL,

  -- Visibility
  visibility TEXT NOT NULL DEFAULT 'private',  -- 'private'|'unlisted'|'public'
  status TEXT NOT NULL DEFAULT 'draft',        -- 'draft'|'published'|'archived'
  published_at TIMESTAMPTZ,

  -- Resource limits (runtime enforcement)
  max_memory_mb INT NOT NULL DEFAULT 512,
  max_duration_sec INT NOT NULL DEFAULT 60,
  max_output_mb INT NOT NULL DEFAULT 100,
  allowed_domains TEXT[] DEFAULT '{}',  -- Network allowlist

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, key, version),

  -- Strong constraints
  CHECK(execution_mode IN ('wasm','workflow','clone')),
  CHECK(visibility IN ('private','unlisted','public')),
  CHECK(status IN ('draft','published','archived')),
  CHECK(status != 'published' OR published_at IS NOT NULL),
  CHECK(max_memory_mb BETWEEN 1 AND 4096),
  CHECK(max_duration_sec BETWEEN 1 AND 300),
  CHECK(max_output_mb BETWEEN 1 AND 1024)
);

-- Logical uniqueness: Only one published version per (tenant, key)
CREATE UNIQUE INDEX idx_spells_published_key
  ON spells(tenant_id, key)
  WHERE status = 'published';

CREATE INDEX idx_spells_public
  ON spells(visibility, published_at DESC NULLS LAST)
  WHERE status = 'published';

CREATE INDEX idx_spells_author
  ON spells(author_id, created_at DESC);

CREATE INDEX idx_spells_mode
  ON spells(execution_mode, status);

CREATE INDEX idx_spells_search
  ON spells USING GIN(to_tsvector('english', name || ' ' || description))
  WHERE status = 'published';

-- =======================
-- Casts（実行）
-- =======================
CREATE TABLE casts(
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  spell_id BIGINT NOT NULL REFERENCES spells(id) ON DELETE RESTRICT,
  caster_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Execution
  run_id TEXT NOT NULL UNIQUE,           -- ULID
  idempotency_key TEXT NOT NULL,         -- UUID
  mode TEXT NOT NULL,                    -- 'wasm'|'workflow'|'clone'
  status TEXT NOT NULL,                  -- 'queued'|'running'|'succeeded'|'failed'|'canceled'|'timeout'

  -- Input
  input_hash TEXT NOT NULL,              -- SHA256 of input JSON
  input_retention TEXT NOT NULL DEFAULT 'hash_only',  -- 'hash_only'|'encrypted'
  input_encrypted_key TEXT,              -- S3 key if encrypted
  input_ttl_expires_at TIMESTAMPTZ,      -- Auto-delete encrypted input

  -- Pricing
  estimate_cents INT NOT NULL DEFAULT 0,
  actual_cents INT,
  preauth_amount_cents INT,              -- Stripe pre-authorization
  cost_overrun_limit_pct INT DEFAULT 20, -- Max % overrun allowed

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,

  -- Output
  artifact_key TEXT,                     -- s3://bucket/casts/{run_id}/result.tar.gz
  artifact_sha256 TEXT,

  -- Metrics
  duration_ms INT,
  p95_ms INT DEFAULT 0,
  error_rate DOUBLE PRECISION DEFAULT 0.0,

  -- Abuse detection
  consecutive_failures INT DEFAULT 0,
  last_failure_at TIMESTAMPTZ,

  UNIQUE(tenant_id, idempotency_key),
  CHECK(mode IN ('wasm','workflow','clone')),
  CHECK(status IN ('queued','running','succeeded','failed','canceled','timeout')),
  CHECK(input_retention IN ('hash_only','encrypted')),
  CHECK(input_retention = 'hash_only' OR input_encrypted_key IS NOT NULL)
);

CREATE INDEX idx_casts_spell ON casts(spell_id, created_at DESC);
CREATE INDEX idx_casts_status ON casts(status, created_at DESC)
  WHERE status IN ('queued', 'running');
CREATE INDEX idx_casts_user ON casts(caster_user_id, created_at DESC);
CREATE INDEX idx_casts_run ON casts(run_id, status);
CREATE INDEX idx_casts_idempotency ON casts(tenant_id, idempotency_key);
CREATE INDEX idx_casts_failures ON casts(tenant_id, consecutive_failures)
  WHERE consecutive_failures > 3;

-- =======================
-- Artifacts（成果物メタ）
-- =======================
CREATE TABLE artifacts(
  id BIGSERIAL PRIMARY KEY,
  cast_id BIGINT NOT NULL REFERENCES casts(id) ON DELETE CASCADE,

  storage_key TEXT NOT NULL,             -- s3://...
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL,

  -- Validation
  virus_scan_status TEXT DEFAULT 'pending',  -- 'pending'|'clean'|'infected'|'error'
  virus_scan_at TIMESTAMPTZ,

  -- TTL management
  initial_ttl_minutes INT NOT NULL DEFAULT 15,  -- Initial short TTL
  ttl_expires_at TIMESTAMPTZ NOT NULL,
  max_ttl_expires_at TIMESTAMPTZ NOT NULL,      -- Absolute maximum (creation + 37 days)
  extension_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK(virus_scan_status IN ('pending','clean','infected','error')),
  CHECK(ttl_expires_at <= max_ttl_expires_at),
  CHECK(extension_count >= 0)
);

CREATE INDEX idx_artifacts_cast ON artifacts(cast_id);
CREATE INDEX idx_artifacts_sha ON artifacts(sha256);
CREATE INDEX idx_artifacts_ttl ON artifacts(ttl_expires_at)
  WHERE ttl_expires_at > NOW();
CREATE INDEX idx_artifacts_scan ON artifacts(virus_scan_status)
  WHERE virus_scan_status = 'pending';

-- =======================
-- Billing Ledger（追記専用）
-- =======================
CREATE TABLE billing_ledger(
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id),
  cast_id BIGINT REFERENCES casts(id),

  kind TEXT NOT NULL,                    -- 'estimate'|'preauth'|'charge'|'refund'|'credit'
  amount_cents INT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',

  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  external_id TEXT,                      -- Stripe event id
  source TEXT NOT NULL DEFAULT 'stripe', -- 'stripe'|'manual'|'auto_credit'
  reason TEXT NOT NULL,                  -- 'estimate'|'preauth'|'usage'|'finalize'|'refund'|'slo_violation'

  CHECK(kind IN ('estimate','preauth','charge','refund','credit')),
  CHECK(currency IN ('USD','EUR','JPY'))
);

CREATE UNIQUE INDEX idx_ledger_external
  ON billing_ledger(external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX idx_ledger_tenant ON billing_ledger(tenant_id, occurred_at DESC);
CREATE INDEX idx_ledger_cast ON billing_ledger(cast_id) WHERE cast_id IS NOT NULL;

-- =======================
-- Audit Log（PII最小化）
-- =======================
CREATE TABLE audit_log(
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Identity (minimal)
  tenant_id BIGINT NOT NULL REFERENCES tenants(id),
  user_id BIGINT REFERENCES users(id),

  -- Action
  action TEXT NOT NULL,  -- 'spell.publish', 'cast.execute', etc.
  resource_type TEXT NOT NULL,
  resource_id BIGINT,

  -- Context (PII-minimized)
  ip_hash TEXT,  -- SHA256(ip + daily_salt)
  user_agent_hash TEXT,  -- SHA256(UA + daily_salt)

  -- Details (no PII)
  details JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Retention
  retention_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '90 days'
);

CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, timestamp DESC);
CREATE INDEX idx_audit_retention ON audit_log(retention_expires_at)
  WHERE retention_expires_at > NOW();

-- =======================
-- Monthly Usage View
-- =======================
CREATE MATERIALIZED VIEW monthly_usage AS
SELECT
  tenant_id,
  DATE_TRUNC('month', occurred_at) AS month,
  SUM(amount_cents) AS total_cents
FROM billing_ledger
WHERE kind IN ('charge', 'credit')
GROUP BY tenant_id, DATE_TRUNC('month', occurred_at);

CREATE UNIQUE INDEX idx_monthly_usage ON monthly_usage(tenant_id, month);

-- =======================
-- Functions
-- =======================

-- Prevent lockout: Require at least 1 credential OR recovery codes
CREATE OR REPLACE FUNCTION check_auth_methods()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM webauthn_credentials WHERE user_id = OLD.user_id) = 0
     AND (SELECT COUNT(*) FROM recovery_codes WHERE user_id = OLD.user_id AND used = false) = 0
  THEN
    RAISE EXCEPTION 'Cannot delete last authentication method';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_lockout
  BEFORE DELETE ON webauthn_credentials
  FOR EACH ROW EXECUTE FUNCTION check_auth_methods();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_spells_updated_at
  BEFORE UPDATE ON spells
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();