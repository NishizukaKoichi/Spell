# PROGRESS.md — Spell Platform Delivery Progress (v2)

このファイルは **Spell Platform 全体の進捗をフェーズ方式で管理するための唯一の俯瞰ビュー** であり、
AGENTS.md（法律）と PLANS.md（詳細計画）の上位に位置する **全体マップ** である。

Spell の進捗は、まず **全機能をチケット化 → フェーズ A/B/C に分類 → 各チケットを Worktree / PR 単位で実装** という手法で管理される。

---

# 1. 開発方式（Phase Model）

Spell 開発は、次のような構造で進む：

1. Spell の全機能を **全チケットに分解**（最小粒度）
2. その中で **絶対に最初に完成しないと他が進まない基盤層** を Phase A とする
3. Phase A を前提にできる実装を Phase B とする
4. さらに後続レイヤ（C, D...）があれば続けて定義
5. 実装は常に **A → B → C（依存順）** で進める
6. 各チケットは：

   * Worktree を切る
   * 実装する
   * CI green
   * PR open
   * main に merge
7. 進捗はこの PROGRESS.md に反映する

---

# 2. Ticket Status（ステータス規約）

| Status        | 意味                       |
| ------------- | ------------------------ |
| `OPEN`        | 未着手                      |
| `IN_PROGRESS` | Worktree/branch 上で作業中    |
| `CI_GREEN`    | CI 通過済み（PR 前）            |
| `PR_OPEN`     | PR が作成され、レビュー待ち          |
| `MERGED`      | main にマージ済み              |
| `BLOCKED`     | 上位フェーズ or 依存チケットの未完により停止 |

この表記を全チケットに使用する。

---

# 3. Phase 定義（ここに実データを後で追記）

以下はテンプレート。
後で Spell の具体的なチケットを埋める。

```markdown
### Phase A — Foundational Core
- 目的：Spell エンジンを最低限動かすために絶対に必要な層
- 例：DB schema / JWT verify / BAN / Spell execute pipeline / Billing foundation
- Exit Criteria：Phase A の全チケットが MERGED

### Phase B — Integration Layer
- 目的：A を利用して外部クライアント（ChatGPT / CLI / Apps SDK）と接続する部分
- 例：Apps SDK wiring / CLI integration / Portal URL / Checkout URL
- Exit Criteria：外部クライアントから Spell 実行ができる

### Phase C — Advanced Runtime & Execution
- 目的：WASM / 実行高度化 / 即時反映
- Exit Criteria：WASM Sandboxing と即反映パイプラインが完成
```

---

# 4. Phase 別チケット表（テンプレート）

ここに Spell のすべてのチケットを記入する。
後で分解フェーズに入ったときに埋める。

```markdown
### Phase A — Foundational Core

| Ticket ID | Title | Worktree/Branch | Status | Depends On | Notes |
|-----------|--------|------------------|---------|-------------|--------|
| A-001 | DB schema: users/spells/billing/bans | wt/db-schema | CI_GREEN | - | Prisma schema aligned w/ Spec v1.0 + Jest infra stabilised |
| A-002 | JWT verify + BAN middleware | wt/auth-mw | MERGED | A-001 | Middleware + shared auth errors |
| A-003 | Spell execute pipeline (/api/spell/execute) | wt/spell-exec | MERGED | A-002 | Spell engine + API contract implemented |
| A-004 | Billing foundation (Stripe Customer sync) | wt/billing-core | MERGED | A-001 | Stripe customer sync + billing API errors hardened |
| A-005 | Webhook handling (Stripe) | wt/webhook | OPEN | A-004 | |

### Phase B — Integration Layer

| Ticket ID | Title | Worktree/Branch | Status | Depends On | Notes |
|-----------|--------|------------------|---------|-------------|--------|
| B-001 | Apps SDK integration | wt/apps-sdk | OPEN | A-003 | |
| B-002 | CLI spell run integration | wt/cli-run | OPEN | A-003 | |
| B-003 | Billing portal + checkout URL | wt/portal-checkout | OPEN | A-004 | |

### Phase C — Advanced Runtime & Execution

| Ticket ID | Title | Worktree/Branch | Status | Depends On | Notes |
|-----------|--------|------------------|---------|-------------|--------|
| C-001 | WASM runtime (sandbox) | wt/wasm-runtime | OPEN | A-003 | |
| C-002 | Public Spell immediate reflection | wt/public-reflect | OPEN | C-001 | |
```

---

# 5. Summary Metrics（全体の進捗まとめ）

ここに全体状況を定期的に記録する（AI にも更新させる）。

```markdown
### Summary (Last Updated: 2025-01-16)

Phase A: 2 / 5 MERGED
Phase B: 0 / 3 MERGED
Phase C: 0 / 3 MERGED

Total Tickets: 11
Overall Completion: ~18%

Current Focus: Phase A-005 — Webhook handling (Stripe)
```

---

# 6. 運用ルール

* すべての実装は Git worktree / branch で行う
* main に直接 push してはならない
* チケットの状態が変わるたびに PROGRESS.md を更新する
* ExecPlan（PLANS.md）が完了したら該当チケットを `MERGED` にする

---

End of PROGRESS.md — Spell Platform Delivery Progress (v2)
