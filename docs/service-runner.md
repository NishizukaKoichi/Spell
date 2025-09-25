# Service Runner

Cloudflare Workers から `mode: "service"` でキューに登録された詠唱は、NATS JetStream を経由してサービスランナーが処理します。ランナーは成果物を生成して R2 へアップロードし、`/api/v1/casts/{id}:verdict` に結果を返します。Edge 側では Stripe Webhook の各イベント（成功・返金・支払い失敗）で台帳が更新されるため、ランナーが返す `status` / `cost_cents` が課金フローの基準になります。さらに `OTLP_ENDPOINT` を指定しておけば、実行ステータスを OTLP HTTP 経由で即時転送できます。

## 必要な環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `NATS_URL` | ✅ | NATS サーバ (JetStream) の URL。例: `tls://nats.example.internal:4222` |
| `NATS_AUTH_TOKEN` | ⛔️ | トークン認証を使う場合に指定 |
| `NATS_CREDS_FILE` | ⛔️ | `.creds` ファイルで認証する場合に指定 (指定時は `NATS_AUTH_TOKEN` より優先) |
| `INTERNAL_API_TOKEN` | ✅ | Workers 側の verdict エンドポイント呼び出しに使用する内部トークン |
| `WORKER_BASE_URL` | ➖ | Workers API のベース URL (`https://koichinishizuka.com`) |
| `RUNNER_ARTIFACT_PREFIX` | ➖ | R2 に保存する成果物キーのプリフィックス (既定 `artifacts`) |
| `RUNNER_ARTIFACT_TTL_DAYS` | ➖ | 成果物 TTL（日数）。既定 7 |
| `RUNNER_SANDBOX_CMD` | ➖ | サンドボックス実行コマンド（`<cmd> <input.json> <output_dir>` が渡される）。未設定時はダミー成果物生成 |
| `RUNNER_SANDBOX_ARGS` | ➖ | サンドボックスコマンドに付与する追加引数（スペース区切り） |
| `OTLP_ENDPOINT` / `OTLP_HTTP_ENDPOINT` | ➖ | ランナー実行ステータスを送信する OTLP HTTP エンドポイント |
| `SERVICE_RUNNER_QUEUE` | ➖ | NATS queue group 名。既定 `service-runners` |
| `SERVICE_RUNNER_ID` | ➖ | ログに表示されるランナー名 |

## 実行方法

```bash
pnpm install
pnpm runner:service
```

起動後は以下のような流れで処理が進みます。

1. `run.*` を購読し、`run_id` / `cast_id` などのペイロードを受信。
2. `POST /api/v1/casts/{id}:verdict` に `status: "running"` を送って詠唱開始を通知。
3. `RUNNER_SANDBOX_CMD` が設定されていれば `input.json` を引数に実行し、`logs.ndjson` / `sbom.spdx.json` / `result.json` を収集。未設定の場合はダミー成果物を生成。
4. 収集したファイルを ZIP 化し、`PUT /api/artifacts/...` で R2 にアップロード。SHA256 を計算してレスポンスに添付。
5. `status: "succeeded"` とともに `artifact.url/sha256/size/ttl` を verdict 経由で返送。失敗時・キャンセル時は理由を含めて verdict を送信。
6. `cancel.<run_id>` を受信した場合は該当ジョブをキャンセルし、`status: "canceled"` の verdict を送出。

## カスタマイズ

`core/service-runner.mjs` はあくまで雛形です。実際の Spell 実行ロジックを組み込む場合は以下のポイントを差し替えてください。

- `createArtifact()` で実処理の成果物を生成し、必要に応じて複数ファイルを zip 化する。
- `handleRun()` 内で実行コストを算出できるなら `cost_cents` に反映する。
- 実行ログや中間状態を API 経由で返したい場合は `POST /api/v1/casts/{id}:verdict` を追加呼び出しする。

## 動作確認フロー

1. Workers をデプロイ (`pnpm cf:deploy`) し、`mode: "service"` で `POST /api/v1/spells/{id}:cast` を呼び出す。
2. ランナーが `run.{sha256(spell_id:input_hash)}` を受信し、成果物をアップロード → verdict を送付する。
3. `GET /api/v1/casts/{id}` で `status` が `succeeded` に遷移し、`artifact_url` / `artifact_sha256` / `artifact_size_bytes` が設定されていることを確認。
4. `GET /api/v1/casts/{id}/events` の SSE で `artifact_ready` → `completed` のイベントが流れることを確認。
5. 詠唱中に `POST /api/v1/casts/{id}:cancel` を実行し、ランナーがキャンセルを検知して `status: "canceled"` を返すことを確認。
6. Stripe Dashboard / CLI から `payment_intent.succeeded` / `charge.refunded` / `invoice.payment_failed` をトリガーし、Workers 側の台帳（`billing_ledger`）とメトリクスが更新されることを確認。

これでサービスランナーの基本的な機能確認が完了します。
