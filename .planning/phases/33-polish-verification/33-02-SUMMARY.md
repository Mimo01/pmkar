---
phase: 33-polish-verification
plan: 02
subsystem: groups-a11y
tags: [contrast, wcag, css-tokens, tests]
requires: []
provides:
  - src/test-utils/contrast.ts shared helpers
  - --color-focus-ring and --color-destructive-text tokens (both themes)
affects: [33-04, 33-05]
key-files:
  created:
    - src/test-utils/contrast.ts
    - src/features/groups/__tests__/contrast.test.ts
    - .planning/phases/33-polish-verification/deferred-items.md
  modified:
    - src/features/groups/__tests__/colors.test.ts
    - src/index.css
decisions:
  - "Global dark --color-ring #c02232 -> #e5484d. Approved by user 2026-10-12 (intentional D-03 exception, app-wide shadcn focus ring)."
  - "Dimmed missing card at 0.7 opacity is decorative; hint line and labelled Remove buttons carry the meaning."
metrics:
  completed: 2026-10-12
---

# Phase 33 Plan 02: Token-level contrast Summary

Shared contrast helpers extracted to `src/test-utils/contrast.ts` (incl. new `mix`), and both-theme token contrast tests added with new `--color-focus-ring` (#c02232 light / #e5484d dark) and `--color-destructive-text` (#b91c1c light / #f87171 dark) tokens.

## Commits
- 13de846: refactor, shared helpers, colors.test.ts imports them
- 126c657: feat, tokens, contrast.test.ts, deferred-items.md

## Deviations from Plan

1. **[Rule 3 - Blocking] MISSING_DIM_OPACITY not exported.** Biome `noExportsInTest` rejects exports from test files; kept as a module constant (acceptance grep still matches).
2. **[Rule 3 - Blocking] RED not committed separately.** The pre-commit hook runs the full test suite, so a failing-test commit is impossible without `--no-verify`. RED was verified locally (14 failures: missing tokens and dark ring 2.79:1), then tests and tokens committed together.

Global dark `--color-ring` change approved by user 2026-10-12; recorded in deferred-items.md under "Intentional exceptions (D-03)".

## Verification
`npx vitest run src/features/groups`: 493 passed. Pre-commit (lint, full frontend tests, cargo) passed.

## Self-Check: PASSED
