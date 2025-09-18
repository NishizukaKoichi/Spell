use actix_web::{get, App, HttpResponse, HttpServer, Responder};
use anyhow::Result;
use async_nats::Client as NatsClient;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info};

#[derive(Clone)]
struct RunnerConfig {
    worker_base_url: String,
    internal_api_token: String,
    artifact_prefix: String,
    artifact_ttl_days: i64,
}

#[derive(Debug, Deserialize)]
struct RunPayload {
    run_id: String,
    cast_id: String,
    tenant_id: String,
    spell_id: String,
    mode: Option<String>,
    input: serde_json::Value,
    created_at: Option<i64>,
    timeout_sec: Option<i64>,
    region: Option<String>,
    estimate_cents: Option<i64>,
}

#[derive(Serialize)]
struct VerdictArtifact<'a> {
    url: &'a str,
    key: &'a str,
    sha256: &'a str,
    size_bytes: usize,
    ttl_expires_at: i64,
}

#[derive(Serialize)]
struct VerdictPayload<'a> {
    run_id: &'a str,
    status: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    cost_cents: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    artifact: Option<VerdictArtifact<'a>>,
}

#[get("/health")]
async fn health() -> impl Responder {
    HttpResponse::Ok().body("ok")
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cfg = Arc::new(RunnerConfig {
        worker_base_url: std::env::var("WORKER_BASE_URL").unwrap_or_else(|_| "https://koichinishizuka.com".into()),
        internal_api_token: std::env::var("INTERNAL_API_TOKEN")?,
        artifact_prefix: std::env::var("RUNNER_ARTIFACT_PREFIX").unwrap_or_else(|_| "artifacts".into()),
        artifact_ttl_days: std::env::var("RUNNER_ARTIFACT_TTL_DAYS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(7),
    });

    let nats = connect_nats().await?;

    let queue = std::env::var("SERVICE_RUNNER_QUEUE").unwrap_or_else(|_| "service-runners".into());
    let mut sub = nats.queue_subscribe("spell.run.*".into(), queue).await?;

    let active = Arc::new(Mutex::new(std::collections::HashSet::<String>::new()));

    // cancellation listener
    {
        let nats = nats.clone();
        let active = active.clone();
        tokio::spawn(async move {
            if let Ok(mut cancel_sub) = nats.queue_subscribe("cancel.*".into(), "service-runners".into()).await {
                while let Some(msg) = cancel_sub.next().await {
                    if let Some((_prefix, run_id)) = msg.subject.split_once('.') {
                        let mut guard = active.lock().await;
                        if guard.remove(run_id) {
                            info!(run_id, "marked run as cancelled");
                        }
                    }
                }
            }
        });
    }

    // spawn worker loop
    {
        let cfg = cfg.clone();
        let active = active.clone();
        tokio::spawn(async move {
            while let Some(msg) = sub.next().await {
                let cfg = cfg.clone();
                let active = active.clone();
                match serde_json::from_slice::<RunPayload>(&msg.payload) {
                    Ok(payload) => {
                        let run_id = payload.run_id.clone();
                        {
                            let mut guard = active.lock().await;
                            guard.insert(run_id.clone());
                        }
                        tokio::spawn(async move {
                            if let Err(err) = handle_run(payload, cfg, active).await {
                                error!(?err, "run handling failed");
                            }
                        });
                    }
                    Err(err) => {
                        error!(?err, "failed to decode run payload");
                    }
                }
            }
        });
    }

    // Actix server (health only)
    HttpServer::new(|| App::new().service(health))
        .bind(("0.0.0.0", 8080))?
        .run()
        .await?;

    Ok(())
}

async fn connect_nats() -> Result<NatsClient> {
    let servers = std::env::var("NATS_URL")?;
    let client = if let Ok(creds) = std::env::var("NATS_CREDS_FILE") {
        let contents = tokio::fs::read(creds).await?;
        async_nats::ConnectOptions::with_credentials(contents).connect(servers).await?
    } else if let Ok(token) = std::env::var("NATS_AUTH_TOKEN") {
        async_nats::ConnectOptions::new().token(token).connect(servers).await?
    } else {
        async_nats::connect(servers).await?
    };
    Ok(client)
}

async fn handle_run(payload: RunPayload, cfg: Arc<RunnerConfig>, active: Arc<Mutex<std::collections::HashSet<String>>>) -> Result<()> {
    let run_id = payload.run_id.clone();
    post_verdict(
        &cfg,
        &payload.cast_id,
        &VerdictPayload {
            run_id: &payload.run_id,
            status: "running",
            cost_cents: None,
            message: None,
            artifact: None,
        },
    )
    .await?;

    {
        let guard = active.lock().await;
        if !guard.contains(&run_id) {
            info!(run_id, "cancelled before start");
            return Ok(());
        }
    }

    let artifact = create_artifact(&payload)?;
    {
        let guard = active.lock().await;
        if !guard.contains(&run_id) {
            info!(run_id, "cancelled during artifact creation");
            post_verdict(
                &cfg,
                &payload.cast_id,
                &VerdictPayload {
                    run_id: &payload.run_id,
                    status: "canceled",
                    cost_cents: None,
                    message: Some("Canceled during artifact creation"),
                    artifact: None,
                },
            )
            .await?;
            return Ok(());
        }
    }

    let uploaded = upload_artifact(&cfg, &payload.run_id, &artifact).await?;
    {
        let guard = active.lock().await;
        if !guard.contains(&run_id) {
            info!(run_id, "cancelled after upload");
            post_verdict(
                &cfg,
                &payload.cast_id,
                &VerdictPayload {
                    run_id: &payload.run_id,
                    status: "canceled",
                    cost_cents: None,
                    message: Some("Canceled after artifact upload"),
                    artifact: None,
                },
            )
            .await?;
            return Ok(());
        }
    }

    let ttl = ttl_epoch_ms(cfg.artifact_ttl_days);
    post_verdict(
        &cfg,
        &payload.cast_id,
        &VerdictPayload {
            run_id: &payload.run_id,
            status: "succeeded",
            cost_cents: payload.estimate_cents,
            message: None,
            artifact: Some(VerdictArtifact {
                url: &uploaded.url,
                key: &uploaded.key,
                sha256: &uploaded.sha256,
                size_bytes: uploaded.size,
                ttl_expires_at: ttl,
            }),
        },
    )
    .await?;

    {
        let mut guard = active.lock().await;
        guard.remove(&run_id);
    }

    Ok(())
}

fn create_artifact(payload: &RunPayload) -> Result<Vec<u8>> {
    let mut zip_buf = Vec::new();
    {
        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut zip_buf));
        let opts = zip::write::FileOptions::default();
        let json = serde_json::to_vec_pretty(&serde_json::json!({
            "run_id": payload.run_id,
            "cast_id": payload.cast_id,
            "spell_id": payload.spell_id,
            "tenant_id": payload.tenant_id,
            "input": payload.input,
            "generated_at": chrono::Utc::now().to_rfc3339(),
        }))?;
        zip.start_file("result.json", opts)?;
        zip.write_all(&json)?;
        zip.finish()?;
    }
    Ok(zip_buf)
}

struct UploadedArtifact {
    url: String,
    key: String,
    sha256: String,
    size: usize,
}

async fn upload_artifact(cfg: &RunnerConfig, run_id: &str, buffer: &[u8]) -> Result<UploadedArtifact> {
    let key = format!("{}/ {}/result.zip", cfg.artifact_prefix.trim_end_matches('/'), run_id).replace(" ", "");
    let target = format!("{}/api/artifacts/{}", cfg.worker_base_url.trim_end_matches('/'), key);
    let resp = reqwest::Client::new()
        .put(&target)
        .body(buffer.to_vec())
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(anyhow::anyhow!("artifact upload failed: {}", resp.status()));
    }
    let body: serde_json::Value = resp.json().await?;
    let mut hasher = Sha256::new();
    hasher.update(buffer);
    let sha = hasher.finalize();
    let sha_hex = sha.iter().map(|b| format!("{:02x}", b)).collect::<String>();
    Ok(UploadedArtifact {
        url: body
            .get("url")
            .and_then(|v| v.as_str())
            .unwrap_or(&target)
            .to_string(),
        key,
        sha256: sha_hex,
        size: buffer.len(),
    })
}

async fn post_verdict(cfg: &RunnerConfig, cast_id: &str, payload: &VerdictPayload<'_>) -> Result<()> {
    let url = format!(
        "{}/api/v1/casts/{}:verdict",
        cfg.worker_base_url.trim_end_matches('/'),
        cast_id
    );
    let res = reqwest::Client::new()
        .post(url)
        .bearer_auth(&cfg.internal_api_token)
        .json(payload)
        .send()
        .await?;
    if !res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(anyhow::anyhow!("verdict post failed: {} {}", res.status(), text));
    }
    Ok(())
}

fn ttl_epoch_ms(days: i64) -> i64 {
    let clamped = if days <= 0 { 7 } else { days };
    (chrono::Utc::now() + chrono::Duration::days(clamped)).timestamp_millis()
}
