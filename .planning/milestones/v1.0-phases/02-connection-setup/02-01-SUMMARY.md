---
phase: 02-connection-setup
plan: 01
subsystem: api
tags: [rust, tauri, axum, reqwest, mock-server, base64, jira]

requires:
  - phase: 01-foundation
    provides: "AuditDb, build_audited_client, mock_server router structure, SharedFixtures, AppError"

provides:
  - "/rest/api/2/myself and /rest/api/2/serverInfo mock routes returning Jira Server v2 JSON shapes"
  - "/rest/api/3/myself and /rest/api/3/serverInfo mock routes returning Jira Cloud v3 JSON shapes"
  - "ConnectionTestResult struct with success/username/server_version/error_kind/retry_after_secs"
  - "test_jira_server_connection Tauri command (Bearer PAT auth)"
  - "test_jira_cloud_connection Tauri command (Basic base64 auth)"
  - "map_error_status helper covering 401/403/429/5xx error kinds"

affects: [02-02-connection-wizard-ui, 02-03-connection-state]

tech-stack:
  added: [base64 = "0.22"]
  patterns:
    - "AuditDb managed as Arc<Mutex<AuditDb>> to allow Arc::clone in async Tauri commands"
    - "fetch_server_version is non-fatal: serverInfo failure does not fail the connection test"
    - "Cloud v3 /myself uses displayName only (no name field); Server v2 /myself prefers name over displayName"

key-files:
  created: []
  modified:
    - src-tauri/src/mock_server.rs
    - src-tauri/src/commands.rs
    - src-tauri/src/main.rs
    - src-tauri/Cargo.toml

key-decisions:
  - "State type changed from Mutex<AuditDb> to Arc<Mutex<AuditDb>> — build_audited_client requires Arc; Tauri State<'_,T>.inner() returns &T not Arc"
  - "base64 = 0.22 added as explicit dep — needed for Cloud Basic auth encoding"
  - "fetch_server_version non-fatal: /myself confirms auth, serverInfo version is best-effort"
  - "Mock /myself and /serverInfo routes placed inside require_auth middleware layer — matches real Jira behavior"

patterns-established:
  - "Pattern: async Tauri commands that call build_audited_client must hold Arc<Mutex<AuditDb>> state, not bare Mutex"

requirements-completed: [CONN-01, CONN-02, CONN-04, CONN-05]

duration: 2min
completed: 2026-03-20
---

# Phase 02 Plan 01: Connection Backend Commands Summary

**Four mock Jira endpoints (v2/v3 myself+serverInfo) and two Tauri commands (test_jira_server_connection, test_jira_cloud_connection) with structured ConnectionTestResult covering success + 5 error kinds**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T09:25:36Z
- **Completed:** 2026-03-20T09:27:36Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Four mock endpoints added: v2/myself, v2/serverInfo, v3/myself, v3/serverInfo — all behind require_auth middleware, returning correct Jira JSON shapes
- `test_jira_server_connection` command with Bearer PAT auth, reads `name` fallback `displayName` from v2 /myself
- `test_jira_cloud_connection` command with Basic base64(email:token) auth, reads `displayName` from v3 /myself (no name field)
- `ConnectionTestResult` struct covers success (username + server_version) and all 5 error kinds (auth, forbidden, rate_limit, server_error, network)
- All 9 existing tests pass unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Add /myself and /serverInfo mock endpoints** - `d051266` (feat)
2. **Task 2: Add test_jira_server_connection and test_jira_cloud_connection** - `f8caae6` (feat)

**Plan metadata:** _(pending)_

## Files Created/Modified
- `src-tauri/src/mock_server.rs` - Added get_myself and get_server_info handlers in mod v2 and mod v3, registered routes in both routers
- `src-tauri/src/commands.rs` - Added ConnectionTestResult, test_jira_server_connection, test_jira_cloud_connection, map_error_status, fetch_server_version; updated State type to Arc<Mutex<AuditDb>>
- `src-tauri/src/main.rs` - Changed managed state to Arc<Mutex<AuditDb>>, registered two new commands
- `src-tauri/Cargo.toml` - Added base64 = "0.22" dependency

## Decisions Made
- **State wrapping:** Changed `Mutex<AuditDb>` to `Arc<Mutex<AuditDb>>` in managed state. `build_audited_client` requires `Arc<Mutex<AuditDb>>`; Tauri's `State<'_, T>.inner()` returns `&T`, so without Arc wrapping at manage-time there is no way to get an `Arc`. Updated all affected commands (`get_audit_logs`, `clear_audit_logs`) to use the new type.
- **Non-fatal serverInfo:** After confirming auth via `/myself`, the serverInfo call is best-effort. If it fails, `server_version` is `None` but the connection still reports success. This matches real-world Jira behavior where some instances restrict that endpoint.
- **base64 explicit dep:** Added as explicit dependency (not relying on transitive).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Changed AuditDb managed state from Mutex to Arc<Mutex>**
- **Found during:** Task 2 (test_jira_server_connection implementation)
- **Issue:** Plan called `Arc::clone(db.inner())` but `app.manage(Mutex::new(audit_db))` stores bare `Mutex<AuditDb>`. `State<'_, Mutex<AuditDb>>.inner()` returns `&Mutex<AuditDb>`, not `Arc<Mutex<AuditDb>>`. `build_audited_client` signature requires `Arc<Mutex<AuditDb>>` — would not compile.
- **Fix:** Changed `app.manage(Mutex::new(audit_db))` to `app.manage(Arc::new(Mutex::new(audit_db)))` in main.rs; updated `State<'_, Mutex<AuditDb>>` to `State<'_, Arc<Mutex<AuditDb>>>` in `get_audit_logs` and `clear_audit_logs`; added `Arc` import to commands.rs.
- **Files modified:** src-tauri/src/main.rs, src-tauri/src/commands.rs
- **Verification:** `cargo check --features mock-server` and `cargo test --features mock-server` pass
- **Committed in:** f8caae6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking compile error)
**Impact on plan:** Required for correctness. State type change is consistent and contained — existing audit commands updated in the same commit.

## Issues Encountered
None beyond the Arc/Mutex deviation above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Backend is ready: frontend can invoke `test_jira_server_connection` and `test_jira_cloud_connection` via Tauri invoke
- `ConnectionTestResult` provides all fields the wizard UI needs (success, username, server_version, error_kind, retry_after_secs)
- Mock server responds correctly on 127.0.0.1:8080 (v2) and 127.0.0.1:8081 (v3) with auth-gated /myself and /serverInfo

---
*Phase: 02-connection-setup*
*Completed: 2026-03-20*
