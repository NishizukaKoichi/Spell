import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  AuditAction,
  AuditResource,
  AuditStatus,
  createAuditLog,
  logAuthLogin,
  logAuthRegister,
  logSpellCreated,
  logCastCreated,
  logPaymentSuccess,
  logApiKeyCreated,
  getIpAddress,
  getUserAgent,
  getRequestContext,
} from '@/lib/audit-log';

// Mock prisma client
const mockPrisma = {
  auditLog: {
    create: mock.fn(async () => ({
      id: 'test-audit-log-id',
      userId: 'test-user-id',
      action: AuditAction.AUTH_LOGIN,
      resource: AuditResource.USER,
      resourceId: 'test-user-id',
      metadata: null,
      ipAddress: null,
      userAgent: null,
      status: AuditStatus.SUCCESS,
      errorMessage: null,
      createdAt: new Date(),
    })),
  },
};

// Mock the prisma import
mock.module('@/lib/prisma', {
  namedExports: {
    prisma: mockPrisma,
  },
});

describe('Audit Log', () => {
  beforeEach(() => {
    // Reset mock call counts
    mockPrisma.auditLog.create.mock.resetCalls();
  });

  describe('createAuditLog', () => {
    it('creates an audit log with all fields', async () => {
      await createAuditLog({
        userId: 'user-123',
        action: AuditAction.AUTH_LOGIN,
        resource: AuditResource.USER,
        resourceId: 'user-123',
        metadata: { method: 'passkey' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: AuditStatus.SUCCESS,
      });

      assert.equal(mockPrisma.auditLog.create.mock.calls.length, 1);
      const createCall = mockPrisma.auditLog.create.mock.calls[0];
      assert.deepEqual(createCall.arguments[0].data, {
        userId: 'user-123',
        action: AuditAction.AUTH_LOGIN,
        resource: AuditResource.USER,
        resourceId: 'user-123',
        metadata: { method: 'passkey' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: AuditStatus.SUCCESS,
        errorMessage: null,
      });
    });

    it('creates an audit log with minimal fields', async () => {
      await createAuditLog({
        action: AuditAction.SPELL_CREATED,
        resource: AuditResource.SPELL,
      });

      assert.equal(mockPrisma.auditLog.create.mock.calls.length, 1);
      const createCall = mockPrisma.auditLog.create.mock.calls[0];
      assert.equal(createCall.arguments[0].data.action, AuditAction.SPELL_CREATED);
      assert.equal(createCall.arguments[0].data.resource, AuditResource.SPELL);
      assert.equal(createCall.arguments[0].data.userId, null);
      assert.equal(createCall.arguments[0].data.status, AuditStatus.SUCCESS);
    });

    it('handles errors gracefully without throwing', async () => {
      // Temporarily make create throw
      const originalCreate = mockPrisma.auditLog.create;
      mockPrisma.auditLog.create = mock.fn(async () => {
        throw new Error('Database error');
      });

      // Should not throw
      await assert.doesNotReject(async () => {
        await createAuditLog({
          action: AuditAction.AUTH_LOGIN,
          resource: AuditResource.USER,
        });
      });

      // Restore original
      mockPrisma.auditLog.create = originalCreate;
    });
  });

  describe('Helper Functions', () => {
    it('logAuthLogin creates correct audit log', async () => {
      await logAuthLogin('user-123', '192.168.1.1', 'Mozilla/5.0', { method: 'passkey' });

      assert.equal(mockPrisma.auditLog.create.mock.calls.length, 1);
      const createCall = mockPrisma.auditLog.create.mock.calls[0];
      assert.equal(createCall.arguments[0].data.action, AuditAction.AUTH_LOGIN);
      assert.equal(createCall.arguments[0].data.userId, 'user-123');
      assert.equal(createCall.arguments[0].data.resource, AuditResource.USER);
    });

    it('logAuthRegister creates correct audit log', async () => {
      await logAuthRegister('user-123', '192.168.1.1', 'Mozilla/5.0', { email: 'test@example.com' });

      assert.equal(mockPrisma.auditLog.create.mock.calls.length, 1);
      const createCall = mockPrisma.auditLog.create.mock.calls[0];
      assert.equal(createCall.arguments[0].data.action, AuditAction.AUTH_REGISTER);
      assert.equal(createCall.arguments[0].data.userId, 'user-123');
    });

    it('logSpellCreated creates correct audit log', async () => {
      await logSpellCreated('user-123', 'spell-456', 'My Spell', { key: 'my-spell' });

      assert.equal(mockPrisma.auditLog.create.mock.calls.length, 1);
      const createCall = mockPrisma.auditLog.create.mock.calls[0];
      assert.equal(createCall.arguments[0].data.action, AuditAction.SPELL_CREATED);
      assert.equal(createCall.arguments[0].data.resource, AuditResource.SPELL);
      assert.equal(createCall.arguments[0].data.resourceId, 'spell-456');
      assert.deepEqual(createCall.arguments[0].data.metadata, {
        spellName: 'My Spell',
        key: 'my-spell',
      });
    });

    it('logCastCreated creates correct audit log', async () => {
      await logCastCreated('user-123', 'cast-789', 'spell-456', { input: { test: true } });

      assert.equal(mockPrisma.auditLog.create.mock.calls.length, 1);
      const createCall = mockPrisma.auditLog.create.mock.calls[0];
      assert.equal(createCall.arguments[0].data.action, AuditAction.CAST_CREATED);
      assert.equal(createCall.arguments[0].data.resource, AuditResource.CAST);
      assert.equal(createCall.arguments[0].data.resourceId, 'cast-789');
    });

    it('logPaymentSuccess creates correct audit log', async () => {
      await logPaymentSuccess('user-123', 'payment-999', 'spell-456', 1000, { currency: 'USD' });

      assert.equal(mockPrisma.auditLog.create.mock.calls.length, 1);
      const createCall = mockPrisma.auditLog.create.mock.calls[0];
      assert.equal(createCall.arguments[0].data.action, AuditAction.PAYMENT_SUCCESS);
      assert.equal(createCall.arguments[0].data.resource, AuditResource.PAYMENT);
      assert.equal(createCall.arguments[0].data.resourceId, 'payment-999');
      assert.deepEqual(createCall.arguments[0].data.metadata, {
        spellId: 'spell-456',
        amountCents: 1000,
        currency: 'USD',
      });
    });

    it('logApiKeyCreated creates correct audit log', async () => {
      await logApiKeyCreated('user-123', 'key-111', 'Production Key', '192.168.1.1');

      assert.equal(mockPrisma.auditLog.create.mock.calls.length, 1);
      const createCall = mockPrisma.auditLog.create.mock.calls[0];
      assert.equal(createCall.arguments[0].data.action, AuditAction.API_KEY_CREATED);
      assert.equal(createCall.arguments[0].data.resource, AuditResource.API_KEY);
      assert.equal(createCall.arguments[0].data.resourceId, 'key-111');
    });
  });

  describe('Request Context Helpers', () => {
    it('getIpAddress extracts IP from x-forwarded-for', () => {
      const mockRequest = {
        headers: new Map([['x-forwarded-for', '192.168.1.1, 10.0.0.1']]),
      } as unknown as Request;

      // Mock headers.get
      mockRequest.headers.get = (name: string) => {
        if (name === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1';
        return null;
      };

      const ip = getIpAddress(mockRequest);
      assert.equal(ip, '192.168.1.1');
    });

    it('getIpAddress extracts IP from x-real-ip', () => {
      const mockRequest = {
        headers: new Map([['x-real-ip', '192.168.1.1']]),
      } as unknown as Request;

      mockRequest.headers.get = (name: string) => {
        if (name === 'x-real-ip') return '192.168.1.1';
        return null;
      };

      const ip = getIpAddress(mockRequest);
      assert.equal(ip, '192.168.1.1');
    });

    it('getIpAddress returns null when no IP headers', () => {
      const mockRequest = {
        headers: new Map(),
      } as unknown as Request;

      mockRequest.headers.get = () => null;

      const ip = getIpAddress(mockRequest);
      assert.equal(ip, null);
    });

    it('getUserAgent extracts user agent', () => {
      const mockRequest = {
        headers: new Map([['user-agent', 'Mozilla/5.0']]),
      } as unknown as Request;

      mockRequest.headers.get = (name: string) => {
        if (name === 'user-agent') return 'Mozilla/5.0';
        return null;
      };

      const userAgent = getUserAgent(mockRequest);
      assert.equal(userAgent, 'Mozilla/5.0');
    });

    it('getRequestContext extracts both IP and user agent', () => {
      const mockRequest = {
        headers: new Map([
          ['x-forwarded-for', '192.168.1.1'],
          ['user-agent', 'Mozilla/5.0'],
        ]),
      } as unknown as Request;

      mockRequest.headers.get = (name: string) => {
        if (name === 'x-forwarded-for') return '192.168.1.1';
        if (name === 'user-agent') return 'Mozilla/5.0';
        return null;
      };

      const context = getRequestContext(mockRequest);
      assert.equal(context.ipAddress, '192.168.1.1');
      assert.equal(context.userAgent, 'Mozilla/5.0');
    });
  });

  describe('Audit Action Enum', () => {
    it('has expected authentication actions', () => {
      assert.equal(AuditAction.AUTH_LOGIN, 'auth.login');
      assert.equal(AuditAction.AUTH_LOGOUT, 'auth.logout');
      assert.equal(AuditAction.AUTH_REGISTER, 'auth.register');
      assert.equal(AuditAction.AUTH_LOGIN_FAILED, 'auth.login_failed');
    });

    it('has expected spell actions', () => {
      assert.equal(AuditAction.SPELL_CREATED, 'spell.created');
      assert.equal(AuditAction.SPELL_UPDATED, 'spell.updated');
      assert.equal(AuditAction.SPELL_DELETED, 'spell.deleted');
    });

    it('has expected cast actions', () => {
      assert.equal(AuditAction.CAST_CREATED, 'cast.created');
      assert.equal(AuditAction.CAST_STARTED, 'cast.started');
      assert.equal(AuditAction.CAST_COMPLETED, 'cast.completed');
      assert.equal(AuditAction.CAST_FAILED, 'cast.failed');
    });

    it('has expected payment actions', () => {
      assert.equal(AuditAction.PAYMENT_SUCCESS, 'payment.success');
      assert.equal(AuditAction.PAYMENT_FAILED, 'payment.failed');
    });
  });
});
