use actix_web::{get, App, HttpResponse, HttpServer, Responder};
use anyhow::{anyhow, Result};
use async_nats::Client as NatsClient;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::io::Write;
use std::sync::Arc;
use std::time::Instant;
use tempfile::tempdir;
use tokio::fs;
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};
use tracing::{error, info, warn};

#[derive(Clone)]
struct RunnerConfig {
    worker_base_url: String,
    internal_api_token: String,
    artifact_prefix: String,
    artifact_ttl_days: i64,
    otlp_endpoint: Option<String>,
    sandbox_cmd: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RunPayload {
    run_id: String,
    cast_id: String,
    tenant_id: String,
    spell_id: String,
    #[allow(dead_code)] // Reserved for future expansion
    mode: Option<String>,
    input: serde_json::Value,
    #[allow(dead_code)] // Reserved for future expansion
    created_at: Option<i64>,
    timeout_sec: Option<i64>,
    #[allow(dead_code)] // Reserved for future expansion
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
    tenant_id: &'a str,
    spell_id: &'a str,
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
        worker_base_url: std::env::var("WORKER_BASE_URL")
            .unwrap_or_else(|_| "https://koichinishizuka.com".into()),
        internal_api_token: std::env::var("INTERNAL_API_TOKEN")?,
        artifact_prefix: std::env::var("RUNNER_ARTIFACT_PREFIX")
            .unwrap_or_else(|_| "artifacts".into()),
        artifact_ttl_days: std::env::var("RUNNER_ARTIFACT_TTL_DAYS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(7),
        otlp_endpoint: std::env::var("OTLP_ENDPOINT").ok(),
        sandbox_cmd: std::env::var("RUNNER_SANDBOX_CMD").ok(),
    });

    let nats = connect_nats().await?;

    let queue = std::env::var("SERVICE_RUNNER_QUEUE").unwrap_or_else(|_| "service-runners".into());
    let mut sub = nats.queue_subscribe("run.*", queue).await?;

    let active = Arc::new(Mutex::new(std::collections::HashSet::<String>::new()));

    // cancellation listener
    {
        let nats = nats.clone();
        let active = active.clone();
        tokio::spawn(async move {
            if let Ok(mut cancel_sub) = nats.subscribe("cancel.*").await {
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
    let health_port = std::env::var("RUNNER_HEALTH_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);

    HttpServer::new(|| App::new().service(health))
        .bind(("0.0.0.0", health_port))?
        .run()
        .await?;

    Ok(())
}

async fn connect_nats() -> Result<NatsClient> {
    let servers = std::env::var("NATS_URL")?;
    let client = if let Ok(creds) = std::env::var("NATS_CREDS_FILE") {
        let contents = tokio::fs::read_to_string(creds).await?;
        async_nats::ConnectOptions::with_credentials(&contents)?
            .connect(servers.as_str())
            .await?
    } else if let Ok(token) = std::env::var("NATS_AUTH_TOKEN") {
        async_nats::ConnectOptions::new()
            .token(token)
            .connect(servers.as_str())
            .await?
    } else {
        async_nats::connect(servers.as_str()).await?
    };
    Ok(client)
}

async fn handle_run(
    payload: RunPayload,
    cfg: Arc<RunnerConfig>,
    active: Arc<Mutex<std::collections::HashSet<String>>>,
) -> Result<()> {
    let run_id = payload.run_id.clone();
    post_verdict(
        &cfg,
        &payload.cast_id,
        &VerdictPayload {
            run_id: &payload.run_id,
            status: "running",
            tenant_id: &payload.tenant_id,
            spell_id: &payload.spell_id,
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
            emit_otlp_event(&cfg, &payload, "canceled", None, Some("before_start"))
                .await
                .ok();
            return Ok(());
        }
    }

    let (artifact, exec_cost) = execute_sandbox(&payload, &cfg).await?;
    let final_cost = exec_cost.or(payload.estimate_cents);
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
                    tenant_id: &payload.tenant_id,
                    spell_id: &payload.spell_id,
                    cost_cents: None,
                    message: Some("Canceled during artifact creation"),
                    artifact: None,
                },
            )
            .await?;
            emit_otlp_event(
                &cfg,
                &payload,
                "canceled",
                None,
                Some("during_artifact_creation"),
            )
            .await
            .ok();
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
                    tenant_id: &payload.tenant_id,
                    spell_id: &payload.spell_id,
                    cost_cents: None,
                    message: Some("Canceled after artifact upload"),
                    artifact: None,
                },
            )
            .await?;
            emit_otlp_event(
                &cfg,
                &payload,
                "canceled",
                None,
                Some("after_artifact_upload"),
            )
            .await
            .ok();
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
            tenant_id: &payload.tenant_id,
            spell_id: &payload.spell_id,
            cost_cents: final_cost,
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
    emit_otlp_event(&cfg, &payload, "succeeded", final_cost, None)
        .await
        .ok();

    {
        let mut guard = active.lock().await;
        guard.remove(&run_id);
    }

    Ok(())
}

async fn emit_otlp_event(
    cfg: &RunnerConfig,
    payload: &RunPayload,
    status: &str,
    cost_cents: Option<i64>,
    reason: Option<&str>,
) -> Result<()> {
    let endpoint = match &cfg.otlp_endpoint {
        Some(e) => e,
        None => return Ok(()),
    };
    let mut body = json!({
        "kind": "status",
        "status": status,
        "run_id": payload.run_id,
        "spell_id": payload.spell_id,
        "tenant_id": payload.tenant_id,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });
    if let Some(cost) = cost_cents {
        body["cost_cents"] = json!(cost);
    }
    if let Some(reason_val) = reason {
        body["reason"] = json!(reason_val);
    }
    let client = reqwest::Client::new();
    match client.post(endpoint).json(&body).send().await {
        Ok(res) => {
            if !res.status().is_success() {
                warn!(status = ?res.status(), "otlp_emit_failed");
            }
        }
        Err(err) => {
            warn!(?err, "otlp_emit_error");
        }
    }
    Ok(())
}

async fn execute_sandbox(
    payload: &RunPayload,
    cfg: &RunnerConfig,
) -> Result<(Vec<u8>, Option<i64>)> {
    if let Some(cmd) = &cfg.sandbox_cmd {
        let temp = tempdir()?;
        let input_path = temp.path().join("input.json");
        let output_dir = temp.path().join("out");
        fs::create_dir_all(&output_dir).await?;
        fs::write(&input_path, serde_json::to_vec_pretty(&payload.input)?).await?;

        let mut command = Command::new(cmd);
        command.arg(&input_path).arg(&output_dir);
        command.env("SPELL_RUN_ID", &payload.run_id);
        command.env("SPELL_TENANT_ID", &payload.tenant_id);
        command.env("SPELL_ID", &payload.spell_id);
        command.stdout(std::process::Stdio::piped());
        command.stderr(std::process::Stdio::piped());

        let timeout_secs = payload
            .timeout_sec
            .and_then(|t| if t > 0 { Some(t as u64) } else { None })
            .unwrap_or(60);

        let start = Instant::now();
        let output = timeout(
            Duration::from_secs(timeout_secs),
            command.spawn()?.wait_with_output(),
        )
        .await
        .map_err(|_| anyhow!("sandbox command timed out"))??;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow!("sandbox command failed: {}", stderr.trim()));
        }

        let mut logs: Vec<String> = Vec::new();
        if let Ok(content) = fs::read_to_string(output_dir.join("logs.ndjson")).await {
            logs.extend(content.lines().map(|l| l.to_string()));
        }

        let stdout_text = String::from_utf8_lossy(&output.stdout);
        if !stdout_text.trim().is_empty() {
            logs.push(
                json!({
                    "level": "info",
                    "message": "sandbox.stdout",
                    "data": stdout_text.trim(),
                    "run_id": payload.run_id,
                })
                .to_string(),
            );
        }

        let stderr_text = String::from_utf8_lossy(&output.stderr);
        if !stderr_text.trim().is_empty() {
            logs.push(
                json!({
                    "level": "warn",
                    "message": "sandbox.stderr",
                    "data": stderr_text.trim(),
                    "run_id": payload.run_id,
                })
                .to_string(),
            );
        }

        if logs.is_empty() {
            logs = build_logs(payload);
        }

        let result_override = match fs::read_to_string(output_dir.join("result.json")).await {
            Ok(contents) => serde_json::from_str(&contents).ok(),
            Err(_) => None,
        };
        let sbom_override = match fs::read_to_string(output_dir.join("sbom.spdx.json")).await {
            Ok(contents) => serde_json::from_str(&contents).ok(),
            Err(_) => None,
        };

        let artifact = create_artifact(
            payload,
            result_override.as_ref(),
            Some(&logs),
            sbom_override.as_ref(),
        )?;
        let elapsed = start.elapsed();
        let millis = elapsed.as_millis() as i64;
        let runtime_cost = if let Some(cost) = payload.estimate_cents {
            Some(cost)
        } else {
            Some(((millis as f64 / 1000.0).ceil() as i64).max(1))
        };
        return Ok((artifact, runtime_cost));
    }

    Ok((
        create_artifact(payload, None, None, None)?,
        payload.estimate_cents,
    ))
}

fn create_artifact(
    payload: &RunPayload,
    result_override: Option<&serde_json::Value>,
    logs: Option<&[String]>,
    sbom: Option<&serde_json::Value>,
) -> Result<Vec<u8>> {
    let mut zip_buf = Vec::new();
    {
        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut zip_buf));
        let opts = zip::write::FileOptions::default();
        let result_value = match result_override {
            Some(val) => val.clone(),
            None => default_result(payload),
        };
        let json = serde_json::to_vec_pretty(&result_value)?;
        zip.start_file("result.json", opts)?;
        zip.write_all(&json)?;
        let log_lines: Vec<String> = match logs {
            Some(provided) => provided.to_vec(),
            None => build_logs(payload),
        };
        zip.start_file("logs.ndjson", opts)?;
        zip.write_all(log_lines.join("\n").as_bytes())?;
        zip.write_all(b"\n")?;
        let sbom_json = match sbom {
            Some(v) => v.clone(),
            None => generate_sbom(payload),
        };
        zip.start_file("sbom.spdx.json", opts)?;
        zip.write_all(sbom_json.to_string().as_bytes())?;
        zip.finish()?;
    }
    Ok(zip_buf)
}

fn build_logs(payload: &RunPayload) -> Vec<String> {
    let now = chrono::Utc::now().to_rfc3339();
    vec![
        json!({
            "level": "info",
            "message": "sandbox.start",
            "at": now,
            "run_id": payload.run_id,
            "spell_id": payload.spell_id,
            "tenant_id": payload.tenant_id,
        })
        .to_string(),
        json!({
            "level": "info",
            "message": "sandbox.input",
            "keys": payload.input.as_object().map(|obj| obj.keys().cloned().collect::<Vec<_>>()).unwrap_or_default(),
            "at": now,
            "run_id": payload.run_id,
        })
        .to_string(),
    ]
}

fn generate_sbom(payload: &RunPayload) -> serde_json::Value {
    json!({
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": format!("SPDXRef-DOCUMENT-{}", payload.run_id),
        "name": format!("spell-{}", payload.spell_id),
        "documentNamespace": format!("https://spell.local/spdx/{}", payload.run_id),
        "creationInfo": {
            "created": chrono::Utc::now().to_rfc3339(),
            "creators": ["Organization: Spell Platform"],
        },
        "packages": [
            {
                "SPDXID": format!("SPDXRef-Package-{}", payload.spell_id),
                "name": format!("spell-{}", payload.spell_id),
                "versionInfo": payload.input.get("version").and_then(|v| v.as_str()).unwrap_or("unknown"),
                "supplier": "Organization: Spell Platform",
            }
        ],
    })
}

fn default_result(payload: &RunPayload) -> serde_json::Value {
    json!({
        "run_id": payload.run_id,
        "cast_id": payload.cast_id,
        "spell_id": payload.spell_id,
        "tenant_id": payload.tenant_id,
        "input": payload.input,
        "generated_at": chrono::Utc::now().to_rfc3339(),
    })
}

struct UploadedArtifact {
    url: String,
    key: String,
    sha256: String,
    size: usize,
}

async fn upload_artifact(
    cfg: &RunnerConfig,
    run_id: &str,
    buffer: &[u8],
) -> Result<UploadedArtifact> {
    let key = format!(
        "{}/ {}/result.zip",
        cfg.artifact_prefix.trim_end_matches('/'),
        run_id
    )
    .replace(" ", "");
    let target = format!(
        "{}/api/artifacts/{}",
        cfg.worker_base_url.trim_end_matches('/'),
        key
    );
    let resp = reqwest::Client::new()
        .put(&target)
        .body(buffer.to_vec())
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(anyhow!("artifact upload failed: {}", resp.status()));
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

async fn post_verdict(
    cfg: &RunnerConfig,
    cast_id: &str,
    payload: &VerdictPayload<'_>,
) -> Result<()> {
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
    let status = res.status();
    if !status.is_success() {
        let text = res.text().await.unwrap_or_default();
        return Err(anyhow!("verdict post failed: {} {}", status, text));
    }
    Ok(())
}

fn ttl_epoch_ms(days: i64) -> i64 {
    let clamped = if days <= 0 { 7 } else { days };
    (chrono::Utc::now() + chrono::Duration::days(clamped)).timestamp_millis()
}
