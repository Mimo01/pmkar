---
phase: 28-foundations
plan: 05
subsystem: backend
tags: [rust, tauri, groups]
requires: [28-04]
provides:
  - Ten group Tauri commands with Rust-derived scope and typed JSON errors
  - groups.db opened at startup and managed as Arc<Mutex<GroupsDb>>
affects: [28-06]
key-files:
  created:
    - src-tauri/src/groups_commands.rs
  modified:
    - src-tauri/src/lib.rs
    - src-tauri/src/main.rs
key-decisions:
  - "Scope resolved from server connection_meta in a scoped lock block; triage lock released before groups lock (D-21)"
  - "List commands return empty with no scope; mutations and get_group_members return no_scope"
requirements-completed: [GRP-06]
duration: 10min
completed: 2026-10-12
---

# Phase 28 Plan 05: Group commands Summary

Ten `#[tauri::command]` group commands (list, memberships, members, create, rename, color, move, delete, add/remove issues) delegating to `_inner` fns that derive scope in Rust via `normalize_scope`, with `groups.db` opened in `main.rs` setup.

## Commits
- Task 1: 33ecb51 - groups_commands.rs + lib.rs module (8 unit tests: scope none/cloud, normalization, lock release, no-scope, scope switch, username change, error serialisation, poisoned mutexes)
- Task 2: 6825e1d - main.rs open/manage groups.db and register handlers

## Deviations from Plan
- Added `#![allow(clippy::needless_pass_by_value)]` to groups_commands.rs, matching commands.rs, since tauri::State params trigger it. No other deviations.

## Issues
- Pre-existing `createmeta_pagination` integration test failure (known baseline) stops a full `cargo test` run; lib tests (250) pass. groups_commands.rs has no clippy findings; `cargo fmt --check` passes.

## Known Stubs
None.

## Self-Check: PASSED
