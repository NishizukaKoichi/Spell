use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Tenant {
    pub id: i64,
    pub slug: String,
    pub plan: String,
    pub region: Option<String>,
    pub monthly_cap_cents: Option<i32>,
    pub stripe_customer_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: i64,
    pub tenant_id: i64,
    pub gh_user_id: i64,
    pub gh_username: String,
    pub gh_avatar_url: Option<String>,
    pub email: Option<String>,
    pub role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Spell {
    pub id: i64,
    pub tenant_id: i64,
    pub author_id: i64,
    pub key: String,
    pub version: String,
    pub name: String,
    pub description: String,
    pub execution_mode: String,
    pub wasm_hash: Option<String>,
    pub wasm_size_bytes: Option<i64>,
    pub repo_ref: Option<String>,
    pub workflow_id: Option<String>,
    pub template_repo: Option<String>,
    pub input_schema: serde_json::Value,
    pub pricing_json: serde_json::Value,
    pub visibility: String,
    pub status: String,
    pub published_at: Option<DateTime<Utc>>,
    pub max_memory_mb: i32,
    pub max_duration_sec: i32,
    pub max_output_mb: i32,
    pub allowed_domains: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Cast {
    pub id: i64,
    pub tenant_id: i64,
    pub spell_id: i64,
    pub caster_user_id: i64,
    pub run_id: String,
    pub idempotency_key: String,
    pub mode: String,
    pub status: String,
    pub input_hash: String,
    pub input_retention: String,
    pub input_encrypted_key: Option<String>,
    pub input_ttl_expires_at: Option<DateTime<Utc>>,
    pub estimate_cents: i32,
    pub actual_cents: Option<i32>,
    pub preauth_amount_cents: Option<i32>,
    pub cost_overrun_limit_pct: i32,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub canceled_at: Option<DateTime<Utc>>,
    pub artifact_key: Option<String>,
    pub artifact_sha256: Option<String>,
    pub duration_ms: Option<i32>,
    pub p95_ms: i32,
    pub error_rate: f64,
    pub consecutive_failures: i32,
    pub last_failure_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Artifact {
    pub id: i64,
    pub cast_id: i64,
    pub storage_key: String,
    pub content_type: String,
    pub size_bytes: i64,
    pub sha256: String,
    pub virus_scan_status: String,
    pub virus_scan_at: Option<DateTime<Utc>>,
    pub initial_ttl_minutes: i32,
    pub ttl_expires_at: DateTime<Utc>,
    pub max_ttl_expires_at: DateTime<Utc>,
    pub extension_count: i32,
    pub created_at: DateTime<Utc>,
}

// Request/Response DTOs
#[derive(Debug, Deserialize)]
pub struct CreateSpellRequest {
    pub key: String,
    pub version: Option<String>,
    pub name: String,
    pub description: String,
    pub execution_mode: String,
    pub input_schema: serde_json::Value,
    pub pricing_json: serde_json::Value,
    pub max_memory_mb: Option<i32>,
    pub max_duration_sec: Option<i32>,
    pub max_output_mb: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CastSpellRequest {
    pub input: serde_json::Value,
    pub budget_cap_cents: Option<i32>,
    pub timeout_sec: Option<i32>,
    pub input_retention: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CastResponse {
    pub cast_id: i64,
    pub run_id: String,
    pub status: String,
    pub estimate_cents: i32,
    pub preauth_amount_cents: Option<i32>,
    pub result_url: String,
    pub events_url: String,
}