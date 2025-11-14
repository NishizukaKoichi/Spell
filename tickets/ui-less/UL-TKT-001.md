# [UL-TKT-001] Next.js UI撤去とAPIベースラインへの移行

## 目的

Spell を UIレスプロダクトへ転換するため、既存 Next.js のページ/コンポーネントを削除し、API・runtime・docs だけが残る構成へ移行する。

## スコープ

- `src/app` から UI ページ/レイアウトを削除、API ルートと共通ライブラリのみ残す
- `components/`, `public/` 等フロント専用資産の整理
- `next.config.ts`, `tailwind.config.ts` など UI 固有設定の撤去 or API 用最小構成
- Build/CI (`package.json` scripts, Vercel 設定) の API 専用化

## 実装詳細

- `docs/PRODUCT_UX_SPEC.md` で定義された UIレス方針を遵守し、画面遷移を前提とするコードを削除
- API ルートは Next.js Route Handlers or Edge Functions として継続利用（UI 削除後も dev server で動くこと）
- 削除後も環境変数・Prisma schema・runtime 関連フォルダは残す
- CI は `pnpm lint`, `pnpm test`, `pnpm build` が API のみで成功するよう調整

## 受け入れ条件

- [ ] `pnpm build` が UI 依存コードなしで成功
- [ ] `components/` や UI ページが削除されている
- [ ] Vercel/Next 設定が API route だけを対象にしている
- [ ] 主要 API のスモークテストが通る

## 依存関係

blocks: [UL-TKT-002]
blocked-by: []

## 技術スタック

- Next.js Route Handlers
- PNPM + Turbopack (API only)

## 優先度

CRITICAL

## 見積もり複雑度

L

## セキュリティ考慮事項

- 誤って `.env` や秘密情報を削除しない
- 削除コミットにユーザーデータ/credential が含まれないことを確認

