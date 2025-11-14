# Spell Platform Implementation Tickets - Master Index

**Generated**: 2025-11-07
**Total Tickets**: 220
**Status**: Planning Phase

## Legend

- **Priority**: CRITICAL > HIGH > MEDIUM > LOW
- **Complexity**: XL (Extra Large) > L (Large) > M (Medium) > S (Small)
- **Status**: 🔴 Not Started | 🟡 In Progress | 🟢 Complete | 🔵 Blocked

---

## UIレス Spell イニシアチブ（2025-11）

| Ticket     | Title                                     | Priority | Notes                         |
| ---------- | ----------------------------------------- | -------- | ----------------------------- |
| UL-TKT-001 | Next.js UI撤去とAPIベースラインへの移行   | CRITICAL | 画面資産削除 + API-only build |
| UL-TKT-002 | Spell Core Runtime (固定呪文セット)       | CRITICAL | WASM-first 呪文実行エンジン   |
| UL-TKT-003 | ChatGPT Apps SDK / MCP ツール実装         | CRITICAL | `spell.execute/list/estimate` |
| UL-TKT-004 | Spell CLI (auth/list/run)                 | HIGH     | CLI で認証/実行/ Rune         |
| UL-TKT-005 | Passkey Identity & Token Service          | CRITICAL | WebAuthn + token issuance     |
| UL-TKT-006 | 課金・決済ハンドシェイク (ChatGPT連携)    | HIGH     | Stripe 連携 & usage 記録      |
| UL-TKT-007 | Spell Engine HTTP API (execute/list/rune) | CRITICAL | CLI/Apps SDK 共通 API         |
| UL-TKT-008 | Rune β: 呪文作成・登録フロー              | MEDIUM   | 高信頼ユーザー作成機能        |
| UL-TKT-009 | BAN・信頼スコアサービス                   | HIGH     | Rune/有料呪文のガードレール   |
| UL-TKT-010 | Observability & 実行監査ログ              | MEDIUM   | OTel + audit logging          |

詳細は `tickets/ui-less/` の各チケットを参照。

---

## Foundation (TKT-001 to TKT-020)

| ID      | Title                                   | Priority | Complexity | Status | Dependencies              |
| ------- | --------------------------------------- | -------- | ---------- | ------ | ------------------------- |
| TKT-001 | Database Schema Migration & Core Tables | CRITICAL | L          | 🟢     | -                         |
| TKT-002 | Core Data Models & DTOs                 | CRITICAL | M          | 🟢     | TKT-001                   |
| TKT-003 | API Authentication Middleware           | CRITICAL | M          | 🟢     | TKT-001, TKT-002          |
| TKT-004 | Rate Limiting (Redis-backed)            | HIGH     | M          | 🟢     | TKT-001, TKT-003          |
| TKT-005 | Idempotency Handling                    | HIGH     | S          | 🟢     | TKT-001, TKT-003, TKT-004 |
| TKT-006 | Error Catalog Implementation            | HIGH     | S          | 🟢     | -                         |
| TKT-007 | Redis Cache Layer Setup                 | HIGH     | M          | 🔴     | -                         |
| TKT-008 | Neon PostgreSQL Connection Pool         | HIGH     | S          | 🔴     | TKT-001                   |
| TKT-009 | Database Migrations CLI                 | MEDIUM   | S          | 🔴     | TKT-001                   |
| TKT-010 | Session Management                      | MEDIUM   | M          | 🔴     | TKT-003, TKT-007          |
| TKT-011 | API Key Generation & Rotation           | HIGH     | M          | 🔴     | TKT-001, TKT-003          |
| TKT-012 | RBAC (Role-Based Access Control)        | MEDIUM   | M          | 🔴     | TKT-003                   |
| TKT-013 | Request Validation Middleware           | MEDIUM   | S          | 🔴     | TKT-002                   |
| TKT-014 | Response Serialization Layer            | LOW      | S          | 🔴     | TKT-002                   |
| TKT-015 | Logging Infrastructure (JSON)           | HIGH     | M          | 🟢     | -                         |
| TKT-016 | Health Check Endpoint                   | MEDIUM   | S          | 🔴     | TKT-008                   |
| TKT-017 | Readiness Probe                         | MEDIUM   | S          | 🔴     | TKT-008                   |
| TKT-018 | Liveness Probe                          | MEDIUM   | S          | 🔴     | -                         |
| TKT-019 | Graceful Shutdown Handler               | MEDIUM   | M          | 🔴     | -                         |
| TKT-020 | Configuration Management (env vars)     | HIGH     | S          | 🟢     | -                         |

---

## Security & Supply Chain (TKT-021 to TKT-040)

| ID      | Title                                      | Priority | Complexity | Status | Dependencies              |
| ------- | ------------------------------------------ | -------- | ---------- | ------ | ------------------------- |
| TKT-021 | Sigstore Integration (Fulcio + Rekor)      | HIGH     | L          | 🟢     | TKT-001                   |
| TKT-022 | SBOM Generation Pipeline                   | HIGH     | M          | 🔴     | -                         |
| TKT-023 | SBOM Validation Service                    | HIGH     | L          | 🔴     | TKT-001, TKT-021, TKT-022 |
| TKT-024 | Canonical Package Format                   | HIGH     | M          | 🔴     | TKT-021                   |
| TKT-025 | Sigstore Signature Verification            | HIGH     | L          | 🔴     | TKT-021                   |
| TKT-026 | Rekor Transparency Log Integration         | HIGH     | M          | 🔴     | TKT-021                   |
| TKT-027 | CVE Database Integration (OSV API)         | HIGH     | M          | 🔴     | TKT-023                   |
| TKT-028 | Dependency Scanning on Upload              | HIGH     | M          | 🔴     | TKT-023, TKT-027          |
| TKT-029 | Daily CVE Re-scan Job                      | MEDIUM   | M          | 🔴     | TKT-028                   |
| TKT-030 | License Compatibility Checker              | MEDIUM   | M          | 🔴     | TKT-023                   |
| TKT-031 | Policy Violation Detection                 | HIGH     | M          | 🔴     | TKT-001                   |
| TKT-032 | Auto-delisting on Abuse                    | HIGH     | M          | 🔴     | TKT-031                   |
| TKT-033 | Maker Notification System                  | MEDIUM   | S          | 🔴     | TKT-032                   |
| TKT-034 | Supply Chain Audit Log                     | MEDIUM   | M          | 🔴     | TKT-021                   |
| TKT-035 | SBOM Download Endpoint                     | LOW      | S          | 🔴     | TKT-023                   |
| TKT-036 | Signature Bundle Storage (R2)              | MEDIUM   | M          | 🔴     | TKT-021                   |
| TKT-037 | Vulnerability Report Generation            | LOW      | M          | 🔴     | TKT-028                   |
| TKT-038 | Security Advisory System                   | LOW      | M          | 🔴     | TKT-029                   |
| TKT-039 | Certificate Identity Extraction            | MEDIUM   | S          | 🔴     | TKT-021                   |
| TKT-040 | SBOM Format Conversion (SPDX ↔ CycloneDX) | LOW      | M          | 🔴     | TKT-023                   |

---

## WASM Runtime (TKT-041 to TKT-060)

| ID      | Title                                  | Priority | Complexity | Status | Dependencies     |
| ------- | -------------------------------------- | -------- | ---------- | ------ | ---------------- |
| TKT-041 | WASM Module Loader with Caching        | CRITICAL | L          | 🔴     | TKT-007          |
| TKT-042 | WASI Sandbox Implementation            | CRITICAL | XL         | 🔴     | TKT-041          |
| TKT-043 | Resource Limits (CPU, Memory, Timeout) | CRITICAL | M          | 🔴     | TKT-042          |
| TKT-044 | Network Policy Enforcement             | HIGH     | L          | 🔴     | TKT-042          |
| TKT-045 | Filesystem Isolation (Read-only)       | HIGH     | M          | 🔴     | TKT-042          |
| TKT-046 | Host Function Whitelisting             | HIGH     | M          | 🔴     | TKT-042          |
| TKT-047 | AOT Compilation Cache                  | MEDIUM   | M          | 🔴     | TKT-041          |
| TKT-048 | JIT Fallback for WASM                  | LOW      | M          | 🔴     | TKT-041          |
| TKT-049 | WASM Binary Validation                 | HIGH     | M          | 🔴     | TKT-041          |
| TKT-050 | Size Limit Enforcement (5MB)           | MEDIUM   | S          | 🔴     | TKT-049          |
| TKT-051 | CPU Cycle Tracking                     | MEDIUM   | M          | 🔴     | TKT-043          |
| TKT-052 | Memory Peak Tracking                   | MEDIUM   | M          | 🔴     | TKT-043          |
| TKT-053 | Network Bytes Tracking                 | MEDIUM   | M          | 🔴     | TKT-044          |
| TKT-054 | Execution Timeout Handling             | HIGH     | M          | 🔴     | TKT-043          |
| TKT-055 | Policy Violation Logging               | HIGH     | M          | 🔴     | TKT-031, TKT-044 |
| TKT-056 | WASM Runtime Error Handling            | MEDIUM   | M          | 🔴     | TKT-042          |
| TKT-057 | Stdout/Stderr Capture                  | MEDIUM   | S          | 🔴     | TKT-042          |
| TKT-058 | Exit Code Handling                     | MEDIUM   | S          | 🔴     | TKT-042          |
| TKT-059 | WASM Module Warm Start                 | LOW      | M          | 🔴     | TKT-047          |
| TKT-060 | Runtime Performance Metrics            | MEDIUM   | M          | 🔴     | TKT-043          |

---

## Execution Modes (TKT-061 to TKT-080)

| ID      | Title                                   | Priority | Complexity | Status | Dependencies              |
| ------- | --------------------------------------- | -------- | ---------- | ------ | ------------------------- |
| TKT-061 | Workflow Mode (GitHub Actions Dispatch) | CRITICAL | L          | 🟢     | TKT-001, TKT-005          |
| TKT-062 | Service Mode (JetStream-based)          | HIGH     | L          | 🔴     | TKT-001, TKT-042          |
| TKT-063 | Clone Mode (Template Generation)        | MEDIUM   | M          | 🔴     | TKT-001                   |
| TKT-064 | GitHub App Installation Check           | HIGH     | M          | 🔴     | TKT-061                   |
| TKT-065 | Repository Permission Validation        | HIGH     | M          | 🔴     | TKT-061, TKT-064          |
| TKT-066 | workflow_dispatch Trigger               | CRITICAL | M          | 🟢     | TKT-061                   |
| TKT-067 | repository_dispatch Trigger             | MEDIUM   | M          | 🟢     | TKT-061                   |
| TKT-068 | GitHub Artifacts API Integration        | HIGH     | L          | 🟢     | TKT-061                   |
| TKT-069 | Artifact Download & Storage             | HIGH     | M          | 🔴     | TKT-068                   |
| TKT-070 | Progress Streaming (SSE)                | MEDIUM   | M          | 🟢     | TKT-061                   |
| TKT-071 | NATS JetStream Setup                    | HIGH     | M          | 🔴     | -                         |
| TKT-072 | RunRequest Message Schema               | MEDIUM   | S          | 🔴     | TKT-071                   |
| TKT-073 | RunResult Message Schema                | MEDIUM   | S          | 🔴     | TKT-071                   |
| TKT-074 | Message Deduplication (Msg-Id)          | HIGH     | M          | 🔴     | TKT-071                   |
| TKT-075 | Double Ack Pattern                      | MEDIUM   | M          | 🔴     | TKT-071                   |
| TKT-076 | Template Repository Generation          | MEDIUM   | L          | 🔴     | TKT-063                   |
| TKT-077 | Initial Setup PR Creation               | LOW      | M          | 🔴     | TKT-076                   |
| TKT-078 | Run Status Polling                      | MEDIUM   | M          | 🟢     | TKT-061                   |
| TKT-079 | Execution Mode Selection Logic          | MEDIUM   | M          | 🔴     | TKT-061, TKT-062, TKT-063 |
| TKT-080 | Fallback Strategy on Failure            | LOW      | M          | 🔴     | TKT-079                   |

---

## Payment & Billing (TKT-081 to TKT-110)

| ID      | Title                              | Priority | Complexity | Status | Dependencies     |
| ------- | ---------------------------------- | -------- | ---------- | ------ | ---------------- |
| TKT-081 | Stripe Setup & Configuration       | CRITICAL | M          | 🔴     | -                |
| TKT-082 | Stripe Tax API Integration         | HIGH     | L          | 🔴     | TKT-081          |
| TKT-083 | Stripe Connect (Revenue Split)     | HIGH     | L          | 🔴     | TKT-081          |
| TKT-084 | Metered Subscriptions              | HIGH     | M          | 🔴     | TKT-081          |
| TKT-085 | Usage Records API                  | HIGH     | M          | 🔴     | TKT-084          |
| TKT-086 | Billing Thresholds                 | MEDIUM   | M          | 🔴     | TKT-084          |
| TKT-087 | Budget Cap Enforcement             | CRITICAL | M          | 🟢     | TKT-001          |
| TKT-088 | Budget Cap Pre-check (402)         | CRITICAL | M          | 🟢     | TKT-087          |
| TKT-089 | Flat Pricing (Pay-per-cast)        | HIGH     | M          | 🔴     | TKT-081          |
| TKT-090 | Setup Intent (Payment Method)      | HIGH     | M          | 🔴     | TKT-089          |
| TKT-091 | Payment Intent (Charge)            | HIGH     | M          | 🔴     | TKT-090          |
| TKT-092 | One-time Payment (Clone mode)      | MEDIUM   | M          | 🔴     | TKT-081, TKT-063 |
| TKT-093 | Stripe Checkout Integration        | MEDIUM   | M          | 🔴     | TKT-092          |
| TKT-094 | Webhook Handler (/webhooks/stripe) | HIGH     | M          | 🟢     | TKT-081          |
| TKT-095 | Webhook Signature Verification     | HIGH     | S          | 🟢     | TKT-094          |
| TKT-096 | Event Deduplication                | MEDIUM   | S          | 🔴     | TKT-094          |
| TKT-097 | Refund Automation (SLA-based)      | MEDIUM   | M          | 🔴     | TKT-081          |
| TKT-098 | Partial Refund Logic               | MEDIUM   | M          | 🔴     | TKT-097          |
| TKT-099 | Chargeback Handling                | LOW      | M          | 🔴     | TKT-081          |
| TKT-100 | Invoice Generation                 | MEDIUM   | M          | 🔴     | TKT-084          |
| TKT-101 | Receipt Email                      | LOW      | M          | 🔴     | TKT-089          |
| TKT-102 | Billing History Endpoint           | MEDIUM   | S          | 🟢     | TKT-001          |
| TKT-103 | Payment Method Management          | MEDIUM   | M          | 🔴     | TKT-090          |
| TKT-104 | Failed Payment Retry               | MEDIUM   | M          | 🔴     | TKT-091          |
| TKT-105 | Dunning Management                 | LOW      | M          | 🔴     | TKT-104          |
| TKT-106 | Currency Conversion                | LOW      | M          | 🔴     | TKT-081          |
| TKT-107 | Tax Calculation (GST/VAT)          | HIGH     | M          | 🔴     | TKT-082          |
| TKT-108 | Revenue Split Calculation          | MEDIUM   | M          | 🔴     | TKT-083          |
| TKT-109 | Payout to Makers                   | MEDIUM   | M          | 🔴     | TKT-083          |
| TKT-110 | Billing Ledger (Immutable)         | HIGH     | M          | 🔴     | TKT-001          |

---

## Compliance (TKT-111 to TKT-140)

| ID      | Title                                 | Priority | Complexity | Status | Dependencies     |
| ------- | ------------------------------------- | -------- | ---------- | ------ | ---------------- |
| TKT-111 | GDPR Data Export Endpoint             | CRITICAL | M          | 🔴     | TKT-001          |
| TKT-112 | GDPR Erasure Endpoint                 | CRITICAL | L          | 🔴     | TKT-001          |
| TKT-113 | CCPA Privacy Report                   | HIGH     | M          | 🔴     | TKT-001          |
| TKT-114 | CCPA Do-Not-Sell Flag                 | HIGH     | S          | 🔴     | TKT-001          |
| TKT-115 | Data Retention Automation             | HIGH     | L          | 🔴     | TKT-001          |
| TKT-116 | Consent Management                    | MEDIUM   | M          | 🔴     | TKT-001          |
| TKT-117 | Cross-border Transfer Tracking        | MEDIUM   | M          | 🔴     | TKT-001          |
| TKT-118 | Data Residency Selection              | LOW      | L          | 🔴     | TKT-001          |
| TKT-119 | User Profile Rectification            | MEDIUM   | S          | 🔴     | TKT-001          |
| TKT-120 | Account Suspension (without deletion) | MEDIUM   | M          | 🔴     | TKT-001          |
| TKT-121 | Data Processing Agreement (DPA)       | LOW      | S          | 🔴     | -                |
| TKT-122 | Sub-processor List                    | LOW      | S          | 🔴     | -                |
| TKT-123 | Privacy Policy Generation             | MEDIUM   | M          | 🔴     | -                |
| TKT-124 | Terms of Service                      | MEDIUM   | M          | 🔴     | -                |
| TKT-125 | Cookie Consent Banner                 | LOW      | S          | 🔴     | -                |
| TKT-126 | Data Breach Notification System       | HIGH     | M          | 🔴     | TKT-111          |
| TKT-127 | GDPR Compliance Dashboard             | LOW      | M          | 🔴     | TKT-111          |
| TKT-128 | CCPA Compliance Dashboard             | LOW      | M          | 🔴     | TKT-113          |
| TKT-129 | Japan PIPA Compliance                 | LOW      | L          | 🔴     | TKT-001          |
| TKT-130 | Anonymization Service                 | MEDIUM   | M          | 🔴     | TKT-112          |
| TKT-131 | Data Minimization Audit               | LOW      | M          | 🔴     | TKT-001          |
| TKT-132 | PII Detection & Masking               | MEDIUM   | M          | 🔴     | TKT-015          |
| TKT-133 | Right to Portability (JSON export)    | MEDIUM   | S          | 🔴     | TKT-111          |
| TKT-134 | Right to Restriction                  | MEDIUM   | M          | 🔴     | TKT-120          |
| TKT-135 | Right to Object                       | MEDIUM   | M          | 🔴     | TKT-001          |
| TKT-136 | Consent Version Tracking              | MEDIUM   | S          | 🔴     | TKT-116          |
| TKT-137 | Legal Hold Implementation             | LOW      | M          | 🔴     | TKT-115          |
| TKT-138 | Data Transfer Consent UI              | LOW      | M          | 🔴     | TKT-117          |
| TKT-139 | Regional Data Storage                 | LOW      | XL         | 🔴     | TKT-118          |
| TKT-140 | Compliance Reporting Dashboard        | LOW      | M          | 🔴     | TKT-111, TKT-113 |

---

## Observability (TKT-141 to TKT-160)

| ID      | Title                                        | Priority | Complexity | Status | Dependencies |
| ------- | -------------------------------------------- | -------- | ---------- | ------ | ------------ |
| TKT-141 | OpenTelemetry Instrumentation                | HIGH     | M          | 🔴     | -            |
| TKT-142 | Distributed Tracing (traceparent/tracestate) | HIGH     | M          | 🔴     | TKT-141      |
| TKT-143 | Prometheus Metrics Exporter                  | HIGH     | M          | 🔴     | -            |
| TKT-144 | Structured Logging (JSON)                    | HIGH     | M          | 🔴     | TKT-015      |
| TKT-145 | Audit Trail (Append-only Ledger)             | CRITICAL | L          | 🔴     | TKT-001      |
| TKT-146 | Grafana Dashboards                           | MEDIUM   | M          | 🔴     | TKT-143      |
| TKT-147 | PagerDuty Integration                        | MEDIUM   | M          | 🔴     | -            |
| TKT-148 | Alert Rules (SLO violations)                 | MEDIUM   | M          | 🔴     | TKT-143      |
| TKT-149 | Log Aggregation (Vector → S3)                | MEDIUM   | M          | 🔴     | TKT-144      |
| TKT-150 | Trace Sampling Strategy                      | LOW      | M          | 🔴     | TKT-142      |
| TKT-151 | Custom Metrics (cast.count, revenue)         | MEDIUM   | S          | 🔴     | TKT-143      |
| TKT-152 | Error Rate Monitoring                        | HIGH     | S          | 🔴     | TKT-143      |
| TKT-153 | Latency Percentiles (p50, p90, p99)          | HIGH     | S          | 🔴     | TKT-143      |
| TKT-154 | SLO Dashboard                                | MEDIUM   | M          | 🔴     | TKT-146      |
| TKT-155 | Incident Response Runbook                    | LOW      | S          | 🔴     | -            |
| TKT-156 | On-call Rotation Setup                       | LOW      | S          | 🔴     | TKT-147      |
| TKT-157 | Postmortem Template                          | LOW      | S          | 🔴     | -            |
| TKT-158 | Status Page Integration                      | LOW      | M          | 🔴     | -            |
| TKT-159 | Performance Budget Tracking                  | LOW      | M          | 🔴     | TKT-153      |
| TKT-160 | Cost Tracking Dashboard                      | LOW      | M          | 🔴     | TKT-143      |

---

## API Endpoints (TKT-161 to TKT-200)

| ID      | Title                                             | Priority | Complexity | Status | Dependencies                  |
| ------- | ------------------------------------------------- | -------- | ---------- | ------ | ----------------------------- |
| TKT-161 | POST /v1/spells (Register Spell)                  | CRITICAL | M          | 🔴     | TKT-001, TKT-003, TKT-023     |
| TKT-162 | GET /v1/spells (List Spells)                      | HIGH     | S          | 🔴     | TKT-001, TKT-003              |
| TKT-163 | GET /v1/spells/{id} (Get Spell)                   | HIGH     | S          | 🔴     | TKT-001, TKT-003              |
| TKT-164 | POST /v1/spells/{id}:cast (Cast Spell)            | CRITICAL | L          | 🔴     | TKT-001-005, TKT-061, TKT-087 |
| TKT-165 | GET /v1/casts/{id} (Get Cast Status)              | HIGH     | M          | 🔴     | TKT-001, TKT-164              |
| TKT-166 | GET /v1/casts (List User Casts)                   | MEDIUM   | S          | 🔴     | TKT-001, TKT-003              |
| TKT-167 | GET /v1/spells/{id}/sbom (Get SBOM)               | MEDIUM   | S          | 🔴     | TKT-023, TKT-035              |
| TKT-168 | GET /v1/users/me (Get User Profile)               | MEDIUM   | S          | 🔴     | TKT-001, TKT-003              |
| TKT-169 | PATCH /v1/users/me (Update Profile)               | MEDIUM   | S          | 🔴     | TKT-001, TKT-003              |
| TKT-170 | DELETE /v1/users/me (Delete Account)              | HIGH     | M          | 🔴     | TKT-001, TKT-112              |
| TKT-171 | GET /v1/users/me/data-export (GDPR Export)        | HIGH     | M          | 🔴     | TKT-111                       |
| TKT-172 | PATCH /v1/users/me/preferences (Privacy Settings) | MEDIUM   | S          | 🔴     | TKT-001, TKT-116              |
| TKT-173 | GET /v1/users/me/privacy/data-transfers           | LOW      | M          | 🔴     | TKT-117                       |
| TKT-174 | POST /v1/billing/caps (Set Budget Cap)            | HIGH     | M          | 🔴     | TKT-087                       |
| TKT-175 | GET /v1/billing/usage (Get Usage)                 | MEDIUM   | S          | 🔴     | TKT-001, TKT-087              |
| TKT-176 | POST /v1/billing/usage (Report Usage)             | MEDIUM   | M          | 🔴     | TKT-085                       |
| TKT-177 | POST /v1/webhooks/stripe (Stripe Webhook)         | HIGH     | M          | 🔴     | TKT-094                       |
| TKT-178 | GET /v1/catalog/spells (Browse Catalog)           | MEDIUM   | M          | 🔴     | TKT-162                       |
| TKT-179 | POST /v1/catalog/spells/{id}/purchase (Buy Clone) | MEDIUM   | M          | 🔴     | TKT-063, TKT-092              |
| TKT-180 | GET /v1/health (Health Check)                     | HIGH     | S          | 🔴     | TKT-016                       |
| TKT-181 | GET /v1/ready (Readiness Probe)                   | HIGH     | S          | 🔴     | TKT-017                       |
| TKT-182 | GET /v1/metrics (Prometheus Metrics)              | MEDIUM   | S          | 🔴     | TKT-143                       |
| TKT-183 | MCP Server Implementation (stdio/WS)              | MEDIUM   | L          | 🔴     | TKT-162, TKT-164              |
| TKT-184 | MCP Tool: spells.list                             | MEDIUM   | M          | 🔴     | TKT-183                       |
| TKT-185 | MCP Tool: spells.detail                           | MEDIUM   | S          | 🔴     | TKT-183                       |
| TKT-186 | MCP Tool: spells.cast (streaming)                 | MEDIUM   | L          | 🔴     | TKT-183, TKT-164              |
| TKT-187 | MCP Resource: artifact://{run_id}                 | LOW      | M          | 🔴     | TKT-183, TKT-069              |
| TKT-188 | OpenAPI 3.1 Spec Generation                       | MEDIUM   | M          | 🔴     | All API endpoints             |
| TKT-189 | API Documentation Site                            | LOW      | M          | 🔴     | TKT-188                       |
| TKT-190 | SDK Generation (TypeScript)                       | LOW      | L          | 🔴     | TKT-188                       |
| TKT-191 | SDK Generation (Python)                           | LOW      | L          | 🔴     | TKT-188                       |
| TKT-192 | SDK Generation (Go)                               | LOW      | L          | 🔴     | TKT-188                       |
| TKT-193 | CLI Tool (spell-cli)                              | MEDIUM   | L          | 🔴     | TKT-190                       |
| TKT-194 | CLI: spell cast                                   | MEDIUM   | M          | 🔴     | TKT-193                       |
| TKT-195 | CLI: spell logs                                   | MEDIUM   | M          | 🔴     | TKT-193                       |
| TKT-196 | CLI: spell cap set                                | MEDIUM   | M          | 🔴     | TKT-193                       |
| TKT-197 | CLI: spell publish                                | MEDIUM   | M          | 🔴     | TKT-193, TKT-161              |
| TKT-198 | CLI: spell sbom generate                          | LOW      | M          | 🔴     | TKT-193, TKT-022              |
| TKT-199 | CLI: spell sign                                   | LOW      | M          | 🔴     | TKT-193, TKT-021              |
| TKT-200 | CLI: spell test (conformance)                     | LOW      | M          | 🔴     | TKT-193                       |

---

## Testing & QA (TKT-201 to TKT-220)

| ID      | Title                             | Priority | Complexity | Status | Dependencies         |
| ------- | --------------------------------- | -------- | ---------- | ------ | -------------------- |
| TKT-201 | Unit Test Framework Setup         | CRITICAL | S          | 🔴     | -                    |
| TKT-202 | Integration Test Suite (DB)       | HIGH     | M          | 🔴     | TKT-001, TKT-201     |
| TKT-203 | Integration Test Suite (API)      | HIGH     | M          | 🔴     | TKT-161-180, TKT-201 |
| TKT-204 | E2E Test: Workflow Mode Cast      | CRITICAL | L          | 🔴     | TKT-061, TKT-164     |
| TKT-205 | E2E Test: Service Mode Cast       | HIGH     | L          | 🔴     | TKT-062, TKT-164     |
| TKT-206 | E2E Test: Clone Mode Purchase     | MEDIUM   | M          | 🔴     | TKT-063, TKT-179     |
| TKT-207 | E2E Test: Budget Cap Enforcement  | HIGH     | M          | 🔴     | TKT-087, TKT-164     |
| TKT-208 | E2E Test: SBOM Validation         | HIGH     | M          | 🔴     | TKT-023, TKT-161     |
| TKT-209 | E2E Test: Sigstore Verification   | HIGH     | M          | 🔴     | TKT-021, TKT-161     |
| TKT-210 | E2E Test: GDPR Data Export        | HIGH     | M          | 🔴     | TKT-111              |
| TKT-211 | Load Test Setup (k6)              | MEDIUM   | M          | 🔴     | TKT-164              |
| TKT-212 | Load Test: 1000 req/s             | MEDIUM   | S          | 🔴     | TKT-211              |
| TKT-213 | Load Test: 10000 concurrent casts | MEDIUM   | M          | 🔴     | TKT-211              |
| TKT-214 | Security Audit Preparation        | HIGH     | M          | 🔴     | All                  |
| TKT-215 | Penetration Testing               | MEDIUM   | L          | 🔴     | TKT-214              |
| TKT-216 | OWASP Top 10 Compliance Check     | HIGH     | M          | 🔴     | TKT-214              |
| TKT-217 | Conformance CLI Tool              | LOW      | M          | 🔴     | TKT-200              |
| TKT-218 | CI/CD Pipeline Setup              | HIGH     | M          | 🔴     | TKT-201              |
| TKT-219 | Automated Deployment (Staging)    | MEDIUM   | M          | 🔴     | TKT-218              |
| TKT-220 | Automated Deployment (Production) | MEDIUM   | M          | 🔴     | TKT-219              |

---

## Summary Statistics

### By Priority

- **CRITICAL**: 19 tickets
- **HIGH**: 87 tickets
- **MEDIUM**: 89 tickets
- **LOW**: 25 tickets

### By Complexity

- **XL (Extra Large)**: 2 tickets
- **L (Large)**: 38 tickets
- **M (Medium)**: 125 tickets
- **S (Small)**: 55 tickets

### By Category

- **Foundation**: 20 tickets
- **Security & Supply Chain**: 20 tickets
- **WASM Runtime**: 20 tickets
- **Execution Modes**: 20 tickets
- **Payment & Billing**: 30 tickets
- **Compliance**: 30 tickets
- **Observability**: 20 tickets
- **API Endpoints**: 40 tickets
- **Testing & QA**: 20 tickets

---

## Critical Path (MVP)

### Phase 0: Foundation (Weeks 1-2)

1. TKT-001: Database Schema
2. TKT-002: Core Data Models
3. TKT-003: Authentication
4. TKT-004: Rate Limiting
5. TKT-005: Idempotency
6. TKT-006: Error Catalog

### Phase 1: Core Execution (Weeks 3-4)

7. TKT-041: WASM Module Loader
8. TKT-042: WASI Sandbox
9. TKT-043: Resource Limits
10. TKT-061: Workflow Mode
11. TKT-062: Service Mode
12. TKT-087: Budget Cap Enforcement

### Phase 2: Security & Payment (Weeks 5-6)

13. TKT-021: Sigstore Integration
14. TKT-022: SBOM Generation
15. TKT-023: SBOM Validation
16. TKT-081: Stripe Setup
17. TKT-089: Flat Pricing
18. TKT-111: GDPR Data Export

### Phase 3: API & Testing (Weeks 7-8)

19. TKT-161: POST /v1/spells
20. TKT-164: POST /v1/spells/{id}:cast
21. TKT-202: Integration Tests
22. TKT-204: E2E Workflow Test
23. TKT-211: Load Testing
24. TKT-220: Production Deployment

---

## Next Steps

1. **Review & Prioritize**: Team reviews ticket list and adjusts priorities
2. **Estimate & Plan**: Assign story points and sprint planning
3. **Start Foundation**: Begin with TKT-001 to TKT-006
4. **Parallel Tracks**: Security and Runtime can be developed in parallel after foundation
5. **Continuous Integration**: Set up CI/CD early (TKT-218)
6. **Iterative Releases**: Ship MVP after Phase 3, iterate with remaining features

---

**Document Status**: Draft
**Last Updated**: 2025-11-07
**Next Review**: Weekly during implementation
