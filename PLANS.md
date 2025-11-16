# PLANS.md — Spell Platform Autonomous Execution Plans (v2)

このファイルは **Spell Platform の全タスクに対する長期記憶・計画書・実行ログ** をまとめるための唯一の場所であり、Codex を長時間自走させる際の「作戦盤」「歴史書」「脳みそ」の役割を果たす。

AGENTS.md で定義された自動実行ルールに従い、Spell の全機能開発は **ExecPlan 単位** でここに記録される。

---

# 1. PLANS.md の役割

PLANS.md は Spell プロジェクトの「時系列と知識の集約点」である。以下を担う：

* 各タスクの **初期計画（ExecPlan）**
* 制約・不変条件の明示
* 実装手順・テスト方針の文章化
* 作業ログ（Progress Log）
* 発見事項（Surprises）
* 意思決定の根拠（Decision Log）
* タスク終了時のまとめ（Outcomes）

Codex や人間エンジニアは、Spell に変更を加える前に必ずここに ExecPlan を作成しなければならない。

---

# 2. Spell 用 ExecPlan ルール

Spell は特殊なアーキテクチャ（UIなし/API専用/Next.js 16/Stripe/WASM）を持つため、ExecPlan には Spell 固有の項目を必ず含める。

以下は **必須構造** であり、省略してはならない：

```markdown
## ExecPlan: <short descriptive title>

### Overview
- このタスクの目的
- Spell のどの部分に影響するか
- なぜこれが重要か（API契約/Stripe/Engine/セキュリティの観点）

### Constraints & Invariants
- Spell に特有の壊してはならない条件（例：自然言語禁止、JWT境界、Stripe Customer 1:1、runtime不変条件、visibility規則、MCP適合性など）
- Breaking change の許可条件（原則不可）

### Milestones & Checklist
- 30〜60分で終わる単位に分解した小ステップ
- 手順の順序性（依存関係）

### Implementation Steps
- 実際に何をどう書くか
- 編集するファイルのパス（例：`app/api/spell/execute/route.ts`）
- 必要なら migration の記述
- MCP で確認するポイント

### Validation & Tests
- 実行する自動テスト（例：`pnpm test`）
- APIの動作確認（curl / Postman / MCP Inspector）
- Billing系はダブルチャージ防止テスト必須
- WASM系は sandbox の安全性確認必須

### Risk & Rollback
- 失敗した場合の影響（課金/セキュリティ/API破壊）
- ロールバックステップ（git revert / migration rollback）

### Progress Log
- `<timestamp> — 作業内容 / 実行したテスト`
- 小さな変更ごとに必ず追記

### Surprises & Discoveries
- 想定外の挙動
- Spell の実装上の罠
- Next.js のクセ、Stripe の仕様、WASM の制限など

### Decision Log
- 設計判断の記録（なぜこうしたか）
- 代替案と採用しなかった理由
- Spell の不変条件との整合性チェック

### Outcomes & Retrospective
- 何が達成されたか
- まだ残っている課題
- 次に作るべきチケット
```

---

# 3. ExecPlan 作成ルール（Spell 専用）

## 3.1 作業開始前に ExecPlan を書くこと

ExecPlan が存在しない状態でコードを変更してはならない。

## 3.2 Spell 固有の制約を必ず明示

以下は毎回の ExecPlan に記載必須：

* **自然言語ロジック禁止**
* **JWT 境界の固定**（issuer / aud / expiry / BAN）
* **Stripe Customer モデル破壊禁止**
* **Spell 実行パイプライン順序の保持**
* **visibility の強制遵守**
* **Next.js MCP で追跡しやすい API 構造を維持**
* **WASM sandbox の安全性**

## 3.3 依存関係は明示的に書く

例：

* DB schema が先 → API handler の実装
* Billing middleware → Spell execute API → CLI integration

## 3.4 Breaking Change は ExecPlan 内で必ず根拠を示す

Spell にとって API や Billing の互換性破壊は非常に重い。
実施する場合は Decision Log で詳細説明が必須。

---

# 4. Progress Log の取り扱い

Progress Log は Spell プロジェクトの「時系列アーカイブ」である。

**必ず以下を残す：**

* どのファイルを触ったか
* 何をリファクタしたか
* どのテストを実行したか
* CIが通ったか
* 手戻りがあったか

ログは後から人間が復元できるレベルで書く。

---

# 5. Surprises / Decision Log / Outcomes の重要性

Spell のように依存が多いプロジェクトでは：

* Surprises → **“意図せぬ罠の記録”**
* Decision Log → **“設計根拠の記録”**
* Outcomes → **“次へのタスクリンク”**

これら3つが後続作業の品質を左右する。

特に Decision Log は **Codex と人間の間の非同期コミュニケーションの中心** になる。

---

# 6. フェーズ方式との連携（PROGRESS.md）

Spell の開発はフェーズ（A → B → C）方式で進むため、ExecPlan は常に PROGRESS.md と同期して扱う：

* ExecPlan = 1 チケットまたは 1 機能の計画
* PROGRESS.md = 全体フェーズの俯瞰

ExecPlan で完了したら、PROGRESS.md の該当チケットを `MERGED` に更新する。

---

# 7. 新規 ExecPlan のテンプレート

以下は Spell v2 用の拡張テンプレート：

```markdown
## ExecPlan: <TASK_TITLE>

### Overview
- <why this task>
- <affected components>
- <product/system reasoning>

### Constraints & Invariants
- <Spell-specific constraints>
- <JWT/billing/runtime requirements>
- <MCP compatibility>

### Milestones & Checklist
1. <milestone>
2. <milestone>
3. <milestone>

### Implementation Steps
- <step>
- <file paths>
- <schema/migration>
- <runtime considerations>

### Validation & Tests
- <unit tests>
- <integration tests>
- <API smoke tests>
- <billing safety>
- <wasm sandbox checks>

### Risk & Rollback
- <risk>
- <rollback strategy>

### Progress Log
- <timestamp-like marker> — <what was done>

### Surprises & Discoveries
- <unexpected behavior>

### Decision Log
- <decision + justification>

### Outcomes & Retrospective
- <results>
- <remaining work>
- <tickets to create>
```

---

## ExecPlan: A-001 — Prisma Schema Alignment with Spec

### Overview
- Establish the canonical Prisma schema that matches `Spec.md` for `users`, `spells`, `rune_artifacts`, `billing_records`, and `bans`.
- Ensure enum values surfaced to API clients match the lowercase strings defined in the spec (`'public'`, `'team'`, `'private'`, etc.) so downstream clients do not need to normalize values.
- Add safe defaults (e.g., `priceAmount = 0`, `visibility = 'public'`) to guarantee Rune-created spells become runnable immediately, satisfying the “Bazaar-less” requirement.

### Constraints & Invariants
- Spell remains UI-less; no additions outside Prisma + supporting TypeScript typings.
- JWT and billing boundaries are untouched; we only reshape schema/enums to line up with the spec.
- Stripe customer 1:1 mapping via `users.stripe_customer_id` must stay intact.
- Spell execution pipeline ordering stays the same (auth → BAN → visibility → billing → runtime).
- Visibility defaults to `public`, and all enum values should be lowercase to honor the published API contract.
- Prisma schema must continue to target Neon Postgres (snake_case columns, jsonb fields).

### Milestones & Checklist
1. Compare Spec vs current Prisma schema and note mismatches.
2. Update enums (`UserStatus`, `SpellRuntime`, `SpellVisibility`, `BillingStatus`) to lowercase values per spec and add missing defaults (`priceAmount = 0`, `visibility = 'public'`).
3. Touch all TypeScript usages/tests so they consume the lowercase enums safely.
4. Run Prisma format/generate and the test suite to ensure no regressions.
5. Update `PROGRESS.md` ticket A-001 status after completing work/merge.

### Implementation Steps
- Modify `prisma/schema.prisma`:
  - Rewrite enum declarations to lowercase members (Prisma allows lowercase identifiers).
  - Add `@default(0)` for `priceAmount` and `@default('public')` for `visibility`.
  - Ensure timestamps/foreign keys still match spec.
- Update TypeScript:
  - `lib/spell-engine.ts`: switch `SpellRuntime.BUILTIN` etc. to use `Prisma.$Enums.SpellRuntime` or literal strings.
  - `app/api/rune/create/route.ts`: update allowed visibility/runtime sets.
  - Tests under `__tests__/` referencing enums must update to new strings.
- Run `pnpm prisma format && pnpm prisma generate` to regenerate clients.

### Validation & Tests
- `pnpm prisma format`
- `pnpm prisma generate`
- `pnpm test`
- Optional: `pnpm lint` if configured (currently not).

### Risk & Rollback
- Risk: Enum renames are breaking for persisted data; acceptable now since DB is not yet stable. If issues arise, revert schema+code changes and regenerate Prisma client.
- Rollback: `git revert` on schema commit; re-run Prisma generate/test.

### Progress Log
- 2025-01-14 — Authored ExecPlan for A-001 (schema alignment).
- 2025-01-15 — Normalized Prisma enums/defaults + updated API/lib/test references to lowercase contract.
- 2025-01-15 — Added Jest manual mocks (Prisma, Stripe) + WebAssembly/Stripe polyfills; `pnpm test` now passes.

### Surprises & Discoveries
- next/jest (SWC) treats `jose` + Prisma client as ESM modules, so tests required dedicated mocks + Node test environment; also Stripe SDK expects `fetch`.

### Decision Log
- Preserve explicit `Invalid token: missing sub claim` error by rethrowing custom error before generic JWT failure; keeps API contract self-explanatory despite catch block.
- Introduced shared Jest manual mocks instead of per-test factories to prevent accidental Prisma client instantiation (missing `DATABASE_URL`).

### Outcomes & Retrospective
- Prisma schema + downstream TypeScript now match `Spec.md`.
- Jest infra ready for subsequent Phase A/B work (tests run headless with mocks).
- Pending: merge `wt/db-schema` once reviewed; follow-up tickets for webhook + billing continue from this baseline.

---

## ExecPlan: A-002 — Auth Middleware & BAN Enforcement

### Overview
- Introduce a centralized authentication layer for `/api/**` routes so every handler receives a verified `user_id` and consistent BAN enforcement without duplicating logic per route.
- Ensure Apps SDK / CLI clients can rely on uniform error codes when JWT validation fails or when a user has been banned, satisfying the security requirements in Spec.md §7 and §11.

### Constraints & Invariants
- Spell remains UI-less; middleware must only guard API routes.
- JWT boundary: only accept bearer tokens signed with `JWT_SECRET`; never issue tokens.
- BAN logic must run before any billing or spell execution, and banned users must not be charged.
- Middleware must be edge-compatible (Next.js 16) and avoid blocking `/_next` assets.
- No natural language parsing; responses stay structured JSON errors.

### Milestones & Checklist
1. Define error primitives in `lib/auth` (e.g., `AuthError`, `BanError`) to distinguish failure reasons.
2. Implement `middleware.ts` (or route handler wrapper) that verifies JWT, checks BAN, and injects `x-spell-user-id` into the request headers for downstream handlers.
3. Update existing route handlers to read the injected header instead of calling `authenticateRequest` manually (remove duplication, but keep helper for tests).
4. Add Jest coverage for: successful pass-through, missing token, invalid token, banned user.
5. Update docs (`Spec.md`/`PLANS.md`) if API error shapes change.

### Implementation Steps
- Extend `lib/auth.ts` with typed errors and a helper to serialize auth failures.
- Add `middleware.ts` at the repo root configured to run on `/api/:path*`, skip `/_next` and `/_static`.
- Inside middleware: parse Authorization, call `authenticateRequest`, attach user id to `requestHeaders` (e.g., `requestHeaders.set('x-spell-user-id', userId)`), and forward; on error, short-circuit with JSON response.
- Update each API route to read `request.headers.get('x-spell-user-id')` (fallback to `authenticateRequest` for non-middleware contexts such as tests).
- Adjust tests to mock the middleware header injection.

### Validation & Tests
- Unit tests for `lib/auth` error types and happy/ban paths.
- Middleware tests via Next's `NextRequest` mock verifying header injection and error JSON.
- Re-run `pnpm test` and `vercel build --yes` to ensure middleware compiles for both Node and Edge runtimes.

### Risk & Rollback
- Risk: middleware intercept might break unauthenticated endpoints; mitigate via matcher configuration.
- Rollback: remove `middleware.ts`, revert API header changes, reinstall per-route `authenticateRequest` before release.

### Progress Log
- 2025-01-15 — Drafted ExecPlan for A-002 (auth middleware & BAN enforcement).
- 2025-01-16 — Implemented shared auth helpers + Next middleware that injects `x-spell-user-id`, added internal BAN-check endpoint, and updated every API handler to trust the forwarded header.
- 2025-01-16 — Added middleware + auth unit tests, documented new env vars, and ran `pnpm test`.

### Surprises & Discoveries
- Next.js middleware executes in the Edge runtime, so Prisma cannot run there; needed an internal authenticated API to ask the Node runtime for BAN status.

### Decision Log
- Added `/api/internal/auth/ban-check` gated by `INTERNAL_AUTH_SECRET` so middleware can enforce bans without embedding Prisma in the Edge bundle.
- Middleware sanitizes and forward-fills `x-spell-user-id` to avoid re-verifying JWT/bans in each handler, keeping consistent auth state for downstream logic.

### Outcomes & Retrospective
- Added centralized authentication middleware with uniform JWT/BAN enforcement across all API routes, plus internal ban-check endpoint to keep Prisma on Node runtime.
- All `/api/*` handlers now rely on forwarded `x-spell-user-id`, and Jest coverage ensures auth failures return structured error codes.
- Remaining work: Phase A-003 (spell execute pipeline) now unblocked; monitor env rollout (`JWT_ISSUER`, `JWT_AUDIENCE`, `INTERNAL_AUTH_SECRET`) before staging deploy.

---

## ExecPlan: A-003 — Spell Execution Pipeline

### Overview
- Deliver the first runnable Spell execution pipeline so `/api/spell/execute` enforces the Spec-defined flow: spell lookup → visibility guard → billing (PaymentIntent + billing record) → runtime dispatch (`builtin`/`api`/`wasm`) → JSON result.
- Wire `lib/spell-engine` to Stripe + Prisma in a way that Apps SDK/CLI can rely on deterministic errors (spell not found, access denied, billing failure, runtime failure) and ensure billing happens exactly once per paid invocation.
- This unblocks downstream Phase B integrations by guaranteeing a stable execution engine contract.

### Constraints & Invariants
- Remain API-only—no UI additions. Reuse Next.js App Router semantics.
- Spell pipeline order is fixed (Spec §8.1). Authentication/BAN already handled by middleware; this layer must not skip visibility/billing/runtime checks.
- Stripe Customer relationship stays 1:1 with `users`. PaymentIntent must be created with `confirm=true`, and billing records must represent success/failure accurately.
- Forbid natural-language parsing; runtime execution is deterministic code/API/WASM.
- Prisma operations must target Neon Postgres schema from Phase A-001.
- Keep runtime dispatch extensible but minimal (no real WASM sandbox yet; stub allowed with TODO comments).

### Milestones & Checklist
1. Document execution contract + error enums for `executeSpell` (success/error shape, billing record expectations).
2. Implement visibility + billing enforcement aligned with Spec (PaymentIntent helper, billing record statuses).
3. Flesh out runtime dispatch scaffolding for builtin/api/wasm (with clear placeholders where future work plugs in).
4. Update `/api/spell/execute` response handling + tests to cover success/failure/billing error flows.
5. Run full Jest suite; update docs/logs (PLANS/PROGRESS) once behavior is validated.

### Implementation Steps
- `lib/spell-engine.ts`:
  - Introduce discriminated union for `SpellExecutionResult` to encode `status`, `errorCode`, `billingRecordId`.
  - Add helper functions `getSpellOrError`, `ensureVisibility`, `chargeSpell` (invoking `createPaymentIntent` with `confirm=true` and capturing `stripePaymentIntentId`), and `recordBilling`.
  - Expand runtime executors: `executeBuiltinSpell`, `executeApiSpell`, `executeWasmSpell` with clear TODO boundaries; ensure API runtime respects `config.headers` and times out gracefully.
  - Guarantee atomicity: if runtime fails after billing success, return `billingRecordId` so clients can reconcile.
- `app/api/spell/execute/route.ts`:
  - Ensure request body validation (spellId string, parameters object) and map `executeSpell` results to HTTP codes (200 success, 402 for billing fail, 403 for visibility, 404 for missing spell, 500 fallback).
  - Surface consistent error JSON (`{ error, code, billingRecordId? }`).
- Tests:
  - Expand `__tests__/lib/spell-engine.test.ts` to mock Prisma + Stripe for each path (spell missing, visibility fail, billing success/failure, runtime error).
  - Add API handler tests (e.g., using NextRequest mocks) if feasible; otherwise rely on engine tests plus smoke tests.

### Validation & Tests
- `pnpm test` (covers `lib/spell-engine`, middleware, stripe mocks).
- Optional targeted test command: `pnpm test __tests__/lib/spell-engine.test.ts`.
- Manual sanity check via `pnpm dev` + MCP inspector hitting `POST /api/spell/execute` with mocked data (document in Surprises if run).

### Risk & Rollback
- Risk: double billing or missing refunds if runtime fails. Mitigate by recording billing status and propagating PaymentIntent IDs.
- Rollback: revert `lib/spell-engine.ts` and `app/api/spell/execute/route.ts`; rerun tests; ensure previous simple stub still executes.

### Progress Log
- 2025-01-16 — Authored ExecPlan for A-003 (Spell execution pipeline).
- 2025-01-16 — Reworked `lib/spell-engine` to enforce visibility/billing order, return typed success/error unions, and updated `/api/spell/execute` to map errors to HTTP status.
- 2025-01-16 — Expanded spell engine Jest coverage + full `pnpm test` to validate billing failure and runtime failure behavior.

### Surprises & Discoveries
- Existing engine returned boolean success without error codes, so API routing logic could not choose HTTP statuses; adding discriminated unions simplified response mapping.

### Decision Log
- Standardized spell execution error codes (`SPELL_NOT_FOUND`, `VISIBILITY_DENIED`, `BILLING_FAILED`, `RUNTIME_ERROR`) and mapped them to HTTP responses so clients receive actionable failures.

### Outcomes & Retrospective
- _Pending completion._

---

End of PLANS.md — Spell Platform Autonomous Execution Plans (v2)
