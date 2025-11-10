import { NextRequest, NextResponse } from 'next/server';

import { resetBudget, getBudgetStatus } from '@/lib/budget';
import { requireSession } from '@/lib/api-middleware';

/**
 * POST /api/budget/reset - Reset user's budget
 *
 * This endpoint allows users to manually reset their monthly budget.
 * Normally, budgets reset automatically on the 1st of each month.
 *
 * Use cases:
 * - Testing
 * - Manual reset requested by user
 * - Admin operations
 */
export async function POST(_req: NextRequest) {
  try {
    const sessionResult = await requireSession();
    if (!sessionResult.ok) {
      return sessionResult.response;
    }
    const session = sessionResult.value;

    // Reset the budget
    await resetBudget(session.user.id);

    // Get updated status
    const budgetStatus = await getBudgetStatus(session.user.id);

    return NextResponse.json({
      message: 'Budget reset successfully',
      budget: budgetStatus,
    });
  } catch (error) {
    console.error('Failed to reset budget:', error);
    return NextResponse.json({ error: 'Failed to reset budget' }, { status: 500 });
  }
}
