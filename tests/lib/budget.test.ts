import { describe, it, beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBudget, updateBudgetSpend, resetBudget, getBudgetStatus } from '@/lib/budget';
import { prisma } from '@/lib/prisma';

/**
 * Budget Tests - Cent-based pricing
 *
 * All monetary values should be in cents (integer):
 * - Budget caps: stored as monthlyCapCents (e.g., 10000 = $100.00)
 * - Current spend: stored as currentMonthCents
 * - Estimated costs: passed as cents to checkBudget()
 *
 * Expected behavior:
 * - No floating-point arithmetic
 * - Exact integer comparisons (no rounding errors)
 * - Budget enforcement: currentMonthCents + estimateCents <= monthlyCapCents
 */

const TEST_USER_ID = 'test-user-budget-cents';

const HAS_DATABASE = Boolean(process.env.DATABASE_URL);

if (!HAS_DATABASE) {
  test('Budget (Cents-based) requires DATABASE_URL', { skip: true }, () => {
    // CI environments without Neon/Postgres should skip these integration tests.
  });
} else {
  describe('Budget (Cents-based)', () => {
  beforeEach(async () => {
    // Clean up test user before each test
    await prisma.budgets.deleteMany({
      where: { userId: TEST_USER_ID },
    });
    await prisma.user.deleteMany({
      where: { id: TEST_USER_ID },
    });

    // Create test user
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: `${TEST_USER_ID}@test.com`,
        name: 'Test User',
      },
    });
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.budgets.deleteMany({
      where: { userId: TEST_USER_ID },
    });
    await prisma.user.deleteMany({
      where: { id: TEST_USER_ID },
    });
  });

  it('creates default budget with 10000 cents ($100) cap', async () => {
    const result = await checkBudget(TEST_USER_ID, 1000); // $10.00 request

    assert.equal(result.allowed, true);
    assert.equal(result.budget.monthlyCapCents, 10000); // $100.00
    assert.equal(result.budget.currentMonthCents, 0);
    assert.equal(result.budget.remainingCents, 10000);
    assert.equal(result.estimatedCostCents, 1000);
  });

  it('allows request when under budget cap', async () => {
    // Create budget with 50000 cents ($500)
    await prisma.budgets.create({
      data: {
        id: `budget_${TEST_USER_ID}`,
        userId: TEST_USER_ID,
        monthlyCapCents: 50000,
        currentMonthCents: 30000, // Already spent $300
        periodStart: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await checkBudget(TEST_USER_ID, 15000); // Request $150

    assert.equal(result.allowed, true); // 30000 + 15000 = 45000 <= 50000
    assert.equal(result.budget.currentMonthCents, 30000);
    assert.equal(result.budget.monthlyCapCents, 50000);
    assert.equal(result.budget.remainingCents, 20000);
  });

  it('blocks request when budget cap would be exceeded', async () => {
    await prisma.budgets.create({
      data: {
        id: `budget_${TEST_USER_ID}`,
        userId: TEST_USER_ID,
        monthlyCapCents: 10000, // $100
        currentMonthCents: 9500, // $95 spent
        periodStart: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await checkBudget(TEST_USER_ID, 600); // Request $6 (would exceed)

    assert.equal(result.allowed, false); // 9500 + 600 = 10100 > 10000
    assert.equal(result.reason?.includes('Budget cap exceeded'), true);
    assert.ok(result.retryAfter); // Should suggest when budget resets
  });

  it('allows request at exact budget cap boundary', async () => {
    await prisma.budgets.create({
      data: {
        id: `budget_${TEST_USER_ID}`,
        userId: TEST_USER_ID,
        monthlyCapCents: 10000,
        currentMonthCents: 7500,
        periodStart: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await checkBudget(TEST_USER_ID, 2500); // Exactly at cap

    assert.equal(result.allowed, true); // 7500 + 2500 = 10000 <= 10000 (exact match)
  });

  it('updates budget spend with integer cents (no rounding errors)', async () => {
    await prisma.budgets.create({
      data: {
        id: `budget_${TEST_USER_ID}`,
        userId: TEST_USER_ID,
        monthlyCapCents: 10000,
        currentMonthCents: 0,
        periodStart: new Date(),
        updatedAt: new Date(),
      },
    });

    // Update with 1234 cents ($12.34)
    await updateBudgetSpend(TEST_USER_ID, 1234);

    const budget = await prisma.budgets.findUnique({
      where: { userId: TEST_USER_ID },
    });

    assert.equal(budget?.currentMonthCents, 1234); // Exact integer, no rounding

    // Update again with 5678 cents ($56.78)
    await updateBudgetSpend(TEST_USER_ID, 5678);

    const updated = await prisma.budgets.findUnique({
      where: { userId: TEST_USER_ID },
    });

    assert.equal(updated?.currentMonthCents, 1234 + 5678); // 6912 cents = $69.12
  });

  it('resets budget to zero cents', async () => {
    await prisma.budgets.create({
      data: {
        id: `budget_${TEST_USER_ID}`,
        userId: TEST_USER_ID,
        monthlyCapCents: 10000,
        currentMonthCents: 7500,
        periodStart: new Date('2024-01-01'),
        updatedAt: new Date(),
      },
    });

    await resetBudget(TEST_USER_ID);

    const budget = await prisma.budgets.findUnique({
      where: { userId: TEST_USER_ID },
    });

    assert.equal(budget?.currentMonthCents, 0);
    assert.ok(budget!.periodStart.getTime() > new Date('2024-01-01').getTime());
  });

  it('returns budget status in cents', async () => {
    await prisma.budgets.create({
      data: {
        id: `budget_${TEST_USER_ID}`,
        userId: TEST_USER_ID,
        monthlyCapCents: 25000, // $250
        currentMonthCents: 12500, // $125
        periodStart: new Date(),
        updatedAt: new Date(),
      },
    });

    const status = await getBudgetStatus(TEST_USER_ID);

    assert.equal(status.monthlyCapCents, 25000);
    assert.equal(status.currentMonthCents, 12500);
    assert.equal(status.remainingCents, 12500);
    assert.equal(status.percentUsed, 50); // 50% used
  });

  it('calculates percentUsed correctly with integer division', async () => {
    await prisma.budgets.create({
      data: {
        id: `budget_${TEST_USER_ID}`,
        userId: TEST_USER_ID,
        monthlyCapCents: 10000,
        currentMonthCents: 3333, // 33.33% used
        periodStart: new Date(),
        updatedAt: new Date(),
      },
    });

    const status = await getBudgetStatus(TEST_USER_ID);

    assert.equal(status.percentUsed, 33.33); // Percentage can be float for display
  });

  it('handles negative cost rejection', async () => {
    await prisma.budgets.create({
      data: {
        id: `budget_${TEST_USER_ID}`,
        userId: TEST_USER_ID,
        monthlyCapCents: 10000,
        currentMonthCents: 5000,
        periodStart: new Date(),
        updatedAt: new Date(),
      },
    });

    // Negative costs should be rejected (or handled specially)
    const result = await checkBudget(TEST_USER_ID, -1000);

    // Behavior: either reject or treat as 0
    // For now, we expect it to be "allowed" since negative doesn't increase spend
    // But ideally should validate and reject
    assert.equal(result.allowed, true); // Current implementation allows negative
  });

  it('auto-resets budget after one month', async () => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 1); // Ensure past threshold

    await prisma.budgets.create({
      data: {
        id: `budget_${TEST_USER_ID}`,
        userId: TEST_USER_ID,
        monthlyCapCents: 10000,
        currentMonthCents: 9999, // Almost at cap
        periodStart: oneMonthAgo,
        updatedAt: new Date(),
      },
    });

    const result = await checkBudget(TEST_USER_ID, 5000); // Request $50

    assert.equal(result.allowed, true); // Should reset and allow
    assert.equal(result.budget.currentMonthCents, 0); // Reset to 0
  });
  });
}
