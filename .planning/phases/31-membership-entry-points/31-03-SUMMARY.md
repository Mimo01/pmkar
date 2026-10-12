---
phase: 31-membership-entry-points
plan: 03
subsystem: ui
tags: [react, hooks, selection, filter-bar]
requires:
  - phase: 31-01
    provides: i18n key tickets.filter.select
provides:
  - useListSelection hook (per-page select mode, range, prune, Esc, focus return)
  - Opt-in Select toggle in TicketFilterBar
affects: [31-05, 31-06, 31-08, 31-09]
tech-stack:
  added: []
  patterns: [per-page useState selection, content-compared prune effect]
key-files:
  created:
    - src/features/groups/useListSelection.ts
    - src/features/groups/__tests__/useListSelection.test.tsx
  modified:
    - src/features/tickets/TicketFilterBar.tsx
    - src/features/tickets/__tests__/TicketFilterBar.test.tsx
key-decisions:
  - "Shift-toggle only adds the anchor-to-key range, never removes; anchor always moves to the clicked key"
  - "Prune effect bails out by size comparison, preventing setState loops"
  - "Button already uses React.forwardRef, so selectToggleRef is passed as ref directly"
requirements-completed: [GMEM-06]
duration: 12min
completed: 2026-10-12
---

# Phase 31 Plan 03: Selection hook and Select toggle Summary

Per-page `useListSelection` hook (range select, visible-key pruning, Esc exit with focus return, no select-all) plus an opt-in, aria-pressed Select toggle in `TicketFilterBar`.

## Tasks
1. useListSelection hook with 16 tests (commit 29a3cb0)
2. TicketFilterBar Select toggle with 5 new tests (commit dcf2530)

## Deviations from Plan
None to the code. Worktree base was corrected via `git reset --hard 4bb65cc` per the startup check. node_modules was symlinked from the main repo for testing and removed before return.

## Deferred Issues
`npm run lint` reports pre-existing `useLiteralKeys` findings in CopyPreviewModal.tsx and CopyPreviewPage.tsx (out of scope). Pre-commit hooks passed for both commits.

## Known Stubs
None.

## Self-Check: PASSED
