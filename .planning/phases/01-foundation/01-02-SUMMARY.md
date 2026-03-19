---
phase: 01-foundation
plan: 02
subsystem: auth
tags: [keyring, rusqlite, reqwest-middleware, sqlite, keychain, audit-log, credential-redaction]

# Dependency graph
requires:
  - phase: 01-01
    provides: AppError/AppResult types with From<keyring::Error> and From<rusqlite::Error>, project scaffold, Cargo.toml with keyring/rusqlite/reqwest-middleware deps
provides:
  - OS keychain CRUD via keychain.rs (store_credential, get_credential, delete_credential)
  - SQLite audit log via audit.rs (AuditDb, AuditEntry, AuditMiddleware, build_audited_client)
  - Credential redaction middleware — Authorization header replaced with [REDACTED] before SQLite write
  - In-memory AuditDb for test isolation (open_in_memory)
affects:
  - 01-03 (mock server — uses build_audited_client for HTTP calls)
  - 02-connections (stores/retrieves PATs via store_credential/get_credential)
  - All phases making HTTP calls (AuditMiddleware logs every outbound request)

# Tech tracking
tech-stack:
  added:
    - keyring 3.6 (OS keychain; apple-native/windows-native/linux-native-sync-persistent features)
    - rusqlite 0.39 with bundled feature (static SQLite, no system dependency)
    - reqwest-middleware 0.5.1 (middleware chain on HTTP client)
    - reqwest upgraded from 0.12 to 0.13 (to match reqwest-middleware 0.5.1 transitive dependency)
    - http 1.x (required for http::Extensions in AuditMiddleware trait implementation)
    - async-trait 0.1 (required by reqwest_middleware::Middleware trait)
    - chrono 0.4 with serde feature (ISO 8601 UTC timestamps in audit entries)
  patterns:
    - Keychain service namespacing via SERVICE_PREFIX ("pmkar") + connection_type
    - AuditMiddleware redacts Authorization before log creation — not at log call site
    - Audit failures silent (let _ = db.insert) — audit never breaks HTTP requests
    - Integration tests use unique service names to avoid polluting real OS keychain
    - open_in_memory() pattern for fast SQLite unit tests without filesystem

key-files:
  created:
    - src-tauri/src/keychain.rs
    - src-tauri/src/audit.rs
    - src-tauri/tests/keychain.rs
    - src-tauri/tests/audit.rs
  modified:
    - src-tauri/src/lib.rs (added pub mod keychain, pub mod audit)
    - src-tauri/Cargo.toml (reqwest 0.12 -> 0.13, added http = "1")
    - Cargo.lock

key-decisions:
  - "reqwest upgraded 0.12 to 0.13 — reqwest-middleware 0.5.1 depends on reqwest 0.13; both must match to avoid type mismatch in Middleware::handle signature"
  - "http = 1 added as explicit dep — http::Extensions required by reqwest_middleware::Middleware trait, not re-exported by reqwest-middleware"
  - "Audit failure is silent (let _ = db.insert) — audit subsystem must never break production HTTP calls"
  - "Authorization header redacted via header map clone before next.run() — credentials never reachable downstream"
  - "Response body not captured by AuditMiddleware — body consumed by reading; captured separately if needed by caller"

patterns-established:
  - "Pattern: Credential namespacing — service name = pmkar-{connection_type}, ensures no cross-service key collisions"
  - "Pattern: Redact-before-log — Authorization replaced with [REDACTED] in header clone BEFORE next.run(), credentials structurally unreachable in log"
  - "Pattern: open_in_memory() for test isolation — SQLite in-memory databases for unit tests, no test file cleanup needed"

requirements-completed: [CONN-03, AUDIT-01, AUDIT-03]

# Metrics
duration: 6min
completed: 2026-03-20
---

# Phase 01 Plan 02: Security Modules Summary

**OS keychain CRUD (keyring 3.6) and SQLite audit log with reqwest-middleware credential redaction — Authorization headers structurally blocked from audit log**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-20T07:11:03Z
- **Completed:** 2026-03-20T07:17:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Keychain module with store/get/delete using keyring::Entry, namespaced under "pmkar-{connection_type}"
- Audit module with AuditDb (SQLite CRUD), AuditEntry struct, 10KB truncation, clear_logs
- AuditMiddleware redacts Authorization headers before log entry creation — credentials architecturally isolated
- build_audited_client assembles reqwest_middleware::ClientWithMiddleware with AuditMiddleware attached
- 8 integration tests (3 keychain, 5 audit) all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement OS keychain credential store** - `432b257` (feat)
2. **Task 2: Implement audit logging with SQLite and reqwest-middleware credential redaction** - `21af8c5` (feat)

**Plan metadata:** (docs commit — to be added)

_Note: TDD tasks — tests written first in RED state, implementation to GREEN, no refactor needed_

## Files Created/Modified
- `src-tauri/src/keychain.rs` - OS keychain CRUD: store_credential, get_credential, delete_credential using keyring::Entry
- `src-tauri/src/audit.rs` - AuditDb (SQLite), AuditEntry, AuditMiddleware (credential redaction), build_audited_client
- `src-tauri/tests/keychain.rs` - 3 integration tests: round-trip, delete, nonexistent
- `src-tauri/tests/audit.rs` - 5 unit tests: schema, insert, redaction, truncation, clear
- `src-tauri/src/lib.rs` - Added pub mod keychain and pub mod audit
- `src-tauri/Cargo.toml` - reqwest 0.12 -> 0.13, added http = "1" dependency

## Decisions Made
- Upgraded reqwest from 0.12 to 0.13 to align with reqwest-middleware 0.5.1 (which pulls reqwest 0.13 transitively — mismatched versions caused type errors in Middleware::handle signature)
- Added http = "1" as explicit dependency (http::Extensions required by the Middleware trait, not re-exported)
- Audit failure is silent — `let _ = db.insert()` ensures audit subsystem never bubbles up to break HTTP calls

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed reqwest version mismatch causing Middleware trait compile error**
- **Found during:** Task 2 (audit module implementation)
- **Issue:** Cargo.toml had `reqwest = "0.12"` but `reqwest-middleware 0.5.1` internally uses `reqwest 0.13`. The `Middleware::handle` signature expects `reqwest_middleware::reqwest::Request` (0.13) while our impl declared `reqwest::Request` (0.12) — type mismatch compile error.
- **Fix:** Changed `reqwest = "0.12"` to `reqwest = "0.13"` in Cargo.toml
- **Files modified:** src-tauri/Cargo.toml, Cargo.lock
- **Verification:** `cargo test test_audit` passes with 5 tests; `cargo test test_keychain` still passes with 3 tests
- **Committed in:** 21af8c5 (Task 2 commit)

**2. [Rule 3 - Blocking] Added http = "1" explicit dependency for http::Extensions**
- **Found during:** Task 2 (audit module implementation)
- **Issue:** `reqwest_middleware::Middleware::handle` takes `extensions: &mut http::Extensions` — the `http` crate was not a direct dependency and could not be resolved
- **Fix:** Added `http = "1"` to Cargo.toml dependencies
- **Files modified:** src-tauri/Cargo.toml, Cargo.lock
- **Verification:** Compilation succeeds, all tests pass
- **Committed in:** 21af8c5 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking — version compatibility)
**Impact on plan:** Both fixes required for compilation. No scope creep. The research doc noted reqwest-middleware 0.5.1 compatibility but Cargo.toml was written with 0.12 — runtime discovery corrected this.

## Issues Encountered
- reqwest 0.12 vs 0.13 conflict: `reqwest-middleware 0.5.1` re-exports reqwest 0.13 internally. Having a separate reqwest 0.12 in Cargo.toml creates two incompatible `Request`/`Response` types that can't satisfy the `Middleware` trait. Fixed by aligning to reqwest 0.13.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Keychain and audit modules importable from pmkar_lib
- All Jira HTTP clients should use build_audited_client to get automatic audit logging
- Tauri commands for credential management and audit log retrieval can be wired in commands.rs (Plan 03+)
- Linux CI: keychain integration tests use real OS keychain; on headless Linux add `dbus-run-session` or mark `#[ignore]`

---
*Phase: 01-foundation*
*Completed: 2026-03-20*

## Self-Check: PASSED

- FOUND: src-tauri/src/keychain.rs
- FOUND: src-tauri/src/audit.rs
- FOUND: src-tauri/tests/keychain.rs
- FOUND: src-tauri/tests/audit.rs
- FOUND: .planning/phases/01-foundation/01-02-SUMMARY.md
- FOUND commit 432b257: feat(01-02): implement OS keychain credential store
- FOUND commit 21af8c5: feat(01-02): implement audit logging with SQLite and credential redaction
