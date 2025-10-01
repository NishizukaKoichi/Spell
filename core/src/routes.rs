use axum::{
    routing::{get, post},
    Router,
};

use crate::AppState;

pub fn api_routes() -> Router<AppState> {
    Router::new()
        // Auth routes
        .route("/auth/github/callback", get(crate::auth::github_callback))
        .route("/auth/webauthn/register/start", post(crate::auth::webauthn_register_start))
        .route("/auth/webauthn/register/finish", post(crate::auth::webauthn_register_finish))
        .route("/auth/webauthn/login/start", post(crate::auth::webauthn_login_start))
        .route("/auth/webauthn/login/finish", post(crate::auth::webauthn_login_finish))
        .route("/auth/recovery-codes/generate", post(crate::auth::generate_recovery_codes))
        .route("/auth/recovery-code/login", post(crate::auth::recovery_code_login))

        // Spell routes
        .route("/spells", get(list_spells).post(create_spell))
        .route("/spells/:id", get(get_spell).put(update_spell).delete(delete_spell))
        .route("/spells/:id/publish", post(publish_spell))
        .route("/spells/:id/cast", post(cast_spell))

        // Cast routes
        .route("/casts/:id", get(get_cast))
        .route("/casts/:id/events", get(cast_events))
        .route("/casts/:id/cancel", post(cancel_cast))

        // Artifact routes
        .route("/artifacts/:id/download", get(download_artifact))
        .route("/artifacts/:id/extend_ttl", post(extend_artifact_ttl))

        // Audit routes
        .route("/audit", get(list_audit_logs))
}

// Placeholder handlers (to be implemented)
async fn list_spells() -> &'static str {
    "list_spells"
}

async fn create_spell() -> &'static str {
    "create_spell"
}

async fn get_spell() -> &'static str {
    "get_spell"
}

async fn update_spell() -> &'static str {
    "update_spell"
}

async fn delete_spell() -> &'static str {
    "delete_spell"
}

async fn publish_spell() -> &'static str {
    "publish_spell"
}

async fn cast_spell() -> &'static str {
    "cast_spell"
}

async fn get_cast() -> &'static str {
    "get_cast"
}

async fn cast_events() -> &'static str {
    "cast_events"
}

async fn cancel_cast() -> &'static str {
    "cancel_cast"
}

async fn download_artifact() -> &'static str {
    "download_artifact"
}

async fn extend_artifact_ttl() -> &'static str {
    "extend_artifact_ttl"
}

async fn list_audit_logs() -> &'static str {
    "list_audit_logs"
}