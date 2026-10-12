---
phase: 30-group-management-reorder
plan: 06
subsystem: ui
tags: [react, groups, popover, radix, a11y]
requires:
  - phase: 30-03
    provides: useGroupNameForm, GroupNameForm, GroupColorSwatches
provides:
  - RenameGroupPopover (controlled, virtualRef-anchored)
  - ChangeColorPopover (controlled, virtualRef-anchored)
affects: [30-07]
tech-stack:
  added: []
  patterns: [PopoverAnchor virtualRef with explicit onCloseAutoFocus focus return]
key-files:
  created:
    - src/features/groups/RenameGroupPopover.tsx
    - src/features/groups/ChangeColorPopover.tsx
    - src/features/groups/__tests__/RenameGroupPopover.test.tsx
    - src/features/groups/__tests__/ChangeColorPopover.test.tsx
  modified: []
key-decisions:
  - "Rename reset effect is keyed on [open, group.id] only, so a rename hydrate does not clobber typed input."
requirements-completed: [GRP-02, GRP-03]
duration: 10min
completed: 2026-10-12
---

# Phase 30 Plan 06: Rename and Change color popovers Summary

Controlled Rename and Change color popovers anchored to the tab via Radix `PopoverAnchor virtualRef`, reusing the shared name form and swatches, with explicit `onReturnFocus` callbacks for Plan 07.

## Tasks

1. RenameGroupPopover (11 tests): 432fdf2
2. ChangeColorPopover (9 tests): d9f3de8

## Verification

- `npx vitest run src/features/groups`: 17 files, 262 tests pass
- `npx tsc --noEmit`: exit 0
- `npx biome check src/features/groups`: clean

## Deviations from Plan

None - plan executed exactly as written. Worktree base was corrected with `git reset --hard` to the expected base at startup, per the startup check.

Note: the pre-commit hook printed Biome `useLiteralKeys` findings in unrelated files (`CopyPreviewModal.tsx`, `CopyPreviewPage.tsx`); these are pre-existing, out of scope, and did not block the commits.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED
