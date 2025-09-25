# Spell Platform Specification

**要旨**：GitHub 認証（GitHub App 基本＋必要時 OAuth 補助）と Stripe 課金を土台に、**ワンタップ詠唱 → 実行（GitHub Actions / 自前 Service） → 成果物返却（Artifacts API / R2） → 課金/監査**を堅牢に定義。AI は後段。

- **スコープ**：Spell の **登録・販売・詠唱・成果物返却・課金・監査**（CtoC 想定）。
- **非スコープ**：Spell の自動生成/最適化/モデル選択（後日フックで接続）。
- **実装完了の定義（DoD）**：機能要件を満たすコードがローカルに実装され、ビルド＆テストが緑でローカルコミットされた状態（PR/push/CI は次工程）。

---

## 0. 原則

- **ゼロメンテ志向**：まず人間承認で安全運用 → 段階的自動化フック。
- **最小権限・短命トークン**：GitHub/Stripe/Workers すべてで徹底。
- **追記専用監査**：不可逆台帳＋R2 スナップ。
- **版固定**：ランナー/依存は pin。

---

## 1. 採択スタック（固定）

|レイヤ|技術 / 版|用途|備考|
|---|---|---|---|
|言語|Rust 1.80+（2021 Edition） + Tokio 1.47|Core/Runner/CLI|版固定|
|UI/外周|Next.js 15（App Router/RSC） on Vercel|管理UI・Bazaar・ダッシュボード|Node/Edge 併用|
|エッジAPI|Cloudflare Workers (wasm)|`/v1/*` API・SSE・Stripe Webhook|超低遅延・高可用|
|Core API|Actix Web 4.x（コンテナ常駐）|重量処理・長時間I/O|Edge と分離|
|メッセージ|NATS JetStream|起動/結果・確定通知|`Msg-Id` で冪等|
|DB|PlanetScale (MySQL)|メタ/台帳|FK は DB で不使用（アプリ整合）|
|オブジェクト|Cloudflare R2 (S3互換)|成果物・証跡・監査スナップ|署名URL|
|課金|Stripe Billing/Checkout|決済・請求|カード情報は保持しない|
|観測|`tracing` + OTLP 0.30 → Tempo/Grafana|Trace/Logs/Metrics|`traceparent` 透過|
|IaC/配備|Terraform 1.9 / Wrangler / Vercel Projects|CF/DB/Queues/Routes|dev/stg/prd|

> **分離**：UI=Vercel、API=Workers、Core=コンテナ。Actix を Workers 上で直接動かすことはしない。Runner 内部での WASM サンドボックスは可。

---

## 2. アーキテクチャ全体像

```
[ Client: Web(Next.js)/PWA/CLI/杖 ]
        │ HTTPS / SSE
        ▼
    [ Vercel (Next.js) ] --(JWT/OIDC session)--> [ Cloudflare Workers (Edge API) ]
        │                                                │
        │ calls: https://api.example.com/v1/*            ├─ Stripe Webhook (raw body)
        │                                                ├─ NATS publish (run/cancel/verdict)
        │                                                ├─ R2 presigned GET/PUT
        │                                                └─ GitHub App/OAuth → Actions/Artifacts
        ▼
[ Core(Actix/Rust; コンテナ) ] <---subscribe--- [ NATS JetStream ]
   └─ Sandbox(WASM/コンテナ) → R2 へ成果物保存 → verdict publish
```

---

## 3. ドメイン/ルーティング

- UI：`https://app.example.com`
- API：`https://api.example.com`
- Webhook：`POST https://api.example.com/webhooks/stripe`（raw）
- CDN：`https://dl.example.com`

CORS は `Origin: https://app.example.com` のみ許可。

---

## 4. 認証 / セッション / 認可

### GitHub App
- Installation Token を短命利用。必要時のみ `contents:write` 昇格。

### GitHub OAuth
- 個人 Spell の clone などリポ操作時のみ PKCE + state で実施。

### セッション
- Workers で短命 JWT (`sub`, `tenant_id`, `role`)。Refresh も短命。

### RBAC
- 役割: `maker` / `caster` / `operator` / `auditor`
- クエリは必ず `tenant_id` でスコープ。

---

## 5. データモデル（PlanetScale）

（全文は DDL を参照）
- `tenants`, `users`, `spells`, `casts`, `billing_ledger`, `artifacts`
- 外部キーはアプリ側で保証。

---

## 6. 実行モード / SSE / キャンセル / タイムアウト

### workflow
- Workers → GitHub Actions dispatch。
- Artifact を Action から取得後すぐ R2 ミラー。
- cancel 時は Actions API + 協調キャンセル。

### service
- Workers → NATS `run.{sha256(spell_id:input_hash)}` publish。
- Runner (Actix) が受信し、sandbox で実行→R2 PUT→verdict。
- cancel は `cancel.{run_id}` publish。

### clone
- Stripe `one_time` 決済後に GitHub テンプレート複製。

### SSE
- イベント: `progress`, `artifact_ready`, `completed`, `failed`, `canceled`, `heartbeat`, `log`
- `Last-Event-ID` で再送、リングバッファ 100 件。

---

## 7. API（外部公開 `/v1`）

- `POST /spells/{id}:cast`
- `GET /casts/{id}` / `GET /casts/{id}/events`
- `POST /casts/{id}:cancel`
- `POST /billing/caps`
- `POST /billing/usage`
- `POST /webhooks/stripe`

共通エラー形式：`{ code, message, details?, request_id, retry_after? }`

---

## 8. 課金 / Cap / 冪等

- Cap: `tenant_usage_month + estimate <= cap`
- `budget_cap_cents` が指定されれば追加チェック。
- NATS `Nats-Msg-Id = Idempotency-Key`
- Stripe `event.id` を `billing_ledger.external_id` に保存。

---

## 9. 成果物 / 証跡 / TTL

- GitHub Artifact は即時 R2 ミラー。
- Service Runner は直接 R2 に PUT。
- TTL は既定 7 日。失効時は HTTP 410。

---

## 10. 観測

- Metrics: `cast.count`, `cast.latency_ms`, `cast.error_rate`, `revenue.cents`, `artifact.bytes`
- Traces: `traceparent` を Next → Workers → Runner へ透過。
- Logs: JSON, `trace_id` / `span_id` を必須。

---

## 11. セキュリティ

- GitHub App 権限は最小。
- Installation/OAuth Token は短命。
- `casts.input` は既定で保持しない（保持する場合は暗号化 + TTL）。
- Service Runner は WASM/コンテナ sandbox。

---

## 12. レート制御 / バックプレッシャ

- レート: `IP × tenant × token × mode`
- NATS backlog が閾値を超えたら `503 Retry-Later`。
- 429/5xx は指数バックオフ。

---

## 13. UI

- Bazaar / Grimoire / My Spells / Billing / Account
- SSE 再接続対応、ARIA live region で進捗表示。
- Next.js App Router。ISR/PPR を適用。

---

## 14. SDK

薄い TypeScript SDK を提供 (`cast`, `onProgress`, `cancel`)。

---

## 15. Cloudflare Workers 要点

- `/v1/spells/{id}:cast` で NATS publish or GitHub dispatch。
- `/v1/casts/{id}:verdict` で Runner からの結果を確定。
- `/v1/casts/{id}/events` は SSE を返却。
- Stripe Webhook で raw body 検証。

---

## 16. Core Runner（Actix）

- NATS `run.*` を購読。
- R2 に成果物を保存。
- verdict を `/api/v1/casts/{id}:verdict` にポスト。
- cancel を `cancel.{run_id}` から受信。

---

## 17. GitHub Actions

- `spell-run.yml` で `workflow_dispatch` を受け付け、成果物をアップロード。
- Workers が artifacts API からダウンロードし R2 へミラー。

---

## 18. エラーコード

|code|http|説明|
|---|--:|---|
|`BUDGET_CAP_EXCEEDED`|402|Cap 超過|
|`UNAUTHORIZED`|401|認証失敗|
|`FORBIDDEN_REPO`|403|GitHub App 権限不足|
|`WORKFLOW_NOT_FOUND`|404|Actions ワークフロー不在|
|`VALIDATION_ERROR`|422|入力不正|
|`IDEMPOTENCY_CONFLICT`|409|冪等衝突|
|`RATE_LIMITED`|429|レート制限|
|`ARTIFACT_EXPIRED`|410|成果物 TTL 失効|
|`TIMEOUT`|504|実行タイムアウト|
|`INTERNAL`|500|内部エラー|

---

## 19. 監査 / 台帳 / スナップ

- `billing_ledger` は追記のみ。
- `audit/daily-YYYYMMDD.jsonl` にフェーズ (`artifact_ready` / `completed`) を追記。
- Merkle root を別保管する拡張を想定。

---

## 20. CI/CD

- ランナー: `ubuntu-24.04`, `windows-2025`, `macos-15`
- Rust: `dtolnay/rust-toolchain` + `Swatinem/rust-cache`
- Next: `pnpm build`
- `wrangler deploy` / Vercel CLI
- OpenAPI 差分チェック、DB マイグレーションの2フェーズ適用。

---

## 21. インシデント・ランブック

- 詠唱不可 5 分超: `503 Retry-After` と自動 25% クレジット。
- TTL 失効多発: TTL 延長 API を案内。
- 課金過大: estimate と finalize 乖離 > 20% で自動返金。

---

## 22. 受け入れ基準（DoD）

1. `cast → SSE → artifact → billing` が E2E で成功する。
2. Cap 超過は必ず 402。
3. 冪等性: 同じ Idempotency-Key で再実行しても応答が安定。
4. 成果物は `result.zip` + `sbom.spdx.json` + `result.sha256` を取得可能。
5. 監査 JSONL に欠落がない。
6. 初期 SLO (Edge/Core/E2E) を満たす。
7. Stripe Webhook は raw 検証 + 冪等（`payment_intent.succeeded` / `charge.refunded` / `invoice.payment_failed` を処理）。
8. Cancel API が冪等に動作。
9. SSE 再接続でイベント欠落がない。
10. GitHub Artifact → R2 ミラーが 1 分以内に完了。
11. 台帳多明細を正しく集計できる。

---

## 23. ロールアウト

- Phase0: 内部利用、Stripe sandbox。
- Phase1: 招待制、Workflow 優先。
- Phase2: 一般公開、Clone 解禁。

カナリアリリース: `/internal/deploy/{canary,commit,rollback}` を想定。

---

## 24. 付録

- SSE メッセージ例、Cap 判定擬似コード、状態遷移図などを `docs/ARCHITECTURE.md` に収録。
- 杖向け失敗語彙（サウンド/トースト）もここで管理。
