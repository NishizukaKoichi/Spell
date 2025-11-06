/**
 * Cast Events Publisher
 *
 * Publishes cast status updates to all connected listeners.
 * Uses NATS for distributed systems or EventEmitter for single-instance deployments.
 */

import 'server-only';
import { EventEmitter } from 'events';
import { publish as natsPublish } from './nats';
import { prisma } from './prisma';

/**
 * Cast event types
 */
export enum CastEventType {
  STATUS_CHANGED = 'status_changed',
  PROGRESS_UPDATE = 'progress_update',
  STARTED = 'started',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ARTIFACT_READY = 'artifact_ready',
}

/**
 * Cast event data structure
 */
export interface CastEvent {
  castId: string;
  userId: string;
  eventType: CastEventType;
  timestamp: string;
  data: {
    status?: string;
    previousStatus?: string;
    progress?: number;
    message?: string;
    duration?: number;
    costCents?: number;
    artifactUrl?: string | null;
    errorMessage?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  };
}

/**
 * In-memory event emitter for single-instance deployments
 * Falls back to this when NATS is not available
 */
class CastEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Increase max listeners for high-concurrency scenarios
    this.setMaxListeners(100);
  }

  /**
   * Emit a cast event
   */
  emitCastEvent(event: CastEvent): void {
    // Emit to global listeners
    this.emit('cast:*', event);

    // Emit to cast-specific listeners
    this.emit(`cast:${event.castId}`, event);

    // Emit to user-specific listeners
    this.emit(`user:${event.userId}`, event);
  }

  /**
   * Subscribe to all cast events
   */
  onAnyCast(handler: (event: CastEvent) => void): () => void {
    this.on('cast:*', handler);
    return () => this.off('cast:*', handler);
  }

  /**
   * Subscribe to specific cast events
   */
  onCast(castId: string, handler: (event: CastEvent) => void): () => void {
    this.on(`cast:${castId}`, handler);
    return () => this.off(`cast:${castId}`, handler);
  }

  /**
   * Subscribe to user's cast events
   */
  onUserCasts(userId: string, handler: (event: CastEvent) => void): () => void {
    this.on(`user:${userId}`, handler);
    return () => this.off(`user:${userId}`, handler);
  }
}

// Global event emitter instance
const eventEmitter = new CastEventEmitter();

/**
 * Publish a cast event to all listeners
 * Uses NATS if available, falls back to EventEmitter
 */
export async function publishCastEvent(event: CastEvent): Promise<void> {
  try {
    // Emit locally for same-instance listeners
    eventEmitter.emitCastEvent(event);

    // Publish to NATS for distributed listeners
    // NATS subjects follow pattern: casts.{castId}.{eventType}
    const subject = `casts.${event.castId}.${event.eventType}`;
    await natsPublish(subject, event as Record<string, unknown>);

    console.log(`[Cast Events] Published event: ${event.eventType} for cast ${event.castId}`);
  } catch (error) {
    console.error('[Cast Events] Error publishing event:', error);
  }
}

/**
 * Helper function to publish a status change event
 */
export async function publishCastStatusChange(
  castId: string,
  userId: string,
  newStatus: string,
  previousStatus?: string,
  additionalData?: Partial<CastEvent['data']>
): Promise<void> {
  const event: CastEvent = {
    castId,
    userId,
    eventType: CastEventType.STATUS_CHANGED,
    timestamp: new Date().toISOString(),
    data: {
      status: newStatus,
      previousStatus,
      ...additionalData,
    },
  };

  await publishCastEvent(event);
}

/**
 * Helper function to publish a progress update
 */
export async function publishCastProgress(
  castId: string,
  userId: string,
  progress: number,
  message?: string
): Promise<void> {
  const event: CastEvent = {
    castId,
    userId,
    eventType: CastEventType.PROGRESS_UPDATE,
    timestamp: new Date().toISOString(),
    data: {
      progress,
      message,
    },
  };

  await publishCastEvent(event);
}

/**
 * Helper function to publish cast started event
 */
export async function publishCastStarted(
  castId: string,
  userId: string,
  startedAt: Date
): Promise<void> {
  const event: CastEvent = {
    castId,
    userId,
    eventType: CastEventType.STARTED,
    timestamp: new Date().toISOString(),
    data: {
      status: 'running',
      startedAt: startedAt.toISOString(),
    },
  };

  await publishCastEvent(event);
}

/**
 * Helper function to publish cast completed event
 */
export async function publishCastCompleted(
  castId: string,
  userId: string,
  finishedAt: Date,
  duration: number,
  costCents: number,
  artifactUrl?: string | null
): Promise<void> {
  const event: CastEvent = {
    castId,
    userId,
    eventType: CastEventType.COMPLETED,
    timestamp: new Date().toISOString(),
    data: {
      status: 'succeeded',
      finishedAt: finishedAt.toISOString(),
      duration,
      costCents,
      artifactUrl,
    },
  };

  await publishCastEvent(event);
}

/**
 * Helper function to publish cast failed event
 */
export async function publishCastFailed(
  castId: string,
  userId: string,
  errorMessage: string,
  finishedAt?: Date
): Promise<void> {
  const event: CastEvent = {
    castId,
    userId,
    eventType: CastEventType.FAILED,
    timestamp: new Date().toISOString(),
    data: {
      status: 'failed',
      errorMessage,
      finishedAt: finishedAt?.toISOString(),
    },
  };

  await publishCastEvent(event);
}

/**
 * Subscribe to all cast events (in-memory only)
 */
export function subscribeToCastEvents(
  handler: (event: CastEvent) => void
): () => void {
  return eventEmitter.onAnyCast(handler);
}

/**
 * Subscribe to specific cast events (in-memory only)
 */
export function subscribeToCast(
  castId: string,
  handler: (event: CastEvent) => void
): () => void {
  return eventEmitter.onCast(castId, handler);
}

/**
 * Subscribe to user's cast events (in-memory only)
 */
export function subscribeToUserCasts(
  userId: string,
  handler: (event: CastEvent) => void
): () => void {
  return eventEmitter.onUserCasts(userId, handler);
}

/**
 * Get current cast status from database
 */
export async function getCastStatus(castId: string): Promise<{
  id: string;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  duration: number | null;
  costCents: number;
  artifactUrl: string | null;
  errorMessage: string | null;
  casterId: string;
} | null> {
  try {
    const cast = await prisma.cast.findUnique({
      where: { id: castId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        duration: true,
        costCents: true,
        artifactUrl: true,
        errorMessage: true,
        casterId: true,
      },
    });

    return cast;
  } catch (error) {
    console.error('[Cast Events] Error fetching cast status:', error);
    return null;
  }
}

/**
 * Helper to publish event from database cast update
 * Useful when updating cast status and want to notify listeners
 */
export async function publishCastUpdate(castId: string): Promise<void> {
  const cast = await getCastStatus(castId);

  if (!cast) {
    console.warn(`[Cast Events] Cannot publish update for non-existent cast: ${castId}`);
    return;
  }

  const event: CastEvent = {
    castId: cast.id,
    userId: cast.casterId,
    eventType: CastEventType.STATUS_CHANGED,
    timestamp: new Date().toISOString(),
    data: {
      status: cast.status,
      startedAt: cast.startedAt?.toISOString() || null,
      finishedAt: cast.finishedAt?.toISOString() || null,
      duration: cast.duration,
      costCents: cast.costCents,
      artifactUrl: cast.artifactUrl,
      errorMessage: cast.errorMessage,
    },
  };

  await publishCastEvent(event);
}
