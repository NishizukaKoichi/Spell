# Spell Platform

Spell Platform は Next.js (App Router) + Cloudflare Workers + Rust/Actix サービスランナーで構成された C2C 向け Spell マーケットプレイスです。GitHub Actions と自前 Service Runner の両モードで詠唱を行い、Cloudflare R2 に成果物を保管、Stripe Webhook で決済を確定させます。

## プロジェクト構成

- `app/` – Next.js UI (Bazaar / Grimoire / My Spells など)
- `edge/` – Cloudflare Worker ( `/api/v1/*` / SSE / Stripe Webhook / R2 / NATS )
- `core/` – Rust Actix サービスランナー (NATS 受信 → 成果物生成 → verdict 送信)
- `core/service-runner.mjs` – ローカル開発用の Node.js ランナー雛形
- `lib/` – API クライアント・Zustand ストア・型定義
- `docs/` – `ARCHITECTURE.md` / `service-runner.md` など仕様ドキュメント

## コマンド

```bash
pnpm install         # 依存関係をインストール
pnpm build           # Next.js 本番ビルド
pnpm runner:service  # Node.js 版サービスランナーを起動

# テスト
pnpm test         # すべての Vitest を実行（Edge + Service Runner）
pnpm test:edge    # Edge ワーカーのテストのみ
pnpm test:runner  # Node.js サービスランナーのテストのみ

# Cloudflare Workers
pnpm cf:deploy       # edge/src/worker.ts をデプロイ

# Rust ランナー (Actix)
cargo run --package service-runner -p service-runner  # NATS へ接続して待機
```

Rust ランナーを利用する場合は `core` ディレクトリで `cargo run` を実行し、`NATS_URL` / `INTERNAL_API_TOKEN` など必須の環境変数を設定してください。詳細は `docs/service-runner.md` を参照してください。

## 主な API

- `POST /api/v1/spells/{id}:cast` – 詠唱をキューに登録（GitHub Workflow / Service Runner）
- `GET /api/v1/casts/{id}` – キャスト情報取得
- `GET /api/v1/casts/{id}/events` – SSE で進捗・成果物通知
- `POST /api/v1/casts/{id}:cancel` – キャンセル (Idempotent)
- `POST /api/stripe/webhook` – Stripe Webhook (raw body + HMAC)

## 参考ドキュメント

- `docs/ARCHITECTURE.md` – 採択スタック、API 仕様、DoD などの詳細
- `docs/service-runner.md` – サービスランナーの環境変数、起動手順、検証フロー

## ライセンス

未定義（社内利用を想定）。
