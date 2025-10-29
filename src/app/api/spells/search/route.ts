import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    const where: any = {
      isPublished: true,
    };

    // Text search in name and description
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { longDescription: { contains: query, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (category && category !== 'all') {
      where.category = category;
    }

    // Build orderBy
    const orderBy: any = {};
    if (sortBy === 'rating') {
      orderBy.rating = order;
    } else if (sortBy === 'casts') {
      orderBy.casts = { _count: order };
    } else {
      orderBy[sortBy] = order;
    }

    const spells = await prisma.spell.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            casts: true,
            reviews: true,
          },
        },
      },
      orderBy,
    });

    return NextResponse.json(spells);
  } catch (error) {
    console.error('Failed to search spells:', error);
    return NextResponse.json({ error: 'Failed to search spells' }, { status: 500 });
  }
}
