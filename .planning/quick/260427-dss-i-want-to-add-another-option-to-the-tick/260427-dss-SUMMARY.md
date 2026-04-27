---
phase: quick-260427-dss
plan: "01"
subsystem: triage
tags: [triage, handled-state, sqlite-migration, i18n, frontend]
dependency_graph:
  requires: []
  provides: [handled-triage-state]
  affects: [TicketDetailPanel, TicketDetailPage, TicketListPage, IgnoredTicketsPage, triage_db, set_triage_state]
tech_stack:
  added: []
  patterns: [sqlite-rebuild-migration, zustand-optimistic-update, i18n-key-colocated]
key_files:
  created: []
  modified:
    - src-tauri/src/triage_db.rs
    - src-tauri/src/commands.rs
    - src/features/tickets/types.ts
    - src/features/tickets/TicketDetailPanel.tsx
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/TicketListPage.tsx
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - "SQLite CHECK constraint widened via table-rebuild migration (MIGRATE_TRIAGE_CHECK_HANDLED); gate is a sqlite_master sql-string check for 'handled' so re-runs are idempotent"
  - "TicketDetailPage uses useCallback for handlers (matching existing pattern); TicketDetailPanel uses plain functions (matching existing pattern there)"
  - "Mark as Handled + Dismiss buttons both rendered side-by-side when ticket is in new/seen state; handled replaces both when ticket is already handled"
metrics:
  duration: "~15 min"
  completed: "2026-04-27"
  tasks: 2
  files: 9
---

# Phase quick-260427-dss Plan 01: Add 'Mark as Handled' Triage State Summary

**One-liner:** Fifth SQLite triage state 'handled' with in-place CHECK-constraint migration, Tauri allowlist extension, TypeScript union update, and dual detail-view button with Dismissed-tab badge.

## What Was Built

Added a "Mark as Handled" triage action alongside the existing "Dismiss" and "Copy" actions. Used when the user has already manually copied a ticket to their company Jira outside pmkar — handled tickets disappear from the New tab and appear in the Dismissed tab with a "Handled" badge, recoverable via the existing Restore action.

## Task Results

### Task 1: Backend, Command, TypeScript Types

- `CREATE_TRIAGE_STATE_SQL` CHECK constraint updated from 4 to 5 values (`'handled'` added) for fresh databases
- `MIGRATE_TRIAGE_CHECK_HANDLED` const added: a 5-step `BEGIN TRANSACTION ... COMMIT` that rebuilds the table in-place, copying all existing rows including `copied_key`
- `migrate_triage_check_constraint()` helper added: queries `sqlite_master` for the existing table DDL, runs migration only if `'handled'` is absent — idempotent
- Migration called in both `open()` and `open_in_memory()` after `ALTER_TRIAGE_ADD_COPIED_KEY`
- `set_triage_state` in `commands.rs`: allowlist extended with `"handled"`; error message updated
- `TriageState` TypeScript union: `'handled'` added as fifth member
- `test_set_handled_state_accepted` Rust unit test added and passing
- All 14 `triage_db::tests` pass; `tsc --noEmit` clean

**Commit:** `4d826e7`

### Task 2: Frontend Buttons and Filter Updates

- `TicketDetailPanel.tsx`: added `isHandled` flag; added `handleMarkHandled` / `handleUnhandle` plain functions; updated action row to show Mark-as-Handled alongside Dismiss (new/seen state), show Handled button alone (handled state), and hide Copy when handled
- `TicketDetailPage.tsx`: mirror of Panel changes using `useCallback` wrappers; Copy button condition extended to `!isHandled`
- `TicketListPage.tsx`: `candidateTickets` filter extended with `s !== 'handled'`
- `IgnoredTicketsPage.tsx`: `ignoredTickets` filter updated to include `s === 'handled'`; `actionSlot` updated to show "Handled" pill badge before Restore button
- `en.json` + `sk.json`: 5 new keys added (`detail.markHandled`, `detail.markHandled.tooltip`, `detail.handled`, `detail.handled.tooltip`, `tickets.card.handledBadge`)
- All 24 vitest tests pass; `tsc --noEmit` clean

**Commit:** `b86ebe6`

## SQLite Migration Approach

The existing `CREATE TABLE IF NOT EXISTS` uses a `CHECK(state IN ('new','seen','ignored','copied'))` constraint. SQLite cannot alter a CHECK constraint via `ALTER TABLE` alone. The chosen approach:

1. Update `CREATE_TRIAGE_STATE_SQL` to include `'handled'` — affects fresh installs only
2. After the existing `ALTER_TRIAGE_ADD_COPIED_KEY` step, run `migrate_triage_check_constraint()`:
   - Queries `sqlite_master` to read the actual DDL of the existing `triage_state` table
   - If the DDL doesn't contain `'handled'`, executes `MIGRATE_TRIAGE_CHECK_HANDLED` which creates a new table with the widened CHECK, bulk-inserts all rows, drops the old table, and renames the new one
   - Wrapped in `let _ =` so a failure is silent and doesn't crash app startup (consistent with `ALTER_TRIAGE_ADD_COPIED_KEY` pattern)
3. Validation is done at the Tauri command layer (allowlist) — both layers now agree on 5 valid states

## Deviations from Plan

None — plan executed exactly as written. Button positioning, handler naming, and migration approach all match the plan specification.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or external-facing schema changes. The new state is internal to the single-user SQLite database.

## Self-Check: PASSED

All 9 modified files confirmed present. Both task commits (4d826e7, b86ebe6) confirmed in git log.
