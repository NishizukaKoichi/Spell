import type { Prisma, PrismaClient } from '@prisma/client';

import { prisma } from './prisma';

type PrismaClientOrTransaction = PrismaClient | Prisma.TransactionClient;

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

/**
 * Check if user can execute a spell within their budget
 *
 * @param userId - User ID
 * @param estimatedCostCents - Estimated cost in cents
 * @returns BudgetCheck result
 */
export async function checkBudget(
  userId: string,
  estimatedCostCents: number,
  client: PrismaClientOrTransaction = prisma
): Promise<BudgetCheck> {
  const db = client;
  // Get or create budget
  let budget = await db.budgets.findUnique({
    where: { userId },
  });

  if (!budget) {
    // Create default budget (10000 cents = $100 per month)
    budget = await db.budgets.create({
      data: {
        id: `budget_${userId}`,
        userId,
        monthlyCapCents: 10000,
        currentMonthCents: 0,
        periodStart: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Check if monthly reset is needed
  const now = new Date();
  const lastReset = new Date(budget.periodStart);
  const monthsDiff =
    (now.getFullYear() - lastReset.getFullYear()) * 12 + now.getMonth() - lastReset.getMonth();

  if (monthsDiff >= 1) {
    // Reset budget
    budget = await db.budgets.update({
      where: { userId },
      data: {
        currentMonthCents: 0,
        periodStart: now,
        updatedAt: now,
      },
    });
  }

  const monthlyCapCents = budget.monthlyCapCents ?? 0;
  const remainingCents = monthlyCapCents - budget.currentMonthCents;
  const percentUsed = monthlyCapCents > 0 ? (budget.currentMonthCents / monthlyCapCents) * 100 : 0;

  // Check if user can afford this execution (integer comparison, no floating-point errors)
  const allowed = budget.currentMonthCents + estimatedCostCents <= monthlyCapCents;

  // Calculate retry_after (seconds until next month)
  let retryAfter: number | undefined;
  if (!allowed) {
    const nextReset = new Date(lastReset);
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

/**
 * Update user's budget after spell execution
 *
 * @param userId - User ID
 * @param actualCostCents - Actual cost in cents
 * @returns Updated budget
 */
export async function updateBudgetSpend(
  userId: string,
  actualCostCents: number,
  client: PrismaClientOrTransaction = prisma
): Promise<void> {
  await client.budgets.update({
    where: { userId },
    data: {
      currentMonthCents: {
        increment: actualCostCents,
      },
      updatedAt: new Date(),
    },
  });
}

/**
 * Reset user's budget (for testing or manual reset)
 *
 * @param userId - User ID
 */
export async function resetBudget(userId: string): Promise<void> {
  await prisma.budgets.update({
    where: { userId },
    data: {
      currentMonthCents: 0,
      periodStart: new Date(),
      updatedAt: new Date(),
    },
  });
}

/**
 * Get budget status for display
 *
 * @param userId - User ID
 * @returns Budget status (in cents)
 */
export async function getBudgetStatus(userId: string) {
  let budget = await prisma.budgets.findUnique({
    where: { userId },
  });

  if (!budget) {
    budget = await prisma.budgets.create({
      data: {
        id: `budget_${userId}`,
        userId,
        monthlyCapCents: 10000,
        currentMonthCents: 0,
        periodStart: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Check if monthly reset is needed
  const now = new Date();
  const lastReset = new Date(budget.periodStart);
  const monthsDiff =
    (now.getFullYear() - lastReset.getFullYear()) * 12 + now.getMonth() - lastReset.getMonth();

  if (monthsDiff >= 1) {
    budget = await prisma.budgets.update({
      where: { userId },
      data: {
        currentMonthCents: 0,
        periodStart: now,
        updatedAt: now,
      },
    });
  }

  const monthlyCapCents = budget.monthlyCapCents ?? 0;
  const remainingCents = monthlyCapCents - budget.currentMonthCents;
  const percentUsed = monthlyCapCents > 0 ? (budget.currentMonthCents / monthlyCapCents) * 100 : 0;

  return {
    monthlyCapCents,
    currentMonthCents: budget.currentMonthCents,
    remainingCents,
    percentUsed,
    periodStart: budget.periodStart,
    willResetAt: getNextMonthDate(budget.periodStart),
  };
}

/**
 * Calculate next month's reset date
 */
function getNextMonthDate(lastReset: Date): Date {
  const next = new Date(lastReset);
  next.setMonth(next.getMonth() + 1);
  return next;
}
