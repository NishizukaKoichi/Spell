# Production Deployment Guide

## 完了済み要素

✅ **Core APIs**: Cloudflare Workers で本番稼働中
✅ **Database**: PlanetScale MySQL で本番稼働中  
✅ **Frontend**: Next.js アプリケーション完成
✅ **CI/CD**: GitHub Actions パイプライン稼働中
✅ **Tests**: 34 テストすべて通過
✅ **Storage**: R2 オブジェクトストレージ稼働中
✅ **Billing**: Stripe webhook 統合完了

## 残り作業

### 1. NATS JetStream 本番環境構築

```bash
# NATS サーバーの起動（Docker）
docker run -d \
  --name nats-jetstream \
  -p 4222:4222 \
  -p 8222:8222 \
  nats:latest \
  -js -m 8222 --auth=your_auth_token

# または Kubernetes での運用
kubectl apply -f nats-jetstream-k8s.yaml
```

### 2. Service Runner 本番デプロイ

```bash
# Docker で起動
cd core
cp .env.production .env
docker-compose -f docker-compose.prod.yml up -d

# または systemd での常駐化
sudo cp service-runner.service /etc/systemd/system/
sudo systemctl enable service-runner
sudo systemctl start service-runner
```

### 3. 環境変数設定

本番環境で以下を設定：

```bash
# NATS 接続
NATS_URL=nats://your-nats-server:4222
NATS_AUTH_TOKEN=your_production_nats_token

# Worker 統合
WORKER_BASE_URL=https://koichinishizuka.com
INTERNAL_API_TOKEN=your_internal_api_token

# Artifact 設定
RUNNER_ARTIFACT_PREFIX=prod-artifacts
RUNNER_ARTIFACT_TTL_DAYS=30
```

### 4. 稼働確認

```bash
# サービスランナー確認
curl https://koichinishizuka.com/api/v1/wizards

# キャスト実行テスト
curl -X POST https://koichinishizuka.com/api/v1/spells/test:cast \
  -H "Authorization: Bearer ${token}" \
  -d '{"input": {"test": true}}'
```

## 運用監視

- **ログ**: Wrangler tail でリアルタイム監視
- **メトリクス**: /api/v1/wizards でランナー稼働状況
- **ヘルスチェック**: サービスランナーの HTTP エンドポイント
- **アラート**: NATS 接続断やランナー停止の通知設定

## セキュリティ

- **API トークン**: 本番用の強力なトークンに差し替え
- **TLS**: NATS と Worker 間の暗号化通信
- **認証**: GitHub OAuth 本番アプリ設定
- **監査**: 全キャストの audit trail 記録

この手順完了で仕様書ベース 100% 達成となります。