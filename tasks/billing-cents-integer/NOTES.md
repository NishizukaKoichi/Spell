# Notes

## 2025-11-04

- Created SPEC for migrating Float→Int (cents) for all monetary values.
- Identified 3 Float fields to migrate: Spell.priceAmount, budgets.monthlyCap, budgets.currentSpend.
- Cast.costCents is already Int ✅
- Updated schema: priceAmount→priceAmountCents, monthlyCap→monthlyCapCents, currentSpend→currentSpendCents.
- Regenerated Prisma client with new schema.
- Created comprehensive unit tests (10 test cases) for cents-based budget logic.
- Updated budget.ts: All functions now use cents (no Float operations).
- Updated 7 API routes:
  - /api/budget (GET/PATCH)
  - /api/cast (POST)
  - /api/v1/cast (POST) - budget enforcement in cents
  - /api/create-checkout-session (POST) - Stripe unit_amount
  - /api/spells (GET) - price filters
  - /api/spells/create (POST)
  - /api/spells/[id] (PATCH)
- Created MIGRATION.md with safe 4-step SQL migration procedure.
- **Migration NOT executed** - production DB protection (connected to Neon).
- Code complete, ready for staging deployment + migration.
