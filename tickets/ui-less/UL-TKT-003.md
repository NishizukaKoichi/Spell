# [UL-TKT-003] ChatGPT Apps SDK / MCP ツール実装

## 目的

ChatGPT から Spell を操作するための Apps SDK / MCP ツールセットを実装し、呪文の一覧・実行・料金見積もりを提供する。

## スコープ

- MCP ツール定義 (`spell.execute`, `spell.list_spells`, `spell.estimate_cost`)
- Apps SDK マニフェストとハンドラー
- Spell Core (`UL-TKT-002`) とのブリッジ層
- 認証コンテキスト（user_id, payment ステータス）の受け渡し

## 実装詳細

- `docs/API_CLI_APPS_SDK_SPEC.md` のツール一覧に準拠
- ChatGPT 側とのインターフェースは JSON RPC 形式で統一
- 料金見積もりは Billing レイヤー（`UL-TKT-006`）のメトリクスを利用
- ツール実行結果は ChatGPT が取り扱いやすいテキスト/構造化レスポンスを返す

## 受け入れ条件

- [ ] `spell.execute` が Spell Core へフォワードし結果を ChatGPT に返せる
- [ ] `spell.list_spells` が呪文メタデータを返す
- [ ] `spell.estimate_cost` が Billing から取得した数値を返却
- [ ] Apps SDK manifest が QA アカウントで読み込める

## 依存関係

blocks: []
blocked-by: [UL-TKT-002, UL-TKT-006]

## 技術スタック

- OpenAI Apps SDK / MCP
- TypeScript (tool handlers)

## 優先度

CRITICAL

## 見積もり複雑度

M

## セキュリティ考慮事項

- ツール実行時に `user_id` と BAN 状態を検証
- payment-required 呪文の場合 `payment_status: ok` を必須にする
