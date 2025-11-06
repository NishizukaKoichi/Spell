import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/config';
import {
  processUserMessage,
  generateStreamingAIResponse,
  storeMessage,
  ChatRole,
  validateMessageContent,
} from '@/lib/chat';
import { logChatMessageSent, getRequestContext } from '@/lib/audit-log';
import { RateLimiter, RATE_LIMIT_TIERS, RateLimitTier } from '@/lib/rate-limit';

// Initialize rate limiter for chat messages
const rateLimiter = new RateLimiter({
  interval: 60000, // 1 minute
});

/**
 * POST /api/chat/stream
 * Stream AI responses using Server-Sent Events
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = await rateLimiter.check(
      RATE_LIMIT_TIERS[RateLimitTier.AUTHENTICATED],
      `user:${session.user.id}`
    );

    if (!rateLimitResult.success) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { content, conversationId, metadata } = body;

    // Validate message content
    if (!content || typeof content !== 'string') {
      return new Response('Message content is required', { status: 400 });
    }

    const validation = validateMessageContent(content);
    if (!validation.valid) {
      return new Response(validation.error, { status: 400 });
    }

    // Process user message and get context
    const { userMessage, context } = await processUserMessage({
      userId: session.user.id,
      content,
      conversationId: conversationId || null,
      metadata,
    });

    // Audit logging for user message
    const requestContext = getRequestContext(req);
    await logChatMessageSent(
      session.user.id,
      userMessage.id,
      userMessage.conversationId,
      userMessage.role,
      requestContext.ipAddress,
      requestContext.userAgent
    );

    // Create a TransformStream for Server-Sent Events
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Start streaming in the background
    (async () => {
      try {
        // Send initial event with user message
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: 'start', userMessage })}\n\n`)
        );

        let fullResponse = '';

        // Stream AI response
        for await (const chunk of generateStreamingAIResponse({
          context,
          userId: session.user.id,
        })) {
          fullResponse += chunk;
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
          );
        }

        // Store the complete AI response
        const assistantMessage = await storeMessage({
          userId: session.user.id,
          content: fullResponse.trim(),
          role: ChatRole.ASSISTANT,
          conversationId: conversationId || userMessage.conversationId,
          metadata: {
            generatedAt: new Date().toISOString(),
            contextLength: context.length,
            streamed: true,
          },
        });

        // Audit logging for assistant message
        await logChatMessageSent(
          session.user.id,
          assistantMessage.id,
          assistantMessage.conversationId,
          assistantMessage.role,
          requestContext.ipAddress,
          requestContext.userAgent
        );

        // Send completion event
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'end', assistantMessage })}\n\n`
          )
        );

        await writer.close();
      } catch (error) {
        console.error('Streaming error:', error);
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              error: 'Failed to generate response'
            })}\n\n`
          )
        );
        await writer.close();
      }
    })();

    // Return the readable stream
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Failed to start streaming:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
