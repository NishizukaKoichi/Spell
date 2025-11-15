# Spell 要件定義書

**(Next.js 16 / Apps SDK Fully Compatible / Stripe Unified / CLI Unified / Bazaar-less Model)**

---

## 1. 概要

Spell Platform は **UI を一切持たない「呪文実行エンジン (Spell Engine)」** である。自然言語による操作は ChatGPT / CLI / 他 AI などの外部クライアントが担当し、Spell は **認証されたユーザー → Spell ID → Input → 課金 → 実行 → 結果** という処理のみを高速かつ正確に返す。

Spell が提供する機能:

1. パスキー認証済みユーザーの識別
2. Stripe 課金（Customer 共有モデル）
3. Spell 実行
4. Rune による Spell 生成
5. BAN / 権限制御
6. ChatGPT / CLI / 他 AI クライアントの統一利用

> 重要: Spell は自然言語処理を一切行わない。自然言語 → API 呼び出しの翻訳は外部クライアント（Apps SDK / CLI）が担当する。

---

## 2. 技術スタック（確定・最適解）

### 2.1 バックエンド

- Next.js 16.x（App Router）
  - UI（React）は使用しない
  - API Routes のみ利用
  - Vercel Functions（Node.js 20）向け最適化
  - 必要に応じて Edge Functions 併用可
  - Stripe Webhook / JWT 検証に完全対応
- Next.js 16 は現行 LTS（[endoflife.date](https://endoflife.date/nextjs)）。Vercel Functions × Apps SDK 組み合わせが最も安定。

### 2.2 言語

- TypeScript（strict モード）

### 2.3 インフラ

- Vercel: API / Webhook ホスティング
- PostgreSQL（Neon / Supabase）: 永続層
- Stripe: 課金・カード登録・Customer 管理
- Vercel Log Drains: 任意

### 2.4 認証（Passkey → user_token）

- Spell は WebAuthn ceremony を扱わない
- 外部クライアントがパスキー認証し、Spell に JWT（user_token）を送付
- Spell は JWT を検証して user_id を得るだけ

---

## 3. デプロイ構成（Next.js 16 App Router）

### ディレクトリ構成

```
app/
  api/
    spell/
      execute/route.ts
      estimate/route.ts
    rune/
      create/route.ts
    billing/
      checkout-url/route.ts
      confirm-intent/route.ts
      portal-url/route.ts
    me/route.ts
    admin/
      ban/route.ts
```

### 環境

- local: `vercel dev`
- staging: Vercel Preview
- production: Vercel Production

---

## 4. Spell エンジンの設計原則

1. Spell は UI を持たない API 専用サービス
2. 自然言語は扱わない
3. 認証・課金 UI は外部が担当
4. Spell の追加は即世界に反映（Bazaar 不要）
5. ChatGPT / CLI は同じ user_id / Stripe Customer を使用
6. Next.js 16 App Router を唯一のバックエンドとして採用

---

## 5. データモデル

### 5.1 `users`

```
id: uuid
stripe_customer_id: text | null
status: 'active' | 'banned'
created_at: timestamp
```

### 5.2 `spells`

```
id: uuid
slug: text                 // e.g., "resize@v1"
description: text
runtime: 'builtin' | 'api' | 'wasm'
config: jsonb
price_amount: integer      // AUD cents
visibility: 'public' | 'team' | 'private'
created_by: uuid
created_at: timestamp
```

### 5.3 `rune_artifacts`

```
id: uuid
spell_id: uuid
wasm_binary: bytea | null
metadata: jsonb
created_at: timestamp
```

### 5.4 `billing_records`

```
id: uuid
user_id: uuid
spell_id: uuid
amount: integer
currency: text
payment_intent_id: text
status: 'succeeded' | 'failed'
created_at: timestamp
```

### 5.5 `bans`

```
user_id: uuid
reason: text
created_at: timestamp
```

---

## 6. 認証（Passkey → JWT → user_id）

Spell が保証する内容:

1. JWT が正しい発行者で署名されている
2. `sub = user_id`
3. 有効期限が正しい
4. BAN されていない

Spell は ceremony を担当せず、Apps SDK / CLI が UI を処理する。

---

## 7. 決済（Stripe Customer 共有モデル）

### 7.1 モデル

- 1 user = 1 Stripe Customer
- 全クライアント（ChatGPT / CLI / 他 AI）で共有
- カード登録は Stripe Checkout
- Spell はカード情報を保持しない

### 7.2 初回カード登録フロー

1. Spell: 支払い手段なしを検出
2. クライアントに `checkout_url` を返す
3. 外部 UI が Stripe Checkout を開く
4. 顧客がカード登録
5. Stripe Webhook → Spell が DB 更新
6. 全クライアントで決済可能に

### 7.3 有料 Spell 実行フロー

1. `price_amount` をチェック
2. `PaymentIntent(confirm=true)` を発行
3. 課金成功
4. Spell Core を実行
5. 結果を返す

---

## 8. Spell Core（呪文実行エンジン）

### 8.1 実行フロー

```
1. 認証（JWT）
2. BAN チェック
3. spell 取得
4. visibility チェック
5. price チェック
6. 必要なら課金
7. runtime 実行 (builtin/api/wasm)
8. 結果 JSON 返却
```

### 8.2 即時反映設計

- Spell 作成（Rune）→ `public`
- ChatGPT / CLI でも即座に実行可能
- Bazaar 不要の根拠

---

## 9. Rune（呪文作成）

### 9.1 機能

- Spell 新規作成
- WASM 登録
- runtime 設定
- config 保存
- visibility 制御
- versioning (`slug@vN`)

### 9.2 公開の影響

- `visibility = public` で Spell Engine が即時反映

---

## 10. BAN

BAN 状態では以下が無効:

- Spell 実行
- Rune 操作
- 課金
- ChatGPT / CLI 利用

user_id をキーにした完全封鎖。

---

## 11. API エンドポイント（Next.js 16 App Router）

Base URL: `https://api.spell.run`

### Spell

- `POST /api/spell/execute`
- `POST /api/spell/estimate`

### Rune

- `POST /api/rune/create`

### Billing

- `POST /api/billing/checkout-url`
- `POST /api/billing/confirm-intent`
- `POST /api/billing/portal-url`

### User

- `GET /api/me`

### Admin

- `POST /api/admin/ban`

---

## 12. CLI（spell-cli）

### 12.1 コマンド

- `spell auth`
- `spell run <spell-id>`
- `spell rune create --spec <file>`
- `spell billing portal`

### 12.2 UX

- 初回認証 → パスキー（ブラウザ）
- 未登録カード → Checkout URL
- 登録済み → 即課金 → Spell 実行
- ChatGPT と user_id / 決済情報を完全共有

---

## 13. 将来拡張

### v3.x

- Glyph（信頼スコア）統合

### v4.x

- デバイス連携（音声端末、杖型デバイス）

### v5.x

- WASM 実行高速化用 Rust Core（Fly.io）
- Next.js → Rust Core ブリッジ API

---

## 14. 最終結論

Next.js の LTS 状況 / Vercel Functions 互換性 / Apps SDK 実装実績 / Stripe Node SDK の最適性を鑑み、**Spell Platform の最適解は Next.js 16（App Router）ベースの API 専用バックエンド** である。

---
