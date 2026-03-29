---
phase: 15-change-diff-view
plan: 01
subsystem: database
tags: [rust, sqlite, rusqlite, tauri, snapshot, change-tracking]

# Dependency graph
requires:
  - phase: 12-snapshot-foundation
    provides: SnapshotDb, FieldChange, check_for_changes, detect_changes
  - phase: 13-poll-engine
    provides: poll_engine process_tickets, run_poll_loop
provides:
  - SnapshotDb unseen-changes columns (seen_response_json, has_unseen_changes, pending_changes_json)
  - SnapshotDb methods: get_unseen_keys, get_pending_changes, mark_changes_seen, set_unseen_changes, get_seen_snapshot
  - Tauri commands: get_unseen_change_keys, get_ticket_changes, mark_changes_seen
  - Poll engine persisting unseen state with D-12 cumulative diff logic
affects: [15-change-diff-view plan 02, frontend change-diff UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - ALTER TABLE migrations with .ok() pattern for existing on-disk databases
    - D-12 cumulative diff: always diff from seen_response_json baseline to current, not incremental steps
    - D-11: has_unseen_changes flag survives app restart via SQLite persistence

key-files:
  created: []
  modified:
    - src-tauri/src/snapshot_db.rs
    - src-tauri/src/commands.rs
    - src-tauri/src/main.rs
    - src-tauri/src/poll_engine.rs

key-decisions:
  - "ALTER TABLE migrations use .ok() to silently ignore duplicate column errors on existing databases"
  - "D-12 cumulative diff computed at poll time in poll_engine — caller diffs from seen_response_json baseline to current response_json"
  - "set_unseen_changes only called when changes is non-empty — new tickets without changes don't set the unseen flag"

patterns-established:
  - "Unseen changes lifecycle: store_snapshot -> set_unseen_changes (poll) -> get_pending_changes (frontend) -> mark_changes_seen (user views)"
  - "Cumulative diff pattern: get_seen_snapshot -> detect_changes(seen, current) -> set_unseen_changes"

requirements-completed: [CHNG-01, CHNG-02]

# Metrics
duration: 15min
completed: 2026-03-29
---

# Phase 15 Plan 01: Change Diff View — Backend Summary

**SQLite unseen-changes tracking layer with 3 new columns, 5 SnapshotDb methods, 3 Tauri commands, and poll engine wired for D-12 cumulative diffs**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-29T00:00:00Z
- **Completed:** 2026-03-29T00:15:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended snapshot_store table with seen_response_json, has_unseen_changes, and pending_changes_json columns including ALTER TABLE migrations for existing databases
- Added 5 SnapshotDb methods covering the full unseen-changes lifecycle: get_unseen_keys, get_pending_changes, mark_changes_seen, set_unseen_changes, get_seen_snapshot
- Wired 3 new Tauri commands (get_unseen_change_keys, get_ticket_changes, mark_changes_seen) and registered them in main.rs
- Updated poll engine process_tickets to persist cumulative diffs from the seen_response_json baseline per D-12

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend SnapshotDb with unseen-changes columns and methods** - `d3e359d` (feat)
2. **Task 2: Add Tauri commands and wire poll engine** - `37da241` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src-tauri/src/snapshot_db.rs` - Added 3 new columns to CREATE_SNAPSHOT_TABLE, ALTER TABLE migrations in open(), 5 new SnapshotDb methods, 2 new tests
- `src-tauri/src/commands.rs` - Added get_unseen_change_keys, get_ticket_changes, mark_changes_seen Tauri commands
- `src-tauri/src/main.rs` - Registered 3 new commands in generate_handler
- `src-tauri/src/poll_engine.rs` - Added cumulative diff persistence after changed_keys.push in do_poll

## Decisions Made
- ALTER TABLE migrations placed only in `open()` (not `open_in_memory()`): in-memory DBs always start fresh with the full CREATE TABLE schema, so no migration is needed
- Cumulative diff (D-12) computed at poll time by diffing `seen_response_json` against the current `detail_json`, not by accumulating incremental steps
- `set_unseen_changes` is only called when `!changes.is_empty()` to avoid setting the unseen flag for new-ticket entries without field changes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend API complete: all three Tauri commands callable from frontend
- Plan 02 can hydrate unseen keys on startup via `get_unseen_change_keys`, fetch per-ticket diffs via `get_ticket_changes`, and clear state via `mark_changes_seen`
- No blockers.

---
*Phase: 15-change-diff-view*
*Completed: 2026-03-29*

## Self-Check: PASSED

- FOUND: src-tauri/src/snapshot_db.rs
- FOUND: src-tauri/src/commands.rs
- FOUND: src-tauri/src/main.rs
- FOUND: src-tauri/src/poll_engine.rs
- FOUND: .planning/phases/15-change-diff-view/15-01-SUMMARY.md
- FOUND: d3e359d (feat(15-01): extend SnapshotDb with unseen-changes columns and methods)
- FOUND: 37da241 (feat(15-01): add Tauri commands and wire poll engine for unseen changes)
