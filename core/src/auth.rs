// Authentication module
// WebAuthn + GitHub OAuth + Recovery Codes

use axum::response::IntoResponse;

pub async fn github_callback() -> impl IntoResponse {
    "github_callback"
}

pub async fn webauthn_register_start() -> impl IntoResponse {
    "webauthn_register_start"
}

pub async fn webauthn_register_finish() -> impl IntoResponse {
    "webauthn_register_finish"
}

pub async fn webauthn_login_start() -> impl IntoResponse {
    "webauthn_login_start"
}

pub async fn webauthn_login_finish() -> impl IntoResponse {
    "webauthn_login_finish"
}

pub async fn generate_recovery_codes() -> impl IntoResponse {
    "generate_recovery_codes"
}

pub async fn recovery_code_login() -> impl IntoResponse {
    "recovery_code_login"
}