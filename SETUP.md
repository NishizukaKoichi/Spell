# Spell Platform セットアップガイド

このガイドに従って、完全CLI環境でSpell Platformを開発・デプロイします。

## 前提条件

- macOS / Linux
- Homebrew インストール済み
- GitHub アカウント
- pnpm インストール済み (`npm install -g pnpm`)

## 1. 初期セットアップ（初回のみ）

### 1.1 必要なツールのインストール

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# PostgreSQL
brew install postgresql@16
brew services start postgresql@16

# Fly.io CLI
brew install flyctl

# Vercel CLI
npm install -g vercel

# Stripe CLI (Webhook テスト用)
brew install stripe/stripe-cli/stripe

# WASM Tools
brew install wabt binaryen  # wasm-validate, wasm-opt

# SQLx CLI
cargo install sqlx-cli --no-default-features --features postgres
```

### 1.2 プロジェクトセットアップ

```bash
# リポジトリクローン
git clone https://github.com/NishizukaKoichi/Spell.git
cd Spell

# 環境変数設定
make setup
# .env ファイルを編集して各種キーを設定

# Node依存関係インストール
pnpm install

# データベース作成
make db-create

# マイグレーション実行
make db-migrate
```

### 1.3 ホスティングサービス準備

#### Fly.io (Backend)

```bash
# ログイン
fly auth login

# アプリ作成（初回のみ）
cd core
fly launch --name spell-platform-api --region nrt --no-deploy

# Secrets設定
fly secrets set \
  DATABASE_URL="postgres://..." \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  TIGRIS_ACCESS_KEY="..." \
  TIGRIS_SECRET_KEY="..." \
  TIGRIS_BUCKET="spell-artifacts" \
  TIGRIS_ENDPOINT="https://fly.storage.tigris.dev" \
  JWT_SECRET="$(openssl rand -hex 32)" \
  AUDIT_SALT_SECRET="$(openssl rand -hex 32)" \
  RECOVERY_CODE_PEPPER="$(openssl rand -hex 32)" \
  WEBAUTHN_RP_ID="spell-platform.fly.dev" \
  WEBAUTHN_RP_NAME="Spell Platform" \
  WEBAUTHN_RP_ORIGIN="https://spell-platform.fly.dev"
```

#### Vercel (Frontend)

```bash
# ログイン
vercel login

# プロジェクトリンク
vercel link

# 環境変数設定
vercel env add NEXT_PUBLIC_API_URL production
# → https://spell-platform-api.fly.dev

vercel env add NEXT_PUBLIC_WEBAUTHN_RP_ID production
# → spell.yourdomain.com

vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
# → pk_live_...
```

#### Tigris (Storage)

```bash
# Fly.io からTigrisを有効化
fly storage create

# 認証情報を取得
fly storage dashboard
# → Access Key / Secret Key をコピーして .env に設定
```

#### Stripe (Payments)

```bash
# ログイン
stripe login

# Webhook設定（デプロイ後）
stripe listen --forward-to https://spell-platform-api.fly.dev/api/v1/stripe/webhook

# テストモードで動作確認後、本番キーに切り替え
```

## 2. 開発フロー

### 2.1 ローカル開発

```bash
# ターミナル1: Backend
make dev-backend

# ターミナル2: Frontend
make dev-frontend

# ブラウザで確認
# Frontend: http://localhost:3000
# Backend:  http://localhost:8080
```

### 2.2 データベース操作

```bash
# マイグレーション作成
cd core
sqlx migrate add create_users_table

# マイグレーション実行
make db-migrate

# データベースリセット
make db-reset

# PostgreSQL CLI接続
psql spell_platform
```

### 2.3 テスト

```bash
# 全テスト実行
make test

# Rustのみ
cd core && cargo test

# Next.jsのみ
pnpm test
```

## 3. デプロイ

### 3.1 Backend (Fly.io)

```bash
make deploy-backend

# ログ確認
fly logs --tail

# ステータス確認
fly status

# スケーリング
fly scale count 2
fly scale vm shared-cpu-1x
```

### 3.2 Frontend (Vercel)

```bash
make deploy-frontend

# ログ確認
vercel logs --follow

# ドメイン設定
vercel domains add spell.yourdomain.com
```

## 4. 運用

### 4.1 監視

```bash
# Backend logs
fly logs --tail

# Frontend logs
vercel logs --follow

# Stripe events
stripe events list
```

### 4.2 データベースバックアップ

```bash
# バックアップ作成
pg_dump spell_platform > backup_$(date +%Y%m%d).sql

# リストア
psql spell_platform < backup_20250930.sql
```

### 4.3 ロールバック

```bash
# Backend
fly releases
fly releases rollback

# Frontend
vercel rollback
```

## 5. トラブルシューティング

### データベース接続エラー

```bash
# PostgreSQL起動確認
brew services list | grep postgresql

# 再起動
brew services restart postgresql@16
```

### ビルドエラー

```bash
# キャッシュクリア
make clean

# 依存関係再インストール
rm -rf node_modules
pnpm install

cd core && cargo clean && cargo build
```

### マイグレーションエラー

```bash
# マイグレーション履歴確認
cd core
sqlx migrate info

# 強制リセット
make db-reset
```

## 6. コマンドリファレンス

すべてのコマンドは `make help` で確認できます：

```bash
make help
```

主要コマンド：
- `make install` - ツールインストール
- `make setup` - 初期セットアップ
- `make db-migrate` - マイグレーション実行
- `make dev-backend` - Backend開発サーバー
- `make dev-frontend` - Frontend開発サーバー
- `make test` - テスト実行
- `make build` - 本番ビルド
- `make deploy-backend` - Backendデプロイ
- `make deploy-frontend` - Frontendデプロイ