---
phase: 32-durability
plan: 08
subsystem: groups
tags: [gap-closure, CR-01, snapshots, tauri, zustand]
requires: []
provides:
  - signature-gated snapshot refresh in handleFetch
  - expected_base_url scope veto in refresh_group_snapshots
affects: [groups, tickets]
key-files:
  modified:
    - src-tauri/src/groups_commands.rs
    - src/features/groups/groupStore.ts
    - src/features/groups/__tests__/groupStore.test.ts
    - src/features/tickets/TicketListPage.tsx
    - src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx
decisions:
  - "Rust expected_base_url mismatch returns Ok(0), not an error, so the frontend does not warn on an expected race"
  - "expectedBaseUrl can only veto a write; the write scope is still derived in Rust"
metrics:
  completed: 2026-10-12
---

# Phase 32 Plan 08: CR-01 snapshot refresh scope guard Summary

Snapshot refresh after a manual fetch is now skipped when the fetch signature changed mid-flight (frontend), and Rust independently refuses to write when the caller's expected base URL does not match the current connection scope.

## Tasks

1. Rust `refresh_group_snapshots_inner` / command take `expected_base_url`; mismatch or empty returns `Ok(0)`. 3 new cargo tests; existing 2 updated. Commit b84d587.
2. `groupStore.refreshSnapshots(tickets, expectedBaseUrl)` forwards `expectedBaseUrl`; tests updated. Commit ba0589a.
3. `handleFetch` defines `isFetchStillCurrent()` (fresh getState signature vs fetch-start `fetchSig`) and gates both refresh calls, passing `serverConn.baseUrl`. 5 new vitest tests (custom/batch baseUrl switch, username change, preset change, positive case). Commit ba0589a.

## Deviations from Plan

**[Rule 3 - Blocking] Tasks 2 and 3 share one commit.** The pre-commit hook runs `tsc --noEmit`; the required second argument on `refreshSnapshots` breaks the TicketListPage call sites until Task 3 lands, so the two could not be committed separately without `--no-verify`.

## Verification

- cargo test --lib groups_commands: 13 passed
- vitest full suite: 1477 passed; tsc clean; pre-commit hooks passed

## Known Stubs

None.

## Self-Check: PASSED
