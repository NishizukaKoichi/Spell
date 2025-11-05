# Notes

## 2025-02-14

- Created SPEC to add `formatCurrency` helper built on `Intl.NumberFormat`.
- Added failing unit tests in `tests/lib/utils.test.ts`.
- Implemented formatCurrency in `src/lib/utils.ts`.
- All 4 tests pass (default formatting, custom currency/locale, fraction digit overrides, error handling).
- Status: ready-for-merge.
