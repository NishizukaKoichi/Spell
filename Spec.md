# Spell v1 Specification

**（Next.js 16 / API-Only / Passkey-JWT / Stripe Pay-per-Use）**

---

## 1. 概要

Spell は **UI を持たない“呪文実行エンジン”** であり、自然言語処理を一切行わない。  
外部クライアント（ChatGPT / CLI / 他 AI）が自然言語を解釈し、Spell API を叩く前提で設計する。

Spell の責務はただ一つ：

> **「認証されたユーザーが所持する Spell Artifact を、署名 → 課金 → 実行 → 結果返却」**

Spell は生成・編集を行わず、“Artifact を実行するカーネル”として存在する。

---

## 2. 技術構成（最適解）

### 2.1 バックエンド
- Next.js 16（App Router）
- API Routes のみ
- UI フォルダは存在しない
- Node.js 20（Vercel Functions）
- 必要に応じて Edge Functions 併用可

### 2.2 言語
- TypeScript（strict）

### 2.3 ホスティング
- Vercel（production / preview / dev）

### 2.4 永続層
- PostgreSQL（Neon / Supabase）

### 2.5 課金
- Stripe（Customer 共有モデル）
- Subscription は採用しない（都度課金のみ）

### 2.6 認証
- Spell は WebAuthn ceremony を扱わない
- 外部クライアントがパスキー認証し、Spell は JWT 検証のみを行う
- JWT 要件: `sub`=user_id, `iss`=許可クライアント, `exp`=有効期限内
- Spell は署名検証と BAN 確認のみを担う

---

## 3. ディレクトリ構成（確定版）

```
app/
  api/
    spell/
      execute/route.ts
      estimate/route.ts
    billing/
      checkout-url/route.ts
      confirm-intent/route.ts
      portal-url/route.ts
    me/route.ts
    admin/
      ban/route.ts
```

Rune の API は含めない。Rune は完全別プロダクト。

---

## 4. Spell の原則

1. Spell は自然言語を扱わない  
2. Spell は Artifact を実行するだけ  
3. 認証 UI は外部クライアント  
4. 課金 UI も外部クライアント  
5. Spell の追加・更新 = Artifact の差し替えのみ  
6. Bazaar（マーケット）は不要、即時反映  
7. クライアントは ChatGPT / CLI / 実行エージェントなど自由  
8. Spell が返すのは常に JSON（統一エラー形式含む）

---

## 5. データモデル（Spell 側）

### `users`
```
id: uuid
stripe_customer_id: text | null
status: 'active' | 'banned'
created_at: timestamp
```

### `spells`（artifact メタ）
```
id: uuid
slug: text                 // 例: "resize@v1"
runtime: 'api' | 'wasm' | 'builtin'
config: jsonb
price_amount: integer      // cents
visibility: 'public' | 'team' | 'private'
created_by: uuid
created_at: timestamp
```

### `artifacts`
```
id: uuid
spell_id: uuid
wasm_binary: bytea | null
api_endpoint: text | null
metadata: jsonb
created_at: timestamp
```

### `billing_records`
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

### `bans`
```
user_id: uuid
reason: text
created_at: timestamp
```

---

## 6. 認証（JWT → user_id）

Spell が保証するもの：
1. JWT が改ざんされていない
2. 署名者が許可されたクライアント
3. `exp` が有効
4. BAN されていない

Spell 自身はログイン状態や UI を持たず、JWT 検証のみを担う。

---

## 7. 決済（Pay-per-Use 専用）

### モデル
- 1 user = 1 Stripe Customer
- カード登録は外部 UI（Stripe Checkout）
- Spell はカード情報を保持しない
- サブスクなし、すべて都度課金（PaymentIntent confirm=true）

### Spell 実行時フロー
1. `price_amount` を取得
2. Stripe PaymentIntent を `confirm=true` で作成
3. 課金が成功したら Artifact を実行
4. JSON 結果を返却

---

## 8. Spell Core（実行エンジン）

### 実行シーケンス
```
1. JWT 検証
2. BAN チェック
3. Spell 取得
4. visibility チェック
5. price チェック
6. 課金（必要時）
7. runtime 実行 (api / wasm / builtin)
8. 結果 JSON
```

### 統一エラー形式
```
{
  "ok": false,
  "error": {
    "code": "RUNTIME_ERROR",
    "message": "failed to execute wasm",
    "details": {...}
  }
}
```

---

## 9. API 仕様

Base URL: `https://api.spell.run`

### Spell
- `POST /api/spell/execute`
- `POST /api/spell/estimate`

### Billing
- `POST /api/billing/checkout-url`
- `POST /api/billing/confirm-intent`
- `POST /api/billing/portal-url`

### User
- `GET /api/me`

### Admin
- `POST /api/admin/ban`

Rune の API は別プロダクト（`https://api.rune.run`）。

---

# Rune v1 Specification（参考）

Rune は **Spell Artifact を生成する“呪文鍛造炉”** であり、Spell とは完全に分離されたプロダクト。

## 1. 役割
- 自然言語 / Spec → Spell 定義を作成
- Runtime（api / wasm / builtin）を選択
- Artifact を生成し Spell DB / artifacts DB に登録

## 2. 技術スタック
- Next.js / FastAPI / Node / Bun など自由
- ChatGPT / Claude / Gemini 等を使用可能
- WASI / Rust toolchain を内部に持つことがある

## 3. Artifact 生成フロー
```
1. ユーザーが自然言語で Spell を依頼
2. Rune が Spec を構文化
3. runtime を選択し Artifact (WASM/API) を生成
4. Spell DB にメタデータ登録
5. artifacts DB に binary/API config を保存
6. 完了した瞬間 Spell で実行可能
```

## 4. Rune API（Spell とは別ドメイン）
Base URL: `https://api.rune.run`
- `POST /api/rune/create`
- `POST /api/rune/generate-wasm`
- `POST /api/rune/validate`

JWT モデルは Spell と共有してもよいが、自然言語入力が入る点で世界観が異なる。

---

# 総合結論

- **Spell = 実行カーネル**（API-only, JWT, Stripe Pay-per-Use）
- **Rune = Artifact 生成**（自然言語 / Spec / ビルド）

Spell は静的な OS カーネル、Rune はコンパイラ／鍛冶場。  
Spell を先に完成させ、その後 Rune を接続する方針を厳守する。
