import { test, describe } from 'node:test';
import assert from 'node:assert';
import { calculateWasmCost } from '@/lib/wasm/metrics';

describe('WASM Metrics', () => {
  describe('calculateWasmCost', () => {
    test('should calculate cost for basic execution', () => {
      // 1 second execution, 100MB memory
      const cost = calculateWasmCost(1000, 100);

      // Time cost: 1 second * 0.1 cents = 0.1 cents
      // Memory cost: 100 MB * 0.01 cents = 1 cent
      // Total: 1.1 cents, rounded up to 2 cents
      assert.strictEqual(cost, 2);
    });

    test('should apply minimum cost', () => {
      // Very short execution
      const cost = calculateWasmCost(10, 1);

      // Even tiny executions cost at least 1 cent
      assert.strictEqual(cost, 1);
    });

    test('should scale with execution time', () => {
      const cost1 = calculateWasmCost(1000, 0); // 1 second
      const cost2 = calculateWasmCost(10000, 0); // 10 seconds

      // Cost should increase with time
      assert.ok(cost2 > cost1);
    });

    test('should scale with memory usage', () => {
      const cost1 = calculateWasmCost(0, 100); // 100MB
      const cost2 = calculateWasmCost(0, 500); // 500MB

      // Cost should increase with memory
      assert.ok(cost2 > cost1);
    });

    test('should handle large executions', () => {
      // 5 minutes (300 seconds), 512MB
      const cost = calculateWasmCost(300000, 512);

      // Time: 300 * 0.1 = 30 cents
      // Memory: 512 * 0.01 = 5.12 cents
      // Total: 35.12 cents, rounded up to 36 cents
      assert.strictEqual(cost, 36);
    });

    test('should round up fractional cents', () => {
      // Execution that results in fractional cents
      const cost = calculateWasmCost(1500, 50);

      // Time: 1.5 * 0.1 = 0.15 cents
      // Memory: 50 * 0.01 = 0.5 cents
      // Total: 0.65 cents, should round up to 1 cent
      assert.strictEqual(cost, 1);
    });

    test('should handle zero values', () => {
      const cost = calculateWasmCost(0, 0);

      // Even zero execution should cost minimum
      assert.strictEqual(cost, 1);
    });
  });
});
