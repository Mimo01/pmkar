---
phase: 32-durability
plan: 06
subsystem: ui
tags: [react, groups, tickets, popover, a11y]
requires:
  - phase: 32-03
    provides: ConfirmRemovePopover, removeMissingMember, removeAllMissingWithFeedback, groups.missing.* i18n
  - phase: 32-04
    provides: useGroupMembers().missingKeys, readMissingKeysNow
provides:
  - TicketCard dimmed and footerSlot props, data-ticket-key
  - Group view present/missing partition with counted missing block
  - Per-card Remove and Remove all missing (confirmed)
affects: [32-07]
tech-stack:
  added: []
  patterns: [per-element dimming instead of parent opacity, confirm-time recompute of bulk set]
key-files:
  created: []
  modified:
    - src/features/tickets/TicketCard.tsx
    - src/features/tickets/__tests__/TicketCard.test.tsx
    - src/features/groups/GroupViewPage.tsx
    - src/features/groups/__tests__/GroupViewPage.test.tsx
key-decisions:
  - "Dim individual elements (key, dates, summary, metadata cluster) rather than the root, so chips, checkbox and footer stay full contrast"
  - "Bulk remove recomputes missing keys with readMissingKeysNow at confirm; when gating flips off the block (and popover) unmounts so nothing is removed"
requirements-completed: [GDUR-01, GDUR-02, GDUR-03, GDUR-05]
duration: 15min
completed: 2026-10-12
---

# Phase 32 Plan 06: Group view missing members Summary

Group view now renders absent members as a dimmed "No longer in results" block with labelled per-card Remove and a counted "Remove all missing", both confirmed via the shared popover, and nothing extra when hints are gated off.

## Tasks

1. TicketCard dimmed state and footer slot: commit e072a87
2. GroupViewPage missing block, per-card Remove, Remove all missing: commit 095bbbf

## Verification

- `vitest run src/features/groups src/features/tickets`: 976 tests pass
- biome check on changed source files and `tsc --noEmit` clean

## Deviations from Plan

None in scope. Notes:
- The worktree base was behind the expected base; reset to bd66d3d per the branch check.
- node_modules was absent in the worktree; a symlink to the main checkout's node_modules was created (untracked, not committed).
- Test adjustment: the "gating flipped before confirm" test asserts the popover unmounts and no invoke happens, since the missing block disappears entirely when hints become ineligible (the readMissingKeysNow guard remains as defence for races).

## Known Stubs

None.

## Self-Check: PASSED

- 32-06-SUMMARY.md present; commits e072a87 and 095bbbf exist.
