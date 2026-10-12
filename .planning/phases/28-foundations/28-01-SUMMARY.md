---
phase: 28-foundations
plan: 01
subsystem: tickets
tags: [refactor, characterization-tests, sorting, filtering]
requires: []
provides:
  - "ticketListUtils.ts: isNewCandidate, isNotMineCandidate, isLinkedCandidate, filterTickets, sortTickets, TicketSortField, SortDirection"
affects: [29-group-views]
tech-stack:
  added: []
  patterns: ["pure shared list helpers", "characterization tests committed before refactor"]
key-files:
  created:
    - src/features/tickets/ticketListUtils.ts
    - src/features/tickets/__tests__/ticketListUtils.test.ts
    - src/features/tickets/__tests__/ticketListParity.test.tsx
  modified:
    - src/features/tickets/TicketListPage.tsx
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/features/tickets/LinkedTicketsPage.tsx
key-decisions:
  - "Helpers copied verbatim (localeCompare without locale args, no NaN guards) to guarantee behaviour parity (D-23)"
requirements-completed: [GRP-06]
duration: 15min
completed: 2026-10-12
---

# Phase 28 Plan 01: Shared ticket list utilities Summary

Extracted the triple-duplicated New / Not mine / Linked filter and sort logic into a pure `ticketListUtils.ts`, with parity proven by page-level characterization tests committed before any page was touched.

## Commits

- fec1e51 test(28-01): characterization tests for all three pages (30 tests, green against unmodified pages on first run)
- 7673a35 feat(28-01): ticketListUtils.ts plus 18 unit tests
- 8403f1a refactor(28-01): three pages now import the helpers; no inline sort/filter or `localeCompare` remains in them

## Deviations from Plan

- Running `biome check --write src/features/tickets` reformatted 9 files; the 6 unrelated ones were reverted with per-file `git checkout`. Biome also reformatted a few unrelated lines inside the three edited pages (formatting only, same commit).
- The worktree had no `node_modules`; a temporary symlink to the main repo's `node_modules` was used for running tests (never committed).

## Deferred Issues

Two failures in `src/features/tickets/TicketListPage.test.tsx` are pre-existing and unrelated: "shows empty state when no results" and "auto-refetches when lastFetchedAt is set in fetch config". They fail identically with the original, unmodified `TicketListPage.tsx`. All other tests in `src/features/tickets` pass (424 of 426), plus `tsc --noEmit` is clean.

## Known Stubs

None.

## Self-Check: PASSED

Files created exist, commits fec1e51, 7673a35, 8403f1a present.
