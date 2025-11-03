import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatCurrency } from '@/lib/utils';

describe('formatCurrency', () => {
  it('formats amounts with default options', () => {
    assert.equal(formatCurrency(12345), '$123.45');
    assert.equal(formatCurrency(0), '$0.00');
    assert.equal(formatCurrency(-12345), '-$123.45');
  });

  it('applies custom currency and locale defaults', () => {
    assert.equal(formatCurrency(123400, { currency: 'JPY', locale: 'ja-JP' }), '￥1,234');
    assert.equal(formatCurrency(125000, { currency: 'JPY', locale: 'ja-JP' }), '￥1,250');
  });

  it('allows overriding fraction digits', () => {
    const formatted = formatCurrency(1234, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });

    assert.equal(formatted, '$12.3400');
  });

  it('rejects NaN or non-finite values', () => {
    assert.throws(() => formatCurrency(Number.NaN), /Invalid amount/);
    assert.throws(() => formatCurrency(Number.POSITIVE_INFINITY), /Invalid amount/);
    assert.throws(() => formatCurrency(Number.NEGATIVE_INFINITY), /Invalid amount/);
  });
});
