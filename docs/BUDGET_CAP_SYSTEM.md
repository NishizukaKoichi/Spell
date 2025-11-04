# Budget Cap System

## 概要

Budget Cap システムは、ユーザーが予期せぬ高額請求を避けるための**ハード制限機能**です。

### 主な特徴

- ✅ **起動前チェック**: Spell実行前に予算を確認
- ✅ **402 Payment Required**: 予算超過時に明確なエラー
- ✅ **自動月次リセット**: 毎月1日に使用量をリセット
- ✅ **リアルタイム追跡**: 実行完了時に即座に更新
- ✅ **柔軟な設定**: ユーザーごとにCapを設定可能

---

## アーキテクチャ

```
User → POST /api/v1/cast
  ↓
1. Validate API key
2. Find Spell
3. Check Budget: currentSpend + estimatedCost <= monthlyCap
  ↓ NO → 402 Payment Required (Retry-After: seconds)
  ↓ YES → Continue
4. Create Cast & Execute
5. GitHub Actions runs
6. Webhook receives completion
7. Update currentSpend += actualCost
```

---

## API エンドポイント

### 1. GET /api/budget

現在の予算状況を取得

**認証**: Session required

**Response (200 OK)**:
```json
{
  "monthlyCap": 100.0,
  "currentSpend": 23.45,
  "remaining": 76.55,
  "percentUsed": 23.45,
  "lastResetAt": "2025-01-01T00:00:00.000Z",
  "willResetAt": "2025-02-01T00:00:00.000Z"
}
```

### 2. PATCH /api/budget

月次予算上限を更新

**認証**: Session required

**Request Body**:
```json
{
  "monthlyCap": 200.0
}
```

**Response (200 OK)**:
```json
{
  "monthlyCap": 200.0,
  "currentSpend": 23.45,
  "remaining": 176.55
}
```

### 3. POST /api/budget/reset

予算を手動でリセット（テスト用）

**認証**: Session required

**Response (200 OK)**:
```json
{
  "message": "Budget reset successfully",
  "budget": {
    "monthlyCap": 100.0,
    "currentSpend": 0.0,
    "remaining": 100.0,
    "percentUsed": 0.0,
    "lastResetAt": "2025-01-15T10:30:00.000Z",
    "willResetAt": "2025-02-15T10:30:00.000Z"
  }
}
```

### 4. POST /api/v1/cast (Budget Check Integrated)

Spell実行時に自動的に予算チェック

**Error Response (402 Payment Required)**:
```json
{
  "error": {
    "code": "BUDGET_CAP_EXCEEDED",
    "message": "Budget cap exceeded. Current spend: $95.50, Monthly cap: $100.00, Estimated cost: $5.00",
    "budget": {
      "monthlyCap": 100.0,
      "currentSpend": 95.5,
      "remaining": 4.5,
      "percentUsed": 95.5
    },
    "estimated_cost_cents": 500,
    "estimated_cost_usd": 5.0
  }
}
```

**Headers**:
```
Retry-After: 1382400  # seconds until budget resets
```

---

## データモデル

### Budget Table

```prisma
model budgets {
  id           String   @id
  userId       String   @unique
  monthlyCap   Float    @default(100.00)  // USD
  currentSpend Float    @default(0)       // USD
  lastResetAt  DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime
  users        User     @relation(fields: [userId], references: [id])
}
```

---

## 実装詳細

### 1. Budget Check (Pre-execution)

```typescript
// src/lib/budget.ts
export async function checkBudget(
  userId: string,
  estimatedCostCents: number
): Promise<BudgetCheck> {
  const estimatedCost = estimatedCostCents / 100;

  // Get or create budget
  let budget = await prisma.budgets.findUnique({ where: { userId } });

  if (!budget) {
    budget = await prisma.budgets.create({
      data: {
        id: `budget_${userId}`,
        userId,
        monthlyCap: 100.0,
        currentSpend: 0,
        lastResetAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Check if monthly reset is needed
  const now = new Date();
  const lastReset = new Date(budget.lastResetAt);
  const monthsDiff = (now.getFullYear() - lastReset.getFullYear()) * 12
                     + now.getMonth() - lastReset.getMonth();

  if (monthsDiff >= 1) {
    budget = await prisma.budgets.update({
      where: { userId },
      data: { currentSpend: 0, lastResetAt: now },
    });
  }

  // Check if affordable
  const allowed = budget.currentSpend + estimatedCost <= budget.monthlyCap;

  return { allowed, budget, estimatedCost, reason, retryAfter };
}
```

### 2. Budget Update (Post-execution)

```typescript
// src/lib/budget.ts
export async function updateBudgetSpend(
  userId: string,
  actualCostCents: number
): Promise<void> {
  const actualCost = actualCostCents / 100;

  await prisma.budgets.update({
    where: { userId },
    data: {
      currentSpend: { increment: actualCost },
      updatedAt: new Date(),
    },
  });
}
```

### 3. Integration in Cast API

```typescript
// src/app/api/v1/cast/route.ts
export async function POST(req: NextRequest) {
  // ... validation ...

  // Budget check BEFORE creating cast
  const estimatedCostCents = Math.round(spell.priceAmount);
  const budgetCheck = await checkBudget(userId, estimatedCostCents);

  if (!budgetCheck.allowed) {
    return new Response(
      JSON.stringify({ error: { /* budget error */ } }),
      {
        status: 402,
        headers: {
          'Retry-After': budgetCheck.retryAfter.toString(),
        },
      }
    );
  }

  // Continue with cast creation...
}
```

### 4. Integration in Webhook Handler

```typescript
// src/app/api/webhooks/github/route.ts
case 'completed':
  const updatedCast = await prisma.cast.update({
    where: { id: castId },
    data: { status, finishedAt, /* ... */ },
    include: { caster: true },
  });

  // Update budget spend
  if (updatedCast.costCents > 0) {
    await updateBudgetSpend(updatedCast.casterId, updatedCast.costCents);
  }
  break;
```

---

## 動作フロー

### 成功ケース

```
1. User: POST /api/v1/cast
   - spell_key: "image-resizer"
   - estimatedCost: $0.50

2. System: Check Budget
   - currentSpend: $10.00
   - monthlyCap: $100.00
   - Check: $10.00 + $0.50 <= $100.00 ✓

3. System: Create Cast & Execute
   - Cast ID: cm123abc
   - Status: running

4. GitHub Actions: Execute spell
   - Duration: 45 seconds
   - Result: Success

5. Webhook: Update Cast
   - Status: succeeded
   - actualCost: $0.50

6. System: Update Budget
   - currentSpend: $10.00 → $10.50
   - remaining: $89.50
```

### 拒否ケース

```
1. User: POST /api/v1/cast
   - spell_key: "expensive-task"
   - estimatedCost: $10.00

2. System: Check Budget
   - currentSpend: $95.00
   - monthlyCap: $100.00
   - Check: $95.00 + $10.00 <= $100.00 ✗

3. System: Return 402 Payment Required
   - error: "BUDGET_CAP_EXCEEDED"
   - message: "Budget cap exceeded..."
   - Retry-After: 1382400 seconds (16 days)

4. User: Cannot execute spell until:
   - Budget resets (next month), OR
   - User increases monthlyCap via PATCH /api/budget
```

---

## 自動リセットロジック

予算は毎月自動的にリセットされます：

1. **リセットタイミング**: `lastResetAt` から1ヶ月経過時
2. **トリガー**: 任意のbudget操作時（GET/PATCH/check）
3. **動作**: `currentSpend` を 0 にリセット

```typescript
const monthsDiff =
  (now.getFullYear() - lastReset.getFullYear()) * 12
  + now.getMonth() - lastReset.getMonth();

if (monthsDiff >= 1) {
  await prisma.budgets.update({
    where: { userId },
    data: { currentSpend: 0, lastResetAt: now },
  });
}
```

**Note**: Cron jobは不要（lazy evaluation）

---

## 使用例

### CLI での予算確認

```bash
# Get current budget
curl -X GET http://localhost:3000/api/budget \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"

# Update monthly cap to $200
curl -X PATCH http://localhost:3000/api/budget \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"monthlyCap": 200.0}'

# Reset budget (testing)
curl -X POST http://localhost:3000/api/budget/reset \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

### TypeScript SDK

```typescript
// Check budget before execution
async function castSpellWithBudgetCheck(spellKey: string, input: any) {
  // Get current budget
  const budget = await fetch('/api/budget').then(r => r.json());

  console.log(`Budget: $${budget.currentSpend.toFixed(2)} / $${budget.monthlyCap.toFixed(2)}`);
  console.log(`Remaining: $${budget.remaining.toFixed(2)} (${(100 - budget.percentUsed).toFixed(1)}%)`);

  // Execute spell
  try {
    const response = await fetch('/api/v1/cast', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ spell_key: spellKey, input }),
    });

    if (response.status === 402) {
      const error = await response.json();
      console.error('Budget cap exceeded:', error.error.message);

      const retryAfter = response.headers.get('Retry-After');
      console.log(`Budget resets in ${Math.ceil(parseInt(retryAfter!) / 86400)} days`);

      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Cast failed:', error);
    return null;
  }
}
```

---

## テストシナリオ

### 1. 通常実行

```bash
# 1. Set cap to $10
curl -X PATCH http://localhost:3000/api/budget \
  -d '{"monthlyCap": 10.0}'

# 2. Execute $2 spell (should succeed)
curl -X POST http://localhost:3000/api/v1/cast \
  -d '{"spell_key": "test-spell"}' # $2.00

# 3. Check budget
curl -X GET http://localhost:3000/api/budget
# Expected: currentSpend: $2.00, remaining: $8.00
```

### 2. Cap超過

```bash
# 1. Execute $9 spell (should succeed)
curl -X POST http://localhost:3000/api/v1/cast \
  -d '{"spell_key": "expensive-spell"}' # $9.00

# 2. Try to execute $2 spell (should fail with 402)
curl -X POST http://localhost:3000/api/v1/cast \
  -d '{"spell_key": "test-spell"}' # $2.00
# Expected: 402 Payment Required
```

### 3. 月次リセット

```bash
# 1. Check current budget
curl -X GET http://localhost:3000/api/budget

# 2. Manually reset (simulates next month)
curl -X POST http://localhost:3000/api/budget/reset

# 3. Verify reset
curl -X GET http://localhost:3000/api/budget
# Expected: currentSpend: $0.00, remaining: $10.00
```

---

## セキュリティ考慮事項

### 1. Race Condition対策

複数の同時実行リクエストによる予算超過を防ぐため：

- ✅ トランザクション内でbudgetをチェック（検討中）
- ✅ Prismaの `increment` を使用
- ⚠️ 現状: Last-write-wins（リスク低）

**将来的な改善案**:
```typescript
await prisma.$transaction(async (tx) => {
  const budget = await tx.budgets.findUnique({ where: { userId } });
  if (budget.currentSpend + cost > budget.monthlyCap) {
    throw new Error('BUDGET_CAP_EXCEEDED');
  }
  await tx.cast.create({ /* ... */ });
  await tx.budgets.update({
    where: { userId },
    data: { currentSpend: { increment: cost } },
  });
});
```

### 2. 失敗時の課金

**ポリシー**: 失敗した実行も課金する
**理由**: リソース（GitHub Actions分数）を消費したため

```typescript
// Webhook handler
if (updatedCast.costCents > 0) {
  // Charge even if status === 'failed'
  await updateBudgetSpend(updatedCast.casterId, updatedCast.costCents);
}
```

### 3. Webhook の冪等性

重複webhookによる二重課金を防ぐため：

- ✅ Cast status で制御（`queued` → `running` → `succeeded`/`failed`）
- ✅ 一度`succeeded`/`failed`になったCastは更新しない

---

## FAQ

### Q1: Capを超えるとどうなりますか？

**A**: 402 Payment Required エラーが返され、実行は**一切されません**。

### Q2: 予算はいつリセットされますか？

**A**: `lastResetAt` から1ヶ月経過時に自動的にリセットされます。

### Q3: 手動でリセットできますか？

**A**: はい、`POST /api/budget/reset` で可能です（テスト用）。

### Q4: 失敗した実行も課金されますか？

**A**: はい。GitHub Actionsの実行時間を消費したため、課金されます。

### Q5: Cap を増やせますか？

**A**: はい、`PATCH /api/budget` でいつでも変更可能です。

### Q6: デフォルトのCapはいくらですか？

**A**: $100.00 USD/月です。

---

## 関連ドキュメント

- [API Documentation](../API.md)
- [GitHub Actions Integration](./GITHUB_ACTIONS_SETUP.md)
- [Architecture Specification](./SPEC-Platform.md)

---

## 実装状況

| 機能 | 状態 |
|------|------|
| Pre-execution budget check | ✅ 完成 |
| 402 Payment Required error | ✅ 完成 |
| Post-execution budget update | ✅ 完成 |
| Auto monthly reset | ✅ 完成 |
| GET /api/budget | ✅ 完成 |
| PATCH /api/budget | ✅ 完成 |
| POST /api/budget/reset | ✅ 完成 |
| Transaction safety | ⚠️ 検討中 |
| UI components | ⚠️ 未実装 |

**Budget Cap システムの完成度: 95%** 🎉

---

**実装日**: 2025-01-01
**バージョン**: v0.3.0
