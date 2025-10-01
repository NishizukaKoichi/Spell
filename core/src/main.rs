use axum::{
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tower_http::{
    cors::CorsLayer,
    trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer},
};
use tracing::Level;

mod models;
mod routes;
mod auth;
mod wasm;
mod storage;
mod billing;

#[derive(Clone)]
struct AppState {
    db: sqlx::PgPool,
    storage_client: Arc<aws_sdk_s3::Client>,
    webauthn: Arc<webauthn_rs::Webauthn>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(Level::INFO.into()),
        )
        .json()
        .init();

    // Database connection
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    let db = PgPoolOptions::new()
        .max_connections(20)
        .connect(&database_url)
        .await?;

    // Run migrations
    sqlx::migrate!("../db/migrations")
        .run(&db)
        .await?;

    // Storage client
    let aws_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
    let storage_client = Arc::new(aws_sdk_s3::Client::new(&aws_config));

    // WebAuthn configuration
    let rp_id = std::env::var("WEBAUTHN_RP_ID")
        .unwrap_or_else(|_| "localhost".to_string());
    let rp_origin = std::env::var("WEBAUTHN_RP_ORIGIN")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());

    let rp_origin_url = url::Url::parse(&rp_origin)?;
    let webauthn = Arc::new(
        webauthn_rs::WebauthnBuilder::new(&rp_id, &rp_origin_url)?
            .rp_name("Spell Platform")
            .build()?
    );

    let state = AppState {
        db,
        storage_client,
        webauthn,
    };

    // Build router
    let app = Router::new()
        .route("/health", get(health))
        .nest("/api/v1", routes::api_routes())
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
                .on_response(DefaultOnResponse::new().level(Level::INFO)),
        )
        .layer(CorsLayer::permissive())
        .with_state(state);

    // Start server
    let addr = std::env::var("BIND_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:8080".to_string());

    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION")
    }))
}