---
phase: 32-durability
plan: 01
subsystem: groups-backend
tags: [rust, sqlite, tauri, snapshots]
requires: []
provides:
  - GroupsDb::refresh_snapshots (UPDATE-only, scope-bound)
  - Tauri command refresh_group_snapshots
affects: [32-04 frontend refresh wiring]
tech-stack:
  added: []
  patterns: [require_scope before lock_groups, validate-then-transaction]
key-files:
  created: []
  modified:
    - src-tauri/src/groups_db.rs
    - src-tauri/src/groups_commands.rs
    - src-tauri/src/main.rs
key-decisions:
  - "Refresh is UPDATE-only with ticket_json != new guard, so unchanged rows return 0 and no orphan snapshots can be created"
requirements-completed: [GDUR-01, GDUR-06]
metrics:
  tasks: 2
  files: 3
  completed: 2026-10-12
---

# Phase 32 Plan 01: Snapshot refresh backend Summary

UPDATE-only, scope-bound `refresh_snapshots` plus `refresh_group_snapshots` Tauri command, with regression tests proving refresh never touches membership and GC on remove/delete still works.

## Tasks

1. `GroupsDb::refresh_snapshots` and 8 new tests (refresh and GC regression) - commit 47f4e36
2. `refresh_group_snapshots_inner` and `#[tauri::command]`, registered in `generate_handler!`, with 2 command tests - commit 3283305

## Deviations from Plan

- Worktree base was reset to 42cec48 per the startup instructions (the branch started at an older commit).
- Added backticks to a doc comment to satisfy clippy `doc_markdown` (pre-commit hook).

## Known Stubs

None.

## Self-Check: PASSED

Full cargo test suite and pre-commit hooks passed on both commits.
