# Spell システムアーキテクチャ仕様 v1.0

## 1. コンポーネント構成（論理）

- **Spell Core**: 呪文実行エンジン、呪文メタデータ、実行ログを管理。
- **Rune Core**: 呪文作成・編集・登録ロジック。最終的には Spell Core と同一クラスタに統合。
- **Auth & Identity**: パスキー署名検証、ユーザー ID 管理、将来の信頼スコア連携。
- **Billing & Usage**: 呪文単位の価格設定、従量課金記録、Rune 利用時の課金。
- **API Gateway**: HTTP/gRPC API、MCP/Apps SDK ツール公開、CLI 向け API。
- **管理モジュール**: BAN・ブラックリスト、ログ閲覧、設定変更。

## 2. データフロー（ChatGPT 経由の実行）

1. ChatGPT → API Gateway: 認証済みユーザーコンテキストを含むリクエスト。
2. API Gateway → Auth 層: パスキー由来トークンの検証。
3. Auth 層 → Spell Core: 認証済ユーザーとして呪文実行を許可。
4. Spell Core → Billing: 料金計算・使用量記録。
5. Spell Core → 監査ログ: 実行結果とメタデータを保存。

## 3. Rune 統合後の構造

- Rune 操作は `POST /rune/...` エンドポイント経由で Spell Core と同一のメタデータストアを利用。
- 呪文の定義は Spell Core の呪文メタデータに保存され、通常の実行フローに乗る。

## 4. 配備イメージ

- Spell Core/Rune Core: WASM 実行環境を備えたサーバレス or コンテナクラスタ。
- API Gateway: Edge/Workers 層に配置し、低レイテンシを実現。
- 認証・課金システム: マネージドサービス（Passkey IdP, Stripe 等）と連携。
- 監査ログ・メトリクス: OpenTelemetry + Prometheus/Grafana で外部観測。
