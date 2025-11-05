import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { getBudgetStatus } from '@/lib/budget';

// GET /api/budget - Get user's budget
export async function GET(_req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { monthlyCapCents } = body;

    if (typeof monthlyCapCents !== 'number' || monthlyCapCents < 0 || !Number.isInteger(monthlyCapCents)) {
      return NextResponse.json({ error: 'Invalid monthly cap value (must be positive integer in cents)' }, { status: 400 });
    }

    const budget = await prisma.budgets.upsert({
      where: { userId: session.user.id },
      update: {
        monthlyCapCents,
        updatedAt: new Date(),
      },
      create: {
        id: `budget_${session.user.id}`,
        userId: session.user.id,
        monthlyCapCents,
        currentSpendCents: 0,
        lastResetAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      monthlyCapCents: budget.monthlyCapCents,
      currentSpendCents: budget.currentSpendCents,
      remainingCents: budget.monthlyCapCents - budget.currentSpendCents,
    });
  } catch (error) {
    console.error('Failed to update budget:', error);
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }
}
