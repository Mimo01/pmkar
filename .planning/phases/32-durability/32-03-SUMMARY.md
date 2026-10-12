---
phase: 32-durability
plan: 03
subsystem: groups-ui
tags: [i18n, popover, membership]
requires: []
provides:
  - groups.missing.* and groups.menu.removeMissing EN/SK copy
  - ConfirmRemovePopover shared confirm popover
  - removeMissingMember, removeAllMissingWithFeedback helpers
affects: [32-06, 32-07]
tech-stack:
  added: []
  patterns: [shared confirm popover with trigger or virtual anchor]
key-files:
  created:
    - src/features/groups/ConfirmRemovePopover.tsx
    - src/features/groups/__tests__/ConfirmRemovePopover.test.tsx
  modified:
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
    - src/features/groups/__tests__/groupI18n.test.ts
    - src/features/groups/membershipActions.ts
    - src/features/groups/__tests__/membershipActions.test.ts
decisions:
  - Both helpers route through useGroupStore.removeFromGroup (D-16, GC path)
metrics:
  completed: 2026-10-12
requirements: [GDUR-03, GDUR-05]
---

# Phase 32 Plan 03: Missing-member building blocks Summary

EN/SK copy with Slovak plurals, one shared ConfirmRemovePopover (Cancel-focused, in-flight guarded, trigger or virtual anchor), and two removal helpers that toast on every failure.

## Tasks

1. EN/SK copy plus plural/parity tests - 9e9c4e1
2. ConfirmRemovePopover and removeMissingMember / removeAllMissingWithFeedback with tests - 0867442

## Deviations from Plan

None - plan executed as written. The worktree base was reset to 42cec48 per the startup check, and node_modules was symlinked from the main checkout (not committed).

## Known Stubs

None.

## Self-Check: PASSED
