# [UL-TKT-006] 課金・決済ハンドシェイク (ChatGPT連携)

## 目的

有料呪文を実行する際に ChatGPT 決済 UI と連携し、Spell 側で料金請求・使用量を記録する Billing レイヤーを実装する。

## スコープ

- 決済要求/検証 API (`/billing/intents`, `/billing/confirmations`)
- ChatGPT からの `payment_status: ok` 検証ロジック
- 価格テーブル/呪文ごとの課金設定
- 従量課金使用量の記録と Stripe へのエクスポート

## 実装詳細

- `docs/PRODUCT_UX_SPEC.md` セクション5の決済フローに準拠
- `SpellCore` のメタデータに `pricingModel`, `basePrice`, `meteredFormula` を追加
- ChatGPT から受け取る決済トークンを Stripe API で検証
- 後続の `spell.execute` では Billing レコード ID を添付して実行

## 受け入れ条件

- [ ] 有料呪文リクエストで決済確認が必須になっている
- [ ] 課金レコードが DB に保存され、Stripe ダッシュボードで確認できる
- [ ] `spell.estimate_cost` がこの Billing レイヤーを参照
- [ ] 失敗時は呪文実行が拒否され、ユーザーに理由を返す

## 依存関係

blocks: [UL-TKT-003]
blocked-by: [UL-TKT-005]

## 技術スタック

- Stripe (PaymentIntent または Checkout Session)
- Prisma/PostgreSQL

## 優先度

HIGH

## 見積もり複雑度

L

## セキュリティ考慮事項

- 決済トークンは一度きりで利用し、保存は hash 化された識別子のみ
- 課金記録へのアクセスは管理ロールに限定
