---
phase: 32-durability
plan: 09
subsystem: groups
tags: [gap-closure, race-guard, WR-01, GDUR-05]
requires: []
provides:
  - removeMissingMember confirm-time still-missing recheck
affects: [src/features/groups/membershipActions.ts]
key-files:
  modified:
    - src/features/groups/membershipActions.ts
    - src/features/groups/__tests__/membershipActions.test.ts
key-decisions:
  - Guard lives inside removeMissingMember (its only caller is the GroupViewPage per-card confirm), so the call site is unchanged
  - Silent abort (return false, no toast), matching the bulk path
requirements-completed: [GDUR-05]
duration: ~10min
completed: 2026-10-12
---

# Phase 32 Plan 09: Single-card Remove recheck Summary

removeMissingMember now returns false without any IPC call unless `readMissingKeysNow(group.id).has(issueKey)`, closing review finding WR-01 (T-32-23 / T-32-29).

## Task

1. Task 1: guard plus tests. Commit 25cf844.
   - Added the recheck at the top of `removeMissingMember` and updated its JSDoc.
   - Added `seedMissing` test helper and three abort tests (came back, hints ineligible, not a member). The existing three tests now seed an eligible missing state.
   - GroupViewPage.tsx is unchanged. Its `if (!ok)` branch clears pendingFocusRef.

Verification: full vitest suite passes (117 files, 1475 tests), `tsc --noEmit` is clean, and biome is clean on the two changed files. The pre-commit hook passed.

## Deviations from Plan

None. The worktree was reset to the specified base 707f0ef at startup, as the branch check prescribes.

## Deferred Review Items

WR-02 (bulk count vs visible heading, product decision), WR-03 (ConfirmRemovePopover closes on failure), WR-04 (one invalid item aborts batch refresh), IN-01..IN-03.

Pre-existing, out of scope: `npm run lint` over `src/` reports `useLiteralKeys` findings in CopyPreviewModal.tsx and CopyPreviewPage.tsx. They did not block the commit.

## Self-Check: PASSED
