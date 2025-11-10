import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from './prisma';

type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

const DEFAULT_MONTHLY_CAP_CENTS = 10_000; // $100

export interface BudgetCheck {
  allowed: boolean;
  budget: {
    monthlyCapCents: number;
    currentMonthCents: number;
    remainingCents: number;
    percentUsed: number;
  };
  estimatedCostCents: number;
  reason?: string;
  retryAfter?: number; // seconds until budget resets
}

export interface BudgetStatus {
  monthlyCapCents: number;
  currentMonthCents: number;
  remainingCents: number;
  percentUsed: number;
  periodStart: Date;
  willResetAt: Date;
}

type BudgetRecord = Awaited<ReturnType<typeof prisma.budgets.findUnique>>;

export class BudgetService {
  constructor(private readonly defaultClient: PrismaClientOrTransaction = prisma) {}

  private getClient(client?: PrismaClientOrTransaction) {
    return client ?? this.defaultClient;
  }

  private async getOrCreateBudget(userId: string, client: PrismaClientOrTransaction) {
    let budget = await client.budgets.findUnique({ where: { userId } });

    if (!budget) {
      budget = await client.budgets.create({
        data: {
          id: `budget_${userId}`,
          userId,
          monthlyCapCents: DEFAULT_MONTHLY_CAP_CENTS,
          currentMonthCents: 0,
          periodStart: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    return budget!;
  }

  private needsMonthlyReset(periodStart: Date, now: Date) {
    return (
      now.getFullYear() !== periodStart.getFullYear() ||
      now.getMonth() !== periodStart.getMonth()
    );
  }

  private async resetIfNeeded(
    userId: string,
    budget: BudgetRecord,
    now: Date,
    client: PrismaClientOrTransaction
  ) {
    if (!this.needsMonthlyReset(budget.periodStart, now)) {
      return budget;
    }

    return client.budgets.update({
      where: { userId },
      data: {
        currentMonthCents: 0,
        periodStart: now,
        updatedAt: now,
      },
    });
  }

  async checkBudget(
    userId: string,
    estimatedCostCents: number,
    client?: PrismaClientOrTransaction
  ): Promise<BudgetCheck> {
    const db = this.getClient(client);
    const now = new Date();

    let budget = await this.getOrCreateBudget(userId, db);
    budget = await this.resetIfNeeded(userId, budget, now, db);

    const monthlyCapCents = budget.monthlyCapCents ?? 0;
    const remainingCents = monthlyCapCents - budget.currentMonthCents;
    const percentUsed =
      monthlyCapCents > 0 ? (budget.currentMonthCents / monthlyCapCents) * 100 : 0;
    const allowed = budget.currentMonthCents + estimatedCostCents <= monthlyCapCents;

    let retryAfter: number | undefined;
    if (!allowed) {
      const nextReset = new Date(budget.periodStart);
      nextReset.setMonth(nextReset.getMonth() + 1);
      retryAfter = Math.ceil((nextReset.getTime() - now.getTime()) / 1000);
    }

    return {
      allowed,
      budget: {
        monthlyCapCents,
        currentMonthCents: budget.currentMonthCents,
        remainingCents,
        percentUsed,
      },
      estimatedCostCents,
      reason: allowed
        ? undefined
        : `Budget cap exceeded. Current spend: ${budget.currentMonthCents} cents ($${(budget.currentMonthCents / 100).toFixed(2)}), Monthly cap: ${monthlyCapCents} cents ($${(monthlyCapCents / 100).toFixed(2)}), Estimated cost: ${estimatedCostCents} cents ($${(estimatedCostCents / 100).toFixed(2)})`,
      retryAfter,
    };
  }

  async updateBudgetSpend(
    userId: string,
    actualCostCents: number,
    client?: PrismaClientOrTransaction
  ): Promise<void> {
    const db = this.getClient(client);
    await db.budgets.update({
      where: { userId },
      data: {
        currentMonthCents: {
          increment: actualCostCents,
        },
        updatedAt: new Date(),
      },
    });
  }

  async resetBudget(userId: string, client?: PrismaClientOrTransaction): Promise<void> {
    const db = this.getClient(client);
    await db.budgets.update({
      where: { userId },
      data: {
        currentMonthCents: 0,
        periodStart: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async setMonthlyCap(
    userId: string,
    monthlyCapCents: number,
    client?: PrismaClientOrTransaction
  ): Promise<BudgetStatus> {
    const db = this.getClient(client);

    await this.getOrCreateBudget(userId, db);
    await db.budgets.update({
      where: { userId },
      data: {
        monthlyCapCents,
        updatedAt: new Date(),
      },
    });

    return this.getBudgetStatus(userId, db);
  }

  async getBudgetStatus(userId: string, client?: PrismaClientOrTransaction): Promise<BudgetStatus> {
    const db = this.getClient(client);
    const now = new Date();

    let budget = await this.getOrCreateBudget(userId, db);
    budget = await this.resetIfNeeded(userId, budget, now, db);

    const monthlyCapCents = budget.monthlyCapCents ?? 0;
    const remainingCents = monthlyCapCents - budget.currentMonthCents;
    const percentUsed =
      monthlyCapCents > 0 ? (budget.currentMonthCents / monthlyCapCents) * 100 : 0;

    return {
      monthlyCapCents,
      currentMonthCents: budget.currentMonthCents,
      remainingCents,
      percentUsed,
      periodStart: budget.periodStart,
      willResetAt: getNextMonthDate(budget.periodStart),
    };
  }
}

const budgetService = new BudgetService();

export function getBudgetService() {
  return budgetService;
}

export async function checkBudget(
  userId: string,
  estimatedCostCents: number,
  client?: PrismaClientOrTransaction
) {
  return budgetService.checkBudget(userId, estimatedCostCents, client);
}

export async function updateBudgetSpend(
  userId: string,
  actualCostCents: number,
  client?: PrismaClientOrTransaction
) {
  return budgetService.updateBudgetSpend(userId, actualCostCents, client);
}

export async function resetBudget(userId: string, client?: PrismaClientOrTransaction) {
  return budgetService.resetBudget(userId, client);
}

export async function getBudgetStatus(userId: string, client?: PrismaClientOrTransaction) {
  return budgetService.getBudgetStatus(userId, client);
}

export async function setMonthlyCap(
  userId: string,
  monthlyCapCents: number,
  client?: PrismaClientOrTransaction
) {
  return budgetService.setMonthlyCap(userId, monthlyCapCents, client);
}

function getNextMonthDate(lastReset: Date): Date {
  const next = new Date(lastReset);
  next.setMonth(next.getMonth() + 1);
  return next;
}
