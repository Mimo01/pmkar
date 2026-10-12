---
phase: 30-group-management-reorder
plan: 08
subsystem: groups
tags: [tailwind-v4, css, gap-closure]
requires: []
provides:
  - Light-theme group palette always emitted in production CSS
affects: [group color swatches, tab dots]
key-files:
  modified:
    - src/index.css
    - src/features/groups/colors.ts
    - src/features/groups/__tests__/colors.test.ts
key-decisions:
  - Plain :root rule (not @theme static) mirrors body.dark and keeps palette out of Tailwind utility namespace
requirements-completed: [GRP-02, GRP-03]
completed: 2026-10-12
---

# Phase 30 Plan 08: Group color light-theme fix Summary

Moved the 8 light `--color-group-*` variables from Tailwind v4 `@theme` into a plain `:root` rule so teal, green, orange and pink are no longer tree-shaken out of the light theme.

## Tasks
1. Moved palette to `:root`, updated colors.ts doc comment (commit 43fd9fc).
2. Parity test now reads `:root`; count helper counts declarations only; added regression test that `@theme` holds zero group vars (commit 43fd9fc).
3. Verified: `npm run build` emits all 8 light and 8 dark variables; `npm test` passes (1234 tests).

Tasks 1 and 2 share one commit because the pre-commit hook runs the test suite, which fails if the CSS move is committed without the updated parity test.

## Deviations from Plan
- Single combined commit for tasks 1 and 2 (see above). Also applied Biome formatting to the test file to satisfy the pre-commit lint hook.

## Known Stubs
None.

## Self-Check: PASSED
