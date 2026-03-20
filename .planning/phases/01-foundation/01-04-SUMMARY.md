---
phase: 01-foundation
plan: "04"
subsystem: ui
tags: [tauri, react, typescript, rust, ipc, sqlite, keychain, axum, reqwest]

# Dependency graph
requires:
  - phase: 01-02
    provides: keychain, audit db, AuditMiddleware, build_audited_client
  - phase: 01-03
    provides: mock_server, fixtures, SharedFixtures, build_fixtures
provides:
  - Tauri IPC command handlers (store/get/delete_credential, audit CRUD, mock server start, health pings)
  - JiraClient struct wrapping reqwest with AuditMiddleware
  - main.rs with state registration and mock server auto-start in dev mode
  - StatusBadge, AppShell, ErrorBoundary UI components
  - DevStatusPanel showing live health of Server v2, Cloud v3, and OS Keychain
  - App.tsx composition with ErrorBoundary and AppShell
affects: [02, 03, 04, 05, 06, 07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Tauri Manager trait must be imported for app.path() and app.manage()
    - setup() closure must be `move` to satisfy 'static lifetime for managed state
    - tauri::async_runtime::spawn (not tokio::spawn) for async tasks inside Tauri setup
    - mock-server Cargo feature gates server startup — absent from release builds
    - Tauri IPC commands with State<'_, Mutex<T>> for shared Rust state
    - React IPC via invoke from @tauri-apps/api/core, mocked in Vitest with vi.mock

key-files:
  created:
    - src-tauri/src/commands.rs
    - src-tauri/src/jira_client.rs
    - src/components/ui/StatusBadge.tsx
    - src/components/ui/AppShell.tsx
    - src/components/ui/ErrorBoundary.tsx
    - src/features/dev/DevStatusPanel.tsx
  modified:
    - src-tauri/src/lib.rs
    - src-tauri/src/main.rs
    - src/App.tsx
    - src/App.test.tsx

key-decisions:
  - "use tauri::Manager must be imported explicitly — path() and manage() are not in scope by default"
  - "setup() closure must use move keyword — State registered in setup must be 'static"
  - "ping_mock_servers uses POST for v3 search/jql (not GET) — matches mock_server route definition"

patterns-established:
  - "Tauri state pattern: app.manage(Mutex::new(T)) in setup(), State<'_, Mutex<T>> in command params"
  - "React Tauri IPC pattern: vi.mock('@tauri-apps/api/core') with per-cmd Promise.resolve in tests"
  - "StatusBadge role=status + aria-live=polite for screen reader live region updates"

requirements-completed: [TEST-03, CONN-03, AUDIT-01, AUDIT-03]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 01 Plan 04: Integration — Tauri Commands, JiraClient, and Dev Status UI Summary

**Tauri IPC layer wired with 8 command handlers, JiraClient wrapping audit-logged reqwest, and DevStatusPanel showing live health badges for Server v2 mock, Cloud v3 mock, and OS Keychain**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T01:02:52Z
- **Completed:** 2026-03-20T01:05:52Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 10

## Accomplishments
- All 8 Tauri IPC commands registered: store/get/delete_credential, get/clear_audit_logs, start_mock_servers_cmd, ping_mock_servers, ping_keychain
- JiraClient struct wraps reqwest ClientWithMiddleware via build_audited_client — all HTTP calls audit-logged with Authorization redacted
- main.rs manages AuditDb and SharedFixtures as Tauri state; mock servers auto-start under mock-server feature flag using tauri::async_runtime::spawn
- Dev status UI: StatusBadge (accessible, role=status, aria-live=polite), AppShell, ErrorBoundary (class component with componentDidCatch), DevStatusPanel with 3 live health badges
- App.tsx composed as ErrorBoundary > AppShell > DevStatusPanel; all 3 Vitest tests pass with mocked Tauri IPC

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Tauri commands, jira_client, and wire main.rs** - `6fac2c1` (feat)
2. **Task 2: Build dev status UI components and screen** - `a60cf98` (feat)
3. **Task 3: Verify Tauri app launches with dev status screen** - auto-approved (checkpoint, cargo check + vitest both pass)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src-tauri/src/commands.rs` - 8 Tauri IPC command handlers (credentials, audit, mock server, health pings)
- `src-tauri/src/jira_client.rs` - JiraClient struct wrapping reqwest with AuditMiddleware
- `src-tauri/src/lib.rs` - Added pub mod commands and pub mod jira_client
- `src-tauri/src/main.rs` - Full Tauri builder with state management and mock server startup
- `src/components/ui/StatusBadge.tsx` - Accessible status indicator with healthy/loading/error states
- `src/components/ui/AppShell.tsx` - Top-level layout wrapper with dark mode
- `src/components/ui/ErrorBoundary.tsx` - React class component with componentDidCatch
- `src/features/dev/DevStatusPanel.tsx` - Dev screen with 3 live service health badges
- `src/App.tsx` - Composed app: ErrorBoundary > AppShell > DevStatusPanel
- `src/App.test.tsx` - 3 tests with mocked Tauri IPC, all passing

## Decisions Made
- `use tauri::Manager` must be imported explicitly — `path()` and `manage()` methods are only available through this trait
- `setup()` closure must be `move` — state values captured in the closure must be `'static`
- `ping_mock_servers` sends POST to v3 search/jql endpoint (not GET) to match mock_server route

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing `use tauri::Manager` import to main.rs**
- **Found during:** Task 1 (wire main.rs)
- **Issue:** `app.path()` and `app.manage()` failed to compile — these methods are provided by `tauri::Manager` trait which was not in scope
- **Fix:** Added `use tauri::Manager;` to main.rs imports
- **Files modified:** src-tauri/src/main.rs
- **Verification:** cargo check passes
- **Committed in:** 6fac2c1 (Task 1 commit)

**2. [Rule 1 - Bug] Changed setup() closure to `move` closure**
- **Found during:** Task 1 (wire main.rs)
- **Issue:** `fixtures` captured by reference inside `.setup(|app| {...})` but closure must be `'static`; borrow outlives function
- **Fix:** Changed `.setup(|app|` to `.setup(move |app|`
- **Files modified:** src-tauri/src/main.rs
- **Verification:** cargo check passes
- **Committed in:** 6fac2c1 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes were required by Rust borrow checker and Tauri API. No scope creep.

## Issues Encountered
None beyond the auto-fixed compilation errors above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 foundation complete: all 4 plans executed
- Tauri app with mock servers, OS keychain, audit logging, and dev status UI is fully functional
- Ready for Phase 2: connecting to real Jira instances with credential management UI

---
*Phase: 01-foundation*
*Completed: 2026-03-20*
