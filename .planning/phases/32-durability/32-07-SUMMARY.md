---
phase: 32-durability
plan: 07
subsystem: groups-ui
tags: [groups, menu, popover, durability]
requires: [32-03, 32-04]
provides:
  - "Remove all missing (N) entry in group dropdown and context menus"
  - "RemoveMissingPopover tab-anchored confirm"
affects: [src/features/groups]
key-files:
  created:
    - src/features/groups/RemoveMissingPopover.tsx
    - src/features/groups/__tests__/RemoveMissingPopover.test.tsx
  modified:
    - src/features/groups/GroupMenuItems.tsx
    - src/features/groups/GroupTabStrip.tsx
    - src/features/groups/__tests__/GroupMenuItems.test.tsx
    - src/features/groups/__tests__/GroupTabStripOverlays.test.tsx
decisions:
  - "Item hidden (not disabled) unless missingCount > 0; only Delete is destructive-styled"
  - "Confirm rechecks readMissingKeysNow and aborts when empty (T-32-23)"
metrics:
  completed: 2026-10-12
requirements: [GDUR-05]
---

# Phase 32 Plan 07: Remove all missing menu entry Summary

Group menu item "Remove all missing (N)" above Delete opens a tab-anchored confirm popover that makes one atomic removal call and returns focus to the group trigger.

## Tasks

1. GroupMenuItems item and RemoveMissingPopover - commit c88bcb9
2. 'remove-missing' wiring in GroupTabStrip with focus return - commit c88bcb9

## Deviations from Plan

**[Rule 3 - Blocking] Tasks 1 and 2 committed together.** The pre-commit hook runs `tsc`, and Task 1's new required GroupMenuItems props break GroupTabStrip until Task 2 wires them, so a separate Task 1 commit was rejected. Both tasks landed in one commit.

Also extended the sonner mock in GroupTabStripOverlays.test.tsx with `toast.success`.

## Verification

`npx vitest run src/features/groups` (428 tests pass), biome and tsc pass via the pre-commit hook.

## Known Stubs

None.

## Self-Check: PASSED
