---
phase: 31-membership-entry-points
plan: 08
subsystem: groups
tags: [select-mode, selection-bar, group-view]
requires: ["31-03", "31-05", "31-06"]
provides:
  - "Select mode, bulk add and confirmed bulk remove in GroupViewPage"
  - "Current-group chip hidden on cards in its own view"
affects: [src/features/groups/GroupViewPage.tsx]
key-files:
  modified:
    - src/features/groups/GroupViewPage.tsx
    - src/features/groups/__tests__/GroupViewPage.test.tsx
requirements-completed: [GMEM-04, GMEM-06, GMEM-07, GMEM-08]
duration: ~15min
completed: 2026-10-12
---

# Phase 31 Plan 08: GroupViewPage selection Summary

GroupViewPage now wires useListSelection, SelectionBar (with the current group enabling Remove and excluding it from Add) and hideGroupId on cards.

## Task Commits

1. Task 1: wire selection, SelectionBar and hideGroupId - e54d0b7

## Details

- Selection is derived from the visible `sorted` list, so issues hidden by search drop out (T-31-25). Remove requires the SelectionBar confirm popover (T-31-26). State is page-local, so remount discards it (T-31-27).
- 11 new tests cover: toggle and own-chip hiding, click and shift-range, Add/Remove pickers, single remove call, remove failure keeping selection, add to another group, search pruning, Esc semantics (list vs. confirm popover), remount, and Restore in select mode.
- Verification: `npx vitest run src/features/groups` (386 passed), `npx tsc --noEmit`, and the pre-commit hook (biome, cargo) all pass.

## Deviations from Plan

- The worktree started on a different base than expected, so I reset it to f415dd1 as the setup step prescribes.
- A `biome-ignore lint/a11y/noStaticElementInteractions` comment was added on the wrapper div for the Esc handler. This is minor.

## Known Stubs

None.

## Self-Check: PASSED
