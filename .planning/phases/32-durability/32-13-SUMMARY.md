---
phase: 32-durability
plan: 13
subsystem: tickets/groups
tags: [gap-closure, WR-06, durability]
requires: [32-09]
provides: [loading-guarded confirm-time eligibility reader]
affects: [membershipActions.removeMissingMember, Remove all, RemoveMissingPopover]
tech-stack:
  patterns: [single shared reader guards all removal paths]
key-files:
  modified:
    - src/features/tickets/useHintsEligible.ts
    - src/features/tickets/__tests__/useHintsEligible.test.tsx
    - src/features/groups/__tests__/missingMembers.test.tsx
decisions:
  - "useHintsEligible hook deliberately ignores fetchStatus (no flicker on background polls); safety lives in readHintsEligibleNow"
metrics:
  tasks: 1
  files: 3
  completed: 2026-10-12
requirements: [GDUR-04, GDUR-05]
---

# Phase 32 Plan 13: Loading guard for confirm-time eligibility Summary

`readHintsEligibleNow()` now returns false while `fetchStatus === 'loading'`, so every removal recheck (single remove, Remove all, tab-menu popover) aborts mid-fetch (WR-06, T-32-42).

## What changed
- `readHintsEligibleNow` reads the store once and returns false when loading or when no signature is stored. Otherwise the comparison is unchanged.
- `useHintsEligible` logic is unchanged. Its doc comment now records why it ignores fetchStatus.
- Tests added (names contain "loading"):
  - The reader is false while loading and true again after idle.
  - The reader stays true on error with a matching signature.
  - The hook stays true across loading while the reader is false.
  - `readMissingKeysNow` returns `EMPTY_MISSING` while loading and recovers after idle.
- Both suites now reset `fetchStatus: 'idle'` in `beforeEach`.

## Commits
- 9a312c1: fix(32-13): abort confirm-time removal rechecks while a fetch is in flight

## Verification
- The full vitest run passed with 1484 tests, and tsc and biome were clean on the changed files.
- The pre-commit hook's first run hit a timeout in `src/__tests__/App.test.tsx` ("shows SetupWizard when no connections configured"). It is unrelated to this change and passed on the retry. It looks like a load flake.
- The hook's repo-wide `biome check src/` prints pre-existing lint findings in other files (CopyPreviewModal, CopyPreviewPage, and others). They are out of scope and were not touched.

## Deviations from Plan
None. No existing test encoded the WR-06 bug. `missingMembers.ts` and `membershipActions.ts` are unmodified.

## Notes
- A `node_modules` symlink was added to the worktree to run the tests. It is untracked and was not committed.
- The silent abort of a confirm during loading (IN-06) remains deferred (T-32-43, accepted).

## Self-Check: PASSED
