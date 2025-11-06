/**
 * React Hook for Cast Events (SSE)
 *
 * Subscribes to real-time cast status updates via Server-Sent Events.
 * Handles automatic reconnection, error handling, and cleanup.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface CastEventData {
  castId: string;
  status?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  duration?: number | null;
  costCents?: number;
  artifactUrl?: string | null;
  errorMessage?: string | null;
  progress?: number;
  message?: string;
  timestamp: string;
}

export interface CastEventHandlers {
  onStatus?: (data: CastEventData) => void;
  onProgress?: (data: CastEventData) => void;
  onComplete?: (data: CastEventData) => void;
  onError?: (data: CastEventData) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export interface UseCastEventsOptions {
  castId: string;
  enabled?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface UseCastEventsReturn {
  isConnected: boolean;
  lastEvent: CastEventData | null;
  lastUpdate: Date | null;
  error: Error | null;
  reconnectCount: number;
}

/**
 * Hook to subscribe to real-time cast events
 */
export function useCastEvents(
  options: UseCastEventsOptions,
  handlers: CastEventHandlers = {}
): UseCastEventsReturn {
  const {
    castId,
    enabled = true,
    reconnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<CastEventData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const handleConnectionChange = useCallback(
    (connected: boolean) => {
      setIsConnected(connected);
      handlers.onConnectionChange?.(connected);
    },
    [handlers]
  );

  const connect = useCallback(() => {
    if (!enabled || !castId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource(`/api/casts/${castId}/events`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log(`[SSE] Connected to cast ${castId}`);
        handleConnectionChange(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.addEventListener('status', (event) => {
        try {
          const data = JSON.parse(event.data) as CastEventData;
          setLastEvent(data);
          setLastUpdate(new Date());
          handlers.onStatus?.(data);
        } catch (err) {
          console.error('[SSE] Error parsing status event:', err);
        }
      });

      eventSource.addEventListener('progress', (event) => {
        try {
          const data = JSON.parse(event.data) as CastEventData;
          setLastEvent(data);
          setLastUpdate(new Date());
          handlers.onProgress?.(data);
        } catch (err) {
          console.error('[SSE] Error parsing progress event:', err);
        }
      });

      eventSource.addEventListener('complete', (event) => {
        try {
          const data = JSON.parse(event.data) as CastEventData;
          setLastEvent(data);
          setLastUpdate(new Date());
          handlers.onComplete?.(data);

          // Close connection on completion
          eventSource.close();
          handleConnectionChange(false);
        } catch (err) {
          console.error('[SSE] Error parsing complete event:', err);
        }
      });

      eventSource.addEventListener('error', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as CastEventData;
          setLastEvent(data);
          setLastUpdate(new Date());
          handlers.onError?.(data);
        } catch (err) {
          // Error event might not have data
          console.error('[SSE] Error event received:', err);
        }
      });

      eventSource.onerror = (err) => {
        console.error('[SSE] Connection error:', err);
        const connectionError = new Error('SSE connection error');
        setError(connectionError);
        handleConnectionChange(false);
        eventSource.close();

        // Attempt reconnection
        if (
          reconnect &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current++;
          setReconnectCount(reconnectAttemptsRef.current);

          console.log(
            `[SSE] Reconnecting in ${reconnectInterval}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('[SSE] Max reconnection attempts reached');
          setError(new Error('Max reconnection attempts reached'));
        }
      };
    } catch (err) {
      console.error('[SSE] Error creating EventSource:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      handleConnectionChange(false);
    }
  }, [
    enabled,
    castId,
    reconnect,
    reconnectInterval,
    maxReconnectAttempts,
    handlers,
    handleConnectionChange,
  ]);

  // Connect on mount and when dependencies change
  useEffect(() => {
    if (enabled && castId) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect, enabled, castId]);

  return {
    isConnected,
    lastEvent,
    lastUpdate,
    error,
    reconnectCount,
  };
}

/**
 * Helper hook for simple status-only updates
 */
export function useCastStatus(castId: string, enabled = true) {
  const [status, setStatus] = useState<string | null>(null);
  const [isTerminal, setIsTerminal] = useState(false);

  const handleStatus = useCallback((data: CastEventData) => {
    if (data.status) {
      setStatus(data.status);
      setIsTerminal(
        data.status === 'succeeded' || data.status === 'failed'
      );
    }
  }, []);

  const { isConnected, lastUpdate } = useCastEvents(
    { castId, enabled: enabled && !isTerminal },
    { onStatus: handleStatus, onComplete: handleStatus }
  );

  return {
    status,
    isTerminal,
    isConnected,
    lastUpdate,
  };
}

/**
 * Polling fallback for browsers that don't support SSE
 * or when SSE connection fails repeatedly
 */
export function useCastPolling(
  castId: string,
  options: {
    enabled?: boolean;
    interval?: number;
    onUpdate?: (cast: any) => void;
  } = {}
) {
  const { enabled = true, interval = 5000, onUpdate } = options;
  const [isPolling, setIsPolling] = useState(false);
  const [cast, setCast] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !castId) return;

    let isActive = true;
    let timeoutId: NodeJS.Timeout;

    const poll = async () => {
      if (!isActive) return;

      try {
        setIsPolling(true);
        const response = await fetch(`/api/casts/${castId}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setCast(data);
        setError(null);
        onUpdate?.(data);

        // Stop polling if cast is in terminal state
        if (data.status === 'succeeded' || data.status === 'failed') {
          setIsPolling(false);
          return;
        }

        // Schedule next poll
        timeoutId = setTimeout(poll, interval);
      } catch (err) {
        console.error('[Polling] Error fetching cast:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));

        // Continue polling on error
        timeoutId = setTimeout(poll, interval);
      }
    };

    // Start polling
    poll();

    // Cleanup
    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setIsPolling(false);
    };
  }, [enabled, castId, interval, onUpdate]);

  return {
    cast,
    isPolling,
    error,
  };
}

/**
 * Detect SSE support
 */
export function isSSESupported(): boolean {
  return typeof window !== 'undefined' && typeof EventSource !== 'undefined';
}
