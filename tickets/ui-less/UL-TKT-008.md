# [UL-TKT-008] Rune β: 呪文作成・登録フロー

## 目的

高信頼ユーザー向けに Rune の基本機能（呪文作成→Spell Core への登録→実行）を閉じた β として提供する。

## スコープ

- Rune API (`POST /api/rune/spells`) のビジネスロジック
- Spell Definition スキーマ（runtime, params_schema, pricing）
- バージョン管理とリリース手続き
- Rune CLI サブコマンド (`spell rune create`, `spell rune list`)

## 実装詳細

- `docs/SYSTEM_ARCHITECTURE_SPEC.md` と `docs/API_CLI_APPS_SDK_SPEC.md` の Rune 部分に沿う
- Spell Core メタデータストアに `createdBy`, `reviewStatus`, `trustScoreRequirement` を追加
- Rune 作成リクエストに対し自動検証（WASM lint, resource limit check）を実施
- Rune β フラグのある `user_id` のみがアクセス可能

## 受け入れ条件

- [ ] Rune API を通じて作成した呪文が Spell Core で実行可能
- [ ] 作成→レビュー→公開の状態遷移が記録される
- [ ] CLI から Rune 作成/一覧が操作できる
- [ ] テストで不正な spec が拒否されることを確認

## 依存関係

blocks: []
blocked-by: [UL-TKT-004, UL-TKT-005, UL-TKT-007]

## 技術スタック

- Prisma/PostgreSQL (Spell definitions)
- WASM validation toolchain

## 優先度

MEDIUM

## 見積もり複雑度

L

## セキュリティ考慮事項

- Rune からアップロードされるコードをサンドボックス内で静的解析し、サプライチェーンリスクを最小化
- 作成者と reviewer の監査ログを必須化
