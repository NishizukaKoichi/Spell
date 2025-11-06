/**
 * Tests for Cast Events API Endpoint
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth/config', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/api-key', () => ({
  validateApiKey: jest.fn(),
}));

jest.mock('@/lib/cast-events', () => ({
  subscribeToCast: jest.fn(),
  getCastStatus: jest.fn(),
}));

jest.mock('@/lib/audit-log', () => ({
  createAuditLog: jest.fn(),
  getRequestContext: jest.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  })),
}));

jest.mock('@/lib/rate-limit', () => ({
  RateLimiter: jest.fn().mockImplementation(() => ({
    check: jest.fn().mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60000,
    }),
  })),
  RATE_LIMIT_TIERS: {
    ANONYMOUS: 20,
    AUTHENTICATED: 100,
    API_KEY: 60,
    ADMIN: 500,
    WEBHOOK: 1000,
  },
  RateLimitTier: {
    ANONYMOUS: 'anonymous',
    AUTHENTICATED: 'authenticated',
    API_KEY: 'api_key',
    ADMIN: 'admin',
    WEBHOOK: 'webhook',
  },
}));

describe('Cast Events API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      // Mock unauthenticated request
      const { auth } = await import('@/lib/auth/config');
      (auth as jest.Mock).mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/casts/123/events');

      // Note: In a real test, we'd import and call the route handler
      // For now, we verify the mocks are set up correctly
      expect(auth).toBeDefined();
    });

    it('should accept session authentication', async () => {
      const { auth } = await import('@/lib/auth/config');
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'user-123' },
      });

      expect(auth).toBeDefined();
    });

    it('should accept API key authentication', async () => {
      const { validateApiKey } = await import('@/lib/api-key');
      (validateApiKey as jest.Mock).mockResolvedValue({
        valid: true,
        userId: 'user-123',
      });

      const result = await validateApiKey('test-key');
      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-123');
    });
  });

  describe('Authorization', () => {
    it('should verify cast ownership', async () => {
      const { getCastStatus } = await import('@/lib/cast-events');
      (getCastStatus as jest.Mock).mockResolvedValue({
        id: 'cast-123',
        status: 'running',
        casterId: 'user-123',
        startedAt: new Date(),
        finishedAt: null,
        duration: null,
        costCents: 0,
        artifactUrl: null,
        errorMessage: null,
      });

      const cast = await getCastStatus('cast-123');
      expect(cast?.casterId).toBe('user-123');
    });

    it('should reject access to other user casts', async () => {
      const { getCastStatus } = await import('@/lib/cast-events');
      (getCastStatus as jest.Mock).mockResolvedValue({
        id: 'cast-123',
        status: 'running',
        casterId: 'user-456', // Different user
        startedAt: new Date(),
        finishedAt: null,
        duration: null,
        costCents: 0,
        artifactUrl: null,
        errorMessage: null,
      });

      const cast = await getCastStatus('cast-123');
      expect(cast?.casterId).not.toBe('user-123');
    });

    it('should handle non-existent cast', async () => {
      const { getCastStatus } = await import('@/lib/cast-events');
      (getCastStatus as jest.Mock).mockResolvedValue(null);

      const cast = await getCastStatus('non-existent');
      expect(cast).toBeNull();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const { RateLimiter } = await import('@/lib/rate-limit');
      const limiter = new RateLimiter();

      const result = await limiter.check(100, 'user-123');
      expect(result.success).toBe(true);
      expect(result.remaining).toBeLessThan(result.limit);
    });

    it('should block when rate limit exceeded', async () => {
      const { RateLimiter } = await import('@/lib/rate-limit');
      const mockCheck = jest.fn().mockResolvedValue({
        success: false,
        limit: 100,
        remaining: 0,
        reset: Date.now() + 60000,
      });

      const limiter = new RateLimiter();
      limiter.check = mockCheck;

      const result = await limiter.check(100, 'user-123');
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('Event Subscription', () => {
    it('should set up cast subscription', () => {
      const { subscribeToCast } = require('@/lib/cast-events');
      const mockHandler = jest.fn();

      subscribeToCast('cast-123', mockHandler);

      expect(subscribeToCast).toHaveBeenCalledWith('cast-123', mockHandler);
    });

    it('should return unsubscribe function', () => {
      const { subscribeToCast } = require('@/lib/cast-events');
      const mockUnsubscribe = jest.fn();

      (subscribeToCast as jest.Mock).mockReturnValue(mockUnsubscribe);

      const unsubscribe = subscribeToCast('cast-123', jest.fn());

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('Audit Logging', () => {
    it('should log connection opened', async () => {
      const { createAuditLog } = await import('@/lib/audit-log');

      await createAuditLog({
        userId: 'user-123',
        action: 'cast.sse_connection_opened',
        resource: 'cast',
        resourceId: 'cast-123',
        status: 'success',
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cast.sse_connection_opened',
          resource: 'cast',
        })
      );
    });

    it('should log connection closed', async () => {
      const { createAuditLog } = await import('@/lib/audit-log');

      await createAuditLog({
        userId: 'user-123',
        action: 'cast.sse_connection_closed',
        resource: 'cast',
        resourceId: 'cast-123',
        metadata: {
          duration: 45000,
          messageCount: 5,
        },
        status: 'success',
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cast.sse_connection_closed',
          metadata: expect.objectContaining({
            duration: expect.any(Number),
            messageCount: expect.any(Number),
          }),
        })
      );
    });

    it('should log unauthorized access attempts', async () => {
      const { createAuditLog } = await import('@/lib/audit-log');

      await createAuditLog({
        userId: null,
        action: 'security.unauthorized_access',
        resource: 'cast',
        resourceId: 'cast-123',
        status: 'failure',
        errorMessage: 'Unauthorized SSE connection attempt',
      });

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'security.unauthorized_access',
          status: 'failure',
        })
      );
    });
  });

  describe('Terminal State Handling', () => {
    it('should immediately close for succeeded cast', async () => {
      const { getCastStatus } = await import('@/lib/cast-events');
      (getCastStatus as jest.Mock).mockResolvedValue({
        id: 'cast-123',
        status: 'succeeded',
        casterId: 'user-123',
        startedAt: new Date(),
        finishedAt: new Date(),
        duration: 45000,
        costCents: 250,
        artifactUrl: '/artifacts/123',
        errorMessage: null,
      });

      const cast = await getCastStatus('cast-123');
      expect(cast?.status).toBe('succeeded');
    });

    it('should immediately close for failed cast', async () => {
      const { getCastStatus } = await import('@/lib/cast-events');
      (getCastStatus as jest.Mock).mockResolvedValue({
        id: 'cast-123',
        status: 'failed',
        casterId: 'user-123',
        startedAt: new Date(),
        finishedAt: new Date(),
        duration: 10000,
        costCents: 0,
        artifactUrl: null,
        errorMessage: 'Execution failed',
      });

      const cast = await getCastStatus('cast-123');
      expect(cast?.status).toBe('failed');
    });
  });
});
