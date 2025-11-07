# Spell Platform - Implementation Tickets

このディレクトリには、Spell Platform実装のための全チケットが含まれています。

## ディレクトリ構造

```
tickets/
├── INDEX.md                 # 全チケットのマスターインデックス（220チケット）
├── README.md                # このファイル
├── foundation/              # 基盤系チケット (TKT-001～020)
│   ├── TKT-001.md          # Database Schema Migration
│   ├── TKT-002.md          # Core Data Models & DTOs
│   ├── TKT-003.md          # API Authentication Middleware
│   ├── TKT-004.md          # Rate Limiting (Redis-backed)
│   ├── TKT-005.md          # Idempotency Handling
│   └── TKT-006.md          # Error Catalog Implementation
├── security/                # セキュリティ＆サプライチェーン (TKT-021～040)
│   ├── TKT-021.md          # Sigstore Integration
│   ├── TKT-022.md          # SBOM Generation Pipeline
│   └── TKT-023.md          # SBOM Validation Service
├── runtime/                 # WASM Runtime (TKT-041～060)
│   └── TKT-041.md          # WASM Module Loader with Caching
├── execution/               # 実行モード (TKT-061～080)
│   └── TKT-061.md          # Workflow Mode (GitHub Actions)
├── payment/                 # 課金＆決済 (TKT-081～110)
│   └── TKT-087.md          # Budget Cap Enforcement
├── compliance/              # コンプライアンス (TKT-111～140)
├── observability/           # 可観測性 (TKT-141～160)
├── api/                     # APIエンドポイント (TKT-161～200)
│   └── TKT-164.md          # POST /v1/spells/{id}:cast
└── testing/                 # テスト＆QA (TKT-201～220)
```

## チケット番号体系

- **TKT-001～020**: Foundation (基盤)
- **TKT-021～040**: Security & Supply Chain (セキュリティ＆サプライチェーン)
- **TKT-041～060**: WASM Runtime (WASM実行環境)
- **TKT-061～080**: Execution Modes (実行モード)
- **TKT-081～110**: Payment & Billing (課金＆決済)
- **TKT-111～140**: Compliance (コンプライアンス)
- **TKT-141～160**: Observability (可観測性)
- **TKT-161～200**: API Endpoints (APIエンドポイント)
- **TKT-201～220**: Testing & QA (テスト＆品質保証)

## 優先度

各チケットには以下の優先度が設定されています：

- **CRITICAL**: MVP/β版リリースに必須
- **HIGH**: 本番リリースまでに必要
- **MEDIUM**: Phase 2/3で実装
- **LOW**: 将来的な機能拡張

## 複雑度見積もり

- **XL (Extra Large)**: 2+ 週間（例：WASI Sandbox、Multi-region）
- **L (Large)**: 1-2 週間（例：Sigstore統合、E2Eテスト）
- **M (Medium)**: 3-5 日（例：API認証、Rate Limiting）
- **S (Small)**: 1-2 日（例：Error Catalog、Health Check）

## クリティカルパス（MVP）

最小限のMVPを実現するためのクリティカルパス：

### Phase 0: Foundation (Weeks 1-2)
1. **TKT-001**: Database Schema Migration ⭐
2. **TKT-002**: Core Data Models & DTOs ⭐
3. **TKT-003**: API Authentication Middleware ⭐
4. **TKT-004**: Rate Limiting (Redis-backed)
5. **TKT-005**: Idempotency Handling
6. **TKT-006**: Error Catalog Implementation

### Phase 1: Core Execution (Weeks 3-4)
7. **TKT-041**: WASM Module Loader ⭐
8. **TKT-042**: WASI Sandbox ⭐
9. **TKT-043**: Resource Limits
10. **TKT-061**: Workflow Mode (GitHub Actions) ⭐
11. **TKT-062**: Service Mode (JetStream)
12. **TKT-087**: Budget Cap Enforcement ⭐

### Phase 2: Security & Payment (Weeks 5-6)
13. **TKT-021**: Sigstore Integration
14. **TKT-022**: SBOM Generation Pipeline
15. **TKT-023**: SBOM Validation Service
16. **TKT-081**: Stripe Setup
17. **TKT-089**: Flat Pricing (Pay-per-cast)
18. **TKT-111**: GDPR Data Export

### Phase 3: API & Testing (Weeks 7-8)
19. **TKT-161**: POST /v1/spells ⭐
20. **TKT-164**: POST /v1/spells/{id}:cast ⭐
21. **TKT-202**: Integration Test Suite
22. **TKT-204**: E2E Test: Workflow Mode Cast ⭐
23. **TKT-211**: Load Test Setup
24. **TKT-220**: Production Deployment

⭐ = 特に重要

## チケットテンプレート

各チケットには以下のセクションが含まれています：

```markdown
# [TKT-XXX] {Feature Name}

## 目的
{Purpose and business value}

## スコープ
{Target directories/files}

## 実装詳細
{Implementation details from SPEC}

## 受け入れ条件
- [ ] {Acceptance criteria 1}
- [ ] {Acceptance criteria 2}
- [ ] Tests pass locally
- [ ] Code committed

## 依存関係
blocks: [TKT-xxx, TKT-yyy]
blocked-by: [TKT-zzz]

## 技術スタック
{Relevant technologies from SPEC}

## 優先度
{CRITICAL | HIGH | MEDIUM | LOW}

## 見積もり複雑度
{XL | L | M | S}

## セキュリティ考慮事項
{Security requirements if applicable}
```

## 使い方

### 1. チケット選択
- `INDEX.md` で全体像を把握
- 優先度と依存関係を確認
- 自分のスキルセットに合ったチケットを選択

### 2. 実装
- チケット内の「実装詳細」を参照
- SPEC-Platform.md / SPEC-Implementation.md のセクションを確認
- 受け入れ条件を満たすまで実装

### 3. テスト
- ローカルでテスト実行
- 全受け入れ条件をチェック
- コードレビュー準備

### 4. PR作成
- チケット番号をブランチ名・コミットメッセージに含める
  - `git checkout -b feature/TKT-001-database-schema`
  - `git commit -m "feat(TKT-001): implement database schema migration"`
- PR説明にチケット番号とリンクを記載

## ステータス管理

現在のステータス表示：
- 🔴 Not Started (未着手)
- 🟡 In Progress (進行中)
- 🟢 Complete (完了)
- 🔵 Blocked (ブロック中)

`INDEX.md` の各チケット行のStatusカラムを更新してください。

## 並行作業可能なチケット

以下のチケットは互いに依存せず、並行して作業可能：

**Week 1-2:**
- TKT-001 (DB Schema)
- TKT-006 (Error Catalog)
- TKT-020 (Configuration Management)
- TKT-022 (SBOM Generation Pipeline)

**Week 3-4:**
- TKT-041 (WASM Loader) ← DB完了後
- TKT-061 (Workflow Mode) ← DB完了後
- TKT-021 (Sigstore) ← DB完了後
- TKT-081 (Stripe Setup) ← 独立

**Week 5-6:**
- TKT-042 (WASI Sandbox) ← WASM Loader完了後
- TKT-062 (Service Mode) ← DB完了後
- TKT-111 (GDPR Export) ← DB完了後
- TKT-141 (OpenTelemetry) ← 独立

## コントリビューション

1. チケットを選択したら、`INDEX.md` でステータスを 🟡 に更新
2. 実装完了したら、🟢 に更新
3. ブロックされたら、🔵 に更新し、理由をコメント

## 質問・議論

- チケット内容について質問がある場合は、Issueを作成
- 実装方針について議論したい場合は、Discussionsを使用
- SPEC解釈が不明な場合は、`docs/SPEC-*.md` を確認後、Issue作成

## 参考リンク

- [SPEC-Platform.md](/Users/koichinishizuka/Desktop/Spell/docs/SPEC-Platform.md)
- [SPEC-Implementation.md](/Users/koichinishizuka/Desktop/Spell/docs/SPEC-Implementation.md)
- [GitHub Project Board](#) (TODO: 作成予定)
- [Sprint Planning](#) (TODO: 作成予定)

---

**Last Updated**: 2025-11-07
**Total Tickets**: 220
**Status**: Planning Phase
