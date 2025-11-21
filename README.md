# Spell

Next.js 16 / API-Only / Passkey-JWT / Stripe Pay-per-Use

Spell Platform は UI を持たない API 専用の呪文実行エンジンです。外部クライアント（ChatGPT / CLI / 他 AI）が自然言語を扱い、Spell は認証済みユーザーからの実行要求を受けて **JWT 検証 → BAN チェック → 課金 → Runtime 実行 → JSON 応答** のみを担います。詳細は [`Spec.md`](./Spec.md) を参照してください。

## 機能ハイライト

- パスキー認証済み JWT の検証とユーザー識別
- Stripe Customer 共有モデルによる課金フロー
- Spell Artifact（builtin / API / WASM）の即時実行
- BAN / 権限制御での完全遮断
- ChatGPT / CLI / 他 AI クライアントとのストライプ情報共有

## 技術スタック

- Next.js 16 (App Router) + TypeScript strict mode
- Vercel Functions / Edge Functions（Node.js 20）
- PostgreSQL (Neon / Supabase)
- Stripe（PaymentIntent / Checkout / Portal）

## ディレクトリガイド

```
app/
  api/
    spell/
      execute/route.ts      # Spell 実行
      estimate/route.ts     # コスト見積り
    billing/
      checkout-url/route.ts # Stripe Checkout URL
      confirm-intent/route.ts
      portal-url/route.ts
    me/route.ts             # ユーザー情報
    admin/
      ban/route.ts          # BAN 制御
lib/                        # 共通ユーティリティ
prisma/                     # DB スキーマとマイグレーション
```

> App Router の各 `route.ts` は Next.js API Route として動作し、UI は提供しません。

## 開発フロー

事前に `.env` を設定し、Stripe・PostgreSQL 資格情報を投入してください。

```bash
pnpm install
pnpm dev # (= vercel dev)
```

- ローカル: `vercel dev`
- Staging: Vercel Preview
- Production: Vercel Production

## CLI / クライアント

CLI (`spell-cli`) は `spell auth`, `spell run`, `spell billing portal` などのコマンドで Spell API を呼び出し、ChatGPT / Apps SDK と user_id / Stripe Customer を共有します。パスキー認証や課金 UI はすべてクライアント側で実施し、Spell には JWT が渡されます。

## 追加資料

- [`Spec.md`](./Spec.md): 機能要件・データモデル・API 一覧
- 将来拡張: Glyph 信頼スコア, デバイス連携, Rust Core + Fly.io

Pull Request / Issue では対象 Spell のスコープと Stripe 依存を明示してください。
