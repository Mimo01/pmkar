---
phase: 26-batch-ticket-fetching-per-watched-user
plan: "01"
subsystem: frontend-fetch
tags:
  - frontend
  - tauri-ipc
  - jql
  - batching
  - i18n
  - tdd
dependency_graph:
  requires: []
  provides:
    - handleFetch sequential batch loop
    - buildMineBatchJql
    - buildUserBatchJql
    - progress counter UI (batchesDone/batchesTotal)
    - partial-failure warning UI (failedUserNames)
    - i18n keys tickets.fetchProgress and tickets.partialFetchWarning
  affects:
    - TicketListPage.tsx handleFetch
    - TicketListPage.projectScope.test.tsx (D-02 clause update)
tech_stack:
  added: []
  patterns:
    - sequential for...of loop over batches array with await
    - per-iteration try/catch for per-user failure isolation
    - first-seen-wins dedup via Set<string>
    - local component state for transient fetch progress (not Zustand)
key_files:
  created: []
  modified:
    - src/features/tickets/TicketListPage.tsx
    - src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx
    - src/features/tickets/__tests__/TicketListPage.projectScope.test.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - "D-02 clause removal reflected in projectScope test (comment~/description~ assertions inverted to not.toContain)"
  - "Progress counter test uses data-testid not i18n text regex — test environment returns key name, not translated string"
  - "setTickets-once test uses loading->idle transition tracking rather than subscribe counting all idle states"
metrics:
  duration_minutes: 9
  completed_date: "2026-05-06"
  tasks_completed: 3
  files_modified: 5
---

# Phase 26 Plan 01: Batch Ticket Fetching per Watched User Summary

Sequential per-user JQL batching in handleFetch: buildMineBatchJql + buildUserBatchJql replace the single combined buildJql, a for...of loop issues one fetch_tickets call per batch, and results are deduplicated and committed to the store in a single setTickets call.

## What Was Built

### Task 1 (TDD RED) — Test extension
Extended `TicketListPage.handleFetch.test.tsx` with 4 new describe blocks covering:
- Per-user batch invocation count and JQL order
- D-02 clause assertions (no comment~/description~ in new builders)
- Deduplication (first-seen wins)
- Pitfall 1 guard (setTickets called once)
- Partial failure tolerance (D-06)
- Progress counter visibility during load (D-04)
- Change detection over merged list (Pitfall 2)

Test count delta: 2 existing → 17 tests (added 15 new it() cases; 12 were expected, 3 passed immediately because the current implementation already handled mine/custom/empty-watchedUsers presets correctly).

### Task 2 (TDD GREEN) — Implementation refactor
Modified `TicketListPage.tsx`:
- Replaced `buildJql()` with `buildMineBatchJql()` and `buildUserBatchJql()` (D-02 — dropped comment~/description~ clauses)
- Added 3 local state variables: `batchesDone`, `batchesTotal`, `failedUserNames`
- Replaced single-invoke handleFetch body with:
  - Custom preset fast-path (Pitfall 4)
  - Sequential batch loop over `[mine, ...watchedUsers]` (D-05)
  - Per-iteration try/catch for failure isolation (D-06)
  - First-seen dedup via Set<string> (D-07)
  - Single `store.setTickets()` call after loop (D-03)
  - Change-detection loop over `mergedIssues` (Pitfall 2, regression guard)
- Added progress counter JSX: `data-testid="fetch-progress"` with `{batchesTotal > 0}` guard (Pitfall 6)
- Added partial-failure warning JSX: `data-testid="partial-fetch-warning"` after truncation warning

Updated `TicketListPage.projectScope.test.tsx`: inverted `comment ~` / `description ~` assertions from `toContain` to `not.toContain` to reflect D-02 behavior (pre-existing test tested OLD buildJql behavior).

### Task 3 — i18n keys
Added to en.json and sk.json after `tickets.truncationWarningHint`:
- `tickets.fetchProgress`: `{{done}}/{{total}} users fetched` / `{{done}}/{{total}} načítaných používateľov`
- `tickets.partialFetchWarning`: `Fetch failed for {{count}} user(s)` / `Načítanie zlyhalo pre {{count}} používateľa/ov`

## Regression Guard Confirmed

The `issueKey: ticket.key` parameter name in `fetch_ticket_detail` invocations is preserved in all code paths (custom preset fast-path and batch loop). The existing regression test for manual-fetch-misses-changes passes without modification.

Per-batch error log format: `[manual-fetch] batch '<label>' failed:` — label is either `'mine'` or the `WatchedUser.displayName`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Progress counter test used i18n text regex that fails in test environment**
- **Found during:** Task 2 GREEN phase
- **Issue:** `screen.findByText(/\d+\/\d+ users fetched/i)` fails because i18next returns the key name in test environment, not the translated string
- **Fix:** Changed to `screen.findByTestId('fetch-progress')` and `screen.queryByTestId('fetch-progress')` respectively
- **Files modified:** `TicketListPage.handleFetch.test.tsx`
- **Commit:** c18fb7b

**2. [Rule 1 - Bug] setTickets-once test used subscribe counting all 'idle' transitions**
- **Found during:** Task 2 GREEN phase
- **Issue:** `subscribe((state) => { if (state.fetchStatus === 'idle') count++ })` counted 6 transitions (initial state + beforeEach + other effects) instead of exactly 1
- **Fix:** Changed to track `'loading' → 'idle'` transitions only, which precisely tracks the setTickets call
- **Files modified:** `TicketListPage.handleFetch.test.tsx`
- **Commit:** c18fb7b

**3. [Rule 1 - Bug] projectScope test asserted comment~/description~ presence after D-02 removal**
- **Found during:** Task 2 GREEN phase
- **Issue:** `TicketListPage.projectScope.test.tsx` line 103-104 expected `comment ~ "alice"` and `description ~ "alice"` in the mine JQL — behavior intentionally removed by D-02
- **Fix:** Updated assertions to `not.toContain` + added D-02 note to test description comment
- **Files modified:** `TicketListPage.projectScope.test.tsx`
- **Commit:** c18fb7b

## TDD Gate Compliance

- RED gate commit: `27bf798` (test(26-01): add failing tests...)
- GREEN gate commit: `c18fb7b` (feat(26-01): refactor handleFetch...)
- REFACTOR gate: not required (no logic changes needed after GREEN)

## Known Stubs

None. All data flows are wired (fetch loop populates mergedIssues → store.setTickets → store.tickets → UI render).

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. JQL interpolation pattern is unchanged from pre-refactor behavior (same trust boundary, same Rust-side URL-encoding). See threat model T-26-01 through T-26-05 in PLAN.md for full threat register.

## Pre-existing Out-of-Scope Failure

`CopyPreviewPage.test.tsx` has 1 pre-existing failing test (`searchUsersForPicker invokes search_jira_users_by_domain`) unrelated to this plan. Logged here for orchestrator awareness. Not introduced by this plan's changes.

## Self-Check: PASSED

Files created/modified:
- src/features/tickets/TicketListPage.tsx — FOUND (buildMineBatchJql, buildUserBatchJql, sequential loop, progress counter, partial-failure warning)
- src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx — FOUND (17 tests, 5 describe blocks)
- src/features/tickets/__tests__/TicketListPage.projectScope.test.tsx — FOUND (D-02 updates)
- src/i18n/locales/en.json — FOUND (tickets.fetchProgress, tickets.partialFetchWarning)
- src/i18n/locales/sk.json — FOUND (tickets.fetchProgress, tickets.partialFetchWarning)

Commits verified:
- 27bf798 — test(26-01): add failing tests for per-user batch fetching (TDD RED)
- c18fb7b — feat(26-01): refactor handleFetch to sequential per-user batch loop (TDD GREEN)
- e3fbda5 — feat(26-01): add i18n keys for progress counter and partial-failure warning
