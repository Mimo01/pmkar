---
phase: 28-foundations
plan: 04
subsystem: database
tags: [rust, rusqlite, sqlite, unicode-normalization, groups]
requires: []
provides:
  - GroupsDb (groups.db data layer) with scoped CRUD, ordering, atomic membership, snapshot GC
  - normalize_scope, validate_group_name, group_name_key, GROUP_COLORS, pick_default_color
  - Shared Rust+TS vectors in src/test-fixtures/group-vectors.json
affects: [28-05, later group phases]
tech-stack:
  added: [unicode-normalization 0.1.25]
  patterns: [typed GroupError codes, scope column on every table, include_str! of locale files for reserved names]
key-files:
  created:
    - src-tauri/src/groups_db.rs
    - src/test-fixtures/group-vectors.json
  modified:
    - src-tauri/Cargo.toml
    - Cargo.lock
    - src-tauri/src/lib.rs
key-decisions:
  - "Table named custom_group (GROUPS is an SQLite keyword)"
  - "A ticket may belong to multiple groups (membership PK is (group_id, issue_key))"
  - "API always takes an explicit scope; no-scope handling is left to the command layer (28-05)"
  - "move_group renumbers positions densely after swapping neighbours"
requirements-completed: [GRP-06]
duration: 25min
completed: 2026-10-12
---

# Phase 28 Plan 04: Groups data layer Summary

Durable `groups.db` layer in Rust: scoped groups, memberships and snapshots with Rust-authoritative name/color/scope rules, verified by 16 unit tests including a tempfile reopen test.

## Task 1 checkpoint
User approved unicode-normalization@0.1 (2026-10-12, collected by orchestrator before dispatch). No alternative used; resolved to 0.1.25.

## Commits
- Task 2: 003843b - rules, crate, shared vectors
- Task 3: storage commit (see git log, "feat(28-04): add GroupsDb storage...")

## Deviations from Plan
- Worktree base was corrected with `git reset --hard 2db2acf` at startup per the branch-check step.
- `npx biome check src/test-fixtures` processes 0 files (path ignored by biome config); the JSON was written in standard 2-space format instead.
- `move_group` renumbers all positions in scope densely rather than swapping two values, so it is robust to gaps.

## Issues
- `cargo clippy --all-targets -- -D warnings` for the whole crate fails on 27 pre-existing doc_markdown errors in other files (e.g. `field_transform/version.rs`); groups_db.rs itself has zero clippy findings. Out of scope, not fixed.

## Known Stubs
None.

## Self-Check: PASSED
