---
phase: 32-durability
plan: 11
subsystem: tickets
tags: [zustand, cr-01, server-switch, fetch]
requires: []
provides:
  - resetForServerSwitch action and connection subscription in ticketStore
  - isSameServerAsFetch gate before setTickets in both handleFetch paths
affects: [group views, add_issues_to_group source list]
key-files:
  modified:
    - src/features/tickets/ticketStore.ts
    - src/features/tickets/TicketListPage.tsx
    - src/features/tickets/__tests__/ticketStore.test.ts
    - src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx
    - src/features/tickets/TicketListPage.test.tsx
    - src/features/tickets/__tests__/ticketListParity.test.tsx
key-decisions:
  - "Gate setTickets on server identity (baseUrl + username), not the full fetch signature, so same-server filter changes mid-flight still apply"
requirements-completed: [GDUR-06]
duration: 15min
completed: 2026-10-12
---

# Phase 32 Plan 11: Stale ticket list on server switch Summary

The ticket store now drops the previous server's list on a baseUrl change, and fetches whose server changed mid-flight are discarded instead of applied (CR-01, stale-list half).

## Tasks

1. Task 1 (40e9ef9): `resetForServerSwitch` plus a module-level `useConnectionStore.subscribe` that resets only when the previous baseUrl was non-null and differs from the new one. Startup null-to-A hydration does not clear. Six new store tests.
2. Task 2 (0f32c50): `isSameServerAsFetch` and `discardStaleResult` in handleFetch, checked before `setTickets` on the custom path and before the all-failed branch on the batch path. The 32-08 `isFetchStillCurrent` refresh gates are unchanged. The three 32-08 mid-flight server tests now assert discard. Added a lock-release test.

## Deviations from Plan

**1. [Rule 3 - Blocking] Test mocks lacked `subscribe`**
- **Found during:** Task 1 full-suite run
- **Issue:** `TicketListPage.test.tsx` and `ticketListParity.test.tsx` mock connectionStore without `subscribe`, so importing ticketStore threw.
- **Fix:** Added a no-op `subscribe: () => () => {}` to both mocks. No assertions changed.
- **Commit:** 40e9ef9

No test setup reordering was needed in other files. `useHintsEligible.test.tsx` was not touched.

**Environment note:** the worktree had no node_modules, so I symlinked the main repo's (left untracked, not committed). The worktree started at c4d9cb4 and was reset to the specified base 7fcc60b per the startup check. One pre-commit run hit a one-off timeout in `App.test.tsx` (passed on rerun and in isolation earlier).

## Known Stubs

None.

## Self-Check: PASSED

Commits 40e9ef9 and 0f32c50 exist; full vitest (1486 tests), tsc, and pre-commit checks pass.
