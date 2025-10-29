import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

// POST /api/reviews - Submit a review for a cast
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { castId, rating, comment } = body;

    // Validate input
    if (!castId || typeof rating !== 'number') {
      return NextResponse.json({ error: 'Cast ID and rating are required' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    // Get the cast and verify ownership
    const cast = await prisma.cast.findUnique({
      where: { id: castId },
      include: { spell: true },
    });

    if (!cast) {
      return NextResponse.json({ error: 'Cast not found' }, { status: 404 });
    }

    if (cast.casterId !== session.user.id) {
      return NextResponse.json({ error: 'You can only review your own casts' }, { status: 403 });
    }

    if (cast.status !== 'completed') {
      return NextResponse.json({ error: 'You can only review completed casts' }, { status: 400 });
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: { castId },
    });

    if (existingReview) {
      return NextResponse.json({ error: 'You have already reviewed this cast' }, { status: 400 });
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        castId,
        spellId: cast.spellId,
        userId: session.user.id,
        rating,
        comment: comment || null,
      },
    });

    // Recalculate spell rating
    const reviews = await prisma.review.findMany({
      where: { spellId: cast.spellId },
    });

    const averageRating =
      reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length;

    await prisma.spell.update({
      where: { id: cast.spellId },
      data: { rating: averageRating },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error('Failed to create review:', error);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}

// GET /api/reviews?spellId=xxx - Get reviews for a spell
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const spellId = searchParams.get('spellId');

    if (!spellId) {
      return NextResponse.json({ error: 'Spell ID is required' }, { status: 400 });
    }

    const reviews = await prisma.review.findMany({
      where: { spellId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        cast: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Failed to fetch reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}
