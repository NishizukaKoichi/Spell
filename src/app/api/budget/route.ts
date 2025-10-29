import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

// GET /api/budget - Get user's budget
export async function GET(_req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let budget = await prisma.budgets.findUnique({
      where: { userId: session.user.id },
    });

    // Create default budget if doesn't exist
    if (!budget) {
      budget = await prisma.budgets.create({
        data: {
          id: `budget_${session.user.id}`,
          userId: session.user.id,
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
    const monthsDiff =
      (now.getFullYear() - lastReset.getFullYear()) * 12 + now.getMonth() - lastReset.getMonth();

    if (monthsDiff >= 1) {
      budget = await prisma.budgets.update({
        where: { userId: session.user.id },
        data: {
          currentSpend: 0,
          lastResetAt: now,
          updatedAt: now,
        },
      });
    }

    return NextResponse.json({
      monthlyCap: budget.monthlyCap,
      currentSpend: budget.currentSpend,
      remaining: budget.monthlyCap - budget.currentSpend,
      lastResetAt: budget.lastResetAt,
      percentUsed: (budget.currentSpend / budget.monthlyCap) * 100,
    });
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
    const { monthlyCap } = body;

    if (typeof monthlyCap !== 'number' || monthlyCap < 0) {
      return NextResponse.json({ error: 'Invalid monthly cap value' }, { status: 400 });
    }

    const budget = await prisma.budgets.upsert({
      where: { userId: session.user.id },
      update: {
        monthlyCap,
        updatedAt: new Date(),
      },
      create: {
        id: `budget_${session.user.id}`,
        userId: session.user.id,
        monthlyCap,
        currentSpend: 0,
        lastResetAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      monthlyCap: budget.monthlyCap,
      currentSpend: budget.currentSpend,
      remaining: budget.monthlyCap - budget.currentSpend,
    });
  } catch (error) {
    console.error('Failed to update budget:', error);
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }
}
