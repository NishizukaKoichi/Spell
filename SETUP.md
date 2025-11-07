# Spell Platform - Setup Guide

本番環境へのデプロイに必要な設定手順です。

## 必須タスクチェックリスト

### ✅ 完了済み

- [x] TypeScript型エラーの修正
- [x] ESLintエラーの修正
- [x] データベーススキーマの定義
- [x] 認証機能の実装（WebAuthn）
- [x] Stripe決済統合
- [x] GitHub Actions統合
- [x] フロントエンドUI実装
- [x] APIエンドポイント実装
- [x] テストの実装と実行
- [x] ビルドの確認
- [x] WASMディレクトリの作成

### 📋 残りのタスク

#### 1. 環境変数の設定

```bash
# NEXTAUTH_SECRETを生成
openssl rand -base64 32

# .envファイルを編集
cp .env.example .env
```

必要な環境変数：

- `NEXTAUTH_URL`: 本番環境のURL
- `AUTH_SECRET`: 上記で生成したシークレット
- `GITHUB_APP_ID`: GitHub Appの設定から取得
- `GITHUB_APP_PRIVATE_KEY`: GitHub Appの秘密鍵
- `GITHUB_APP_INSTALLATION_ID`: インストールID
- `STRIPE_SECRET_KEY`: Stripeのシークレットキー
- `STRIPE_WEBHOOK_SECRET`: Stripeのwebhookシークレット
- `DATABASE_URL`: すでに設定済み

#### 2. GitHub Appの作成

1. https://github.com/settings/apps/new にアクセス
2. 以下の権限を設定:
   - Repository permissions:
     - Actions: Read & Write
     - Contents: Read & Write
   - Subscribe to events:
     - Workflow run
3. Private Keyを生成してダウンロード
4. App IDとInstallation IDを控える

#### 3. Stripeの設定

1. https://dashboard.stripe.com/apikeys でAPIキーを取得
2. https://dashboard.stripe.com/webhooks でWebhookを設定
   - エンドポイント: `https://your-domain.com/api/webhooks/stripe`
   - イベント: `checkout.session.completed`, `payment_intent.payment_failed`

#### 4. データベースのセットアップ

```bash
# マイグレーションの実行
pnpm prisma migrate deploy

# サンプルデータのシード
pnpm db:seed
```

#### 5. GitHubへコミット

```bash
git add .
git commit -m "🚀 Production ready: Add WASM support and configuration

- Add WASM runtime directory structure
- Fix TypeScript and ESLint issues
- Update environment configuration
- Add setup documentation

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main
```

#### 6. Vercelへデプロイ

```bash
# Vercel CLIでデプロイ
vercel --prod

# または GitHub連携で自動デプロイ
```

環境変数をVercelに設定:

```bash
vercel env add NEXTAUTH_URL
vercel env add AUTH_SECRET
vercel env add GITHUB_APP_ID
# ... 他の環境変数も同様に設定
```

#### 7. 動作確認

- [ ] トップページへアクセス
- [ ] ユーザー登録（Passkey）
- [ ] Spellの作成
- [ ] Spellの実行
- [ ] 決済フロー
- [ ] GitHub Actions実行

#### 8. モニタリング設定（オプション）

- Vercel Analytics
- OpenTelemetry
- Sentry

## 開発環境での起動

```bash
# 依存関係のインストール
pnpm install

# データベースのセットアップ
pnpm prisma migrate dev
pnpm db:seed

# 開発サーバーの起動
pnpm dev
```

## トラブルシューティング

### データベース接続エラー

- `DATABASE_URL`が正しく設定されているか確認
- Neonのデータベースが起動しているか確認

### GitHub App認証エラー

- Private Keyの改行が正しくエスケープされているか確認
- Installation IDが正しいか確認

### Stripe Webhookエラー

- Webhook URLが正しく設定されているか確認
- Webhook Secretが一致しているか確認

## サポート

問題が発生した場合：

1. GitHub Issuesで報告
2. ログを確認: `vercel logs`
3. データベースの状態を確認: `pnpm prisma studio`

---

**Status**: 🚀 Production Ready
**Version**: 0.1.0
**Last Updated**: 2025-11-06
