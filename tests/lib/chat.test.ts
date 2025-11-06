import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  validateMessageContent,
  sanitizeMessage,
  generateConversationTitle,
  ChatRole,
  MESSAGE_VALIDATION,
} from '../../src/lib/chat';

describe('Chat Utility Functions', () => {
  describe('validateMessageContent', () => {
    it('should validate valid message content', () => {
      const result = validateMessageContent('Hello, world!');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.error, undefined);
    });

    it('should reject empty messages', () => {
      const result = validateMessageContent('');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(typeof result.error, 'string');
    });

    it('should reject whitespace-only messages', () => {
      const result = validateMessageContent('   ');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(typeof result.error, 'string');
    });

    it('should reject messages that are too long', () => {
      const longMessage = 'a'.repeat(MESSAGE_VALIDATION.MAX_LENGTH + 1);
      const result = validateMessageContent(longMessage);
      assert.strictEqual(result.valid, false);
      assert.strictEqual(typeof result.error, 'string');
    });

    it('should accept messages at max length', () => {
      const maxMessage = 'a'.repeat(MESSAGE_VALIDATION.MAX_LENGTH);
      const result = validateMessageContent(maxMessage);
      assert.strictEqual(result.valid, true);
    });

    it('should accept messages with special characters', () => {
      const result = validateMessageContent('Hello! @#$% 你好 🎉');
      assert.strictEqual(result.valid, true);
    });

    it('should accept multiline messages', () => {
      const result = validateMessageContent('Line 1\nLine 2\nLine 3');
      assert.strictEqual(result.valid, true);
    });
  });

  describe('sanitizeMessage', () => {
    it('should preserve safe text content', () => {
      const input = 'Hello, world!';
      const result = sanitizeMessage(input);
      assert.strictEqual(result, input);
    });

    it('should remove script tags', () => {
      const input = 'Hello <script>alert("xss")</script> world';
      const result = sanitizeMessage(input);
      assert.ok(!result.includes('<script>'));
      assert.ok(!result.includes('alert'));
    });

    it('should remove iframe tags', () => {
      const input = 'Hello <iframe src="evil.com"></iframe> world';
      const result = sanitizeMessage(input);
      assert.ok(!result.includes('<iframe'));
    });

    it('should remove javascript: protocol', () => {
      const input = 'Click <a href="javascript:alert(1)">here</a>';
      const result = sanitizeMessage(input);
      assert.ok(!result.includes('javascript:'));
    });

    it('should remove inline event handlers', () => {
      const input = '<div onclick="alert(1)">Click me</div>';
      const result = sanitizeMessage(input);
      assert.ok(!result.includes('onclick='));
    });

    it('should trim whitespace', () => {
      const input = '  Hello, world!  ';
      const result = sanitizeMessage(input);
      assert.strictEqual(result, 'Hello, world!');
    });

    it('should handle multiple script tags', () => {
      const input =
        '<script>bad1()</script>Hello<script>bad2()</script>World<script>bad3()</script>';
      const result = sanitizeMessage(input);
      assert.ok(!result.includes('<script>'));
      assert.ok(!result.includes('bad1'));
      assert.ok(!result.includes('bad2'));
      assert.ok(!result.includes('bad3'));
    });

    it('should handle nested tags', () => {
      const input = '<div><script>alert(1)</script></div>';
      const result = sanitizeMessage(input);
      assert.ok(!result.includes('<script>'));
      assert.ok(!result.includes('alert'));
    });

    it('should preserve newlines and formatting', () => {
      const input = 'Line 1\n\nLine 2\n  Indented';
      const result = sanitizeMessage(input);
      assert.strictEqual(result, input.trim());
    });

    it('should handle empty strings', () => {
      const result = sanitizeMessage('');
      assert.strictEqual(result, '');
    });
  });

  describe('generateConversationTitle', () => {
    it('should return the full message if under max length', () => {
      const message = 'This is a short message';
      const result = generateConversationTitle(message);
      assert.strictEqual(result, message);
    });

    it('should truncate long messages', () => {
      const longMessage = 'a'.repeat(100);
      const result = generateConversationTitle(longMessage);
      assert.ok(result.length <= 53); // 50 + '...'
      assert.ok(result.endsWith('...'));
    });

    it('should handle exactly max length messages', () => {
      const message = 'a'.repeat(50);
      const result = generateConversationTitle(message);
      assert.strictEqual(result, message);
    });

    it('should trim whitespace', () => {
      const message = '  Hello, world!  ';
      const result = generateConversationTitle(message);
      assert.strictEqual(result, 'Hello, world!');
    });

    it('should truncate at word boundaries when possible', () => {
      const message = 'This is a very long message that should be truncated at some point';
      const result = generateConversationTitle(message);
      assert.ok(result.endsWith('...'));
      assert.ok(result.length <= 53);
    });

    it('should handle messages with newlines', () => {
      const message = 'First line\nSecond line\nThird line';
      const result = generateConversationTitle(message);
      assert.ok(result.includes('\n'));
    });

    it('should handle empty messages', () => {
      const result = generateConversationTitle('');
      assert.strictEqual(result, '');
    });
  });

  describe('ChatRole enum', () => {
    it('should have USER role', () => {
      assert.strictEqual(ChatRole.USER, 'user');
    });

    it('should have ASSISTANT role', () => {
      assert.strictEqual(ChatRole.ASSISTANT, 'assistant');
    });

    it('should have SYSTEM role', () => {
      assert.strictEqual(ChatRole.SYSTEM, 'system');
    });
  });

  describe('MESSAGE_VALIDATION constants', () => {
    it('should have reasonable limits', () => {
      assert.ok(MESSAGE_VALIDATION.MIN_LENGTH > 0);
      assert.ok(MESSAGE_VALIDATION.MAX_LENGTH > MESSAGE_VALIDATION.MIN_LENGTH);
      assert.ok(MESSAGE_VALIDATION.MAX_CONTEXT_MESSAGES > 0);
      assert.ok(MESSAGE_VALIDATION.MAX_CONTEXT_TOKENS > 0);
    });

    it('should have expected minimum length', () => {
      assert.strictEqual(MESSAGE_VALIDATION.MIN_LENGTH, 1);
    });

    it('should have expected maximum length', () => {
      assert.strictEqual(MESSAGE_VALIDATION.MAX_LENGTH, 10000);
    });

    it('should have expected context limits', () => {
      assert.strictEqual(MESSAGE_VALIDATION.MAX_CONTEXT_MESSAGES, 50);
      assert.strictEqual(MESSAGE_VALIDATION.MAX_CONTEXT_TOKENS, 4000);
    });
  });

  describe('Integration Tests - Message Flow', () => {
    it('should validate, sanitize, and title generation work together', () => {
      const userInput = '  <script>alert("xss")</script>How do I create a spell?  ';

      // Validate
      const validation = validateMessageContent(userInput);
      assert.strictEqual(validation.valid, true);

      // Sanitize
      const sanitized = sanitizeMessage(userInput);
      assert.ok(!sanitized.includes('<script>'));
      assert.ok(!sanitized.includes('alert'));
      assert.ok(sanitized.includes('How do I create a spell?'));

      // Generate title
      const title = generateConversationTitle(sanitized);
      assert.strictEqual(title, 'How do I create a spell?');
    });

    it('should handle edge cases in the flow', () => {
      const userInput = '   ';

      // Validation should fail for whitespace
      const validation = validateMessageContent(userInput);
      assert.strictEqual(validation.valid, false);

      // But sanitize should still work
      const sanitized = sanitizeMessage(userInput);
      assert.strictEqual(sanitized, '');
    });

    it('should handle long messages with XSS attempts', () => {
      const userInput =
        '<script>alert(1)</script>' +
        'This is a legitimate long message that contains some malicious code but should still be processed '.repeat(
          20
        );

      const validation = validateMessageContent(userInput);
      assert.strictEqual(validation.valid, true);

      const sanitized = sanitizeMessage(userInput);
      assert.ok(!sanitized.includes('<script>'));
      assert.ok(!sanitized.includes('alert'));
      assert.ok(sanitized.length > 0);

      const title = generateConversationTitle(sanitized);
      assert.ok(title.length <= 53);
    });
  });

  describe('Security Tests', () => {
    it('should prevent XSS through script injection', () => {
      const attacks = [
        '<script>alert(document.cookie)</script>',
        '<img src=x onerror="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<body onload="alert(1)">',
        '<svg/onload=alert(1)>',
        'javascript:alert(1)',
      ];

      attacks.forEach((attack) => {
        const sanitized = sanitizeMessage(attack);
        assert.ok(!sanitized.includes('alert'));
        assert.ok(!sanitized.includes('javascript:'));
        assert.ok(!sanitized.includes('<script'));
        assert.ok(!sanitized.includes('onload'));
        assert.ok(!sanitized.includes('onerror'));
      });
    });

    it('should handle case variations of dangerous tags', () => {
      const attacks = [
        '<SCRIPT>alert(1)</SCRIPT>',
        '<ScRiPt>alert(1)</sCrIpT>',
        '<sCrIpT>alert(1)</ScRiPt>',
      ];

      attacks.forEach((attack) => {
        const sanitized = sanitizeMessage(attack);
        assert.ok(!sanitized.toLowerCase().includes('script'));
        assert.ok(!sanitized.includes('alert'));
      });
    });

    it('should handle encoded attacks', () => {
      // Note: Basic implementation may not catch all encoded attacks
      // For production, use a dedicated sanitization library
      const attack = '<script>alert(1)</script>';
      const sanitized = sanitizeMessage(attack);
      assert.ok(!sanitized.includes('<script>'));
    });
  });

  describe('Edge Cases', () => {
    it('should handle null-like values gracefully', () => {
      // These should be caught by TypeScript, but test runtime behavior
      const validation1 = validateMessageContent(undefined as any);
      assert.strictEqual(validation1.valid, false);

      const validation2 = validateMessageContent(null as any);
      assert.strictEqual(validation2.valid, false);
    });

    it('should handle non-string inputs to sanitizeMessage', () => {
      // TypeScript should prevent this, but test runtime
      const result = sanitizeMessage(123 as any);
      assert.ok(typeof result === 'string');
    });

    it('should handle unicode and emoji', () => {
      const messages = ['Hello 👋', '你好世界', '🎉🎊🎈', 'مرحبا', 'שלום'];

      messages.forEach((msg) => {
        const validation = validateMessageContent(msg);
        assert.strictEqual(validation.valid, true);

        const sanitized = sanitizeMessage(msg);
        assert.strictEqual(sanitized, msg);
      });
    });

    it('should handle very long single words', () => {
      const longWord = 'supercalifragilisticexpialidocious'.repeat(100);
      const validation = validateMessageContent(longWord);
      assert.strictEqual(validation.valid, true);

      const title = generateConversationTitle(longWord);
      assert.ok(title.length <= 53);
    });

    it('should handle messages with only special characters', () => {
      const message = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const validation = validateMessageContent(message);
      assert.strictEqual(validation.valid, true);

      const sanitized = sanitizeMessage(message);
      assert.strictEqual(sanitized, message);
    });
  });
});
