import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const priceModel = searchParams.get('priceModel');
    const sortBy = searchParams.get('sortBy') || 'popularity';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');

    const where: any = {
      status: 'active',
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    // Category filter
    if (category && category !== 'all') {
      where.category = category;
    }

    // Tags filter (all selected tags must be present)
    if (tags && tags.length > 0) {
      where.tags = {
        hasEvery: tags,
      };
    }

    // Price range filter
    if (minPrice || maxPrice) {
      where.priceAmount = {};
      if (minPrice) {
        where.priceAmount.gte = parseFloat(minPrice) * 100; // Convert to cents
      }
      if (maxPrice) {
        where.priceAmount.lte = parseFloat(maxPrice) * 100; // Convert to cents
      }
    }

    // Price model filter
    if (priceModel && priceModel !== 'all') {
      where.priceModel = priceModel;
    }

    // Sorting
    let orderBy: any = { totalCasts: 'desc' }; // Default: popularity
    switch (sortBy) {
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'price-low':
        orderBy = { priceAmount: 'asc' };
        break;
      case 'price-high':
        orderBy = { priceAmount: 'desc' };
        break;
      case 'name':
        orderBy = { name: 'asc' };
        break;
      case 'popularity':
      default:
        orderBy = { totalCasts: 'desc' };
        break;
    }

    const [spells, total, categories] = await Promise.all([
      prisma.spell.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      prisma.spell.count({ where }),
      // Get all unique categories for filter options
      prisma.spell.findMany({
        where: { status: 'active' },
        select: { category: true },
        distinct: ['category'],
      }),
    ]);

    // Get all unique tags for filter options
    const allSpells = await prisma.spell.findMany({
      where: { status: 'active' },
      select: { tags: true },
    });
    const allTags = Array.from(new Set(allSpells.flatMap((s) => s.tags))).sort();

    return NextResponse.json({
      spells,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        categories: categories
          .map((c) => c.category)
          .filter(Boolean)
          .sort(),
        tags: allTags,
      },
    });
  } catch (error) {
    console.error('Failed to fetch spells:', error);
    return NextResponse.json({ error: 'Failed to fetch spells' }, { status: 500 });
  }
}
