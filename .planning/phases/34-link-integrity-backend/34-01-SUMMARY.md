---
phase: 34-link-integrity-backend
plan: 01
subsystem: database
tags: [rust, rusqlite, sqlite, triage]
requires: []
provides:
  - TriageDb::get_copied_key and TriageDb::relink
  - set_triage refuses state 'copied'
  - delete_triage_entries keeps rows with copied_key
  - open_legacy_shape_for_test helper (cfg(test), pub(crate))
affects: [34-02]
tech-stack:
  added: []
  patterns: ["Link integrity enforced in TriageDb, not in commands"]
key-files:
  created: []
  modified: [src-tauri/src/triage_db.rs]
key-decisions:
  - "set_triage returns AppError::Internal for 'copied' (message points to relink_ticket / copy flow)"
  - "relink uses UPDATE guarded by copied_key IS NOT NULL then SELECT (no RETURNING); never creates rows or writes copied_key"
requirements-completed: [LINT-02, LINT-04]
duration: 15min
completed: 2026-10-15
---

# Phase 34 Plan 01: Link Integrity DB Layer Summary

TriageDb now blocks generic writes of 'copied', offers an atomic key-preserving `relink`, a `get_copied_key` lookup, and a cleanup delete that cannot erase remembered links.

## Tasks
1. Add get_copied_key/relink, refuse 'copied', guard delete (commit 941f4a7)
2. Legacy-shape DB helper and migration test (commit 941f4a7)

## Deviations from Plan
Both tasks were implemented and committed together in one commit (941f4a7) because they touch the same file and the tests were written alongside the implementation; the separate RED commit was not made. Fixed two clippy doc-markdown warnings (backticks) in new doc comments.

## Verification
`cargo test --lib triage_db`: 25 passed. `cargo clippy --all-targets`: no warnings in triage_db.rs. Pre-commit hooks passed.

## Known Stubs
None.

## Self-Check: PASSED
