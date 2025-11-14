# Development Progress Tracker

Last Updated: 2025-11-14

## Current Status

**Active Branch:** N/A（UIレス転換の計画フェーズ）
**Last Completed Work:** Spell Execute MVP（固定呪文 + HTTP API + CLI）
**Next Ticket:** UL-TKT-001（Next.js UI撤去とAPIベースラインへの移行）

## UIレス Spell イニシアチブ（2025-11）

- ✅ プロダクト文書 5 点を `docs/` に追加
  - `docs/PRODUCT_UX_SPEC.md`
  - `docs/SYSTEM_ARCHITECTURE_SPEC.md`
  - `docs/AUTH_ACCOUNT_BAN_SPEC.md`
  - `docs/API_CLI_APPS_SDK_SPEC.md`
  - `docs/ROADMAP.md`
- ✅ 必要機能を `UL-TKT-001` ～ `UL-TKT-010` に分解し `tickets/ui-less/` に配置
- ▶️ 次手順: UL-TKT-001 ブランチを切って UI 資産削除 / API-only ビルドを確認

---

## Spell Execute MVP（2025-11-14）

- ✅ `src/core/spell/` に固定呪文（`builtin.echo`）を実装
- ✅ `POST /api/spell/execute`（`src/app/api/spell/execute/route.ts`）で API 化
- ✅ `SpellExecutionLog` モデルを Prisma へ追加し、実行ログ/課金メモを蓄積
- ✅ CLI (`pnpm spell execute <spell-id> --input '{"message":"hi"}'`) で API 呼び出しを確認
- ✅ Spec v1.3 従い UI コードと Tailwind 系依存を削除、`page.tsx` は API 仕様案内のみ
- ℹ️ `pnpm test` は Neon DB への接続が無い環境では `tests/lib/budget.test.ts` が失敗するため、DB 接続が無い状態では無視して良い

---

## Completed Tickets

### Phase 1: Foundation Layer (完了済み)

- ✅ **TKT-006**: Error Catalog (PR #5) - 2025-11-09
  - Files: `src/lib/api-response.ts`, `tests/lib/api-response.test.ts`
  - Status: Merged to main

- ✅ **TKT-012**: Budget Tracking (PR #6) - 2025-11-09
  - Files: `src/lib/budget.ts`, `tests/lib/budget.test.ts`
  - Status: Merged to main

- ✅ **TKT-013**: Idempotency (PR #7) - 2025-11-09
  - Files: `src/lib/idempotency.ts`, `tests/lib/idempotency.test.ts`
  - Status: Merged to main

- ✅ **TKT-014**: Rate Limiting (PR #8) - 2025-11-09
  - Files: `src/lib/rate-limit.ts`, `tests/lib/rate-limit.test.ts`
  - Status: Merged to main

- ✅ **TKT-019**: Currency & Validation Utils (PR #9) - 2025-11-09
  - Files: `src/lib/utils.ts`, `tests/lib/utils.test.ts`
  - Status: Merged to main

- ✅ **TKT-020**: Configuration Management (直接main) - 2025-11-09
  - Files: `src/lib/config.ts`, `tests/lib/config.test.ts`
  - Status: Merged to main

- ✅ **TKT-015**: Logging Infrastructure (PR #10) - 2025-11-09
  - Files: `src/lib/logger.ts`, `tests/lib/logger.test.ts`
  - Status: Merged to main
  - Notes: Environment-aware structured logging with child logger support

### Phase 2: API Implementation (進行中)

- ✅ **TKT-007/008/009**: API Keys Management (PR #11) - 2025-11-09
  - Files: `src/app/api/keys/route.ts`, `src/app/api/keys/[id]/route.ts`, `tests/api/keys.test.ts`
  - Status: Merged to main
  - Notes: Refactored existing endpoints to use foundation libraries (logger, ErrorCatalog, handleError). Changed to soft delete (revoke). 22 tests added.

- ✅ **TKT-010/011**: Spells Management Refactoring (PR #12) - 2025-11-10
  - Files: `src/app/api/spells/create/route.ts`, `src/app/api/spells/route.ts`, `src/app/api/spells/[id]/route.ts`, `src/lib/stripe-webhook.ts`
  - Status: Merged to main
  - Notes: Refactored Spells endpoints to use foundation libraries (logger, ErrorCatalog, handleError, apiSuccess). Fixed ESLint error in stripe-webhook.ts. Maintained soft delete logic. All existing tests pass.

- ✅ **TKT-016/017/018**: Cast Execution (PR #13) - 2025-11-10
  - Files: `src/app/api/casts/route.ts`, `src/app/api/casts/[id]/route.ts`, `src/lib/cast-service.ts`
  - Status: Merged to main
  - Notes: Implemented Cast execution endpoints with idempotency, budget checks, and GitHub Actions workflow triggering. Full integration with existing foundation libraries.

### Phase 3: Webhooks & Monitoring (完了済み)

- ✅ **TKT-021**: Stripe Webhook Refactoring (PR #14) - 2025-11-10
  - Files: `src/app/api/webhooks/stripe/route.ts`
  - Status: In PR review
  - Notes: Refactored to use parseStripeWebhookEvent, ErrorCatalog, handleError, and structured logging

- ✅ **TKT-022**: GitHub Webhook Refactoring (PR #14) - 2025-11-10
  - Files: `src/app/api/webhooks/github/route.ts`
  - Status: In PR review
  - Notes: Enhanced structured logging, fixed ErrorCatalog.INTERNAL usage

- ✅ **TKT-023**: Health Check Endpoint (PR #14) - 2025-11-10
  - Files: `src/app/api/health/route.ts`
  - Status: In PR review
  - Notes: Database and Redis health checks with response time monitoring, 3-tier status

- ✅ **TKT-024**: Metrics Endpoint (PR #14) - 2025-11-10
  - Files: `src/app/api/metrics/route.ts`
  - Status: In PR review
  - Notes: Platform-wide metrics with role-based access control (operator/maker only)

## Pending Tickets / Decisions

### Architecture Review Needed

**TKT-001/002/003/004 (Authentication Endpoints)** - DEFERRED ⏸️

These tickets were originally planned for implementing additional auth endpoints, but per architectural decision:

- **Current approach**: WebAuthn (Passkey) + API Keys authentication is working and complete
- **Status**: Kept as-is, no changes needed
- **Future work**: User will implement E-Key (Ephemeral Proof-Bound Capability Key) architecture later
- **Action**: These tickets can be removed or marked as "Not Needed" in future updates

All other tickets from the original roadmap have been completed.

## Session Continuity Guide

### セッションを再開する際の手順

1. **現在の状態確認**

   ```bash
   git status
   git branch
   cat PROGRESS.md
   ```

2. **最後に完了したチケットを確認**
   - このファイルの "Last Completed Ticket" を確認
   - 対応するPRがマージされているか確認

3. **次のチケットを選択**
   - "Pending Tickets" セクションから次のチケットを選ぶ
   - 依存関係を考慮して選択

4. **作業開始**

   ```bash
   # ブランチ作成
   git checkout -b feat/TKT-XXX

   # 実装
   # ...

   # テスト
   pnpm test
   pnpm typecheck
   pnpm build

   # PR作成
   gh pr create --title "feat: TKT-XXX description" --body "..."
   ```

### Current Architecture Status

**Authentication**:

- ✅ WebAuthn (Passkey) implemented via NextAuth
- ✅ API Keys for programmatic access
- ⏸️ No additional auth endpoints needed (TKT-001~004 deferred)
- 🔮 Future: E-Key architecture (to be implemented by project owner)

**Implementation Status**: All planned tickets completed (16/20 original tickets)

- Remaining 4 tickets (TKT-001~004) deferred due to architecture decision

## Technical Notes

### 実装済みの基盤機能

- ✅ エラーハンドリング (SpellError, ErrorCatalog)
- ✅ 予算トラッキング (getBudgetStatus, checkBudgetLimit)
- ✅ べき等性管理 (IdempotencyManager)
- ✅ レート制限 (RateLimiter - Redis/in-memory)
- ✅ ユーティリティ (formatCurrency, validateRequest)
- ✅ 環境設定管理 (getConfig, validateConfig)
- ✅ 構造化ログ (logger, createRequestLogger)

### 統合ポイント

- 全APIエンドポイントでloggerを使用
- 全APIエンドポイントでエラーハンドリング (handleError)
- POST/PUT/PATCHでvalidateRequestを使用
- 重要なエンドポイントでレート制限を適用
- Castエンドポイントで予算チェックを実行

## Test Coverage

Current test suite: 60 tests passing

- API Keys: 22 tests
- Error Catalog: 8 tests
- Budget: 8 tests
- Configuration: 4 tests
- Idempotency: 10 tests
- Logging: 14 tests
- Rate Limiting: 10 tests
- Utils: 6 tests
- Cast Service: (integration tests via API)
- Webhooks: (tested via webhook handlers)

## Environment Setup

Required environment variables (see `.env.example`):

- DATABASE_URL
- NEXTAUTH_URL
- AUTH_SECRET
- GITHUB*APP*\* (6 variables)
- STRIPE\_\* (3 variables)
- Optional: UPSTASH*REDIS*\* (2 variables)
