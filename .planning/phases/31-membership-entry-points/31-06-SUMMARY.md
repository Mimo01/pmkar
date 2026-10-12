---
phase: 31-membership-entry-points
plan: 06
subsystem: groups-ui
tags: [selection-bar, bulk-actions, a11y]
requires: [31-01, 31-04]
provides:
  - "SelectionBar({ selectedTickets, group?, onClear, onActionSucceeded })"
affects: [31-08, 31-09]
key-files:
  created:
    - src/features/groups/SelectionBar.tsx
    - src/features/groups/__tests__/SelectionBar.test.tsx
decisions:
  - "Esc containment needed no extra handler: Radix preventDefaults Escape, so the wrapper spy only sees defaultPrevented events"
requirements-completed: [GMEM-07, GMEM-08]
duration: ~10min
completed: 2026-10-12
---

# Phase 31 Plan 06: SelectionBar Summary

Floating selection bar with an always-mounted polite live region (Slovak plurals), bulk Add via the list-mode GroupPicker (current group excluded), and bulk Remove behind a Cancel-focused confirm popover in group views. Each action is one atomic call and success is reported only on ok.

## Esc propagation (OQ4)
Path taken: Radix alone. Tests for both the Add picker and the Remove confirm pass with no `stopPropagation` fallback, because any Escape keydown reaching the page wrapper has `defaultPrevented === true`. The page-level guard in useListSelection is safe.

## Deviations from Plan
None. 13 tests pass; tsc and biome are clean.

## Known Stubs
None.

## Self-Check: PASSED
