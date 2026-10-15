---
phase: 34-link-integrity-backend
plan: 02
subsystem: backend
tags: [rust, tauri, triage, link-integrity]
requires: [34-01]
provides:
  - validate_triage_state (rejects 'copied')
  - relink_ticket Tauri command (registered)
  - ensure_not_linked guard as first statement of copy_ticket_v2
affects: [35]
key-files:
  modified: [src-tauri/src/commands.rs, src-tauri/src/main.rs]
key-decisions:
  - "Duplicate-copy refusal is AppError::Internal with stable phrase 'already linked to {KEY}'"
  - "Guard lock is scoped in a block and dropped before any await"
requirements-completed: [LINT-02, LINT-03, LINT-04]
duration: 10min
completed: 2026-10-15
---

# Phase 34 Plan 02: Command-Layer Link Integrity Summary

set_triage_state now rejects 'copied', `relink_ticket` exposes the atomic relink, and `copy_ticket_v2` refuses duplicate copies before any credential lookup or Jira call.

## Tasks
1. validate_triage_state, relink_ticket, registration in main.rs
2. ensure_not_linked guard, tests (linked, ignored/new with key, keyless, no-credentials, legacy shape, cleanup keeps linked row)

Both tasks committed together in a single feat commit (same file, tests written alongside); no separate RED commit.

## Deviations from Plan
None functionally. Ran rustfmt on commands.rs.

## Verification
`cargo test`: all pass (286 lib tests plus integration tests). `cargo clippy --all-targets`: no warnings in commands.rs/main.rs (pre-existing warnings elsewhere untouched). No remaining non-test caller passes "copied" to set_triage.

## Known Stubs
None.

## Self-Check: PASSED
