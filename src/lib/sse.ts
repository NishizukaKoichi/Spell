/**
 * Server-Sent Events (SSE) Infrastructure
 *
 * Provides utilities for creating and managing SSE streams for real-time updates.
 * Supports heartbeats, proper error handling, and graceful connection cleanup.
 */

export interface SSEMessage {
  event?: string;
  data: unknown;
  id?: string;
  retry?: number;
}

export interface SSEStream {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
  closed: boolean;
  lastMessageTime: number;
}

/**
 * Format data for SSE transmission
 * Follows the SSE specification: https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
export function formatSSEMessage(message: SSEMessage): string {
  let formatted = '';

  if (message.id) {
    formatted += `id: ${message.id}\n`;
  }

  if (message.event) {
    formatted += `event: ${message.event}\n`;
  }

  if (message.retry) {
    formatted += `retry: ${message.retry}\n`;
  }

  // Data can be multiline, each line prefixed with "data: "
  const dataString = typeof message.data === 'string'
    ? message.data
    : JSON.stringify(message.data);

  const dataLines = dataString.split('\n');
  for (const line of dataLines) {
    formatted += `data: ${line}\n`;
  }

  // SSE messages end with double newline
  formatted += '\n';

  return formatted;
}

/**
 * Create a new SSE stream
 * Returns a TransformStream configured for SSE and helper utilities
 */
export function createSSEStream(): {
  stream: TransformStream;
  sseStream: SSEStream;
} {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const sseStream: SSEStream = {
    writer,
    encoder,
    closed: false,
    lastMessageTime: Date.now(),
  };

  return { stream, sseStream };
}

/**
 * Send an SSE message through the stream
 */
export async function sendSSEMessage(
  sseStream: SSEStream,
  message: SSEMessage
): Promise<boolean> {
  if (sseStream.closed) {
    return false;
  }

  try {
    const formatted = formatSSEMessage(message);
    await sseStream.writer.write(sseStream.encoder.encode(formatted));
    sseStream.lastMessageTime = Date.now();
    return true;
  } catch (error) {
    console.error('[SSE] Error sending message:', error);
    sseStream.closed = true;
    return false;
  }
}

/**
 * Send a heartbeat (comment) to keep the connection alive
 * SSE spec allows comments (lines starting with :) to keep connections alive
 */
export async function sendHeartbeat(sseStream: SSEStream): Promise<boolean> {
  if (sseStream.closed) {
    return false;
  }

  try {
    const heartbeat = `: heartbeat ${Date.now()}\n\n`;
    await sseStream.writer.write(sseStream.encoder.encode(heartbeat));
    sseStream.lastMessageTime = Date.now();
    return true;
  } catch (error) {
    console.error('[SSE] Error sending heartbeat:', error);
    sseStream.closed = true;
    return false;
  }
}

/**
 * Close an SSE stream gracefully
 */
export async function closeSSEStream(sseStream: SSEStream): Promise<void> {
  if (sseStream.closed) {
    return;
  }

  try {
    // Send a final event indicating closure (optional)
    await sendSSEMessage(sseStream, {
      event: 'close',
      data: { message: 'Stream closed' },
    });

    await sseStream.writer.close();
    sseStream.closed = true;
  } catch (error) {
    console.error('[SSE] Error closing stream:', error);
    sseStream.closed = true;
  }
}

/**
 * Create a heartbeat interval for keeping connections alive
 * Returns cleanup function
 */
export function startHeartbeat(
  sseStream: SSEStream,
  intervalMs: number = 30000 // 30 seconds default
): () => void {
  const interval = setInterval(async () => {
    const success = await sendHeartbeat(sseStream);
    if (!success) {
      clearInterval(interval);
    }
  }, intervalMs);

  // Return cleanup function
  return () => clearInterval(interval);
}

/**
 * Create standard SSE response headers
 */
export function getSSEHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  };
}

/**
 * Helper to create a complete SSE Response
 */
export function createSSEResponse(readable: ReadableStream): Response {
  return new Response(readable, {
    headers: getSSEHeaders(),
  });
}

/**
 * Timeout utility - auto-close stream after specified duration
 * Returns cleanup function
 */
export function setTimeout(
  sseStream: SSEStream,
  timeoutMs: number,
  onTimeout?: () => void
): () => void {
  const timeout = globalThis.setTimeout(async () => {
    await sendSSEMessage(sseStream, {
      event: 'timeout',
      data: { message: 'Connection timeout' },
    });
    await closeSSEStream(sseStream);
    onTimeout?.();
  }, timeoutMs);

  // Return cleanup function
  return () => clearTimeout(timeout);
}

/**
 * Helper class for managing SSE connections with automatic cleanup
 */
export class SSEConnection {
  private sseStream: SSEStream;
  private readable: ReadableStream;
  private heartbeatCleanup?: () => void;
  private timeoutCleanup?: () => void;
  private abortCleanup?: () => void;

  constructor(
    options: {
      heartbeatInterval?: number;
      timeout?: number;
      onTimeout?: () => void;
      abortSignal?: AbortSignal;
    } = {}
  ) {
    const { stream, sseStream } = createSSEStream();
    this.sseStream = sseStream;
    this.readable = stream.readable;

    // Setup heartbeat
    if (options.heartbeatInterval !== 0) {
      this.heartbeatCleanup = startHeartbeat(
        sseStream,
        options.heartbeatInterval
      );
    }

    // Setup timeout
    if (options.timeout) {
      this.timeoutCleanup = setTimeout(
        sseStream,
        options.timeout,
        options.onTimeout
      );
    }

    // Setup abort handling
    if (options.abortSignal) {
      const abortHandler = () => {
        this.close();
      };
      options.abortSignal.addEventListener('abort', abortHandler);
      this.abortCleanup = () => {
        options.abortSignal?.removeEventListener('abort', abortHandler);
      };
    }
  }

  /**
   * Send a message through the connection
   */
  async send(message: SSEMessage): Promise<boolean> {
    return sendSSEMessage(this.sseStream, message);
  }

  /**
   * Send a heartbeat
   */
  async heartbeat(): Promise<boolean> {
    return sendHeartbeat(this.sseStream);
  }

  /**
   * Check if connection is still open
   */
  isOpen(): boolean {
    return !this.sseStream.closed;
  }

  /**
   * Get the readable stream for Response
   */
  getReadable(): ReadableStream {
    return this.readable;
  }

  /**
   * Get time since last message (for monitoring)
   */
  getIdleTime(): number {
    return Date.now() - this.sseStream.lastMessageTime;
  }

  /**
   * Close the connection and cleanup resources
   */
  async close(): Promise<void> {
    this.heartbeatCleanup?.();
    this.timeoutCleanup?.();
    this.abortCleanup?.();
    await closeSSEStream(this.sseStream);
  }

  /**
   * Create a Response from this connection
   */
  toResponse(): Response {
    return createSSEResponse(this.readable);
  }
}
