# Spell

Next.js 16 / Apps SDK 完全対応 / Stripe Unified / CLI Unified / Bazaar-less Model

Spell Platform は UI を持たず、外部クライアント（ChatGPT / CLI / 他 AI）に自然言語層を委譲する API 専用の呪文実行エンジンです。認証済みユーザーからの Spell 実行要求を受け、課金・実行・結果返却までを一貫して担います。詳細な要件は [`Spec.md`](./Spec.md) を参照してください。

## 機能ハイライト

- パスキー認証済み JWT の検証とユーザー識別
- Stripe Customer 共有モデルによる課金フロー
- Spell（builtin / API / WASM）の即時実行と Rune 経由の作成
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
    rune/
      create/route.ts       # Spell 生成
    billing/
      checkout-url/route.ts # Stripe Checkout URL
      confirm-intent/route.ts
      portal-url/route.ts
    me/route.ts             # ユーザー情報
a
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

CLI (`spell-cli`) は `spell auth`, `spell run`, `spell rune create`, `spell billing portal` を提供し、ChatGPT / Apps SDK と user_id / Stripe Customer を共有します。パスキー認証や課金 UI は全てクライアント側で実施し、Spell には JWT が渡されます。

## 追加資料

- [`Spec.md`](./Spec.md): 機能要件・データモデル・API 一覧
- 将来拡張: Glyph 信頼スコア, デバイス連携, Rust Core + Fly.io

Pull Request / Issue では対象 Spell のスコープと Stripe 依存を明示してください。
