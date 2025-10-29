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

    // Get all casts made by this user (payments)
    const payments = await prisma.cast.findMany({
      where: { casterId: userId },
      include: {
        spell: {
          select: {
            id: true,
            name: true,
            category: true,
            author: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by month for summary
    const paymentsByMonth = payments.reduce(
      (
        acc: Record<
          string,
          {
            month: string;
            totalAmount: number;
            transactionCount: number;
            transactions: Array<{
              id: string;
              date: Date;
              spellName: string;
              spellCategory: string | null;
              makerName: string;
              amount: number;
              status: string;
            }>;
          }
        >,
        payment
      ) => {
        const monthKey = new Date(payment.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
        });

        if (!acc[monthKey]) {
          acc[monthKey] = {
            month: monthKey,
            totalAmount: 0,
            transactionCount: 0,
            transactions: [],
          };
        }

        acc[monthKey].totalAmount += payment.costCents;
        acc[monthKey].transactionCount += 1;
        acc[monthKey].transactions.push({
          id: payment.id,
          date: payment.createdAt,
          spellName: payment.spell.name,
          spellCategory: payment.spell.category,
          makerName: payment.spell.author.name || 'Unknown',
          amount: payment.costCents / 100,
          status: payment.status,
        });

        return acc;
      },
      {} as Record<
        string,
        {
          month: string;
          totalAmount: number;
          transactionCount: number;
          transactions: Array<{
            id: string;
            date: Date;
            spellName: string;
            spellCategory: string | null;
            makerName: string;
            amount: number;
            status: string;
          }>;
        }
      >
    );

    // Convert to array and calculate totals
    const monthlyData = Object.values(paymentsByMonth).map(
      (month: {
        month: string;
        totalAmount: number;
        transactionCount: number;
        transactions: Array<{
          id: string;
          date: Date;
          spellName: string;
          spellCategory: string | null;
          makerName: string;
          amount: number;
          status: string;
        }>;
      }) => ({
        ...month,
        totalAmount: month.totalAmount / 100,
      })
    );

    // Calculate overall statistics
    const totalSpent = payments.reduce((sum: number, p) => sum + p.costCents, 0) / 100;
    const totalTransactions = payments.length;
    const averageTransaction = totalTransactions > 0 ? totalSpent / totalTransactions : 0;

    // Get recent transactions (last 10)
    const recentTransactions = payments
      .slice(0, 10)
      .map(
        (payment: {
          id: string;
          createdAt: Date;
          spell: { name: string; category: string | null; author: { name: string | null } };
          costCents: number;
          status: string;
        }) => ({
          id: payment.id,
          date: payment.createdAt,
          spellName: payment.spell.name,
          spellCategory: payment.spell.category,
          makerName: payment.spell.author.name || 'Unknown',
          amount: payment.costCents / 100,
          status: payment.status,
        })
      );

    return NextResponse.json({
      summary: {
        totalSpent,
        totalTransactions,
        averageTransaction,
      },
      monthlyData,
      recentTransactions,
    });
  } catch (error) {
    console.error('Failed to fetch payment history:', error);
    return NextResponse.json({ error: 'Failed to fetch payment history' }, { status: 500 });
  }
}
