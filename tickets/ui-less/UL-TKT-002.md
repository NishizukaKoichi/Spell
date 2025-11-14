# [UL-TKT-002] Spell Core Runtime (固定呪文セット)

## 目的

UIレス Spell の MVP として、固定セットの呪文を WASM-first ランタイムで実行できる Spell Core を構築する。

## スコープ

- `src/lib/spell-core/`（新規ディレクトリ）を作成
- 呪文メタデータ（ID, version, pricingフラグ, 実行モード）を定義
- 固定呪文のエグゼキュータ（Node.js 内で WASM モジュール or mock 実装）
- 実行ログ記録（DB or ファイル）

## 実装詳細

- `docs/SYSTEM_ARCHITECTURE_SPEC.md` の Spell Core/Rune Core 境界に沿って内製
- 1st フェーズはハードコードされた Spell カタログで良い（例：`resize-image`, `transcribe-audio`）
- 実行 API は非同期 Promise、結果ペイロード／失敗理由を統一フォーマットで返却
- 後続タスク（Apps SDK, CLI）が利用できるよう TypeScript 型 (`SpellDescriptor`, `SpellRunResult`) を公開

## 受け入れ条件

- [ ] `SpellCore.execute(spellId, inputs, userContext)` が用意され、3 つ以上の固定呪文を実行できる
- [ ] 実行結果/エラーが構造化ログに記録される
- [ ] 呪文メタデータ一覧 API (`SpellCore.list()`) を実装
- [ ] ユニットテストで代表的な呪文実行がカバーされる

## 依存関係

blocks: [UL-TKT-003, UL-TKT-004, UL-TKT-007]
blocked-by: [UL-TKT-001]

## 技術スタック

- TypeScript
- WASM (wasmer-js/wasmtime-js) or Node sandbox
- Prisma/PostgreSQL (ログ保存)

## 優先度

CRITICAL

## 見積もり複雑度

L

## セキュリティ考慮事項

- WASM 実行にリソース制限を設ける（CPU/メモリ）
- 呪文の入出力をサニタイズし、ログに機密情報を残さない
