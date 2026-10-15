---
phase: 37-consistency-accessibility-and-uat
plan: 02
subsystem: testing
tags: [vitest, triage, consistency, RQA-01]
requires: []
provides:
  - RQA-01 automated triage consistency invariant
affects: []
tech-stack:
  added: []
  patterns: [fake persisted DB behind mocked invoke, seeded PRNG sequence test]
key-files:
  created:
    - src/features/tickets/__tests__/triageConsistency.test.tsx
  modified: []
key-decisions:
  - "Tasks 1 and 2 were delivered in a single file write and one commit (same file, tightly coupled)"
requirements-completed: [RQA-01]
duration: 10min
completed: 2026-10-15
---

# Phase 37 Plan 02: Triage Consistency Invariant Summary

One Vitest file proves every ticket sits in exactly one of New / Not mine / Linked (done tickets in none) after deny, undo, link, restore and handled transitions, rollbacks, 200 seeded random steps and a hydrate round-trip, using real predicates, groupBadgeKey, ticketStore and triageActions.

## Accomplishments
- Fake persisted DB (set_triage_state, relink_ticket, get_triage_state, failing fetch_ticket_detail) with a one-shot failNext flag.
- 9-ticket fixture (7 non-done, 2 done); assertInvariant checks tab uniqueness, group badge keys, counts, and newCount vs raw 'new' entries (Pitfall 2); assertStoreMatchesDb checks persistence agreement.
- 10 tests: seed sanity, deny, undo via toast action.onClick, relink, needs-copy, restore, markHandled, rollback, done tickets, seeded random (seed 37) + restart round-trip.

## Task Commits
1. Tasks 1-2 combined: see git log (`test(37-02): add RQA-01 triage consistency invariant`)

## Deviations from Plan
- Both tasks committed together as one commit since they target the same new file.
- `assertInvariant()` is wrapped in a `check()` helper (flush + invariant + store/db match), so the literal `grep -c "assertInvariant()"` count is below 12; it is still asserted after every action.
- Used `calls[length-1]` instead of `.at(-1)` because the TS lib target lacks Array.at (tsc error).

## Issues Encountered
None. Pre-existing Biome warnings elsewhere are out of scope.

## Self-Check: PASSED
Tests pass (10/10), triageActions.test.ts still passes, tsc and biome clean for the file.
