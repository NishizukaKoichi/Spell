import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import {
  createConversation,
  getUserConversations,
  deleteConversation,
  updateConversationTitle,
} from '@/lib/chat';
import {
  logChatConversationCreated,
  logChatConversationDeleted,
  getRequestContext,
} from '@/lib/audit-log';
import { apiError } from '@/lib/api-response';

/**
 * GET /api/chat/conversations
 * List all conversations for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      return apiError('INVALID_INPUT', 400, 'Limit must be between 1 and 100');
    }

    if (offset < 0) {
      return apiError('INVALID_INPUT', 400, 'Offset must be non-negative');
    }

    // Get user conversations
    const conversations = await getUserConversations({
      userId: session.user.id,
      limit,
      offset,
    });

    return NextResponse.json({
      conversations,
      pagination: {
        limit,
        offset,
        hasMore: conversations.length === limit,
      },
    });
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to fetch conversations',
      process.env.NODE_ENV === 'development' ? { error: String(error) } : undefined
    );
  }
}

/**
 * POST /api/chat/conversations
 * Create a new conversation
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 401, 'Authentication required');
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return apiError('INVALID_INPUT', 400, 'Invalid JSON in request body');
    }

    const { title } = body;

    // Validate title if provided
    if (title && (typeof title !== 'string' || title.length > 200)) {
      return apiError('INVALID_INPUT', 400, 'Title must be a string with max 200 characters');
    }

    // Create conversation
    const conversation = await createConversation({
      userId: session.user.id,
      title: title || undefined,
    });

    // Audit logging
    const requestContext = getRequestContext(req);
    await logChatConversationCreated(
      session.user.id,
      conversation.id,
      title,
      requestContext.ipAddress,
      requestContext.userAgent
    );

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to create conversation',
      process.env.NODE_ENV === 'development' ? { error: String(error) } : undefined
    );
  }
}

/**
 * DELETE /api/chat/conversations?id={conversationId}
 * Delete a conversation
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 401, 'Authentication required');
    }

    const searchParams = req.nextUrl.searchParams;
    const conversationId = searchParams.get('id');

    if (!conversationId) {
      return apiError('INVALID_INPUT', 400, 'Conversation ID is required');
    }

    try {
      // Delete conversation
      await deleteConversation({
        conversationId,
        userId: session.user.id,
      });

      // Audit logging
      const requestContext = getRequestContext(req);
      await logChatConversationDeleted(
        session.user.id,
        conversationId,
        requestContext.ipAddress,
        requestContext.userAgent
      );

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return apiError('NOT_FOUND', 404, 'Conversation not found or access denied');
      }
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to delete conversation',
      process.env.NODE_ENV === 'development' ? { error: String(error) } : undefined
    );
  }
}

/**
 * PATCH /api/chat/conversations
 * Update a conversation (e.g., change title)
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 401, 'Authentication required');
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return apiError('INVALID_INPUT', 400, 'Invalid JSON in request body');
    }

    const { conversationId, title } = body;

    if (!conversationId) {
      return apiError('INVALID_INPUT', 400, 'Conversation ID is required');
    }

    if (!title || typeof title !== 'string' || title.length > 200) {
      return apiError('INVALID_INPUT', 400, 'Title must be a string with max 200 characters');
    }

    try {
      // Update conversation
      const conversation = await updateConversationTitle({
        conversationId,
        userId: session.user.id,
        title,
      });

      return NextResponse.json(conversation);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return apiError('NOT_FOUND', 404, 'Conversation not found or access denied');
      }
      throw error;
    }
  } catch (error) {
    console.error('Failed to update conversation:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      'Failed to update conversation',
      process.env.NODE_ENV === 'development' ? { error: String(error) } : undefined
    );
  }
}
