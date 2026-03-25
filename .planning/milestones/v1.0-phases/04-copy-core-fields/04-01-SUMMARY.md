---
phase: 04-copy-core-fields
plan: "01"
subsystem: rust-backend
tags: [cargo, mock-server, triage-db, sqlite, htmltoadf]
dependency_graph:
  requires: []
  provides: [htmltoadf-crate, multipart-reqwest, mock-remotelink-endpoint, mock-priority-endpoint, mock-project-statuses-endpoint, copied-key-column, set-triage-copied-method, triage-entry-response-type]
  affects: [04-02, 04-03, 04-04, 04-05]
tech_stack:
  added: [htmltoadf = "0.1.12", reqwest multipart feature]
  patterns: [SQLite ALTER TABLE migration with silent error on duplicate, UPSERT pattern for triage state]
key_files:
  created: []
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/mock_server.rs
    - src-tauri/src/triage_db.rs
    - src-tauri/src/commands.rs
decisions:
  - "Used HashMap<String, (String, Option<String>)> as triage_db internal return type to avoid premature DTO coupling in the DB layer"
  - "FetchTicketsResult.triage_map also updated to TriageEntryResponse — single source of truth for the triage shape sent to frontend"
metrics:
  duration: ~15 minutes
  completed: 2026-03-22
  tasks_completed: 2
  files_modified: 4
---

# Phase 04 Plan 01: Rust Copy Infrastructure (Cargo + Mock + DB) Summary

## One-liner

Added htmltoadf crate, reqwest multipart, three Cloud mock endpoints (remotelink/priority/project-statuses), SQLite copied_key column migration, set_triage_copied method, and updated get_triage_state to return TriageEntryResponse with copiedKey to the frontend.

## What Was Built

### Task 1: Dependencies and mock endpoints

- `Cargo.toml`: Added `htmltoadf = "0.1.12"` dependency; added `multipart` feature to reqwest
- `mock_server.rs`: Added three new v3 handlers in `mod v3`:
  - `create_remotelink` — POST `/rest/api/3/issue/{key}/remotelink` returns 201 `{ "id": 10001 }`
  - `get_priorities` — GET `/rest/api/3/priority` returns 5-priority Jira Cloud list
  - `get_project_statuses` — GET `/rest/api/3/project/{key}/statuses` returns Task issue type with 4 statuses
- Registered all three routes in `build_v3_router`
- Updated `add_attachment` response to include proper `content` URL field matching the plan spec

### Task 2: triage_db extension and get_triage_state update

- `triage_db.rs`: Added `ALTER_TRIAGE_ADD_COPIED_KEY` constant for `copied_key TEXT` column migration
- Migration applied in both `open()` and `open_in_memory()` with `let _ =` to silently ignore duplicate column error
- `get_all_triage` return type changed from `HashMap<String, String>` to `HashMap<String, (String, Option<String>)>`
- New `set_triage_copied(source_key, target_key)` method using UPSERT to atomically set state='copied' and store target key
- `commands.rs`: Added `TriageEntryResponse { state: String, copied_key: Option<String> }` struct with `camelCase` serde rename
- `get_triage_state` command updated to map raw tuples into `TriageEntryResponse` values
- `FetchTicketsResult.triage_map` type updated from `HashMap<String, String>` to `HashMap<String, TriageEntryResponse>` for consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated FetchTicketsResult.triage_map type**
- **Found during:** Task 2
- **Issue:** `fetch_tickets` command also calls `get_all_triage()` and returns `triage_map` in `FetchTicketsResult`. After changing `get_all_triage` return type, the `FetchTicketsResult` struct and its construction in `fetch_tickets` also needed updating to compile.
- **Fix:** Changed `FetchTicketsResult.triage_map` type from `HashMap<String, String>` to `HashMap<String, TriageEntryResponse>` and updated the map construction in `fetch_tickets` to convert raw tuples to `TriageEntryResponse`.
- **Files modified:** `src-tauri/src/commands.rs`
- **Commit:** a3b76cb

**2. [Rule 1 - Bug] Updated add_attachment response in v3 handler**
- **Found during:** Task 1
- **Issue:** The existing `add_attachment` in `mod v3` returned a response with `"content"` pointing to `/secure/attachment/...` but the plan spec requires `http://localhost:8081/rest/api/3/attachment/content/att-1` format with correct `id`, `filename`, and `size` values.
- **Fix:** Updated the mock response JSON to match the plan's specified format.
- **Files modified:** `src-tauri/src/mock_server.rs`
- **Commit:** 6ec88e1

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 6ec88e1 | feat(04-01): add htmltoadf, multipart support, and Cloud metadata mock endpoints |
| 2 | a3b76cb | feat(04-01): extend triage_db with copied_key and update get_triage_state command |

## Known Stubs

None — all endpoints return deterministic mock data. No placeholder text or hardcoded empty collections flow to the UI from this plan's changes.

## Self-Check: PASSED

- `src-tauri/Cargo.toml` contains `htmltoadf = "0.1.12"` ✓
- `src-tauri/Cargo.toml` contains `features = ["json", "multipart"]` ✓
- `src-tauri/src/mock_server.rs` contains `fn create_remotelink` ✓
- `src-tauri/src/mock_server.rs` contains `fn get_priorities` ✓
- `src-tauri/src/mock_server.rs` contains `fn get_project_statuses` ✓
- `src-tauri/src/mock_server.rs` contains `/rest/api/3/issue/{key}/remotelink` ✓
- `src-tauri/src/mock_server.rs` contains `/rest/api/3/priority` ✓
- `src-tauri/src/mock_server.rs` contains `/rest/api/3/project/{key}/statuses` ✓
- `src-tauri/src/triage_db.rs` contains `ALTER TABLE triage_state ADD COLUMN copied_key TEXT` ✓
- `src-tauri/src/triage_db.rs` contains `fn set_triage_copied` ✓
- `src-tauri/src/triage_db.rs` contains `ON CONFLICT(ticket_key) DO UPDATE SET state='copied'` ✓
- `src-tauri/src/commands.rs` contains `struct TriageEntryResponse` ✓
- `src-tauri/src/commands.rs` contains `copied_key` in get_triage_state ✓
- `src-tauri/src/commands.rs` return type for get_triage_state is `HashMap<String, TriageEntryResponse>` ✓
- Commits 6ec88e1 and a3b76cb exist in git log ✓
- `cargo check` exits 0 ✓
