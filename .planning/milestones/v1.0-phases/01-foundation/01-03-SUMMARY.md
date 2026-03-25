---
phase: 01-foundation
plan: 03
subsystem: testing
tags: [axum, tokio, mock-server, jira, adf, fixtures, serde, integration-tests]

# Dependency graph
requires:
  - phase: 01-01
    provides: Cargo workspace, error.rs with AppError::MockServer, lib.rs module structure
provides:
  - Dual-port mock Jira server (axum routers on :8080 v2 and :8081 v3)
  - 12 fixture tickets in both Server v2 (plain text) and Cloud v3 (ADF) shapes
  - Realistic fixture data with comments, attachments, subtasks, issue links
  - Integration test suite (9 tests) covering auth, CRUD, search, 404
affects: [02-connections, 03-fetch-display, 04-copy-workflow, 05-attachment-copy]

# Tech tracking
tech-stack:
  added:
    - axum 0.8 router with middleware::from_fn auth layer
    - tokio::net::TcpListener dual-port binding
    - std::sync::Once for test server lifecycle management
  patterns:
    - SharedFixtures = Arc<Mutex<FixtureState>> shared between both routers
    - Auth gate as axum middleware (not per-handler) — consistent enforcement
    - AdfDoc struct with version:1 enforces ADF compliance at compile time
    - TDD: failing test commit (RED) then implementation commit (GREEN)
    - Background thread with dedicated runtime for cross-test server persistence

key-files:
  created:
    - src-tauri/src/fixtures.rs
    - src-tauri/src/mock_server.rs
    - src-tauri/tests/mock_server.rs
  modified:
    - src-tauri/src/lib.rs

key-decisions:
  - "std::sync::Once + dedicated std::thread for test server ensures servers persist across per-test tokio runtimes"
  - "AdfDoc.version: u8 = 1 enforced via struct — ADF version field cannot be omitted by accident"
  - "SharedFixtures shared between v2 and v3 routers via Arc::clone — single source of truth for created issues"
  - "FixtureState.next_issue_id tracks auto-increment for create endpoints — no UUID needed for issue keys"

patterns-established:
  - "Pattern: Auth middleware as axum layer — wraps entire router, not individual handlers"
  - "Pattern: serde_json::Value for JiraIssue.fields — supports both v2/v3 shapes without two structs"
  - "Pattern: filter_issues() for simple JQL — returns Vec<&JiraIssue> filtered by assignee= clause"

requirements-completed: [TEST-01, TEST-02]

# Metrics
duration: 7min
completed: 2026-03-20
---

# Phase 01 Plan 03: Mock Jira Server Summary

**Dual axum mock servers on :8080 (Jira Server v2) and :8081 (Jira Cloud v3) with 12 fixture tickets, ADF descriptions, auth gate, and 9 passing integration tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-19T23:51:03Z
- **Completed:** 2026-03-19T23:58:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `fixtures.rs` with 12 PROJ-N tickets in both Server v2 (plain text descriptions) and Cloud v3 (ADF documents with version: 1). Tickets have varied statuses (Open/In Progress/Resolved/Closed/Reopened), varied priorities, 5+ tickets with comments, 2 with attachments, 2 parent tickets with subtasks, 2 with issue links (blocks/is-blocked-by).
- Created `mock_server.rs` with dual axum routers: v2 router on :8080 (GET/PUT issue, GET search, POST create/comment/attachment) and v3 router on :8081 (GET/PUT issue, POST search/jql, POST create/comment/attachment). Auth gate middleware accepts any non-empty Authorization header, returns 401 for missing.
- Created `tests/mock_server.rs` with 9 integration tests covering all behaviors: v2/v3 get, v2/v3 search, auth 401, any-token 200, v2/v3 create 201, 404 unknown key. All 9 pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create fixture data module** - `5f05bba` (feat)
2. **Task 2 RED: Failing integration tests** - `059fd49` (test)
3. **Task 2 GREEN: Implement dual-port mock server** - `7263c56` (feat)

## Files Created/Modified

- `src-tauri/src/fixtures.rs` - JiraIssue, FixtureState, SharedFixtures, AdfDoc/AdfNode types; build_fixtures() returning 12 PROJ-N tickets
- `src-tauri/src/mock_server.rs` - build_v2_router(), build_v3_router(), start_mock_servers(); v2/v3 handler modules; require_auth middleware
- `src-tauri/tests/mock_server.rs` - 9 test_mock_* integration tests using std::sync::Once + background thread for server lifecycle
- `src-tauri/src/lib.rs` - Added pub mod fixtures; and pub mod mock_server;

## Decisions Made

- Used `std::sync::Once` + `std::thread::spawn` with dedicated `tokio::runtime::Runtime` for test server: each `#[tokio::test]` creates a new runtime that drops when the test finishes, killing spawned server tasks. A background thread with its own persistent runtime ensures servers outlive individual test runtimes.
- `JiraIssue.fields` typed as `serde_json::Value` (not two separate structs): both v2 and v3 issues share the same struct but carry differently shaped JSON in fields. Avoids duplication and allows the same HashMap to work for both dialects.
- `filter_issues()` accepts Option<String> JQL and applies only simple `assignee=` extraction. Full JQL parsing is out of scope for a mock server — realistic enough for test fixture use.

## Deviations from Plan

None — plan executed exactly as written. The test restructuring (from async start to background thread) was necessary to solve the per-test runtime isolation problem inherent in `#[tokio::test]`, which is the correct approach per Pitfall 2 from research (Tauri Tokio Runtime Conflict pattern).

## Issues Encountered

- Initial test design used `async fn ensure_servers_started()` which re-bound ports each test or failed silently. The root cause: `#[tokio::test]` drops its runtime after the test, killing spawned server tasks. Fixed by moving to a background `std::thread` with its own runtime that persists for the process lifetime.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Mock servers ready as primary dev environment for all subsequent phases
- Both v2 and v3 servers accept any Bearer token — Phase 02 keychain credentials will work immediately
- Fixture data includes realistic PROJ-N tickets with sufficient variety for Phase 03 fetch/display work
- Create/update endpoints in place for Phase 04 copy workflow

## Self-Check: PASSED

Files verified:
- FOUND: src-tauri/src/fixtures.rs
- FOUND: src-tauri/src/mock_server.rs
- FOUND: src-tauri/tests/mock_server.rs

Commits verified:
- FOUND: 5f05bba (feat: fixtures)
- FOUND: 059fd49 (test: RED)
- FOUND: 7263c56 (feat: GREEN)

---
*Phase: 01-foundation*
*Completed: 2026-03-20*
