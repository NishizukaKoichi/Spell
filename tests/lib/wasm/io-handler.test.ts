import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  serializeInput,
  deserializeOutput,
  detectDataType,
  validateInput,
  formatOutput,
  parseInput,
} from '@/lib/wasm/io-handler';

describe('WASM I/O Handler', () => {
  describe('serializeInput', () => {
    test('should serialize string input', () => {
      const input = 'Hello, World!';
      const buffer = serializeInput(input);

      assert.ok(Buffer.isBuffer(buffer));
      assert.strictEqual(buffer.toString('utf8'), input);
    });

    test('should serialize number input', () => {
      const input = 42;
      const buffer = serializeInput(input);

      assert.ok(Buffer.isBuffer(buffer));
      assert.strictEqual(buffer.toString('utf8'), '42');
    });

    test('should serialize boolean input', () => {
      const buffer1 = serializeInput(true);
      const buffer2 = serializeInput(false);

      assert.strictEqual(buffer1.toString('utf8'), 'true');
      assert.strictEqual(buffer2.toString('utf8'), 'false');
    });

    test('should serialize object as JSON', () => {
      const input = { name: 'Alice', age: 30 };
      const buffer = serializeInput(input);

      const parsed = JSON.parse(buffer.toString('utf8'));
      assert.deepStrictEqual(parsed, input);
    });

    test('should serialize array as JSON', () => {
      const input = [1, 2, 3, 4, 5];
      const buffer = serializeInput(input);

      const parsed = JSON.parse(buffer.toString('utf8'));
      assert.deepStrictEqual(parsed, input);
    });

    test('should serialize null', () => {
      const buffer = serializeInput(null);
      assert.strictEqual(buffer.toString('utf8'), 'null');
    });

    test('should handle buffer input', () => {
      const input = Buffer.from('test');
      const buffer = serializeInput(input);

      assert.ok(Buffer.isBuffer(buffer));
      assert.strictEqual(buffer.toString('utf8'), 'test');
    });

    test('should enforce size limits', () => {
      const largeInput = 'x'.repeat(200 * 1024 * 1024); // 200MB

      assert.throws(
        () => {
          serializeInput(largeInput, { maxSize: 100 * 1024 * 1024 }); // 100MB limit
        },
        (error: Error) => {
          assert.ok(error.message.includes('exceeds maximum allowed size'));
          return true;
        }
      );
    });
  });

  describe('deserializeOutput', () => {
    test('should deserialize JSON', () => {
      const json = { message: 'Hello', count: 42 };
      const buffer = Buffer.from(JSON.stringify(json));

      const result = deserializeOutput(buffer, 'json');
      assert.deepStrictEqual(result, json);
    });

    test('should deserialize text', () => {
      const text = 'Hello, World!';
      const buffer = Buffer.from(text);

      const result = deserializeOutput(buffer, 'text');
      assert.strictEqual(result, text);
    });

    test('should deserialize number', () => {
      const buffer = Buffer.from('123.45');

      const result = deserializeOutput(buffer, 'number');
      assert.strictEqual(result, 123.45);
    });

    test('should deserialize boolean', () => {
      const buffer1 = Buffer.from('true');
      const buffer2 = Buffer.from('false');

      assert.strictEqual(deserializeOutput(buffer1, 'boolean'), true);
      assert.strictEqual(deserializeOutput(buffer2, 'boolean'), false);
    });

    test('should return binary buffer', () => {
      const input = Buffer.from([1, 2, 3, 4]);

      const result = deserializeOutput(input, 'binary');
      assert.ok(Buffer.isBuffer(result));
      assert.deepStrictEqual(result, input);
    });

    test('should throw on invalid JSON', () => {
      const buffer = Buffer.from('invalid json');

      assert.throws(() => {
        deserializeOutput(buffer, 'json');
      });
    });

    test('should throw on invalid number', () => {
      const buffer = Buffer.from('not a number');

      assert.throws(() => {
        deserializeOutput(buffer, 'number');
      });
    });

    test('should enforce size limits', () => {
      const largeBuffer = Buffer.alloc(200 * 1024 * 1024); // 200MB

      assert.throws(
        () => {
          deserializeOutput(largeBuffer, 'text', { maxSize: 100 * 1024 * 1024 });
        },
        (error: Error) => {
          assert.ok(error.message.includes('exceeds maximum allowed size'));
          return true;
        }
      );
    });
  });

  describe('detectDataType', () => {
    test('should detect string type', () => {
      assert.strictEqual(detectDataType('hello'), 'text');
    });

    test('should detect number type', () => {
      assert.strictEqual(detectDataType(42), 'number');
      assert.strictEqual(detectDataType(3.14), 'number');
    });

    test('should detect boolean type', () => {
      assert.strictEqual(detectDataType(true), 'boolean');
      assert.strictEqual(detectDataType(false), 'boolean');
    });

    test('should detect binary type', () => {
      assert.strictEqual(detectDataType(Buffer.from('test')), 'binary');
      assert.strictEqual(detectDataType(new Uint8Array([1, 2, 3])), 'binary');
    });

    test('should detect json type for objects', () => {
      assert.strictEqual(detectDataType({ key: 'value' }), 'json');
      assert.strictEqual(detectDataType([1, 2, 3]), 'json');
    });
  });

  describe('validateInput', () => {
    test('should validate without schema', () => {
      const result = validateInput({ anything: 'goes' });

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('should validate object type', () => {
      const schema = { type: 'object' };

      const result1 = validateInput({}, schema);
      assert.strictEqual(result1.valid, true);

      const result2 = validateInput('not an object', schema);
      assert.strictEqual(result2.valid, false);
      assert.ok(result2.errors.length > 0);
    });

    test('should validate string type', () => {
      const schema = { type: 'string' };

      const result1 = validateInput('hello', schema);
      assert.strictEqual(result1.valid, true);

      const result2 = validateInput(123, schema);
      assert.strictEqual(result2.valid, false);
    });

    test('should validate number type', () => {
      const schema = { type: 'number' };

      const result1 = validateInput(42, schema);
      assert.strictEqual(result1.valid, true);

      const result2 = validateInput('42', schema);
      assert.strictEqual(result2.valid, false);
    });

    test('should validate array type', () => {
      const schema = { type: 'array' };

      const result1 = validateInput([1, 2, 3], schema);
      assert.strictEqual(result1.valid, true);

      const result2 = validateInput({ not: 'array' }, schema);
      assert.strictEqual(result2.valid, false);
    });

    test('should validate required properties', () => {
      const schema = {
        type: 'object',
        properties: { name: {}, age: {} },
        required: ['name', 'age'],
      };

      const result1 = validateInput({ name: 'Alice', age: 30 }, schema);
      assert.strictEqual(result1.valid, true);

      const result2 = validateInput({ name: 'Bob' }, schema);
      assert.strictEqual(result2.valid, false);
      assert.ok(result2.errors.some((e) => e.includes('age')));
    });
  });

  describe('formatOutput', () => {
    test('should format as JSON', () => {
      const data = { message: 'hello' };
      const result = formatOutput(data, 'json');

      assert.deepStrictEqual(result, data);
    });

    test('should format as text', () => {
      const result1 = formatOutput('hello', 'text');
      assert.strictEqual(result1, 'hello');

      const result2 = formatOutput({ key: 'value' }, 'text');
      assert.strictEqual(result2, '{"key":"value"}');

      const buffer = Buffer.from('test');
      const result3 = formatOutput(buffer, 'text');
      assert.strictEqual(result3, 'test');
    });

    test('should format as base64', () => {
      const buffer = Buffer.from('hello');
      const result = formatOutput(buffer, 'base64');

      assert.strictEqual(result, buffer.toString('base64'));
    });
  });

  describe('parseInput', () => {
    test('should parse based on content-type', () => {
      const result1 = parseInput({ key: 'value' }, 'application/json');
      assert.deepStrictEqual(result1.data, { key: 'value' });
      assert.strictEqual(result1.type, 'json');

      const result2 = parseInput('hello', 'text/plain');
      assert.strictEqual(result2.data, 'hello');
      assert.strictEqual(result2.type, 'text');

      const result3 = parseInput(Buffer.from('test'), 'application/octet-stream');
      assert.strictEqual(result3.type, 'binary');
    });

    test('should auto-detect type when no content-type', () => {
      const result1 = parseInput('hello');
      assert.strictEqual(result1.type, 'text');

      const result2 = parseInput(123);
      assert.strictEqual(result2.type, 'number');

      const result3 = parseInput({ key: 'value' });
      assert.strictEqual(result3.type, 'json');
    });

    test('should handle null input', () => {
      const result = parseInput(null);
      assert.strictEqual(result.data, null);
      assert.strictEqual(result.type, 'json');
    });
  });
});
