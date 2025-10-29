import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [casts, total] = await Promise.all([
      prisma.cast.findMany({
        where: { casterId: session.user.id },
        include: {
          spell: {
            select: {
              id: true,
              name: true,
              key: true,
              executionMode: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cast.count({ where: { casterId: session.user.id } }),
    ]);

    return NextResponse.json({
      casts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch casts:', error);
    return NextResponse.json({ error: 'Failed to fetch casts' }, { status: 500 });
  }
}
