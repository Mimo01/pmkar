---
phase: 28-foundations
plan: 03
subsystem: groups
tags: [color-palette, css-tokens, wcag, tailwind-v4]
requires: []
provides: [GROUP_COLOR_TOKENS, GroupColorToken, GROUP_COLOR_HEX, isGroupColorToken, groupColorVar, pickDefaultColor, "--color-group-* CSS tokens"]
affects: [phase-29-group-tabs, phase-30-color-picker]
tech-stack:
  added: []
  patterns: [TS single source of truth mirrored in CSS with parity test]
key-files:
  created:
    - src/features/groups/colors.ts
    - src/features/groups/__tests__/colors.test.ts
  modified:
    - src/index.css
decisions:
  - "Amber light value darkened from #d97706 to #b45309 (failed 3:1 against page bg #f7f7f8); all other UI-SPEC values passed unchanged"
metrics:
  tasks: 2
  completed: 2026-10-12
requirements: [GRP-06]
---

# Phase 28 Plan 03: Group color palette Summary

Eight accessible group color tokens (blue, teal, green, amber, orange, purple, pink, slate) as a TS module plus `--color-group-*` CSS variables for light and dark themes, with WCAG 3:1 contrast, CSS-parity and least-used-default tests.

## Commits
- c328f80: palette module + tests (Task 1)
- Task 2 commit: CSS variables + parity tests (see git log, `feat(28-03): add --color-group-* theme tokens`)

## Changed palette values
- amber light: `#d97706` -> `#b45309` (verified failing before the change). No other values changed.

## Deviations from Plan

**1. [Rule 3 - Blocking] Worktree lacked node_modules**
- Symlinked the main repo's `node_modules` into the worktree (untracked, not committed) to run vitest/tsc/biome.

**2. Test reads index.css via node:fs with `/// <reference types="node" />`**
- `?raw` import returns an empty string under vitest (CSS is stubbed), and plain `node:fs` failed `tsc` without the reference directive. No package installed.

Biome reformatted the new files to the repo's single-quote style.

## Verification
- `vitest run src/features/groups`: 27 passed
- `tsc --noEmit`: clean; `biome check src/features/groups`: clean
- `grep -c -- "--color-group-" src/index.css` = 16; index.css diff is additions only
- Full `npm run lint` was not run separately.

## Known Stubs
None.

## Self-Check: PASSED
