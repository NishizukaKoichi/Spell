import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get maker statistics (spells created by this user)
    const makerSpells = await prisma.spell.findMany({
      where: { authorId: userId },
      include: {
        _count: {
          select: { casts: true },
        },
        casts: {
          select: {
            costCents: true,
            createdAt: true,
            status: true,
          },
        },
      },
    });

    // Calculate maker stats
    const makerTotalRevenue = makerSpells.reduce(
      (sum, spell) => sum + spell.casts.reduce((castSum, cast) => castSum + cast.costCents, 0),
      0
    );

    const makerTotalCasts = makerSpells.reduce((sum, spell) => sum + spell._count.casts, 0);

    const makerTopSpells = makerSpells
      .map((spell) => ({
        id: spell.id,
        name: spell.name,
        totalCasts: spell._count.casts,
        revenue: spell.casts.reduce((sum, cast) => sum + cast.costCents, 0) / 100,
        rating: spell.rating,
      }))
      .sort((a, b) => b.totalCasts - a.totalCasts)
      .slice(0, 5);

    // Revenue by month for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const makerRevenueByMonth = makerSpells.flatMap((spell) =>
      spell.casts
        .filter((cast) => cast.createdAt >= sixMonthsAgo)
        .map((cast) => ({
          month: new Date(cast.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
          }),
          revenue: cast.costCents / 100,
        }))
    );

    const makerMonthlyRevenue = makerRevenueByMonth.reduce(
      (acc, { month, revenue }) => {
        acc[month] = (acc[month] || 0) + revenue;
        return acc;
      },
      {} as Record<string, number>
    );

    // Get caster statistics (casts made by this user)
    const casterCasts = await prisma.cast.findMany({
      where: { casterId: userId },
      include: {
        spell: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate caster stats
    const casterTotalSpending = casterCasts.reduce((sum, cast) => sum + cast.costCents, 0);

    const casterTotalCasts = casterCasts.length;

    const casterCompletedCasts = casterCasts.filter((cast) => cast.status === 'completed').length;

    const casterFailedCasts = casterCasts.filter((cast) => cast.status === 'failed').length;

    // Most used spells
    const spellUsage = casterCasts.reduce(
      (acc, cast) => {
        const key = cast.spell.id;
        if (!acc[key]) {
          acc[key] = {
            id: cast.spell.id,
            name: cast.spell.name,
            category: cast.spell.category,
            count: 0,
            spending: 0,
          };
        }
        acc[key].count += 1;
        acc[key].spending += cast.costCents / 100;
        return acc;
      },
      {} as Record<
        string,
        { id: string; name: string; category: string | null; count: number; spending: number }
      >
    );

    const casterTopSpells = Object.values(spellUsage)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Spending by month for the last 6 months
    const casterSpendingByMonth = casterCasts
      .filter((cast) => cast.createdAt >= sixMonthsAgo)
      .map((cast) => ({
        month: new Date(cast.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
        }),
        spending: cast.costCents / 100,
      }));

    const casterMonthlySpending = casterSpendingByMonth.reduce(
      (acc, { month, spending }) => {
        acc[month] = (acc[month] || 0) + spending;
        return acc;
      },
      {} as Record<string, number>
    );

    // Spending by category
    const casterSpendingByCategory = casterCasts.reduce(
      (acc, cast) => {
        const category = cast.spell.category || 'Uncategorized';
        acc[category] = (acc[category] || 0) + cast.costCents / 100;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      maker: {
        totalRevenue: makerTotalRevenue / 100,
        totalCasts: makerTotalCasts,
        totalSpells: makerSpells.length,
        topSpells: makerTopSpells,
        monthlyRevenue: Object.entries(makerMonthlyRevenue).map(([month, revenue]) => ({
          month,
          revenue,
        })),
      },
      caster: {
        totalSpending: casterTotalSpending / 100,
        totalCasts: casterTotalCasts,
        completedCasts: casterCompletedCasts,
        failedCasts: casterFailedCasts,
        successRate:
          casterTotalCasts > 0 ? ((casterCompletedCasts / casterTotalCasts) * 100).toFixed(1) : '0',
        topSpells: casterTopSpells,
        monthlySpending: Object.entries(casterMonthlySpending).map(([month, spending]) => ({
          month,
          spending,
        })),
        spendingByCategory: Object.entries(casterSpendingByCategory).map(
          ([category, spending]) => ({ category, spending })
        ),
      },
    });
  } catch (error) {
    console.error('Failed to fetch statistics:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}
