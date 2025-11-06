import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import {
  handleChatMessage,
  getMessageHistory,
  validateMessageContent,
} from '@/lib/chat';
import { logChatMessageSent, getRequestContext } from '@/lib/audit-log';
import { RateLimiter, RATE_LIMIT_TIERS, RateLimitTier } from '@/lib/rate-limit';
import { apiError } from '@/lib/api-response';

// Initialize rate limiter for chat messages
const rateLimiter = new RateLimiter({
  interval: 60000, // 1 minute
});

/**
 * GET /api/chat/messages
 * Retrieve message history
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const searchParams = req.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      return apiError('INVALID_INPUT', 400, 'Limit must be between 1 and 100');
    }

    if (offset < 0) {
      return apiError('INVALID_INPUT', 400, 'Offset must be non-negative');
    }

    // Get message history
    const messages = await getMessageHistory({
      userId: session.user.id,
      conversationId: conversationId || undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      messages,
      pagination: {
        limit,
        offset,
        hasMore: messages.length === limit,
      },
    });
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to fetch messages',
      process.env.NODE_ENV === 'development' ? { error: String(error) } : undefined
    );
  }
}

/**
 * POST /api/chat/messages
 * Send new message and get AI response
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 401, 'Authentication required');
    }

    // Rate limiting
    const rateLimitResult = await rateLimiter.check(
      RATE_LIMIT_TIERS[RateLimitTier.AUTHENTICATED],
      `user:${session.user.id}`
    );

    if (!rateLimitResult.success) {
      return apiError('RATE_LIMITED', 429, 'Too many messages. Please try again later.', {
        limit: rateLimitResult.limit,
        reset: new Date(rateLimitResult.reset).toISOString(),
      });
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return apiError('INVALID_INPUT', 400, 'Invalid JSON in request body');
    }

    const { content, conversationId, metadata } = body;

    // Validate message content
    if (!content || typeof content !== 'string') {
      return apiError('INVALID_INPUT', 400, 'Message content is required');
    }

    const validation = validateMessageContent(content);
    if (!validation.valid) {
      return apiError('INVALID_INPUT', 400, validation.error || 'Invalid message content');
    }

    // Validate conversationId if provided
    if (conversationId && typeof conversationId !== 'string') {
      return apiError('INVALID_INPUT', 400, 'Invalid conversation ID');
    }

    // Process message and generate AI response
    const { userMessage, assistantMessage } = await handleChatMessage({
      userId: session.user.id,
      content,
      conversationId: conversationId || null,
      metadata,
    });

    // Audit logging
    const requestContext = getRequestContext(req);
    await logChatMessageSent(
      session.user.id,
      userMessage.id,
      userMessage.conversationId,
      userMessage.role,
      requestContext.ipAddress,
      requestContext.userAgent
    );

    return NextResponse.json(
      {
        userMessage,
        assistantMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to process message:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to process message',
      process.env.NODE_ENV === 'development' ? { error: String(error) } : undefined
    );
  }
}
