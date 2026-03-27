---
phase: 13-background-polling-engine
plan: "01"
subsystem: rust-backend
tags: [poll-engine, background-tasks, tokio, watch-channel, sqlite, tauri-commands]
dependency_graph:
  requires: [snapshot_db, triage_db, jira_client, keychain]
  provides: [poll_engine, poll_frequency_persistence, poll_loop_commands]
  affects: [main.rs, commands.rs, lib.rs]
tech_stack:
  added: [tokio::sync::watch, PollFrequency enum, PollCompletePayload]
  patterns: [watch-channel restart, tokio::select! sleep+rx.changed, let-else, helper extraction for too-long fn]
key_files:
  created:
    - src-tauri/src/poll_engine.rs
  modified:
    - src-tauri/src/triage_db.rs
    - src-tauri/src/jira_client.rs
    - src-tauri/src/commands.rs
    - src-tauri/src/main.rs
    - src-tauri/src/lib.rs
decisions:
  - poll_engine uses standalone jira_client::search_tickets/fetch_ticket_detail_raw (plain reqwest, not audited) — background task cannot hold Tauri State
  - from_str named method (not FromStr trait) — plan spec requires this exact API; suppress clippy::should_implement_trait
  - do_poll split into extract_poll_params + process_tickets helpers — clippy too_many_lines limit (100 lines)
  - build_poll_jql merges "assigned" arm into wildcard — clippy match_same_arms, semantics preserved
metrics:
  duration: 7 min
  completed: "2026-03-27"
  tasks: 2
  files: 6
---

# Phase 13 Plan 01: Rust Background Polling Engine Summary

Implemented the Rust-side background polling engine: tokio::spawn loop controlled by a watch channel, SQLite frequency persistence in TriageDb, Tauri commands for get/set frequency and manual poll trigger, and poll loop wiring in main.rs setup.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | TriageDb poll frequency persistence + poll_engine module | 3bcb605 | triage_db.rs, poll_engine.rs, jira_client.rs, lib.rs |
| 2 | Tauri commands and main.rs poll loop wiring | 2e6b31e | commands.rs, main.rs, poll_engine.rs |

## What Was Built

### poll_engine.rs (new)
- `PollFrequency` enum: `Off` | `Secs(u64)`, with `from_str()` mapping "5m"→300, "15m"→900, "30m"→1800, "1h"→3600
- `PollCompletePayload` struct with `#[serde(rename_all = "camelCase")]` (changedKeys, checkedAt, hadError)
- `run_poll_loop()`: long-lived tokio task using `tokio::select!` on `sleep(secs)` vs `rx.changed()` — frequency changes take effect immediately by cancelling current sleep
- Off parking via `rx.changed().await` — loop does not exit, resumes when frequency set
- `do_poll()`: extracts DB state before any await, fetches tickets via watermark-filtered JQL, runs change detection per ticket
- Watermark not advanced on API failure (only `check_for_changes`/`store_snapshot` advances it)

### triage_db.rs (extended)
- `ALTER TABLE app_config ADD COLUMN poll_frequency TEXT NOT NULL DEFAULT 'off'` migration applied in both `open()` and `open_in_memory()`
- `get_poll_frequency()` → returns stored value, defaults to "off" on any error
- `set_poll_frequency()` → UPDATE app_config

### jira_client.rs (extended)
- `search_tickets(base_url, jql, pat)` — plain reqwest GET (no audit middleware), returns `issues` array
- `fetch_ticket_detail_raw(base_url, issue_key, pat)` — plain reqwest GET, returns full JSON value
- These standalone functions allow the poll loop (which has no Tauri State access) to make HTTP calls

### commands.rs (extended)
- `get_poll_frequency` — reads from TriageDb
- `set_poll_frequency` — persists to DB + sends to watch channel (immediate effect)
- `trigger_manual_poll` — sends current frequency to watch channel (resets background timer)

### main.rs (extended)
- `watch::channel(PollFrequency::Off)` created at startup
- Saved frequency read from DB and sent as initial value
- `Arc<Mutex<watch::Sender<PollFrequency>>>` managed as Tauri state
- `tauri::async_runtime::spawn(run_poll_loop(...))` spawned before mock server block
- Three new commands registered in `generate_handler!`

## Test Results

All 54 tests pass (37 unit + 5 audit + 3 keychain + 9 mock_server):
- 6 PollFrequency::from_str tests
- 1 PollCompletePayload camelCase serialization test
- 3 TriageDb poll_frequency persistence tests (default "off", set/get, overwrite)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed clippy pedantic violations in poll_engine.rs**
- **Found during:** Task 2 (cargo clippy -- -D warnings)
- **Issue:** 10 clippy errors: should_implement_trait (from_str), match_same_arms, too_many_lines in do_poll, multiple let-else suggestions, map_unwrap_or, Option<&T> vs &Option<T>
- **Fix:** Added `#[allow(clippy::should_implement_trait)]` on `from_str`, extracted `extract_poll_params` and `process_tickets` helpers to reduce do_poll line count, rewrote match patterns with `let...else`, used `map_or_else`, merged "assigned" + wildcard arms in build_poll_jql, changed `&Option<T>` to `Option<&T>` parameter
- **Files modified:** src-tauri/src/poll_engine.rs
- **Commit:** 2e6b31e

## Known Stubs

None — all poll logic is wired and functional. The poll loop reads real credentials from keychain and makes real HTTP calls.

## Self-Check: PASSED

All 6 created/modified files exist on disk. Both task commits (3bcb605, 2e6b31e) verified in git log.
