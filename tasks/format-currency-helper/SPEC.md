# Format Currency Helper

## Overview

Introduce a reusable currency formatter so frontend code can display monetary values that originate from billing APIs without duplicating formatting logic.

## Requirements

1. Create a new exported function `formatCurrency(amountInCents: number, options?: { currency?: string; locale?: string; minimumFractionDigits?: number; maximumFractionDigits?: number }): string` in `src/lib/utils.ts`.
2. `amountInCents` represents the value in the smallest unit (e.g. cents). The formatter must convert it back to major units (e.g. dollars) before formatting.
3. Defaults:
   - `currency`: `"USD"`
   - `locale`: `"en-US"`
   - `minimumFractionDigits`: Currency standard (fallback `2` if unavailable)
   - `maximumFractionDigits`: Currency standard (fallback `2` if unavailable)
4. Use `Intl.NumberFormat` to format the value. The implementation must:
   - Preserve the sign for negative values (e.g. `-12345` → `-$123.45` with defaults).
   - Round correctly using standard half away from zero rules (handled by `Intl.NumberFormat`).
   - Allow overriding `minimumFractionDigits` and `maximumFractionDigits`.
5. Reject `NaN` or non-finite values by throwing an `Error` with the message `"Invalid amount"`.

## Tests

Add unit tests in `tests/lib/utils.test.ts` that cover:

1. Default formatting for positive amounts, zero, and negative amounts.
2. Custom currency (e.g. `JPY`) and locale (`ja-JP`) showing no decimals by default.
3. Custom fraction digit overrides (e.g. showing four decimals).
4. Error thrown when `amountInCents` is `NaN` or `Infinity`.

## Definition of Done

- All new tests fail before implementation and pass after implementation.
- No existing tests regress.
- Snapshot reflects the current state of work.
