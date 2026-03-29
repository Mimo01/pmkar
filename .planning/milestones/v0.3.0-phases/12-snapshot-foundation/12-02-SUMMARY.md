---
phase: 12-snapshot-foundation
plan: "02"
subsystem: tauri-integration
tags: [snapshot_db, tauri, managed-state, commands, polling, POLL-06]

# Dependency graph
requires:
  - 12-01 (SnapshotDb, FieldChange, check_for_changes, get_watermark)
provides:
  - SnapshotDb initialized at app startup as Arc<Mutex<SnapshotDb>> managed state
  - check_ticket_changes Tauri command (stores snapshot, returns FieldChange vec)
  - get_poll_watermark Tauri command (returns MIN(last_checked_at))
  - POLL-06 call-site comment enforcing watermark-only-on-success by structure
affects:
  - phase-13: polling engine calls check_ticket_changes after successful fetch_ticket_detail
  - phase-14: UI consumes FieldChange vec via get_poll_watermark and check_ticket_changes

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SnapshotDb follows AuditDb/TriageDb Arc<Mutex<T>> managed state pattern in main.rs
    - New Tauri commands follow existing State<'_, Arc<Mutex<T>>> lock pattern from commands.rs
    - POLL-06 documented at command call site (comment in check_ticket_changes)

key-files:
  created: []
  modified:
    - src-tauri/src/main.rs (SnapshotDb import, initialization, invoke_handler registration)
    - src-tauri/src/commands.rs (SnapshotDb/FieldChange imports, check_ticket_changes, get_poll_watermark)

key-decisions:
  - "POLL-06 enforced by call-site structure: frontend only invokes check_ticket_changes after successful fetch_ticket_detail — no data-layer changes required"
  - "SnapshotDb registered as Arc<Mutex<SnapshotDb>> matching AuditDb/TriageDb pattern — consistent with project managed state convention"
  - "Two commands added: check_ticket_changes (store+diff) and get_poll_watermark (watermark query) — sufficient surface for Phase 13 polling engine"

requirements-completed: [POLL-04, POLL-06]

# Metrics
duration: 3min
completed: 2026-03-27
---

# Phase 12 Plan 02: SnapshotDb Tauri Integration Summary

**SnapshotDb wired into Tauri runtime: initialized at startup, managed as Arc<Mutex<T>> state, two commands registered — POLL-06 enforced by call-site comment and frontend-gated invocation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T21:42:28Z
- **Completed:** 2026-03-27T21:45:40Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- `SnapshotDb::open(&snapshot_db_path)` called at app startup in `main.rs` setup closure, using `snapshots.db` in the app data directory
- `app.manage(Arc::new(Mutex::new(snapshot_db)))` registered immediately after TriageDb, following the established AuditDb/TriageDb pattern
- `check_ticket_changes` Tauri command added — takes `snapshot_db` state, `ticket_key`, and `response_json`; calls `crate::snapshot_db::check_for_changes`; includes POLL-06 call-site comment
- `get_poll_watermark` Tauri command added — returns `MIN(last_checked_at)` from `SnapshotDb::get_watermark()`; ready for Phase 13 JQL filter
- Both commands registered in `invoke_handler` macro in `main.rs`
- All 27 unit tests pass; no regressions; `cargo clippy -- -D warnings` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize SnapshotDb in main.rs and wire into commands.rs** - `d16b2fc` (feat)

## Files Created/Modified

- `src-tauri/src/main.rs` — added `snapshot_db::SnapshotDb` import, SnapshotDb initialization block (`snapshots.db`), two entries in `invoke_handler`
- `src-tauri/src/commands.rs` — added `snapshot_db::{FieldChange, SnapshotDb}` import, `check_ticket_changes` command, `get_poll_watermark` command

## Decisions Made

- POLL-06 watermark-only-on-success guarantee is enforced at the call site, not in the data layer. The frontend invokes `check_ticket_changes` only after `fetch_ticket_detail` succeeds. This is documented with a comment in the command body and matches the original design decision from 12-RESEARCH.md Pattern 4.
- Registered `SnapshotDb` as `Arc<Mutex<SnapshotDb>>` to match the existing `AuditDb` and `TriageDb` pattern — no new conventions introduced.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria satisfied on first build.

## Issues Encountered

None — implementation compiled and all tests passed immediately.

## Known Stubs

None — both commands are fully wired to real `SnapshotDb` implementations.

## Next Phase Readiness

- `check_ticket_changes` and `get_poll_watermark` are callable from the frontend
- Phase 13 polling engine can call `check_ticket_changes` after each `fetch_ticket_detail` success
- `get_poll_watermark` provides the JQL anchor date for `updated >= watermark` queries

---
*Phase: 12-snapshot-foundation*
*Completed: 2026-03-27*
