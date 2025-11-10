// GET /api/spells - List and search spells - TKT-011
// SPEC Reference: Section 10 (Spell Management)

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { createRequestLogger } from '@/lib/logger';
import { handleError, apiSuccess } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const requestLogger = createRequestLogger(randomUUID(), '/api/spells', 'GET');

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

    requestLogger.info('Fetching spells', {
      search,
      category,
      tags,
      sortBy,
      page,
      limit,
    });

    const where: Record<string, unknown> = {
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
      where.priceAmountCents = {};
      if (minPrice) {
        (where.priceAmountCents as Record<string, number>).gte = Math.round(
          parseFloat(minPrice) * 100
        );
      }
      if (maxPrice) {
        (where.priceAmountCents as Record<string, number>).lte = Math.round(
          parseFloat(maxPrice) * 100
        );
      }
    }

    // Price model filter
    if (priceModel && priceModel !== 'all') {
      where.priceModel = priceModel;
    }

    // Sorting
    let orderBy: Record<string, string> = { totalCasts: 'desc' }; // Default: popularity
    switch (sortBy) {
      case 'rating':
        orderBy = { rating: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'price-low':
        orderBy = { priceAmountCents: 'asc' };
        break;
      case 'price-high':
        orderBy = { priceAmountCents: 'desc' };
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
    const allTags = Array.from(new Set(allSpells.flatMap((s: { tags: string[] }) => s.tags))).sort();

    requestLogger.info('Spells fetched successfully', {
      count: spells.length,
      total,
      page,
      limit,
    });

    return apiSuccess({
      spells,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        categories: categories.map((c: { category: string | null }) => c.category).filter(Boolean).sort(),
        tags: allTags,
      },
    });
  } catch (error) {
    requestLogger.error('Failed to fetch spells', error as Error);
    return handleError(error);
  }
}
