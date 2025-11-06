/**
 * Cast Events Streaming Endpoint (Server-Sent Events)
 *
 * GET /api/casts/[id]/events
 *
 * Streams real-time cast status updates to authenticated users.
 * Requires session authentication or API key.
 * Users can only watch their own casts.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/config';
import { validateApiKey } from '@/lib/api-key';
import { SSEConnection } from '@/lib/sse';
import {
  subscribeToCast,
  getCastStatus,
  CastEvent,
} from '@/lib/cast-events';
import { apiError } from '@/lib/api-response';
import { createAuditLog, getRequestContext } from '@/lib/audit-log';
import { RateLimiter, RATE_LIMIT_TIERS, RateLimitTier } from '@/lib/rate-limit';

// Force dynamic rendering and use Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Track active SSE connections per user
const activeConnections = new Map<string, number>();
const MAX_CONNECTIONS_PER_USER = 10;

// Rate limiter for SSE connections
const rateLimiter = new RateLimiter({
  interval: 60000, // 1 minute
});

/**
 * GET handler for SSE stream
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: castId } = await params;
  const { ipAddress, userAgent } = getRequestContext(req);

  try {
    // Authenticate request (session or API key)
    const session = await auth();
    const apiKeyHeader =
      req.headers.get('authorization')?.replace('Bearer ', '') ||
      req.headers.get('x-api-key');

    let userId: string | null = null;
    let rateLimitTier: RateLimitTier = RateLimitTier.ANONYMOUS;

    if (session?.user?.id) {
      userId = session.user.id;
      rateLimitTier = RateLimitTier.AUTHENTICATED;
    } else if (apiKeyHeader) {
      const apiKeyValidation = await validateApiKey(apiKeyHeader);
      if (apiKeyValidation?.userId) {
        userId = apiKeyValidation.userId;
        rateLimitTier = RateLimitTier.API_KEY;
      }
    }

    if (!userId) {
      await createAuditLog({
        userId: null,
        action: 'security.unauthorized_access',
        resource: 'cast',
        resourceId: castId,
        ipAddress,
        userAgent,
        status: 'failure',
        errorMessage: 'Unauthorized SSE connection attempt',
      });

      return apiError('UNAUTHORIZED', 401, 'Authentication required');
    }

    // Rate limiting
    const rateLimitResult = await rateLimiter.check(
      RATE_LIMIT_TIERS[rateLimitTier],
      `sse:${userId}`
    );

    if (!rateLimitResult.success) {
      await createAuditLog({
        userId,
        action: 'security.rate_limit_exceeded',
        resource: 'cast',
        resourceId: castId,
        ipAddress,
        userAgent,
        metadata: { endpoint: `/api/casts/${castId}/events` },
        status: 'failure',
      });

      return apiError('RATE_LIMITED', 429, 'Too many SSE connections', {
        limit: rateLimitResult.limit,
        reset: new Date(rateLimitResult.reset).toISOString(),
      });
    }

    // Fetch cast to verify ownership
    const cast = await getCastStatus(castId);

    if (!cast) {
      await createAuditLog({
        userId,
        action: 'security.unauthorized_access',
        resource: 'cast',
        resourceId: castId,
        ipAddress,
        userAgent,
        status: 'failure',
        errorMessage: 'Cast not found',
      });

      return apiError('NOT_FOUND', 404, 'Cast not found');
    }

    // Verify ownership
    if (cast.casterId !== userId) {
      await createAuditLog({
        userId,
        action: 'security.unauthorized_access',
        resource: 'cast',
        resourceId: castId,
        ipAddress,
        userAgent,
        status: 'failure',
        errorMessage: 'User does not own this cast',
      });

      return apiError('FORBIDDEN', 403, 'You do not have access to this cast');
    }

    // Check connection limit
    const currentConnections = activeConnections.get(userId) || 0;
    if (currentConnections >= MAX_CONNECTIONS_PER_USER) {
      await createAuditLog({
        userId,
        action: 'security.rate_limit_exceeded',
        resource: 'cast',
        resourceId: castId,
        ipAddress,
        userAgent,
        metadata: {
          endpoint: `/api/casts/${castId}/events`,
          reason: 'max_concurrent_connections',
        },
        status: 'failure',
      });

      return apiError(
        'TOO_MANY_CONNECTIONS',
        429,
        `Maximum ${MAX_CONNECTIONS_PER_USER} concurrent SSE connections allowed`
      );
    }

    // Create SSE connection
    const connectionStartTime = Date.now();
    let messageCount = 0;

    const sseConnection = new SSEConnection({
      heartbeatInterval: 30000, // 30 seconds
      timeout: 5 * 60 * 1000, // 5 minutes
      abortSignal: req.signal,
      onTimeout: () => {
        console.log(`[SSE] Connection timeout for cast ${castId}`);
      },
    });

    // Track connection
    activeConnections.set(userId, currentConnections + 1);

    // Log connection opened
    await createAuditLog({
      userId,
      action: 'cast.sse_connection_opened',
      resource: 'cast',
      resourceId: castId,
      ipAddress,
      userAgent,
      status: 'success',
    });

    // Send initial status
    const success = await sseConnection.send({
      event: 'status',
      data: {
        castId: cast.id,
        status: cast.status,
        startedAt: cast.startedAt?.toISOString() || null,
        finishedAt: cast.finishedAt?.toISOString() || null,
        duration: cast.duration,
        costCents: cast.costCents,
        artifactUrl: cast.artifactUrl,
        errorMessage: cast.errorMessage,
        timestamp: new Date().toISOString(),
      },
    });

    if (success) {
      messageCount++;
    }

    // If cast is already in terminal state, close immediately after initial status
    if (cast.status === 'succeeded' || cast.status === 'failed') {
      await sseConnection.send({
        event: 'complete',
        data: {
          castId: cast.id,
          status: cast.status,
          message: 'Cast already in terminal state',
        },
      });

      const connectionDuration = Date.now() - connectionStartTime;
      activeConnections.set(userId, currentConnections); // Decrement

      await createAuditLog({
        userId,
        action: 'cast.sse_connection_closed',
        resource: 'cast',
        resourceId: castId,
        ipAddress,
        userAgent,
        metadata: {
          duration: connectionDuration,
          messageCount: messageCount + 1,
          reason: 'terminal_state',
        },
        status: 'success',
      });

      await sseConnection.close();
      return sseConnection.toResponse();
    }

    // Subscribe to cast events
    const unsubscribe = subscribeToCast(castId, async (event: CastEvent) => {
      if (!sseConnection.isOpen()) {
        unsubscribe();
        return;
      }

      // Map event type to SSE event name
      let eventName = 'status';
      if (event.eventType === 'progress_update') {
        eventName = 'progress';
      } else if (event.eventType === 'completed') {
        eventName = 'complete';
      } else if (event.eventType === 'failed') {
        eventName = 'error';
      }

      // Send event to client
      const sent = await sseConnection.send({
        event: eventName,
        data: {
          castId: event.castId,
          ...event.data,
          timestamp: event.timestamp,
        },
      });

      if (sent) {
        messageCount++;
      }

      // Close connection if cast reached terminal state
      if (event.data.status === 'succeeded' || event.data.status === 'failed') {
        const connectionDuration = Date.now() - connectionStartTime;

        // Cleanup
        unsubscribe();
        activeConnections.set(userId, (activeConnections.get(userId) || 1) - 1);

        await createAuditLog({
          userId,
          action: 'cast.sse_connection_closed',
          resource: 'cast',
          resourceId: castId,
          ipAddress,
          userAgent,
          metadata: {
            duration: connectionDuration,
            messageCount,
            reason: 'cast_completed',
          },
          status: 'success',
        });

        await sseConnection.close();
      }
    });

    // Cleanup on connection close
    req.signal.addEventListener('abort', async () => {
      const connectionDuration = Date.now() - connectionStartTime;

      unsubscribe();
      activeConnections.set(userId!, (activeConnections.get(userId!) || 1) - 1);

      await createAuditLog({
        userId,
        action: 'cast.sse_connection_closed',
        resource: 'cast',
        resourceId: castId,
        ipAddress,
        userAgent,
        metadata: {
          duration: connectionDuration,
          messageCount,
          reason: 'client_disconnect',
        },
        status: 'success',
      });

      await sseConnection.close();
    });

    return sseConnection.toResponse();
  } catch (error) {
    console.error('[SSE] Error creating cast event stream:', error);

    await createAuditLog({
      userId: null,
      action: 'cast.sse_connection_failed',
      resource: 'cast',
      resourceId: castId,
      ipAddress,
      userAgent,
      status: 'failure',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return apiError('INTERNAL', 500, 'Failed to create event stream');
  }
}
