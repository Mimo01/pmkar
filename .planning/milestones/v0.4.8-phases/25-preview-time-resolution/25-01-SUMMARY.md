---
phase: 25-preview-time-resolution
plan: "01"
subsystem: rust-backend
tags: [tauri-commands, user-resolution, wiki-to-adf, tdd, phase-25]
dependency_graph:
  requires:
    - field_transform/wiki_to_adf.rs (convert_and_postprocess)
    - field_transform/user.rs (UserResolver, fetch_users_by_domain, fetch_users_by_query)
    - commands.rs (get_cloud_credentials, PreviewUserEntry)
  provides:
    - resolve_description_to_adf Tauri command (HTML → ADF at preview time)
    - resolve_users_preview Tauri command (domain-batched Cloud user lookup)
  affects:
    - src-tauri/src/main.rs (invoke_handler registration)
    - src-tauri/src/field_transform/user.rs (visibility change: private → pub on fetch methods)
tech_stack:
  added: []
  patterns:
    - TDD red/green cycle for Tauri command implementation
    - Domain-batching (TRAN-06) replicated in preview path
    - find_best_match: email-exact / privacy-mode / displayName fallback chain
key_files:
  created:
    - src-tauri/tests/resolve_users_preview_integration.rs
  modified:
    - src-tauri/src/commands.rs
    - src-tauri/src/field_transform/user.rs
    - src-tauri/src/main.rs
decisions:
  - fetch_users_by_domain and fetch_users_by_query changed to pub (not pub(crate)) — integration tests in tests/ are external crates and cannot access pub(crate) methods; auto-fixed as Rule 1
  - resolve_description_to_adf annotated with allow(clippy::unused_async) — Tauri framework requires async fn for commands even when no await is present
  - Plain reqwest::Client used in resolve_users_preview — preview resolution must not pollute HTTP audit log
metrics:
  duration: 12
  completed_date: "2026-05-05"
  tasks_completed: 2
  files_changed: 4
---

# Phase 25 Plan 01: Preview-Time Resolution Commands Summary

Two new Tauri commands — `resolve_description_to_adf` (HTML→ADF pure transform) and `resolve_users_preview` (domain-batched Cloud user lookup) — added to the Rust backend to move field resolution from copy-commit time to preview-open time.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement resolve_description_to_adf and resolve_users_preview | eacf2f2 | commands.rs, user.rs, tests/resolve_users_preview_integration.rs |
| 2 | Register both commands in main.rs invoke_handler | 5d5dcd5 | main.rs |

TDD RED commit: 42236b1 (failing tests added before implementation)

## What Was Built

### resolve_description_to_adf

Pure transform command: takes an HTML string (from `renderedFields.description`) and returns a valid ADF object `{ version: 1, type: "doc", content: [...] }` by calling `wiki_to_adf::convert_and_postprocess` with an empty user map. No HTTP, no credentials, no side effects.

### resolve_users_preview

Domain-batched Cloud user lookup: takes `Vec<PreviewUserEntry>` (each entry has `username` + optional `email`) and a `cloud_base_url`. Groups by email domain (TRAN-06 invariant: one HTTP call per unique domain), calls `UserResolver::fetch_users_by_domain` per domain, falls back to per-username query for entries without email. Returns a parallel `Vec<serde_json::Value>` where each index N corresponds to `users[N]`: full Cloud user object `{ accountId, displayName, emailAddress }` for resolved users, or `null` for unresolvable users (preserving index alignment).

### find_best_match helper

Private helper mirrors `user.rs::match_user_in_results` but returns the full user JSON object instead of just `accountId`. Implements: (1) exact email match, (2) privacy mode (no email in any result) + single result, (3) single result whose displayName matches username case-insensitively.

### PreviewUserEntry struct

New input struct deserialized from frontend: `{ username: String, email: Option<String> }` with `camelCase` serde rename.

## Tests Added

| Test | Type | Location | Validates |
|------|------|----------|-----------|
| resolve_description_to_adf_returns_doc_for_html | unit | commands.rs | ADF doc shape for HTML input |
| resolve_description_to_adf_returns_empty_doc_for_empty_html | unit | commands.rs | Empty doc for empty HTML |
| resolve_description_to_adf_paragraph_content_non_empty | unit | commands.rs | Non-empty content array with paragraph node |
| preview_user_domain_grouping_two_same_domain | unit | commands.rs | Two users same domain → one bucket |
| preview_user_domain_grouping_no_email_goes_to_no_domain | unit | commands.rs | No-email entry → no_domain bucket |
| resolve_users_preview_returns_account_id_for_known_mock_user | integration | tests/resolve_users_preview_integration.rs | Full HTTP path via mock Cloud server |

All 6 tests pass. Full suite: 0 failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] fetch_users_by_domain and fetch_users_by_query changed from pub(crate) to pub**
- **Found during:** Task 1 GREEN phase
- **Issue:** Plan specified `pub(crate)` visibility, but integration tests in `tests/` directory are external crates that cannot access `pub(crate)` methods. The integration test `resolve_users_preview_integration.rs` calls `resolver.fetch_users_by_domain(...)` which would not compile with `pub(crate)`.
- **Fix:** Changed both methods to `pub` (fully public) instead of `pub(crate)`. The methods were already gated behind `UserResolver::new` which requires valid Cloud credentials and base URL, so making them public does not introduce a security risk.
- **Files modified:** `src-tauri/src/field_transform/user.rs`
- **Commit:** eacf2f2

**2. [Rule 2 - Missing critical functionality] Added #[allow(clippy::unused_async)] annotation**
- **Found during:** Task 1 clippy verification
- **Issue:** `resolve_description_to_adf` is declared `async fn` (required by Tauri command framework) but has no `await` points, causing `clippy::unused_async` error with `-D warnings`.
- **Fix:** Added `#[allow(clippy::unused_async)]` annotation with explanatory comment matching the pattern used elsewhere in commands.rs for Tauri-imposed constraints.
- **Files modified:** `src-tauri/src/commands.rs`
- **Commit:** eacf2f2

## TDD Gate Compliance

- RED gate: commit 42236b1 (`test(25-01)`) — 5 unit tests written before implementation; tests failed due to missing `PreviewUserEntry` type
- GREEN gate: commit eacf2f2 (`feat(25-01)`) — implementation written; all 5 unit tests + 1 integration test pass
- REFACTOR gate: not needed — implementation was clean on first pass

## Self-Check: PASSED
