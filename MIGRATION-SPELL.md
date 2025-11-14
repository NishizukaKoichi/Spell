# MIGRATION-SPELL

_Last updated: 2025-11-14_

このドキュメントは、Spell Platform リポジトリの現状アーキテクチャを整理し、新しい UIレス仕様（`docs/PRODUCT_UX_SPEC.md` ほか）とのギャップを明示する。

## 1. 現状アーキテクチャ概要（2025-11 時点）

### フレームワーク / レイヤー構造
- **Next.js App Router** (`src/app/`) 上に UI (マーケットプレイス、ダッシュボード、チャットなど) と API Route Handler が共存。`src/app/page.tsx` や `src/app/dashboard/*` が代表的な UI。
- **共通ライブラリ**は `src/lib/` に集約され、Prisma 接続、Redis、NATS、GitHub Actions 連携、Stripe、Sigstore、Budget/Rate Limit/Idempotency などの基盤機能が実装済み。
- **Prisma + PostgreSQL** (`prisma/schema.prisma`) がユーザー、Spell、Cast、Budget、API Key、Authenticator などドメインエンティティを管理。

### 実行系（Spell Runtime / Cast）
- `src/app/api/v1/cast/route.ts` が API キー駆動の Cast エンドポイント。Budget チェックや idempotency を経て `createQueuedCastTransaction` (`src/lib/cast-service.ts`) を実行し、GitHub Actions ワークフローを `triggerWorkflowDispatch` (`src/lib/github-app.ts`) で起動する構造。
- `src/lib/runtime.ts` にはローカル WASM テンプレート実行ランタイムが存在し、`wasm/` 配下の `.wasm` を読み込み/キャッシュする機能を提供。ただし現行 UI/API では GitHub ワークフローモードが主経路。
- NATS 発行 (`src/lib/nats.ts`) や webhook (`src/lib/webhook.ts`) も実装され、今後のマルチランタイム化に使える土台がある。

### Rune/Spell 作成周り
- `src/app/api/spells/*` と `src/app/my-spells`, `src/app/dashboard` UI で Spell CRUD・審査ワークフローを実装。Prisma `Spell` モデルには SBOM, signature, pricing, status, codeUrl など新仕様にも必要な属性が既に定義済み。
- レビュー (`src/app/api/reviews` / `prisma.Review`)、マーケットプレイス (`src/app/marketplace`) などコンシューマー向け画面も揃っている。

### 認証 / アカウント
- NextAuth (`src/lib/auth/config.ts`) で Passkey (WebAuthn) ベースの Credentials Provider を設定し、`src/app/api/auth/[...nextauth]/route.ts` から利用。
- WebAuthn 登録/認証エンドポイントが `src/app/api/webauthn/*` に存在。`prisma.authenticators` テーブルでデバイス管理。
- 追加で GitHub OAuth アカウント (`accounts` テーブル) や API Key (`src/lib/api-key.ts`, `src/app/api/keys`) も実装済み。

### 決済 / Billing
- Stripe 連携 (`src/lib/stripe.ts`, `src/lib/stripe-webhook.ts`) と Checkout Session API (`src/app/api/create-checkout-session`, `src/app/api/payments`) があり、Spell 単位の priceAmountCents と Budget Cap (`src/lib/budget.ts`) を組み合わせている。

### API サーフェス
- `src/app/api/` 直下: `spells`, `casts`, `keys`, `budget`, `payments`, `metrics`, `health`, `webhooks`, `v1/*` など。App Router の Route Handler が JSON API を提供する一方で UI からも直接呼び出されている。
- `src/app/api/v1` 配下に外部公開を意識した REST 断片（`cast`, `spells`, `stats`）が存在するが、Apps SDK/CLI 前提の整理は未実施。

### その他
- UI コンポーネント (`src/components`, `src/hooks`, `src/app/(routes)/...`) が多数存在し、Tailwind (`tailwind.config.ts`), global CSS (`src/app/globals.css`) も付随。
- テストは `tests/` ディレクトリに API/Lib の Vitest 套件があり、`pnpm test` で実行。

## 2. 新仕様とのギャップ整理

| 領域 | 既存コードでのカバレッジ | ギャップ / 注意点 |
| --- | --- | --- |
| **Spell Core (実行)** | `createQueuedCastTransaction` + GitHub Actions トリガーにより workflow 実行は可能。`src/lib/runtime.ts` に WASM 実行インフラ、Budget/Idempotency/Logging など実行基盤は揃っている。 | ChatGPT/CLI から直接扱える「UIレス Spell Engine」抽象が未整備。固定 Spell カタログや `spell.execute` RPC 形式が定義されていない。WASM runtime は孤立しており、GitHub Workflow 以外のモードへ接続されていない。 |
| **Rune Core (作成)** | `src/app/api/spells` + `my-spells` UI で Spell CRUD/公開/レビュー機能あり。Prisma モデルに supply-chain 属性も含む。 | UI 依存が強く、Apps SDK/CLI 経由で spec を投入できない。信頼スコア/フラグで Rune β を制御する仕組みは未実装。Spell 作成 API を headless で再利用しやすいよう整理が必要。 |
| **Auth (Passkey 前提)** | NextAuth + WebAuthn エンドポイントが存在し、Prisma authenticators で Passkey データを保存。API Key や NextAuth JWT で保護。 | ChatGPT Apps SDK/CLI が使うトークン発行フローが未確立。現在は NextAuth セッション前提で UI を描画。デバイスコードフローや再認証チャレンジ API も未提供。`verifyAuthenticationResponse` で `expectedChallenge` が TODO のまま等、プロダクション準備も必要。 |
| **API (HTTP/gRPC)** | 多数の API Route Handler あり、idempotency・rate limit・budget などミドルウェアは実装済み。`/api/v1/cast` 等を流用可能。 | 新仕様で求める `spell.execute`, `spell.list_spells`, `rune.create_spell` などの統一エンドポイントや OpenAPI は未整備。UI 前提の `/api/spells/create` などが多く、Apps SDK/CLI 向けにパラメータ/レスポンスを再設計する必要がある。 |
| **CLI (spell CLI)** | なし。 | `spell auth/list/run/rune` CLI 実装がゼロ。既存 API と認証方式を CLI から利用できるようなトークン管理や DX が必要。 |

> 参考: 新しい北極星仕様は `docs/PRODUCT_UX_SPEC.md`, `docs/SYSTEM_ARCHITECTURE_SPEC.md`, `docs/AUTH_ACCOUNT_BAN_SPEC.md`, `docs/API_CLI_APPS_SDK_SPEC.md`, `docs/ROADMAP.md` にまとめ済み。

次セクション以降でディレクトリ再編とリファクタプランを提示し、`spell execute` MVP に到達するまでの差分を段階的に整理する予定。
