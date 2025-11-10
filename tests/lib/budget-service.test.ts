import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { BudgetService } from '@/lib/budget';

type BudgetRecord = {
  id: string;
  userId: string;
  monthlyCapCents: number | null;
  currentMonthCents: number;
  periodStart: Date;
  updatedAt: Date;
};

class MockBudgetsTable {
  private store = new Map<string, BudgetRecord>();

  async findUnique(params: { where: { userId: string } }) {
    return this.store.get(params.where.userId) ?? null;
  }

  async create(params: { data: BudgetRecord }) {
    const record = { ...params.data };
    this.store.set(record.userId, record);
    return record;
  }

  async update(params: { where: { userId: string }; data: Partial<BudgetRecord> & { currentMonthCents?: { increment: number } | number } }) {
    const existing = this.store.get(params.where.userId);
    if (!existing) {
      throw new Error('Record not found');
    }

    const next: BudgetRecord = { ...existing };

    if (params.data.currentMonthCents !== undefined) {
      if (typeof params.data.currentMonthCents === 'number') {
        next.currentMonthCents = params.data.currentMonthCents;
      } else if ('increment' in params.data.currentMonthCents) {
        next.currentMonthCents += params.data.currentMonthCents.increment;
      }
    }

    if (params.data.monthlyCapCents !== undefined) {
      next.monthlyCapCents = params.data.monthlyCapCents ?? null;
    }

    if (params.data.periodStart) {
      next.periodStart = params.data.periodStart;
    }

    if (params.data.updatedAt) {
      next.updatedAt = params.data.updatedAt;
    }

    this.store.set(next.userId, next);
    return next;
  }

  seed(userId: string, record: Partial<BudgetRecord>) {
    const base: BudgetRecord = {
      id: `budget_${userId}`,
      userId,
      monthlyCapCents: record.monthlyCapCents ?? 10000,
      currentMonthCents: record.currentMonthCents ?? 0,
      periodStart: record.periodStart ?? new Date(),
      updatedAt: record.updatedAt ?? new Date(),
    };
    this.store.set(userId, base);
    return base;
  }
}

class MockPrismaClient {
  budgets = new MockBudgetsTable();
}

describe('BudgetService', () => {
  let mockPrisma: MockPrismaClient;
  let service: BudgetService;

  beforeEach(() => {
    mockPrisma = new MockPrismaClient();
    service = new BudgetService(mockPrisma as unknown as any);
  });

  it('creates default budget and enforces cap', async () => {
    const result = await service.checkBudget('user-1', 5000);
    assert.equal(result.allowed, true);
    assert.equal(result.budget.monthlyCapCents, 10000);

    const overCap = await service.checkBudget('user-1', 6000);
    assert.equal(overCap.allowed, false);
    assert.ok(overCap.reason?.includes('Budget cap exceeded'));
  });

  it('resets monthly spend when period changes', async () => {
    const oldDate = new Date('2024-01-01T00:00:00.000Z');
    mockPrisma.budgets.seed('user-2', {
      currentMonthCents: 8000,
      periodStart: oldDate,
    });

    const status = await service.getBudgetStatus('user-2');
    assert.equal(status.currentMonthCents, 0);
    assert.equal(status.percentUsed, 0);
  });

  it('increments spend and returns updated remaining balance', async () => {
    await service.checkBudget('user-3', 1000);
    await service.updateBudgetSpend('user-3', 4000);
    const status = await service.getBudgetStatus('user-3');
    assert.equal(status.currentMonthCents, 4000);
    assert.equal(status.remainingCents, status.monthlyCapCents - 4000);
  });
});
