---
phase: 33-polish-verification
plan: 07
subsystem: groups-tab-strip
tags: [scale, overflow, a11y, tests]
requires: [33-04]
provides:
  - Tab strip arrows scroll 80% of the viewport and hand focus to the active tab when they hide
  - Automated 25-group scale tests (D-11)
key-files:
  modified:
    - src/features/groups/GroupTabStrip.tsx
    - src/features/groups/__tests__/GroupTabStrip.test.tsx
  created:
    - src/features/groups/__tests__/groupScale.test.tsx
requirements: [GQA-02]
metrics:
  completed: 2026-10-12
---

# Phase 33 Plan 07: 25-group scale hardening Summary

Scroll arrows now step by `Math.round(clientWidth * 0.8)` (fallback 200 when width is 0), and when a focused arrow unmounts at a scroll end, focus moves to the active group tab (or the active core tab via `focusCoreTab`). A new `groupScale.test.tsx` covers 25 groups: core tab positions stable, directional arrows, 80% step, scroll-into-view on switch and reorder, 160px truncation with full aria-label (40-char and Slovak diacritic names), picker filter/scroll/arrow-key scrolling, and the 2-chip + "+3" limit.

## Commits
- b49d456: arrow step and focus handoff (with updated GroupTabStrip tests)
- Task 2 commit: groupScale.test.tsx plus this SUMMARY

## Deviations from Plan
- [Rule 3] Worktree base was c4d9cb4; reset to a883cc8 per the startup check. Ran `npm ci` since node_modules was missing.
- TDD RED was not committed separately (pre-commit hook runs the full suite); tests and implementation were committed together.
- Task 2 found no component defects; no source changes beyond Task 1.

## Verification
`npx vitest run src/features/groups`: all green (including 7 new scale tests). `npm run lint`: only pre-existing warnings, no errors.

## Self-Check: PASSED
