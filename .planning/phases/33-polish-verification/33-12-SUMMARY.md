---
phase: 33-polish-verification
plan: 12
subsystem: groups
tags: [a11y, keyboard, focus, gap-closure]
requires: []
provides:
  - preventScroll focus handoff for overflow arrows
  - activeTabRef for ResizeObserver path
  - narrowed select-mode Escape guard
affects: [GroupTabStrip, useListSelection]
key-files:
  modified:
    - src/features/groups/GroupTabStrip.tsx
    - src/features/groups/groupTabs.ts
    - src/features/groups/useListSelection.ts
    - src/features/groups/__tests__/GroupTabStrip.test.tsx
    - src/features/groups/__tests__/groupTabs.test.ts
    - src/features/groups/__tests__/useListSelection.test.tsx
decisions:
  - Focus fallback still targets the active tab but with preventScroll so the strip is not snapped back
metrics:
  completed: 2026-10-13
requirements: [GQA-02]
---

# Phase 33 Plan 12: Overflow focus and Esc guard fixes Summary

Overflow-arrow focus fallback now uses `focus({ preventScroll: true })` so keyboard users can scroll the tab strip to its end (CR-01); activeTab is read through a ref (WR-01); Escape on checkbox/radio inputs exits select mode (WR-03).

## Commits
- d06b457: Task 1 - focusCoreTab(tab, options), preventScroll fallback, activeTabRef, 3 strip tests + 1 groupTabs test
- 2100eea: Task 2 - text-entry-only Escape guard evaluated after the Escape check, 2 new tests

## Verification
- `vitest run src/features/groups`: 35 files, 559 tests pass
- `biome check src/features/groups` clean; `tsc --noEmit` clean

## Deviations from Plan
None in code. Note: the repo pre-commit hook printed pre-existing Biome `useLiteralKeys` findings in `src/features/tickets/CopyPreviewModal.tsx` and `CopyPreviewPage.tsx` (out of scope, not touched); both commits still landed.

## Known Stubs
None.

## Self-Check: PASSED
