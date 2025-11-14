# [UL-TKT-007] Spell Engine HTTP API (execute/list/rune)

## 目的

CLI や外部サービスが Spell Core を呼び出せるよう、HTTP API を再設計し `spell.execute`, `spell.list`, `rune.*` エンドポイントを提供する。

## スコープ

- `POST /api/spell/execute`
- `GET /api/spell`
- `POST /api/rune/spells`（Rune ユーザー限定）
- 認可/レート制限 middleware の再構成
- OpenAPI ドキュメント更新

## 実装詳細

- `docs/API_CLI_APPS_SDK_SPEC.md` の HTTP 例をベースに Request/Response スキーマを決定
- `SpellCore` を呼び出し結果をストリーミング or JSON で返却
- Rune API は feature gate (trusted-user flag) を必須
- API すべてで `user_id`, `ban_status`, `payment_status` を検証

## 受け入れ条件

- [ ] 3 つのエンドポイントが E2E テストを通過
- [ ] OpenAPI/Swagger が生成され CLI/Apps SDK が参照できる
- [ ] 認証ヘッダーなしのアクセスが 401 を返す
- [ ] Rune API が非許可ユーザーに 403 を返す

## 依存関係

blocks: [UL-TKT-004, UL-TKT-008]
blocked-by: [UL-TKT-002, UL-TKT-005]

## 技術スタック

- Next.js Route Handlers / Edge functions
- Zod/OpenAPI Generator

## 優先度

CRITICAL

## 見積もり複雑度

M

## セキュリティ考慮事項

- すべての API で idempotency key と rate limit を必須にする
- Rune API のリクエスト body を schema で厳密に検証
