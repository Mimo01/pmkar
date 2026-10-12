---
phase: 30-group-management-reorder
plan: 07
subsystem: groups-ui
tags: [groups, rename, color, delete, focus, a11y]
requires: [30-03, 30-04, 30-05, 30-06]
provides:
  - Rename, Change color and Delete overlays mounted in GroupTabStrip
  - Delete fallback to New and D-14 focus targets
key-files:
  modified:
    - src/features/groups/GroupTabStrip.tsx
  created:
    - src/features/groups/__tests__/GroupTabStripOverlays.test.tsx
decisions:
  - Tasks 1 and 2 committed together because both edit GroupTabStrip.tsx and the same new test file
  - Delete path does not set `pending`; it uses a separate deleteTarget snapshot (count frozen at open)
metrics:
  completed: 2026-10-12
---

# Phase 30 Plan 07: Overlay wiring Summary

Rename, Change color and Delete overlays are mounted once in the tab strip, with all D-08/D-13/D-14 focus rules and the explicit `onTabChange('new')` fallback covered by integration tests.

## Commits
- dd632a2 feat(30-07): mount rename, color and delete overlays in the tab strip

## What was built
- `pendingGroup` derived via useMemo; `RenameGroupPopover` and `ChangeColorPopover` driven by `pending`, focus returned through `returnFocusIdRef` (set at menu close) and `focusGroupTrigger` (now a no-op for vanished groups).
- Delete: on menu close the group snapshot (id, name, memberCount) and `deleteFocusTarget` are computed before deletion. `onDeleted` writes `onTabChange('new')` when the group was active. `handleDeleteReturnFocus` focuses the core New tab or the ＋ trigger (after a rAF), the neighbour tab, or the `…`/tab on Keep.
- 12 integration tests (rename, cancel, recolor, Esc, vanished guard, 6 delete cases, frozen count, delete error).

## Deviations from Plan
- Worktree base was `c4d9cb4`; reset to the expected `840deb3` per the branch check.
- Tasks 1 and 2 share one commit (see decisions).

## Verification
- `npx vitest run`: 102 files, 1229 tests passed.
- `npx tsc --noEmit`: exit 0.
- Biome and pre-commit hooks passed.
- Manual UAT deferred: VoiceOver announcement, Shift+F10 in WKWebView, no width jump from the `…` slot.

## Known Stubs
None.

## Self-Check: PASSED
