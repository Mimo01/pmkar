---
phase: 17-field-discovery-mock-schema-fidelity
plan: 04
subsystem: api
tags: [rust, tauri-command, http, jira, createmeta, probe, field-discovery, sha256, pagination]

# Dependency graph
requires:
  - phase: 17-field-discovery-mock-schema-fidelity (plans 17-01, 17-02)
    provides: FieldSchema/FieldMappingDb types + mock server field routes
provides:
  - "discover_v2_fields: async HTTP fetcher for GET /rest/api/2/field"
  - "discover_v3_fields: async HTTP fetcher for GET /rest/api/3/field"
  - "fetch_all_createmeta_fields: paginated drain with SHA-256 hash (D-04)"
  - "fetch_target_issue_types: lightweight issue-type list for pre-warm"
  - "probe_paginated_createmeta: ProbeResult with D-07 error format, no credential leak"
  - "get_or_fetch_target_schema: cache-first target schema with DB upsert"
  - "get_or_fetch_source_global: cache-first source global field list"
  - "ProbeResult struct with camelCase serde"
  - "5 Tauri commands: discover_source_fields, get_target_field_schema_for_issuetype, probe_createmeta, pre_warm_target_issue_types, refresh_field_schema_cache"
  - "10 integration tests: field_discovery_integration.rs (7) + probe_createmeta.rs (3)"
affects:
  - 17-05-probe-banner-status-pill-wiring
  - 19-field-mapping-editor
  - 21-schema-drift-detection
  - 22-copy-preview

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cache-first DB read -> HTTP miss path (lock-release-before-HTTP pattern)"
    - "ProbeResult (never Err for HTTP failures) — structured probe result for UI banner"
    - "Paginated loop with #[allow(unused_assignments)] for accumulator variables"
    - "let...else for credential extraction with graceful early return"
    - "SHA-256 over concatenated raw response bytes for schema drift hash (D-04)"

key-files:
  created:
    - src-tauri/src/field_discovery.rs (extended with HTTP functions)
    - src-tauri/tests/field_discovery_integration.rs
    - src-tauri/tests/probe_createmeta.rs
  modified:
    - src-tauri/src/commands.rs (5 new Tauri commands appended)
    - src-tauri/src/main.rs (5 commands registered in invoke_handler)

key-decisions:
  - "ProbeResult uses let...else for credential extraction — cleaner than nested match, satisfies clippy::manual_let_else"
  - "server_total accumulator uses #[allow(unused_assignments)] rather than restructuring loop — preserves clarity of pagination logic"
  - "refresh_field_schema_cache is synchronous (no await) — no async needed for pure DB operation"
  - "probe_createmeta short-circuits with ProbeResult ok=false (not Err) when no project key or cloud credentials configured (Pitfall C)"
  - "D-07 error message appears in fetch_all_createmeta_fields (HTTP error path) and probe hint (both surfaces)"

patterns-established:
  - "Pattern: cache-first with short lock window — lock, read, unlock; then HTTP; then lock, upsert, unlock"
  - "Pattern: probe never returns Err for HTTP/network — always Ok(ProbeResult) so frontend banner renders deterministically"

requirements-completed: [DISC-01, DISC-02, DISC-03]

# Metrics
duration: 55min
completed: 2026-04-27
---

# Phase 17 Plan 04: Field Discovery Rust Module and Commands Summary

**HTTP discovery layer for Jira v2/v3 field endpoints with paginated createmeta drain, connection-time probe with D-07 error format, cache-first DB integration, and 5 Tauri commands wiring the full discovery flow**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-04-27T13:10:27Z
- **Completed:** 2026-04-27T14:05:00Z
- **Tasks:** 3 (2 TDD tasks + 1 wiring task)
- **Files modified:** 5

## Accomplishments

- Implemented 7 async HTTP functions in `field_discovery.rs`: `discover_v2_fields`, `discover_v3_fields`, `fetch_all_createmeta_fields` (paginated, bounded at 50 pages), `fetch_target_issue_types`, `probe_paginated_createmeta`, `get_or_fetch_target_schema`, `get_or_fetch_source_global`
- All 3 verification commands pass: `cargo build`, `cargo test --features mock-server` (all suites), `cargo clippy -D warnings`
- 10 integration tests (7 discovery + 3 probe) pass against in-process mock servers; credential redaction (T-17-03) proven by `probe_redacts_credentials` test with sentinel value `SUPER_SECRET_TOKEN_12345`
- 5 Tauri commands registered and callable from the frontend; `probe_createmeta` handles Pitfall C (no project key configured — `ProbeResult { ok: false, hint: "No target project key configured" }`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing integration tests (RED)** - `9f897a6` (test)
2. **Task 2: Implement HTTP discovery functions (GREEN)** - `88885ed` (feat)
3. **Task 3: Wire 5 Tauri commands + register in main.rs** - `ca76cd6` (feat)

## Files Created/Modified

- `src-tauri/src/field_discovery.rs` — Extended with 7 async HTTP functions, `ProbeResult` struct, `CREATEMETA_PAGE_SIZE`/`MAX_CREATEMETA_PAGES` constants, 2 additional unit tests
- `src-tauri/src/commands.rs` — 5 new `#[tauri::command]` functions appended after `search_jira_users_by_domain`
- `src-tauri/src/main.rs` — 5 new commands registered in `tauri::generate_handler!`
- `src-tauri/tests/field_discovery_integration.rs` — 7 integration tests created
- `src-tauri/tests/probe_createmeta.rs` — 3 probe integration tests created

## Decisions Made

- `server_total` accumulator in pagination loop uses `#[allow(unused_assignments)]` — Rust's unused-assignments lint fires on any initial value for variables that are first-set inside a loop body; the allow is the canonical fix for this false positive in idiomatic Rust loop accumulators
- `refresh_field_schema_cache` is synchronous (no `async`) — no HTTP call inside, pure DB operation; clippy `unused_async` would fire otherwise
- Credential extraction in `probe_createmeta` and `pre_warm_target_issue_types` uses `let...else` (clippy `manual_let_else` enforced by `-D warnings`)
- `ProbeResult` never returns `Err` for HTTP/network failures — always `Ok(ProbeResult { ok: false, ... })` — this is the contract so the frontend banner renders deterministically without needing to catch both `Ok` and `Err` paths

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `unused_assignments` clippy lint in pagination loop**
- **Found during:** Task 2 (clippy -D warnings run)
- **Issue:** Rust's liveness analysis flags `let mut var = initial_value` when the variable is unconditionally overwritten in the first loop iteration without the initial value being read. This fired for the `server_total` accumulator.
- **Fix:** Added `#[allow(unused_assignments)]` on the `server_total` variable. Earlier attempts to refactor around the lint (using `Option<u64>`, struct, `u64::MAX` sentinel) all introduced other clippy violations (`items_after_statements`, or the same lint on the new form). The `allow` is the canonical Rust solution for this class of false positive.
- **Files modified:** `src-tauri/src/field_discovery.rs`
- **Verification:** `cargo clippy --features mock-server -- -D warnings` exits 0
- **Committed in:** `88885ed` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed 5 clippy violations in new commands.rs code**
- **Found during:** Task 3 (clippy -D warnings run)
- **Issue:** `doc_markdown` (two `NULL` literals without backticks in docstring), `manual_let_else` (two `match`-to-tuple patterns that clippy converts to `let...else`), `unused_async` on `refresh_field_schema_cache`
- **Fix:** Added backticks around SQL NULL literals in docstring; rewrote two match blocks as `let Ok(...) = expr else { return ... };`; removed `async` from `refresh_field_schema_cache`
- **Files modified:** `src-tauri/src/commands.rs`
- **Verification:** `cargo clippy --features mock-server -- -D warnings` exits 0
- **Committed in:** `ca76cd6` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 x Rule 1)
**Impact on plan:** Both fixes are correctness/style compliance required by the project's clippy `-D warnings` policy. No scope creep. All plan-specified behavior delivered.

## Issues Encountered

None beyond the clippy violations noted above in Deviations.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 17-05 can now call `probe_createmeta` from the frontend to wire the probe-failure banner and status pill (D-05/D-08)
- Phase 22 Copy Preview can call `get_target_field_schema_for_issuetype` on issue-type selection (D-15/D-16)
- Phase 21 schema drift detection can read `schema_hash` from `field_schema_cache` via `FieldMappingDb::get_cached_schema_hash`
- No blockers

## Threat Flags

No new trust boundaries introduced beyond what the plan's threat model documented.
All 5 commands stay within the existing `Frontend -> Tauri -> Rust -> Jira API` boundary.
`endpoint_url` in `ProbeResult` is server-constructed (no auth substring) — T-17-03 mitigated by design and test.

## Self-Check: PASSED

---
*Phase: 17-field-discovery-mock-schema-fidelity*
*Completed: 2026-04-27*
