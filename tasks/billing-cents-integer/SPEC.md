# Billing Cents Integer Migration

## Overview
Migrate all monetary amounts from Float (dollars) to Int (cents) to eliminate floating-point precision issues in billing calculations.

## Requirements

### 1. Database Schema Changes
Modify `prisma/schema.prisma`:
- `Spell.priceAmount`: `Float` → `Int` (rename to `priceAmountCents` for clarity)
- `budgets.monthlyCap`: `Float` → `Int` (rename to `monthlyCapCents`)
- `budgets.currentSpend`: `Float` → `Int` (rename to `currentSpendCents`)
- `Cast.costCents`: Already `Int` ✅ (no change needed)

### 2. Data Migration
Create Prisma migration that:
1. Adds new Int columns (`priceAmountCents`, `monthlyCapCents`, `currentSpendCents`)
2. Copies data: `newColumn = ROUND(oldColumn * 100)`
3. Drops old Float columns
4. Handles edge cases (NULL values, negative amounts)

### 3. API Routes Update
Update all routes that read/write monetary values:
- `src/app/api/budget/route.ts` - GET/POST budget cap
- `src/app/api/budget/reset/route.ts` - Budget reset
- `src/app/api/cast/route.ts` - Cast creation (cost calculation)
- `src/app/api/v1/cast/route.ts` - Cast API v1
- `src/app/api/v1/casts/[castId]/route.ts` - Cast details
- `src/app/api/create-checkout-session/route.ts` - Stripe checkout
- `src/app/api/spells/route.ts` - Spell listing/creation

Input/Output:
- **Input**: Accept cents (integer) from clients
- **Output**: Return cents (integer) to clients
- **Stripe API**: Use cents when creating Checkout sessions (`unit_amount` in cents)

### 4. UI Components Update
Update components that display monetary values:
- Use `formatCurrency(amountInCents)` helper (already implemented ✅)
- Forms should accept decimal input (e.g., "12.34") and convert to cents before API calls
- Display formatted currency strings to users

### 5. Budget Calculation Logic
Update `src/lib/budget.ts` (if exists) or budget-related functions:
- All arithmetic must use integer cents
- Comparison: `currentSpendCents + estimateCents <= monthlyCapCents`
- No floating-point operations

## Tests

### Unit Tests
Add tests in `tests/lib/budget.test.ts`:
1. Budget cap enforcement with cent values
2. Spend tracking increments correctly
3. Edge cases: exact cap match, negative values rejected, overflow handling

### Integration Tests
Add tests in `tests/api/budget.test.ts` and `tests/api/cast.test.ts`:
1. POST /api/budget with cent values
2. POST /api/cast with price in cents, verify budget deduction
3. Stripe checkout session has correct `unit_amount` (cents)
4. GET endpoints return cent values

### Migration Tests
Verify migration:
1. Seed database with Float values (e.g., `priceAmount: 12.34`)
2. Run migration
3. Verify new columns have correct cent values (`priceAmountCents: 1234`)
4. Verify old columns are dropped

## Definition of Done
- ✅ Schema migration generated and tested
- ✅ All API routes use cent-based integers
- ✅ UI uses `formatCurrency()` for display
- ✅ Forms convert user input (dollars) → cents before API calls
- ✅ All existing tests updated and passing
- ✅ New tests for cent-based logic pass
- ✅ No floating-point arithmetic in monetary calculations
- ✅ Stripe integration uses cent values correctly
- ✅ SNAPSHOT reflects completion status

## Success Criteria
1. `pnpm prisma migrate dev` runs without errors
2. `pnpm test` passes (all suites green)
3. `pnpm typecheck` passes (no type errors in changed files)
4. Manual verification: Create spell with price, cast it, verify budget deduction matches exactly (no rounding errors)
