# Database Migration: Float to Cents (Integer)

## ⚠️ CRITICAL: DO NOT RUN ON PRODUCTION WITHOUT BACKUP

This migration converts monetary amounts from Float (dollars) to Int (cents) to eliminate floating-point precision errors.

## Pre-Migration Checklist

- [ ] Full database backup created
- [ ] Staging environment tested successfully
- [ ] API clients notified of breaking changes
- [ ] Downtime window scheduled (if needed)
- [ ] Rollback plan prepared

## Affected Tables

### 1. `spells` table

- **Before**: `priceAmount` Float
- **After**: `priceAmountCents` Int (default 0)
- **Conversion**: `ROUND(priceAmount * 100)`

### 2. `budgets` table

- **Before**: `monthlyCap` Float, `currentSpend` Float
- **After**: `monthlyCapCents` Int (default 10000), `currentSpendCents` Int (default 0)
- **Conversion**: `ROUND(monthlyCap * 100)`, `ROUND(currentSpend * 100)`

### 3. `casts` table

- **Status**: Already using `costCents` Int ✅ (no changes needed)

## Migration SQL (PostgreSQL)

### Step 1: Add new columns with defaults

```sql
-- Add new cents columns to spells table
ALTER TABLE spells
  ADD COLUMN IF NOT EXISTS "priceAmountCents" INTEGER NOT NULL DEFAULT 0;

-- Add new cents columns to budgets table
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS "monthlyCapCents" INTEGER NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS "currentSpendCents" INTEGER NOT NULL DEFAULT 0;
```

### Step 2: Migrate existing data

```sql
-- Migrate spells.priceAmount → spells.priceAmountCents
UPDATE spells
SET "priceAmountCents" = ROUND("priceAmount" * 100)::INTEGER
WHERE "priceAmountCents" = 0;  -- Only update if not already set

-- Migrate budgets.monthlyCap → budgets.monthlyCapCents
UPDATE budgets
SET "monthlyCapCents" = ROUND("monthlyCap" * 100)::INTEGER
WHERE "monthlyCapCents" = 10000;  -- Only update if still default

-- Migrate budgets.currentSpend → budgets.currentSpendCents
UPDATE budgets
SET "currentSpendCents" = ROUND("currentSpend" * 100)::INTEGER
WHERE "currentSpendCents" = 0;  -- Only update if not already set
```

### Step 3: Verify data integrity

```sql
-- Check for data loss (should return 0 rows)
SELECT id, "priceAmount", "priceAmountCents",
       ABS("priceAmount" * 100 - "priceAmountCents") AS diff
FROM spells
WHERE ABS("priceAmount" * 100 - "priceAmountCents") > 1;  -- Allow 1 cent rounding

SELECT id, "monthlyCap", "monthlyCapCents",
       ABS("monthlyCap" * 100 - "monthlyCapCents") AS diff
FROM budgets
WHERE ABS("monthlyCap" * 100 - "monthlyCapCents") > 1;

-- Check for NULL values (should return 0 rows)
SELECT COUNT(*) FROM spells WHERE "priceAmountCents" IS NULL;
SELECT COUNT(*) FROM budgets WHERE "monthlyCapCents" IS NULL OR "currentSpendCents" IS NULL;
```

### Step 4: Drop old columns (DESTRUCTIVE - only after verification)

**⚠️ WARNING: This step is irreversible. Ensure Step 3 verification passed.**

```sql
-- Drop old Float columns from spells
ALTER TABLE spells DROP COLUMN IF EXISTS "priceAmount";

-- Drop old Float columns from budgets
ALTER TABLE budgets DROP COLUMN IF EXISTS "monthlyCap";
ALTER TABLE budgets DROP COLUMN IF EXISTS "currentSpend";
```

## Rollback Plan

If issues are detected:

### Before Step 4 (old columns still exist)

```sql
-- Revert to old columns
UPDATE spells SET "priceAmount" = "priceAmountCents" / 100.0;
UPDATE budgets SET "monthlyCap" = "monthlyCapCents" / 100.0;
UPDATE budgets SET "currentSpend" = "currentSpendCents" / 100.0;

-- Drop new columns
ALTER TABLE spells DROP COLUMN "priceAmountCents";
ALTER TABLE budgets DROP COLUMN "monthlyCapCents", "currentSpendCents";

-- Redeploy old application code
```

### After Step 4 (old columns dropped)

```sql
-- Restore from backup (full database restore required)
```

## Application Code Changes

Deployed in parallel with this migration:

- ✅ `src/lib/budget.ts` - Uses `monthlyCapCents`, `currentSpendCents`
- ✅ `src/app/api/budget/route.ts` - Accepts/returns cents
- ✅ `src/app/api/cast/route.ts` - Uses `spell.priceAmountCents`
- ✅ `src/app/api/v1/cast/route.ts` - Budget checks in cents
- ✅ `src/app/api/create-checkout-session/route.ts` - Stripe unit_amount in cents
- ✅ `src/app/api/spells/route.ts` - Price filters in cents
- ✅ `src/app/api/spells/create/route.ts` - Accepts `priceAmountCents`
- ✅ `src/app/api/spells/[id]/route.ts` - PATCH accepts `priceAmountCents`

## API Breaking Changes

### Before (Float, dollars)

```json
{
  "priceAmount": 12.34,
  "monthlyCap": 100.0,
  "currentSpend": 45.67
}
```

### After (Int, cents)

```json
{
  "priceAmountCents": 1234,
  "monthlyCapCents": 10000,
  "currentSpendCents": 4567
}
```

**Client Migration**: All API clients must update to use cents-based fields.

## Testing After Migration

```bash
# 1. Check Prisma client regeneration
pnpm prisma generate

# 2. Run unit tests
pnpm test

# 3. Test API endpoints
curl -X GET http://localhost:3000/api/budget \
  -H "Authorization: Bearer <token>"

# Expected response with cents fields:
# {"monthlyCapCents": 10000, "currentSpendCents": 0, ...}

# 4. Create a test spell
curl -X POST http://localhost:3000/api/spells/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "Test Spell",
    "key": "test-cents",
    "description": "Test",
    "priceAmountCents": 500,
    "priceModel": "one-time",
    "tags": ["test"]
  }'
```

## Post-Migration Monitoring

Monitor for:

- API errors related to missing fields
- Budget enforcement accuracy (no off-by-one errors)
- Stripe checkout failures
- Client-side display issues

## Timeline (Recommended)

1. **Day 1**: Deploy code changes to staging, run migration on staging DB
2. **Day 2-3**: Test all endpoints, monitor staging
3. **Day 4**: Notify API clients of upcoming breaking changes
4. **Day 7**: Deploy to production during low-traffic window
5. **Day 8+**: Monitor production, support client migrations

## Notes

- **Why Integer?**: Eliminates floating-point errors (e.g., 0.1 + 0.2 ≠ 0.3)
- **Maximum value**: PostgreSQL INT max = 2,147,483,647 cents = $21,474,836.47 (sufficient for most use cases)
- **Stripe compatibility**: Stripe API expects amounts in cents (this aligns perfectly)
- **Display**: Use `formatCurrency(amountInCents)` helper for UI display
