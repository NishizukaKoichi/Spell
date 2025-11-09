// Logging Infrastructure Tests - TKT-015
import { describe, it, mock } from 'node:test';
import * as assert from 'node:assert/strict';

import { logger, createRequestLogger } from '@/lib/logger';

describe('Logging Infrastructure', () => {
  describe('logger', () => {
    it('should have debug, info, warn, error methods', () => {
      assert.equal(typeof logger.debug, 'function');
      assert.equal(typeof logger.info, 'function');
      assert.equal(typeof logger.warn, 'function');
      assert.equal(typeof logger.error, 'function');
    });

    it('should have child method', () => {
      assert.equal(typeof logger.child, 'function');
    });

    it('should log messages without throwing', () => {
      // Capture console output
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      let logCalled = false;
      let warnCalled = false;
      let errorCalled = false;

      console.log = () => {
        logCalled = true;
      };
      console.warn = () => {
        warnCalled = true;
      };
      console.error = () => {
        errorCalled = true;
      };

      try {
        logger.debug('Debug message');
        logger.info('Info message');
        logger.warn('Warning message');
        logger.error('Error message');

        // Info should be logged in test environment (minLevel is 'warn')
        // So only warn and error should be called
        assert.equal(warnCalled, true);
        assert.equal(errorCalled, true);
      } finally {
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
      }
    });

    it('should log with context', () => {
      const originalWarn = console.warn;
      let loggedMessage = '';

      console.warn = (message: string) => {
        loggedMessage = message;
      };

      try {
        logger.warn('Test message', { userId: '123', action: 'test' });

        // Warn level should be logged
        assert.ok(loggedMessage.length > 0);
        assert.ok(loggedMessage.includes('Test message'));
        assert.ok(loggedMessage.includes('123'));
        assert.ok(loggedMessage.includes('test'));
      } finally {
        console.warn = originalWarn;
      }
    });

    it('should log errors with stack trace', () => {
      const originalError = console.error;
      let loggedMessage = '';

      console.error = (message: string) => {
        loggedMessage = message;
      };

      try {
        const error = new Error('Test error');
        logger.error('Error occurred', error);

        // Should have logged
        assert.ok(loggedMessage.length > 0);

        // Should contain error information
        assert.ok(loggedMessage.includes('Test error'));
      } finally {
        console.error = originalError;
      }
    });
  });

  describe('logger.child', () => {
    it('should create child logger with persistent context', () => {
      const childLogger = logger.child({ requestId: 'req-123' });

      assert.equal(typeof childLogger.debug, 'function');
      assert.equal(typeof childLogger.info, 'function');
      assert.equal(typeof childLogger.warn, 'function');
      assert.equal(typeof childLogger.error, 'function');
    });

    it('should merge parent and child context', () => {
      const originalWarn = console.warn;
      let loggedMessage = '';

      console.warn = (message: string) => {
        loggedMessage = message;
      };

      try {
        const childLogger = logger.child({ requestId: 'req-123' });
        childLogger.warn('Test warning', { userId: 'user-456' });

        // Should contain both parent and child context
        assert.ok(loggedMessage.includes('req-123'));
        assert.ok(loggedMessage.includes('user-456'));
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe('createRequestLogger', () => {
    it('should create logger with request context', () => {
      const requestLogger = createRequestLogger('req-123', '/api/test', 'GET');

      assert.equal(typeof requestLogger.debug, 'function');
      assert.equal(typeof requestLogger.info, 'function');
      assert.equal(typeof requestLogger.warn, 'function');
      assert.equal(typeof requestLogger.error, 'function');
    });

    it('should include request context in logs', () => {
      const originalWarn = console.warn;
      let loggedMessage = '';

      console.warn = (message: string) => {
        loggedMessage = message;
      };

      try {
        const requestLogger = createRequestLogger('req-456', '/api/spells', 'POST');
        requestLogger.warn('Request warning');

        // Should contain request context
        assert.ok(loggedMessage.includes('req-456'));
        assert.ok(loggedMessage.includes('/api/spells'));
        assert.ok(loggedMessage.includes('POST'));
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe('log formatting', () => {
    it('should include timestamp in logs', () => {
      const originalError = console.error;
      let loggedMessage = '';

      console.error = (message: string) => {
        loggedMessage = message;
      };

      try {
        logger.error('Test error');

        // Should contain ISO timestamp
        assert.ok(loggedMessage.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/));
      } finally {
        console.error = originalError;
      }
    });

    it('should include log level in output', () => {
      const originalError = console.error;
      let loggedMessage = '';

      console.error = (message: string) => {
        loggedMessage = message;
      };

      try {
        logger.error('Test error');

        // Should contain level indicator
        assert.ok(
          loggedMessage.includes('error') ||
            loggedMessage.includes('ERROR') ||
            loggedMessage.includes('"level":"error"')
        );
      } finally {
        console.error = originalError;
      }
    });
  });
});
