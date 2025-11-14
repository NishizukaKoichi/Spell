# [UL-TKT-004] Spell CLI (auth/list/run)

## 目的

ChatGPT 以外でも Spell を操作できるよう、`spell-cli` を実装してパスキー連携・呪文一覧・実行を提供する。

## スコープ

- `packages/spell-cli/` もしくは `cli/` ディレクトリ作成
- コマンド: `spell auth`, `spell list`, `spell run`, `spell rune create`
- OAuth/Passkey ブラウザハンドオフ
- CLI から HTTP API (`UL-TKT-007`) を呼び出す薄いクライアント

## 実装詳細

- `docs/PRODUCT_UX_SPEC.md` および `docs/API_CLI_APPS_SDK_SPEC.md` の CLI UX を実装
- `spell auth` はローカルにトークンを保存（Keychain or encrypted file）
- `spell run` は JSON 入力/出力を扱えるよう `--input-file`, `--output` オプションを実装
- Rune コマンドは feature flag で保護（高信頼ユーザーのみ）

## 受け入れ条件

- [ ] CLI で認証→呪文一覧→実行のハッピーパスが動作
- [ ] CLI が API トークンを安全に保存し、BAN 状態を検知
- [ ] `spell rune create` が Rune API へリクエストを送れる（フラグ制御）
- [ ] CLI に対する単体テスト/スモークテストが追加

## 依存関係

blocks: []
blocked-by: [UL-TKT-005, UL-TKT-007]

## 技術スタック

- Node.js + oclif/commander などの CLI framework
- Local secure storage (Keytar/macOS Keychain)

## 優先度

HIGH

## 見積もり複雑度

L

## セキュリティ考慮事項

- トークン保存は OS キーチェーンを優先し、平文ファイル禁止
- CLI から送信するログに個人情報を含めない

