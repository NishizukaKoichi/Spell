import { NextRequest, NextResponse } from 'next/server';

import { getBudgetStatus, setMonthlyCap } from '@/lib/budget';
import { requireSession } from '@/lib/api-middleware';

// GET /api/budget - Get user's budget
export async function GET(_req: NextRequest) {
  try {
    const sessionResult = await requireSession();
    if (!sessionResult.ok) {
      return sessionResult.response;
    }
    const session = sessionResult.value;

    const budgetStatus = await getBudgetStatus(session.user.id);

    return NextResponse.json(budgetStatus);
  } catch (error) {
    console.error('Failed to fetch budget:', error);
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
  }
}

// PATCH /api/budget - Update user's budget cap
export async function PATCH(req: NextRequest) {
  try {
    const sessionResult = await requireSession();
    if (!sessionResult.ok) {
      return sessionResult.response;
    }
    const session = sessionResult.value;

    const body = await req.json();
    const { monthlyCapCents } = body;

    if (
      typeof monthlyCapCents !== 'number' ||
      monthlyCapCents < 0 ||
      !Number.isInteger(monthlyCapCents)
    ) {
      return NextResponse.json(
        { error: 'Invalid monthly cap value (must be positive integer in cents)' },
        { status: 400 }
      );
    }

    const updated = await setMonthlyCap(session.user.id, monthlyCapCents);

    return NextResponse.json({
      monthlyCapCents: updated.monthlyCapCents,
      currentMonthCents: updated.currentMonthCents,
      remainingCents: updated.remainingCents,
    });
  } catch (error) {
    console.error('Failed to update budget:', error);
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }
}
