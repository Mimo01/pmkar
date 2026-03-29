---
phase: 16-enhanced-watch-configuration
plan: "01"
subsystem: backend-and-i18n
tags: [rust, tauri, mock-server, i18n, types]
dependency_graph:
  requires: []
  provides: [search_jira_users_by_domain-command, v3-user-search-mock, domain-search-i18n-keys, JiraUser-emailAddress]
  affects: [16-02-frontend-domain-search]
tech_stack:
  added: []
  patterns: [Cloud-v3-Basic-auth, axum-query-handler, optional-TS-field]
key_files:
  created: []
  modified:
    - src-tauri/src/commands.rs
    - src-tauri/src/mock_server.rs
    - src-tauri/src/main.rs
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
    - src/features/tickets/types.ts
decisions:
  - search_jira_users_by_domain uses get_cloud_credentials helper for Cloud v3 Basic auth — consistent with existing cloud commands pattern
  - V3UserSearchQuery struct added at module level alongside UserSearchQuery — shared via super:: in v3 module
  - Privacy-simulation user in mock omits emailAddress entirely (JSON key absent, not null) — accurately simulates Jira Cloud email visibility restriction
  - Slovak translations use full diacritics matching existing sk.json style
metrics:
  duration: 12
  completed_date: "2026-03-29"
  tasks_completed: 2
  files_modified: 6
---

# Phase 16 Plan 01: Backend Infrastructure for Domain-Based User Search Summary

Backend infrastructure for Cloud v3 domain-based user search: new Tauri command, mock v3 endpoint with privacy simulation, 14 i18n keys in both locales, and optional emailAddress on JiraUser.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add search_jira_users_by_domain Rust command, mock v3 endpoint, register in main.rs | 66471ae | commands.rs, mock_server.rs, main.rs |
| 2 | Add i18n keys for domain search UI and emailAddress to JiraUser type | 988d0e1 | en.json, sk.json, types.ts |

## What Was Built

### Rust Command (`search_jira_users_by_domain`)

New Tauri command in `commands.rs` that:
- Takes a `domain: String` parameter (e.g. "acme.com")
- Prepends `@` to form the search query: `@acme.com`
- Calls Cloud v3 `/rest/api/3/user/search?query=@acme.com&maxResults=50`
- Authenticates with Cloud Basic auth via `get_cloud_credentials`
- Returns `Vec<serde_json::Value>` or empty vec on non-success status

### Mock Server v3 User Search Endpoint

In `mock_server.rs`:
- Added `V3UserSearchQuery` struct with `query` and `maxResults` fields
- Added `v3::search_users` handler with 3 mock users:
  - Jane Doe (`jdoe@example.com`) — normal user
  - Chris Smith (`csmith@example.com`) — normal user
  - Private User (no `emailAddress` field) — simulates Jira Cloud email privacy restriction
- Registered at `/rest/api/3/user/search` in `build_v3_router`
- Filters by email or displayName substring match

### i18n Keys (14 keys in both locales)

All `settings.watchedUsers.domainSearch.*` keys added to `en.json` and `sk.json`:
- UI labels: heading, placeholder, searchButton, searching, found
- Actions: selectAll, deselectAll, alreadyWatching, addSelected
- States: noResults, invalidFormat, error
- Privacy warning: privacyWarning.title, privacyWarning.body

Slovak translations use full diacritics matching the existing `sk.json` style.

### TypeScript Type Update

`JiraUser` interface now includes `emailAddress?: string` with comment explaining Cloud v3 privacy behavior (field absent, not null, when user hides email).

## Verification

- `cargo build` — passed (no errors)
- `cargo test` — 9 tests passed, 0 failed
- i18n validation script — all 14 keys present in both locales

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is complete. The mock data is intentional test infrastructure, not a stub.

## Self-Check: PASSED

- `src-tauri/src/commands.rs` modified — confirmed (66471ae)
- `src-tauri/src/mock_server.rs` modified — confirmed (66471ae)
- `src-tauri/src/main.rs` modified — confirmed (66471ae)
- `src/features/tickets/types.ts` modified — confirmed (988d0e1)
- `src/i18n/locales/en.json` modified — confirmed (988d0e1)
- `src/i18n/locales/sk.json` modified — confirmed (988d0e1)
