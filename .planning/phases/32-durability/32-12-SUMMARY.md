---
phase: 32-durability
plan: 12
subsystem: groups
tags: [react, popover, destructive-confirm, gap-closure]
requires: []
provides:
  - GroupViewPage resets stale confirmKey/confirmAll when their subject leaves missingVisible
affects: [src/features/groups/GroupViewPage.tsx]
key-files:
  modified:
    - src/features/groups/GroupViewPage.tsx
    - src/features/groups/__tests__/GroupViewPage.test.tsx
decisions:
  - "Reset effect depends on [missingVisible, confirmKey, confirmAll]; ConfirmRemovePopover untouched (WR-03 deferred)"
metrics:
  tasks: 1
  files: 2
requirements: [GDUR-05]
---

# Phase 32 Plan 12: Stale remove-confirm reset Summary

A single useEffect in GroupViewPage clears `confirmKey` and `confirmAll` when their card or block leaves the missing set, so neither destructive confirm popover re-opens (or steals focus) without a fresh click (WR-05).

## Tasks

1. Reset stale confirm state, with three regression tests ("does not re-open": member returns then goes missing, filter hides then restores the card, bulk block disappears then reappears). Commit message prefix `fix(32-12)`.

## Verification

- `npx vitest run src/features/groups`: 30 files, 445 tests pass
- `npx tsc --noEmit`: clean
- `npx biome check` on both files: clean

## Deviations from Plan

- Worktree base was corrected with `git reset --hard 7fcc60b` per the startup check.
- node_modules was symlinked from the main repo to run tests (not committed).
- Tests were not run against the pre-fix code to confirm they fail first (no separate RED commit).

## Self-Check: PASSED
