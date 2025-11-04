import { prisma } from './prisma';

export interface BudgetCheck {
  allowed: boolean;
  budget: {
    monthlyCapCents: number;
    currentSpendCents: number;
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
  estimatedCostCents: number
): Promise<BudgetCheck> {
  // Get or create budget
  let budget = await prisma.budgets.findUnique({
    where: { userId },
  });

  if (!budget) {
    // Create default budget (10000 cents = $100 per month)
    budget = await prisma.budgets.create({
      data: {
        id: `budget_${userId}`,
        userId,
        monthlyCapCents: 10000,
        currentSpendCents: 0,
        lastResetAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Check if monthly reset is needed
  const now = new Date();
  const lastReset = new Date(budget.lastResetAt);
  const monthsDiff =
    (now.getFullYear() - lastReset.getFullYear()) * 12 + now.getMonth() - lastReset.getMonth();

  if (monthsDiff >= 1) {
    // Reset budget
    budget = await prisma.budgets.update({
      where: { userId },
      data: {
        currentSpendCents: 0,
        lastResetAt: now,
        updatedAt: now,
      },
    });
  }

  const remainingCents = budget.monthlyCapCents - budget.currentSpendCents;
  const percentUsed = (budget.currentSpendCents / budget.monthlyCapCents) * 100;

  // Check if user can afford this execution (integer comparison, no floating-point errors)
  const allowed = budget.currentSpendCents + estimatedCostCents <= budget.monthlyCapCents;

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
      monthlyCapCents: budget.monthlyCapCents,
      currentSpendCents: budget.currentSpendCents,
      remainingCents,
      percentUsed,
    },
    estimatedCostCents,
    reason: allowed
      ? undefined
      : `Budget cap exceeded. Current spend: ${budget.currentSpendCents} cents ($${(budget.currentSpendCents / 100).toFixed(2)}), Monthly cap: ${budget.monthlyCapCents} cents ($${(budget.monthlyCapCents / 100).toFixed(2)}), Estimated cost: ${estimatedCostCents} cents ($${(estimatedCostCents / 100).toFixed(2)})`,
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
  actualCostCents: number
): Promise<void> {
  await prisma.budgets.update({
    where: { userId },
    data: {
      currentSpendCents: {
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
      currentSpendCents: 0,
      lastResetAt: new Date(),
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
        currentSpendCents: 0,
        lastResetAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  // Check if monthly reset is needed
  const now = new Date();
  const lastReset = new Date(budget.lastResetAt);
  const monthsDiff =
    (now.getFullYear() - lastReset.getFullYear()) * 12 + now.getMonth() - lastReset.getMonth();

  if (monthsDiff >= 1) {
    budget = await prisma.budgets.update({
      where: { userId },
      data: {
        currentSpendCents: 0,
        lastResetAt: now,
        updatedAt: now,
      },
    });
  }

  const remainingCents = budget.monthlyCapCents - budget.currentSpendCents;
  const percentUsed = (budget.currentSpendCents / budget.monthlyCapCents) * 100;

  return {
    monthlyCapCents: budget.monthlyCapCents,
    currentSpendCents: budget.currentSpendCents,
    remainingCents,
    percentUsed,
    lastResetAt: budget.lastResetAt,
    willResetAt: getNextMonthDate(budget.lastResetAt),
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
