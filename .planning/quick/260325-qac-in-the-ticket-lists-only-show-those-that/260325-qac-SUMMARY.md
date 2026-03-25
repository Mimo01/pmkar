---
phase: quick-260325-qac
plan: "01"
subsystem: tickets
tags: [filtering, triage, done-tickets, frontend, backend]
dependency_graph:
  requires: []
  provides: [done-ticket-filtering]
  affects: [TicketListPage, IgnoredTicketsPage, LinkedTicketsPage, triage_db]
tech_stack:
  added: []
  patterns: [status-category-check, bulk-delete-sqlite, isDoneTicket-helper]
key_files:
  created:
    - src/features/tickets/utils.ts
  modified:
    - src-tauri/src/triage_db.rs
    - src-tauri/src/commands.rs
    - src-tauri/src/main.rs
    - src/features/tickets/TicketListPage.tsx
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/features/tickets/LinkedTicketsPage.tsx
    - src/features/tickets/__tests__/LinkedTicketsPage.test.tsx
decisions:
  - isDoneTicket uses statusCategory.key === 'done' as primary check with status name fallback for Server instances missing statusCategory
  - Done ticket triage cleanup happens inside the triage DB lock block in fetch_tickets to avoid a second lock acquisition
  - delete_triage_entries uses dynamic placeholders built from slice length — safe parameterized SQL, no injection risk
metrics:
  duration: ~8 min
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_changed: 8
---

# Phase quick-260325-qac Plan 01: Hide Done Tickets Summary

**One-liner:** Filter done/resolved/closed tickets from all three list views with statusCategory-based detection and SQLite bulk delete cleanup after each fetch.

## What Was Built

Done ticket suppression across the full stack:

1. **Backend (Rust):** `delete_triage_entries(&[String])` method on `TriageDb` that bulk-deletes triage rows by ticket key. In `fetch_tickets`, after the new-ticket triage upsert loop, tickets whose `statusCategory.key == "done"` are collected and their triage entries deleted. A new `delete_done_triage` Tauri command is also registered for frontend-triggered cleanup.

2. **Frontend (TypeScript):** `isDoneTicket(ticket: JiraTicket): boolean` utility function in `src/features/tickets/utils.ts`. Primary check: `statusCategory?.key === 'done'`. Fallback for Jira Server APIs that omit statusCategory: status name lowercased contains 'done', 'resolved', or 'closed'. Applied to all three list page filter predicates.

## Tasks Completed

| Task | Name | Commit |
|------|------|--------|
| 1 | Add bulk delete to triage DB and clean up done tickets after fetch | a220721 |
| 2 | Filter done tickets from all three ticket list views | be3e687 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LinkedTicketsPage test fixture used done status name**

- **Found during:** Task 2 verification
- **Issue:** `makeTicket` helper in `LinkedTicketsPage.test.tsx` set `status: { name: 'Done' }`. With the new `isDoneTicket` fallback (checks name when no statusCategory), these test tickets were now filtered out, causing 3 test failures.
- **Fix:** Updated `makeTicket` to use `status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } }` — an accurate active-ticket fixture.
- **Files modified:** `src/features/tickets/__tests__/LinkedTicketsPage.test.tsx`
- **Commit:** be3e687

## Known Stubs

None — all filtering logic is wired to real data.

## Self-Check: PASSED

- [x] `src/features/tickets/utils.ts` — created
- [x] `delete_triage_entries` — present in triage_db.rs
- [x] `delete_done_triage` — present in commands.rs and registered in main.rs
- [x] `!isDoneTicket(t)` — present in all three page filter predicates
- [x] Commits a220721 and be3e687 — verified via `git log --oneline`
- [x] `cargo test --lib` — 13 unit tests pass (8 triage_db, 5 audit)
- [x] `npx vitest run` — 389 tests pass, 40 test files pass
