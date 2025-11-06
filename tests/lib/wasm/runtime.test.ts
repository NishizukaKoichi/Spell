import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  validateWasmModule,
  calculateWasmHash,
  loadWasmModule,
  executeWasm,
  checkWasmExports,
  getWasmModuleInfo,
  WasmRuntimeError,
} from '@/lib/wasm/runtime';

describe('WASM Runtime', () => {
  describe('validateWasmModule', () => {
    test('should validate correct WASM magic number', () => {
      // WASM magic number: 0x00 0x61 0x73 0x6D
      const validWasm = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
      assert.strictEqual(validateWasmModule(validWasm), true);
    });

    test('should reject invalid magic number', () => {
      const invalidWasm = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      assert.strictEqual(validateWasmModule(invalidWasm), false);
    });

    test('should reject too short buffer', () => {
      const shortBuffer = Buffer.from([0x00, 0x61]);
      assert.strictEqual(validateWasmModule(shortBuffer), false);
    });
  });

  describe('calculateWasmHash', () => {
    test('should calculate SHA-256 hash', () => {
      const wasmBinary = Buffer.from([0x00, 0x61, 0x73, 0x6d]);
      const hash = calculateWasmHash(wasmBinary);

      assert.strictEqual(typeof hash, 'string');
      assert.strictEqual(hash.length, 64); // SHA-256 is 64 hex characters
    });

    test('should produce consistent hashes', () => {
      const wasmBinary = Buffer.from([0x00, 0x61, 0x73, 0x6d]);
      const hash1 = calculateWasmHash(wasmBinary);
      const hash2 = calculateWasmHash(wasmBinary);

      assert.strictEqual(hash1, hash2);
    });

    test('should produce different hashes for different content', () => {
      const wasm1 = Buffer.from([0x00, 0x61, 0x73, 0x6d]);
      const wasm2 = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01]);

      const hash1 = calculateWasmHash(wasm1);
      const hash2 = calculateWasmHash(wasm2);

      assert.notStrictEqual(hash1, hash2);
    });
  });

  describe('loadWasmModule', () => {
    test('should load valid minimal WASM module', async () => {
      // Minimal valid WASM module
      const minimalWasm = Buffer.from([
        0x00, 0x61, 0x73, 0x6d, // magic number
        0x01, 0x00, 0x00, 0x00, // version
      ]);

      const module = await loadWasmModule(minimalWasm);
      assert.ok(module instanceof WebAssembly.Module);
    });

    test('should throw on invalid WASM', async () => {
      const invalidWasm = Buffer.from([0x00, 0x00, 0x00, 0x00]);

      await assert.rejects(
        async () => {
          await loadWasmModule(invalidWasm);
        },
        (error: Error) => {
          assert.ok(error instanceof WasmRuntimeError);
          assert.strictEqual(error.name, 'WasmRuntimeError');
          return true;
        }
      );
    });
  });

  describe('executeWasm', () => {
    test('should execute simple WASM module', async () => {
      // Create a minimal WASM module with an exported function
      const wasmCode = Buffer.from([
        0x00, 0x61, 0x73, 0x6d, // magic
        0x01, 0x00, 0x00, 0x00, // version
        0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f, // type section: () -> i32
        0x03, 0x02, 0x01, 0x00, // function section
        0x07, 0x08, 0x01, 0x04, 0x6d, 0x61, 0x69, 0x6e, 0x00, 0x00, // export "main"
        0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x00, 0x0b, // code section: return 0
      ]);

      const module = await loadWasmModule(wasmCode);
      const result = await executeWasm(module);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.exitCode, 0);
      assert.ok(result.executionTimeMs >= 0);
    });

    test('should enforce execution timeout', async () => {
      // This test would need a module that runs for a long time
      // For now, we just test that the timeout parameter is accepted
      const wasmCode = Buffer.from([
        0x00, 0x61, 0x73, 0x6d,
        0x01, 0x00, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
        0x03, 0x02, 0x01, 0x00,
        0x07, 0x08, 0x01, 0x04, 0x6d, 0x61, 0x69, 0x6e, 0x00, 0x00,
        0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x00, 0x0b,
      ]);

      const module = await loadWasmModule(wasmCode);
      const result = await executeWasm(module, {
        timeout: 1000, // 1 second timeout
      });

      // Should complete successfully within timeout
      assert.strictEqual(result.success, true);
    });

    test('should track execution metrics', async () => {
      const wasmCode = Buffer.from([
        0x00, 0x61, 0x73, 0x6d,
        0x01, 0x00, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
        0x03, 0x02, 0x01, 0x00,
        0x07, 0x08, 0x01, 0x04, 0x6d, 0x61, 0x69, 0x6e, 0x00, 0x00,
        0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x00, 0x0b,
      ]);

      const module = await loadWasmModule(wasmCode);
      const result = await executeWasm(module);

      assert.ok(typeof result.executionTimeMs === 'number');
      assert.ok(result.executionTimeMs >= 0);
      assert.ok(typeof result.memoryUsedMb === 'number');
      assert.ok(result.memoryUsedMb >= 0);
    });
  });

  describe('checkWasmExports', () => {
    test('should check for required exports', async () => {
      const wasmCode = Buffer.from([
        0x00, 0x61, 0x73, 0x6d,
        0x01, 0x00, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
        0x03, 0x02, 0x01, 0x00,
        0x07, 0x08, 0x01, 0x04, 0x6d, 0x61, 0x69, 0x6e, 0x00, 0x00, // exports "main"
        0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x00, 0x0b,
      ]);

      const module = await loadWasmModule(wasmCode);

      // Check for existing export
      const result1 = checkWasmExports(module, ['main']);
      assert.strictEqual(result1.valid, true);
      assert.strictEqual(result1.missing.length, 0);

      // Check for missing export
      const result2 = checkWasmExports(module, ['execute']);
      assert.strictEqual(result2.valid, false);
      assert.deepStrictEqual(result2.missing, ['execute']);

      // Check for multiple exports
      const result3 = checkWasmExports(module, ['main', 'execute']);
      assert.strictEqual(result3.valid, false);
      assert.deepStrictEqual(result3.missing, ['execute']);
    });
  });

  describe('getWasmModuleInfo', () => {
    test('should get module metadata', async () => {
      const wasmCode = Buffer.from([
        0x00, 0x61, 0x73, 0x6d,
        0x01, 0x00, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
        0x03, 0x02, 0x01, 0x00,
        0x07, 0x08, 0x01, 0x04, 0x6d, 0x61, 0x69, 0x6e, 0x00, 0x00,
        0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x00, 0x0b,
      ]);

      const module = await loadWasmModule(wasmCode);
      const info = getWasmModuleInfo(module);

      assert.ok(Array.isArray(info.imports));
      assert.ok(Array.isArray(info.exports));
      assert.ok(Array.isArray(info.customSections));

      // Should have at least one export (main)
      assert.ok(info.exports.length >= 1);
      assert.ok(info.exports.some((exp) => exp.name === 'main'));
    });
  });
});
