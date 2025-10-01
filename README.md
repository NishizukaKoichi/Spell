# Spell Platform

> ワンタップで詠唱。コードを呪文に変えるCtoCマーケットプレイス

Spell PlatformはRust (Axum) + Next.js (App Router) + Postgres + Tigris で構成されたWASM実行プラットフォームです。

## アーキテクチャ概要

- **Backend**: Rust (Axum) - WebAuthn認証、WASM実行、SSE、課金
- **Frontend**: Next.js 15 (App Router) - パスキーログイン、Spell検索・実行
- **Database**: Postgres 16+ - Metadata、課金台帳、監査ログ
- **Storage**: Tigris (S3互換) - Artifact保管
- **Payments**: Stripe - 事前オーソリゼーション、Webhook

## プロジェクト構成

```
Spell/
├── core/                   # Rust backend
│   ├── src/
│   │   ├── main.rs        # Axum server
│   │   ├── models.rs      # Data models
│   │   ├── routes.rs      # API routes
│   │   ├── auth.rs        # WebAuthn + GitHub OAuth
│   │   ├── wasm.rs        # Wasmtime executor
│   │   ├── storage.rs     # Tigris client
│   │   └── billing.rs     # Stripe integration
│   └── Cargo.toml
├── app/                    # Next.js frontend
│   ├── page.tsx           # Landing page
│   ├── login/page.tsx     # Login (GitHub + Passkey)
│   ├── bazaar/page.tsx    # Public spell marketplace
│   └── layout.tsx         # Root layout
├── db/
│   ├── schema.sql         # Postgres schema
│   └── migrations/        # SQLx migrations
└── .env.example           # Environment variables template
```

## セットアップ

### 1. 依存関係のインストール

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install sqlx-cli --no-default-features --features postgres

# Node.js
pnpm install
```

### 2. データベースセットアップ

```bash
# Create database
createdb spell_platform

# Run migrations
cd core
sqlx migrate run
```

### 3. 環境変数の設定

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. 起動

```bash
# Backend (Rust)
cd core
cargo run

# Frontend (Next.js)
pnpm dev
```

## Phase 0 実装範囲

**Phase 0では以下を実装します:**

✅ **認証**
- GitHub OAuth
- WebAuthn (パスキー) - Conditional Mediation対応
- リカバリコード (8個、1回限り使用)

✅ **データベース**
- Postgres 16+ スキーマ
- 外部キー制約、トリガー
- 監査ログ (PII最小化)

✅ **WASM実行**
- Wasmtime 21+ サンドボックス
- リソース制限 (メモリ、時間、出力サイズ)
- ネットワーク許可リスト

✅ **Artifact管理**
- Tigris (S3互換) ストレージ
- ウイルススキャン (ClamAV)
- TTL管理 (初期15分、延長可能、最大37日)

✅ **課金**
- Stripe事前オーソリゼーション
- 台帳 (append-only)
- コスト超過検知 (最大20%)

✅ **UI**
- ランディングページ
- ログインページ (パスキー自動起動)
- Bazaar (公開Spell一覧)

## 主なAPI

### 認証
- `GET /api/v1/auth/github/callback` - GitHub OAuth callback
- `POST /api/v1/auth/webauthn/register/start` - パスキー登録開始
- `POST /api/v1/auth/webauthn/login/start` - パスキーログイン開始
- `POST /api/v1/auth/recovery-codes/generate` - リカバリコード生成
- `POST /api/v1/auth/recovery-code/login` - リカバリコードログイン

### Spell
- `GET /api/v1/spells` - Spell一覧
- `POST /api/v1/spells` - Spell作成
- `POST /api/v1/spells/:id/publish` - Spell公開 (UV必須)
- `POST /api/v1/spells/:id/cast` - 詠唱実行

### Cast
- `GET /api/v1/casts/:id` - Cast情報取得
- `GET /api/v1/casts/:id/events` - SSE進捗ストリーム
- `POST /api/v1/casts/:id/cancel` - キャンセル

### Artifact
- `GET /api/v1/artifacts/:id/download` - ダウンロード (署名URL)
- `POST /api/v1/artifacts/:id/extend_ttl` - TTL延長

## 技術スタック

| レイヤ | 技術 | バージョン |
|--------|------|-----------|
| Backend | Rust | 1.80+ |
| Framework | Axum | 0.7 |
| Runtime | Tokio | 1.x |
| WASM | Wasmtime | 21+ |
| Frontend | Next.js | 15 |
| Database | Postgres | 16+ |
| Storage | Tigris | S3互換 |
| Auth | webauthn-rs | 0.5 |
| Payments | Stripe | 2024+ |

## コマンド

```bash
# Development
pnpm dev                 # Next.js dev server
cargo run                # Rust backend

# Build
pnpm build               # Next.js production build
cargo build --release    # Rust release build

# Database
sqlx migrate run         # Run migrations
sqlx database create     # Create database

# Test
pnpm test                # Frontend tests
cargo test               # Backend tests

# Lint
pnpm lint                # ESLint
cargo clippy             # Rust linter
```

## セキュリティ

- **WASM検証**: wasmtime-validate, wasm-opt
- **Artifactスキャン**: ClamAV
- **監査ログ**: PII最小化 (IP/UAはSHA256ハッシュ)
- **認証**: パスキー (UV Required) + GitHub OAuth
- **課金**: 事前オーソリゼーション + 台帳

## ライセンス

未定義 (開発中)

## ドキュメント

詳細な仕様は提供されたドキュメントを参照してください:
- データモデル定義
- API仕様
- WebAuthnフロー
- WASM実行詳細
- 課金・台帳仕様