# [UL-TKT-009] BAN・信頼スコアサービス

## 目的

パスキーで識別される `user_id` を基点に BAN/ブラックリストおよび簡易信頼スコアを管理し、Rune・有料呪文・管理操作のガードレールを提供する。

## スコープ

- `trust_profiles` テーブル（score, lastReviewedAt, flags）
- BAN リスト管理 API (`POST /api/admin/ban`, `DELETE /api/admin/ban`)
- 信頼スコア更新ジョブ（利用実績/課金成功回数ベース）
- CLI/Admin コマンド

## 実装詳細

- `docs/AUTH_ACCOUNT_BAN_SPEC.md` のモデルに沿って BAN を `user_id` 単位で適用
- 信頼スコアは単純な閾値モデル（例: 実行成功 10 回以上で Rune 可）で開始
- BAN 操作には監査ログ、再認証（Passkey チャレンジ）を必須
- Spell Core 実行前に BAN/score をチェックする middleware を挿入

## 受け入れ条件

- [ ] BAN したユーザーが API/CLI/Apps SDK で拒否される
- [ ] 信頼スコアが Rune フラグを制御している
- [ ] BAN/解除の監査ログが残る
- [ ] CLI から管理コマンドが実行できる

## 依存関係

blocks: [UL-TKT-008]
blocked-by: [UL-TKT-005]

## 技術スタック

- Prisma/PostgreSQL
- Background jobs (cron/queue)

## 優先度

HIGH

## 見積もり複雑度

M

## セキュリティ考慮事項

- 管理 API は多要素認証済みアカウントのみに限定
- BAN/信頼スコアデータは暗号化されたストレージに保存

