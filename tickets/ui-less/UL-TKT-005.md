# [UL-TKT-005] Passkey Identity & Token Service

## 目的

ChatGPT/CLI 双方から利用できるパスキー認証フローを整備し、Spell API が `user_id` とトークンを検証できるようにする。

## スコープ

- WebAuthn/Passkey 登録・認証エンドポイント
- トークン発行（JWT or opaque token）および検証 middleware
- CLI 用デバイスコードフロー（URL + verification code）
- `user_id` 永続化および BAN/信頼スコアフィールド

## 実装詳細

- `docs/AUTH_ACCOUNT_BAN_SPEC.md` のモデルに沿って `user_id` を中心に据える
- 既存 NextAuth 設定をシンプルな Passkey サービスへリファクタリング
- CLI/ChatGPT からのリクエストでは `Authorization: Bearer <token>` で送信
- 高リスク操作時の再認証（チャレンジ）API を用意

## 受け入れ条件

- [ ] Passkey 登録/認証 API が e2e で動作
- [ ] 認証後に `user_id` と `session_token` を返却
- [ ] CLI のデバイスコードフローが実際に `spell auth` から利用可能
- [ ] BAN 状態のユーザーが拒否される

## 依存関係

blocks: [UL-TKT-004, UL-TKT-006, UL-TKT-009]
blocked-by: [UL-TKT-001]

## 技術スタック

- WebAuthn / passkey libraries (e.g., @simplewebauthn/server)
- Prisma/PostgreSQL
- JWT / Lucia / custom token issuance

## 優先度

CRITICAL

## 見積もり複雑度

L

## セキュリティ考慮事項

- Passkey チャレンジに対してリプレイ攻撃対策を実装
- トークン保存時は暗号化された列 or KMS を利用
