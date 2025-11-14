# [UL-TKT-010] Observability & 実行監査ログ

## 目的

UIレス化に伴い、Spell 実行・課金・Rune 操作の監査証跡とメトリクス可視化を整備する。

## スコープ

- OpenTelemetry instrumentation (SpellCore, API, CLI handler)
- 監査ログテーブル（`audit_log`）
- Metrics エンドポイント更新（UIレスモード向け）
- PagerDuty/Grafana ダッシュボード更新

## 実装詳細

- `docs/SYSTEM_ARCHITECTURE_SPEC.md` の Monitoring 節と既存 `PROGRESS.md` で参照される Health/Metrics を統合
- 監査ログには `user_id`, `operation`, `spell_id`, `billing_id`, `result` を保存
- Metrics で CLI/Apps SDK 別の実行数を可視化
- 重大イベント（BAN, Rune 公開, 決済失敗）に PagerDuty アラート

## 受け入れ条件

- [ ] OpenTelemetry traces に Spell execute → Billing → Spell Core の span が含まれる
- [ ] 監査ログに少なくとも 5 種類のイベントが保存される
- [ ] Grafana ダッシュボードが CLI/ChatGPT 別のトラフィックを表示
- [ ] PagerDuty ルールがテスト通知で確認される

## 依存関係

blocks: []
blocked-by: [UL-TKT-002, UL-TKT-006, UL-TKT-009]

## 技術スタック

- OpenTelemetry SDK
- Prometheus / Grafana / PagerDuty

## 優先度

MEDIUM

## 見積もり複雑度

M

## セキュリティ考慮事項

- 監査ログに機密情報を残さず、PII はマスキング
- ログ出力先（OTLP エンドポイント）との通信を TLS で保護

