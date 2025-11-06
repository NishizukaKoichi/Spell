/**
 * Tests for SSE infrastructure utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  formatSSEMessage,
  createSSEStream,
  sendSSEMessage,
  sendHeartbeat,
  closeSSEStream,
  SSEConnection,
} from '@/lib/sse';

describe('SSE Utilities', () => {
  describe('formatSSEMessage', () => {
    it('should format simple data message', () => {
      const result = formatSSEMessage({
        data: { message: 'hello' },
      });

      expect(result).toContain('data: {"message":"hello"}');
      expect(result).toMatch(/\n\n$/); // Ends with double newline
    });

    it('should format message with event type', () => {
      const result = formatSSEMessage({
        event: 'status',
        data: { status: 'running' },
      });

      expect(result).toContain('event: status');
      expect(result).toContain('data: {"status":"running"}');
    });

    it('should format message with id', () => {
      const result = formatSSEMessage({
        id: '123',
        data: { test: true },
      });

      expect(result).toContain('id: 123');
      expect(result).toContain('data: {"test":true}');
    });

    it('should format message with retry', () => {
      const result = formatSSEMessage({
        retry: 5000,
        data: 'test',
      });

      expect(result).toContain('retry: 5000');
      expect(result).toContain('data: test');
    });

    it('should handle multiline data', () => {
      const result = formatSSEMessage({
        data: 'line1\nline2\nline3',
      });

      expect(result).toContain('data: line1');
      expect(result).toContain('data: line2');
      expect(result).toContain('data: line3');
    });

    it('should handle all fields together', () => {
      const result = formatSSEMessage({
        id: 'msg-1',
        event: 'test',
        retry: 3000,
        data: { value: 42 },
      });

      expect(result).toContain('id: msg-1');
      expect(result).toContain('event: test');
      expect(result).toContain('retry: 3000');
      expect(result).toContain('data: {"value":42}');
    });
  });

  describe('createSSEStream', () => {
    it('should create a valid SSE stream', () => {
      const { stream, sseStream } = createSSEStream();

      expect(stream).toBeInstanceOf(TransformStream);
      expect(sseStream).toHaveProperty('writer');
      expect(sseStream).toHaveProperty('encoder');
      expect(sseStream.closed).toBe(false);
      expect(sseStream.lastMessageTime).toBeGreaterThan(0);
    });
  });

  describe('sendSSEMessage', () => {
    it('should send message and update lastMessageTime', async () => {
      const { sseStream } = createSSEStream();
      const initialTime = sseStream.lastMessageTime;

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const success = await sendSSEMessage(sseStream, {
        data: { test: true },
      });

      expect(success).toBe(true);
      expect(sseStream.lastMessageTime).toBeGreaterThan(initialTime);
    });

    it('should return false for closed stream', async () => {
      const { sseStream } = createSSEStream();
      sseStream.closed = true;

      const success = await sendSSEMessage(sseStream, {
        data: { test: true },
      });

      expect(success).toBe(false);
    });
  });

  describe('sendHeartbeat', () => {
    it('should send heartbeat comment', async () => {
      const { sseStream } = createSSEStream();
      const success = await sendHeartbeat(sseStream);

      expect(success).toBe(true);
    });

    it('should return false for closed stream', async () => {
      const { sseStream } = createSSEStream();
      sseStream.closed = true;

      const success = await sendHeartbeat(sseStream);

      expect(success).toBe(false);
    });
  });

  describe('closeSSEStream', () => {
    it('should close stream gracefully', async () => {
      const { sseStream } = createSSEStream();

      expect(sseStream.closed).toBe(false);

      await closeSSEStream(sseStream);

      expect(sseStream.closed).toBe(true);
    });

    it('should be idempotent', async () => {
      const { sseStream } = createSSEStream();

      await closeSSEStream(sseStream);
      await closeSSEStream(sseStream); // Should not throw

      expect(sseStream.closed).toBe(true);
    });
  });

  describe('SSEConnection', () => {
    it('should create connection with default options', () => {
      const connection = new SSEConnection();

      expect(connection.isOpen()).toBe(true);
      expect(connection.getIdleTime()).toBeGreaterThanOrEqual(0);
    });

    it('should send messages', async () => {
      const connection = new SSEConnection();

      const success = await connection.send({
        event: 'test',
        data: { value: 123 },
      });

      expect(success).toBe(true);
    });

    it('should send heartbeats', async () => {
      const connection = new SSEConnection({ heartbeatInterval: 0 });

      const success = await connection.heartbeat();

      expect(success).toBe(true);
    });

    it('should close connection', async () => {
      const connection = new SSEConnection({ heartbeatInterval: 0 });

      expect(connection.isOpen()).toBe(true);

      await connection.close();

      expect(connection.isOpen()).toBe(false);
    });

    it('should create valid Response', () => {
      const connection = new SSEConnection({ heartbeatInterval: 0 });
      const response = connection.toResponse();

      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache, no-transform');
    });

    it('should handle abort signal', async () => {
      const abortController = new AbortController();
      const connection = new SSEConnection({
        heartbeatInterval: 0,
        abortSignal: abortController.signal,
      });

      expect(connection.isOpen()).toBe(true);

      abortController.abort();

      // Give it time to process abort
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(connection.isOpen()).toBe(false);
    });

    it('should handle timeout', async () => {
      let timeoutCalled = false;

      const connection = new SSEConnection({
        heartbeatInterval: 0,
        timeout: 100,
        onTimeout: () => {
          timeoutCalled = true;
        },
      });

      expect(connection.isOpen()).toBe(true);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(connection.isOpen()).toBe(false);
      expect(timeoutCalled).toBe(true);
    });

    it('should track idle time', async () => {
      const connection = new SSEConnection({ heartbeatInterval: 0 });

      const initialIdle = connection.getIdleTime();

      await new Promise((resolve) => setTimeout(resolve, 50));

      const laterIdle = connection.getIdleTime();

      expect(laterIdle).toBeGreaterThan(initialIdle);

      await connection.close();
    });
  });
});
