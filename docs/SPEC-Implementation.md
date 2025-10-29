# 呪文アプリ 仕様書

> **要旨**: GitHub認証（GitHub App＋必要時OAuth）と Stripe 課金を土台に、ワンタップ詠唱・従量/買い切り/サブスク・他者プラリポ発火・成果物返却（Artifacts API）までを**現実に即して**定義。AI最適化は**任意拡張**として後段に分離。固有ブランド名は排し、汎称で統一。

---

## 0. ゴール

- **入力 → 自動設計 → 実装 → 品質確保 → 無停止デプロイ → 課金 → 監査 → 自律運用**を段階自動化（手動上書き可）。
- **ゼロメンテ志向**：SLO/コスト/依存更新は後述の Optimizer（任意）で自動化可能。まずは**人間承認フロー前提**。

---

## 1. 採択スタック（固定ピン留め）

| レイヤ         | 技術 / 版                                                         | 用途              | メモ                         |
| -------------- | ----------------------------------------------------------------- | ----------------- | ---------------------------- |
| 言語/Async     | Rust 2021 + **Tokio 1.47.0**                                      | Core/CLI          | coop改善系。固定ピン留め。   |
| Edge           | **Cloudflare Workers** + `workers-rs`（`wasm32-unknown-unknown`） | Edge API / SSE    | 短時間I/O専任。              |
| Edge（WASI）   | —（**実験**）                                                     | —                 | 必要処理は Core へ委譲。     |
| Core API       | **Actix Web 4.11.x**                                              | 重量処理/橋渡し   | ステートレス指向。           |
| メッセージング | **NATS JetStream**                                                | コマンド/イベント | Msg-Id重複排除＋Double Ack。 |
| 永続化         | Neon PostgreSQL（Serverless）＋ CF **KV/R2**                      | メタ／バイナリ    | R2はS3互換、台帳はRDB。      |
| Observability  | `tracing` + **OpenTelemetry 0.30**（OTLP→Tempo）                  | 分散トレース      | W3C trace を貫通。           |
| 認証           | Passkeys(WebAuthn) + OAuth2                                       | 1タップ認証       | GitHub/OIDC併用。            |
| フロント       | **Next.js 16** + **React 19** + TypeScript                        | PWA               | CLI/Capacitor/Tauri併設。    |
| モバイル       | **Capacitor 5**                                                   | iOS/Android       | —                            |
| デスクトップ   | **Tauri 2**                                                       | Win/macOS/Linux   | —                            |
| リアルタイム   | WebTransport + NATS WS bridge                                     | sub-50ms Push     | SSEフォールバック。          |
| CI/CD          | GitHub Actions（**ubuntu-24.04 / windows-2025 / macos-15**）      | 全OSビルド        | `*-latest` 非使用。          |
| IaC            | Terraform 1.9 / Wrangler                                          | CF/DB/Queues      | 環境はコードで固定。         |

> 設計注：Workers での長時間/WASI前提は **Core へ委譲**。Workers は HTTP/SSE の表口・短期I/Oに徹する。

---

## 2. 実行平面（Execution Plane）

### 2.1 モード定義（必須）

- `execution.mode` ∈ { **`workflow`**, **`service`**, **`clone`** }
  - **workflow**: GitHub Actions を実行平面とし、対象リポの `workflow_dispatch` / `repository_dispatch` を外部から起動。
  - **service**: 自前ワーカー（Actix/NATS/コンテナ/WASM）で実行。低レイテンシ/大量並列/長時間/ネット許可制御向き。
  - **clone**: 買い切り。テンプレートを**ユーザーのGitHub**へ生成（/generate）し、以後はユーザー所有で何度でも利用。

### 2.2 GitHub 連携要件

- 他者の**プライベートリポ**を発火するには、**相手側**で本 GitHub App をインストールし**対象リポを許可**していることが必須。
- 成果物返却は **GitHub Actions Artifacts API** の一時URL（zip）を UI に返すのを正とする。

---

## 3. アーキテクチャ

```
PWA / Capacitor / Tauri / CLI
        │ HTTPS / WebTransport
        ▼
Cloudflare Workers (Edge)
        │ publish run.<sha256> (JetStream)
        ▼
Actix Cluster (Tokio) ──▶ Isolated Sandbox（ro FS / allowlist net / time&mem limit）
        │                    ├─ (任意) Optimizer/Grader
        │                    └─ Ledger (Neon PostgreSQL + R2/KV)
        │
OpenTelemetry (OTLP) ─────► Tempo/Grafana
```

- Streams/SSE を Workers で提供。DO は必要時のみ。

---

## 4. 実行フロー（ユーザー視点）

1. Caster が UI で Spell を選択 → 価格/回数/Cap を確認。
2. **Budget Cap** 判定（`current_usage + estimate <= cap`）。満たさなければ **402** を返し起動拒否。
3. `/v1/spells/{id}:cast` を `POST` → 即時 `run_id` と `progress_sse` を返却。
4. `execution.mode` に応じて発火：
   - **workflow**: 対象リポの `workflow_dispatch` / `repository_dispatch` を起動。
   - **service**: JetStream へ publish → ワーカーが実行。
   - **clone**: Stripe Checkout 後にテンプレ生成（以後はユーザー環境）。

5. 成果物は Artifacts API（workflow） or R2（service）で保管 → 一時URLで返却。
6. 完了時に請求確定（都度 or Usage 反映）。監査/台帳更新。

---

## 5. Public API（要旨）

**Base**: `/v1`

- `POST /spells` … 登録（名前、説明、価格、**execution**、入力スキーマ、SLA、可用リージョン）
- `GET /spells` / `GET /spells/{id}` … 検索/詳細
- `POST /spells/{id}:cast` … 詠唱（**Idempotency-Key必須**、inputs、mode override可）
- `GET /casts/{cast_id}` … 状態（queued/running/succeeded/failed）、`run_url`、`artifact_url`
- `POST /billing/caps` … アカウントの Cap 設定（monthly/total）
- `POST /billing/usage` … サブスク従量の Usage 反映（メーター）
- `POST /webhooks/stripe` … Stripe イベント受領

**エラー例**

```json
{ "error": { "code": "BUDGET_CAP_EXCEEDED", "message": "cap exceeded", "retry_after": 86400 } }
```

**Rate Limit**: `X-RateLimit-*` を返却。超過時は `429`（`Retry-After`）。

---

## 6. トリガ（Workflow/Service）

### 6.1 GitHub Actions 側サンプル

```yaml
name: spell-run
on:
  workflow_dispatch:
    inputs:
      payload:
        description: 'Spell JSON input'
        required: true
  repository_dispatch:
    types: [spell.cast]
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run spell
        run: node scripts/run-spell.js '${{ github.event.inputs.payload || toJson(github.event.client_payload) }}'
      - uses: actions/upload-artifact@v4
        with:
          name: result
          path: out/**
```

### 6.2 Service 実行（JetStream）

- Subjects: `run.<sha256>`（RunRequest）、`verdict.<run_id>`（RunResult）
- Dedupe: `Nats-Msg-Id` を使用。消費側は Confirmed Ack。

---

## 7. 課金モデル / Cap / 返金

### 7.1 種別

- **従量（タップ1回課金）**: SetupIntent でPM保存 → 実行後 PaymentIntent で確定。
- **サブスク従量**: Subscription(metered) + Usage Records（必要に応じ Billing Thresholds）。
- **買い切り（clone）**: Checkout 後にテンプレ生成 → 以後は無制限（プラットフォームからの課金なし）。

### 7.2 Budget Cap（ハード強制）

- Cap はアプリ側で**必ず**強制。起動前に `current_usage + estimate <= cap` を満たさなければ **402** を返す。
- 早期請求（Thresholds）は**補助**であり Cap の代替ではない。

### 7.3 Idempotency / 返金

- すべての課金系APIは **Idempotency-Key** 必須。
- SLA違反・P0 障害時は**部分返金**（従量）または**クレジット付与**（サブスク）。

---

## 8. セキュリティ / プライバシ

- **最小権限**: GitHub App は `Metadata:Read` / `Contents:Read` / `Actions:Read` を基本。必要時のみ `Contents:Write`。
- **トークン**: 短命 Installation Token のみ。長期秘密は保管しない。
- **Sandbox**: ro FS、許可リストネット、時間/メモリ上限、syscall 制限。
- **SBOM/署名（推奨→段階的に必須へ）**: Syft 生成 → cosign attest（in-toto）。
- **監査**: 入力ハッシュ、`run_id`、請求金額、主要イベントを台帳化（不変ログ R2/JSONL）。
- **データ保持**: 入力24h、成果物7日、監査30日（既定）。

---

## 9. 可観測性

- **メトリクス**: `cast.count`, `cast.latency_ms`, `errors.by_code`, `refunds.count`, `revenue.cents`。
- **トレース**: `traceparent/tracestate` を Edge→Core→Runner へ貫通、OTLP→Tempo。
- **ログ**: JSON、PII最小化。保持は上記に準拠。

---

## 10. CLI / SDK / UI

- CLI: `spell cast`, `spell logs`, `spell cap set`, `spell plan subscribe`。
- SDK（TS）: `cast(spellId, input, {mode})`, `onProgress(runId, cb)`（SSE再接続内蔵）。
- UI: 発火ボタン、実行履歴、支払い設定、買い切り導線、Cap表示。

---

## 11. CI / CD（固定）

- ランナー：**ubuntu-24.04 / windows-2025 / macos-15** を**版固定**。
- ワークフロー：`checkout@v4` → `dtolnay/rust-toolchain` → `rust-cache@v2` → `cross/cargo`。
- Edge 配置：`wrangler deploy`（`wrangler.jsonc/json`）。
- SBOM：`anchore/sbom-action` → アーティファクト。
- 署名/証跡：`cosign attest`（DSSE/in-toto）。

---

## 12. 必須 Secrets（例）

| 名称                                    | 用途                               |
| --------------------------------------- | ---------------------------------- |
| `CF_API_TOKEN`                          | `wrangler deploy`                  |
| `CF_ACCOUNT_ID` / `CF_R2_*` / `CF_KV_*` | Workers/KV/R2 バインディング       |
| `NATS_URL` / `NATS_CREDS`               | JetStream 接続                     |
| `DATABASE_URL` / `POSTGRES_PRISMA_URL`  | Neon PostgreSQL 接続（Serverless） |
| `OTLP_ENDPOINT` / `OTLP_API_KEY`        | Tempo/Grafana Cloud 送信           |
| `COSIGN_KEY` / `COSIGN_PASSWORD`        | cosign 署名鍵                      |

---

## 13. SLO（初期）

| 指標         | 目標      |
| ------------ | --------- |
| Edge p99     | ≤ 4 ms    |
| Core p95     | ≤ 50 ms   |
| E2E（Wi‑Fi） | ≤ 120 ms  |
| 年間可用性   | ≥ 99.99 % |
| 監査ログ損失 | 0         |

---

## 14. 受け入れ基準（DoD）

- `e2e/cast` 緑（全プラットフォーム）。
- SBOM（SPDX/CycloneDX）＋ cosign attestation 検証OK。
- `traceparent` が Edge→Core→Ledger まで可視化（Tempo）。
- Canary 失敗時は自動ロールバック。

---

## 15. Go-Live 手順（45–90分目安）

1. GitHub App（最小権限）を組織/個人へ導入。
2. Cloudflare: Workers / KV / R2 / DO を発行し `CF_API_TOKEN` を投入。
3. `wrangler.jsonc` を用意して `wrangler deploy`。
4. DB: Neon PostgreSQL を作成（Serverless）。
5. OTLP エンドポイント/キー設定（Tempo/Grafana Cloud）。
6. ダミーSKUで **cast→進捗→成果物返却** まで E2E を通す。

---

## 16. 既知の制約と措置

- **Workers の WASI は実験段階**：WASI必須処理は Core 実行。
- JetStream の “Exactly-Once” は **Semantics**：`Nats-Msg-Id`＋Double Ack を厳守。
- WebTransport は環境依存：SSE/NATS‑WS を確実なフォールバックに。
- GitHub ランナーの `*-latest` は移行期間で変動：**版固定**で吸収。

---

## 17. 役割/RBAC

- ロール：`maker`, `caster`, `operator`, `auditor`。
- スコープ：`spell:publish`, `cast:invoke`, `ops:deploy`, `audit:read`。

---

## 18. データモデル（要旨）

- `spells`：id, name, semver, author_id, execution, price_model, policy_id, published_at, status
- `casts`：id, spell_id, caster_id, input_hash, mode, status, started_at, finished_at, cost_cents, region
- `artifacts`：場所（Artifacts API or R2）、ダイジェスト、ttl
- `billing_ledger`：cast_id, amount_cents, currency, method, refund_ref

---

## 19. 付録：API スキーマ断片

```json
{
  "id": "com.example.hello",
  "name": "Hello",
  "execution": {
    "mode": "workflow",
    "workflow": {
      "repo": "owner/name",
      "workflow_id": "spell.yml",
      "dispatch": "repository_dispatch"
    }
  },
  "pricing": { "model": "flat", "currency": "USD", "flat_cents": 5 },
  "inputs": {
    "type": "object",
    "properties": { "name": { "type": "string" } },
    "required": ["name"]
  }
}
```

---

## 20. 付録：テンプレ生成（買い切り）フロー

1. Stripe Checkout 成功 → 2) OAuth で `POST /repos/{template}/generate` → 3) 生成先に初回設定 PR → 4) 以後はユーザー所有。

---

## 21. 変更履歴

- v3.0（2025‑08‑26）: 完全版。実行平面の必須化、Budget Cap 強制、GitHub制約/Artifacts返却の明文化、章番号整理、固有名削除。

---

## 21. MCP 拡張（Model Context Protocol）

> 目的: どのAIクライアント（エージェント/チャット/IDE）からでも同じ手順で Spell を探索・実行できる共通IFを提供。

### 21.1 MCP Server（概念）

- **Transport**: stdio / WebSocket（どちらも JSON-RPC 互換の request/response + server-initiated progress）。
- **Auth**: `Authorization: Bearer <short‑lived token>`（OAuth/OIDCで発行）。
- **Idempotency**: `idempotency_key` を `spells.cast` に必須。

### 21.2 Tools（最小）

- `spells.list`  
   **input**: `{ query?: string, tags?: string[], limit?: number }`  
   **output**: `{ items: SpellSummary[] }`
- `spells.detail`  
   **input**: `{ id: string }`  
   **output**: `{ spell: Spell }`
- `spells.cast`（**streaming**）  
   **input**: `{ id: string, args: object, mode?: "workflow|service|clone", budget_cap?: number, idempotency_key: string }`  
   **output (final)**: `{ run_id: string, status: "succeeded|failed", artifact_url?: string, cost_cents?: number }`  
   **progress events**: `{ run_id, stage, message?, pct? }`

### 21.3 Resources（任意）

- `artifact://{run_id}` を読み取り専用で公開（署名付一時URLへ解決）。

---

## 22. カタログ / 購買フロー

### 22.1 エンドポイント

- `GET /catalog/spells?q=&tag=&sort=popular|recent|price`  
   → `SpellSummary[]`: id, name, author, price, mode, rating, tags
- `GET /catalog/spells/{id}`  
   → 価格プラン（従量/サブスク/買い切り）、入力スキーマ、対応モード
- `POST /catalog/spells/{id}/purchase`（**clone**専用）  
   → Stripe Checkout → `POST /repos/{template}/generate`

### 22.2 可視性

- `visibility ∈ { public, unlisted, private }`
- Org/Team スコープ販売を許容。

---

## 23. 課金SKU構造（Stripe対応）

### 23.1 SKU 型

- **flat**: 1詠唱ごと `flat_cents`。
- **metered**: `base_cents` + メーター `casts` / `compute_ms` / `egress_mb`（Usage Records）。
- **one_time**（clone）: 一括。ライセンス条項を `license_url` で紐づけ。

### 23.2 Webhook / 状態遷移

- 受領: `checkout.session.completed`, `customer.subscription.updated`, `invoice.paid`, `charge.refunded`。
- 失敗時: 実行は取り消し／権利剥奪。返金は部分/全額（SLA準拠）。

---

## 24. エラーコード

| code                   | http | 意味               | 対処                          |
| ---------------------- | ---: | ------------------ | ----------------------------- |
| `BUDGET_CAP_EXCEEDED`  |  402 | Cap超過見込み      | Cap引上げ or 入力縮小         |
| `UNAUTHORIZED`         |  401 | 未認証             | ログイン/トークン再取得       |
| `FORBIDDEN_REPO`       |  403 | 対象Repo未許可     | 相手側でAppインストール＋許可 |
| `WORKFLOW_NOT_FOUND`   |  404 | workflow_id不在    | YAML/IDを確認                 |
| `VALIDATION_ERROR`     |  422 | 入力スキーマ不整合 | 入力修正                      |
| `IDEMPOTENCY_CONFLICT` |  409 | 同一キー重複       | 同一レス返却 or キー変更      |
| `RATE_LIMITED`         |  429 | レート超過         | `Retry-After` を待つ          |
| `ARTIFACT_EXPIRED`     |  410 | 成果物TTL切れ      | 再実行 or 再公開              |
| `TIMEOUT`              |  504 | 実行時間超過       | `timeout_sec` 見直し          |
| `INTERNAL`             |  500 | 内部障害           | 再試行/サポート連絡           |

---

## 25. GitHub App マニフェスト（最小）

```json
{
  "name": "Spell Platform",
  "url": "https://example.com",
  "hook_attributes": { "url": "https://edge.example/webhooks/github" },
  "redirect_url": "https://edge.example/github/callback",
  "default_permissions": {
    "metadata": "read",
    "contents": "read",
    "actions": "read"
  },
  "default_events": ["workflow_run", "repository_dispatch"]
}
```

> 他者リポに書き込みが必要な Spell のみ `contents:write` を個別昇格。

---

## 26. Workers 設定（`wrangler.jsonc` 例）

```jsonc
{
  "name": "spell-edge",
  "main": "build/worker.js",
  "compatibility_date": "2025-08-01",
  "routes": [{ "pattern": "api.example.com/*", "zone_id": "Z..." }],
  "vars": { "NATS_URL": "nats://..." },
  "kv_namespaces": [{ "binding": "KV", "id": "..." }],
  "r2_buckets": [{ "binding": "R2", "bucket_name": "spell-artifacts" }],
}
```

---

## 27. TypeScript SDK スニペット

```ts
export async function cast(
  spellId: string,
  input: any,
  opt: { mode?: string; idempotencyKey: string }
) {
  const r = await fetch(`/v1/spells/${spellId}:cast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': opt.idempotencyKey,
    },
    body: JSON.stringify({ input, mode: opt.mode }),
  });
  if (!r.ok) throw await r.json();
  return r.json();
}

export function onProgress(runId: string, cb: (e: MessageEvent) => void) {
  const es = new EventSource(`/v1/casts/${runId}/events`);
  es.onmessage = cb;
  return () => es.close();
}
```

---

## 28. E2E テスト計画（最小）

- **T1: workflow 成功系** — `cast` → Actions 実行 → Artifact取得 → 請求確定。
- **T2: Cap 拒否** — 見積が Cap を超えると 402。
- **T3: Idempotency** — 同一キーで二重起動不可。
- **T4: Repo 権限不足** — 403 `FORBIDDEN_REPO`。
- **T5: TTL 失効** — 410 `ARTIFACT_EXPIRED`。
- **T6: Stripe Webhook** — 署名検証と再送耐性。

---

## 29. 脅威モデルと対策（抜粋）

- **権限濫用**: 最小権限 + 短命トークン、Org/Repo allowlist。
- **サプライチェーン**: SBOM＋cosign、Artifact ダイジェスト検証、テンプレ生成の初回PRは必須レビュー。
- **DoS/スパム**: Rate Limit、課金前提、無料枠にも Cap、IP/Org ごとのバックプレッシャー。
- **データ漏えい**: R2/KV はKMSでサーバ側暗号化、成果物は短命URL、PII最小化ログ。

---

## 30. 非目標（Non‑Goals）

- 物理デバイス（杖）実装は本仕様の範囲外（将来計画）。
- 汎用AIエージェント実装は含めず、**MCP経由の呼び出し**に限定。
- 永久保存は非対応（TTL/保持期間を明示）。
