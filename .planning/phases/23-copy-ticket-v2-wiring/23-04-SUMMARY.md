---
phase: 23-copy-ticket-v2-wiring
plan: 04
subsystem: testing
tags: [copy-pipeline, integration-test, mock-server, cutv-02, cutv-04, rust]

# Dependency graph
requires:
  - phase: 23-copy-ticket-v2-wiring plan 01
    provides: CopyContext struct + five copy_pipeline free helpers
  - phase: 23-copy-ticket-v2-wiring plan 02
    provides: AuditDb::open_in_memory + build_audited_client
  - phase: 23-copy-ticket-v2-wiring plan 03
    provides: copy_ticket_v2 command (integration test verifies pipeline beneath it)
provides:
  - Full-pipeline integration test for CUTV-02 (all five helpers exercised)
  - CUTV-04 proof: target_project_key="ACME" flows through pipeline; grep gate confirms zero MYPROJ literals
  - Regression net for copy_pipeline.rs helper contracts
affects:
  - future copy pipeline changes (any modification to copy_pipeline.rs helpers will be caught)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Once-guarded mock server start (CUTV_SERVERS_ONCE static) — matches probe_createmeta.rs canonical pattern"
    - "build_test_ctx factory: AuditDb::open_in_memory + build_audited_client for in-process audited client"
    - "Direct function-call integration test (not Tauri IPC) — call library helpers directly against mock servers"

key-files:
  created:
    - src-tauri/tests/copy_ticket_v2_integration.rs
  modified: []

key-decisions:
  - "PROJ-1 used as source fixture — confirmed it has all four coverage types: comment (x2), attachment (screenshot.png), subtasks (PROJ-7, PROJ-8), worklog (1 entry seeded)"
  - "Duration::from_hours(1) used instead of Duration::from_secs(3600) — fixes clippy::duration_suboptimal_units lint, diverges from probe_createmeta.rs verbatim pattern"
  - "Doc comment function names in backticks — fixes clippy::doc_markdown lint, diverges from probe_createmeta.rs verbatim copy"

patterns-established:
  - "CUTV_SERVERS_ONCE static name differs from PROBE_SERVERS_ONCE to prevent collision when both test files run in same test binary"

requirements-completed: [CUTV-02, CUTV-04]

# Metrics
duration: 8min
completed: 2026-04-28
---

# Phase 23 Plan 04: copy_ticket_v2_integration Test Summary

**Full-pipeline integration test asserting all five copy_pipeline helpers succeed against mock v2/v3 servers with target_project_key="ACME", proving CUTV-02 coverage and CUTV-04 parameterization**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-28T19:10:37Z
- **Completed:** 2026-04-28T19:18:39Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `src-tauri/tests/copy_ticket_v2_integration.rs` with one `#[tokio::test(flavor = "multi_thread")]` test
- All five helpers exercised against live mock servers: `add_remote_link`, `copy_attachments`, `copy_comments`, `copy_worklogs`, `copy_subtasks`
- CUTV-04 grep gate confirmed: zero `MYPROJ` literals in `copy_pipeline.rs` and `commands.rs` production paths
- Test passes in 0.39s; no new clippy errors introduced

## Task Commits

Each task was committed atomically:

1. **Task 1: Create copy_ticket_v2 full-pipeline integration test (CUTV-02 + CUTV-04)** - `638360b` (test)

**Plan metadata:** committed in final docs commit

## Files Created/Modified

- `src-tauri/tests/copy_ticket_v2_integration.rs` — Full-pipeline integration test with `copy_ticket_v2_full_pipeline_succeeds` test function

## Source Fixture Used

**PROJ-1** — confirmed as the canonical full-coverage fixture:
- Comments: 2 (Jane Doe + Chris Smith)
- Attachment: 1 (`screenshot.png`, seeded at `http://localhost:8080/secure/attachment/10100/screenshot.png`)
- Subtasks: 2 (`PROJ-7` Investigate session token expiry, `PROJ-8` Write regression test)
- Worklog: 1 entry (Jane Doe — 2026-01-15, 2h)

No fallback needed — PROJ-1 had all four coverage types as described in 23-PATTERNS.md.

## Target Key Generated

The mock v3 `create_issue` handler generates keys as `PROJ-{N}` where N = `next_issue_id - 10000`. The target key assigned in the test runtime was a generated `PROJ-{N}` value (the exact number depends on test ordering with other integration tests sharing the same mock server instance). The CUTV-04 invariant is verified by the **request body** path (we send `"ACME"` as project key), not what the mock echoes back.

## Grep Gate Results (CUTV-04 Enforcement)

```
grep -v '^[[:space:]]*//' src-tauri/src/copy_pipeline.rs | grep -c '\bMYPROJ\b'
→ 0

grep -v '^[[:space:]]*//' src-tauri/src/commands.rs | grep -c '\bMYPROJ\b'
→ 0
```

Both return 0. No MYPROJ literals survive in production code paths.

## Decisions Made

- **PROJ-1 confirmed** as best source fixture — all four helper types (attach/comment/worklog/subtask) are seeded, no fallback to PROJ-2/PROJ-6/PROJ-9 needed.
- **Duration::from_hours(1)** used instead of the probe_createmeta.rs verbatim `Duration::from_secs(3600)` — clippy::duration_suboptimal_units lint fires on the test target; `from_hours` is Rust 1.80+, present in this project's MSRV.
- **Doc comment backticks** added around function names (`add_remote_link`, `copy_pipeline`, etc.) — clippy::doc_markdown requires backticks for identifiers; probe_createmeta.rs has these as pre-existing errors but we fix them in the new file to keep our delta clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed clippy::duration_suboptimal_units in start_servers_once()**
- **Found during:** Task 1 (post-write clippy check)
- **Issue:** `Duration::from_secs(3600)` triggers `clippy::duration_suboptimal_units` — the plan's verbatim pattern from probe_createmeta.rs has this as a pre-existing error; we introduced a new instance
- **Fix:** Changed to `Duration::from_hours(1)` which is the idiomatic form
- **Files modified:** `src-tauri/tests/copy_ticket_v2_integration.rs`
- **Verification:** `cargo clippy --workspace --tests -- -D warnings 2>&1 | grep copy_ticket_v2_integration` returns empty
- **Committed in:** `638360b` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed clippy::doc_markdown in module doc comment**
- **Found during:** Task 1 (post-write clippy check)
- **Issue:** Function and type names in `//!` doc comment lines were unquoted; clippy::doc_markdown requires backticks for identifiers
- **Fix:** Wrapped all identifiers (`copy_pipeline`, `add_remote_link`, `copy_attachments`, `copy_comments`, `copy_worklogs`, `copy_subtasks`, `build_fixtures()`, `start_servers_once()`, `probe_createmeta.rs`, `target_project_key`, `CopyContext`) in backticks in the module-level doc comment and the `build_test_ctx` function doc
- **Files modified:** `src-tauri/tests/copy_ticket_v2_integration.rs`
- **Verification:** `cargo clippy --workspace --tests -- -D warnings 2>&1 | grep copy_ticket_v2_integration` returns empty
- **Committed in:** `638360b` (Task 1 commit, same)

---

**Total deviations:** 2 auto-fixed (2x Rule 1 - pre-existing pattern compliance)
**Impact on plan:** Both fixes keep the new test file's clippy footprint clean. The deviations from the probe_createmeta.rs verbatim pattern are cosmetic — test behavior and the canonical Once structure are unchanged.

## Issues Encountered

None — test compiled and passed on first attempt after the clippy fixes above.

## cargo test Runtime

`test copy_ticket_v2_full_pipeline_succeeds ... ok` — finished in 0.39s (well under the expected <2s for mock-server tests).

## Copy Pipeline API Deviation from Plan 23-01

None — all function names and `CopyContext` field names matched the plan's specified contract exactly:
- `add_remote_link(ctx, source_summary)` ✓
- `copy_attachments(ctx, source_body)` ✓
- `copy_comments(ctx, source_body)` ✓
- `copy_worklogs(ctx)` ✓
- `copy_subtasks(ctx, subtasks)` ✓

## Next Phase Readiness

Phase 23 is complete. All four plans executed:
- Plan 01: `copy_pipeline.rs` helpers + `CopyContext`
- Plan 02: `mapping_audit_log` + audit infrastructure
- Plan 03: `copy_ticket_v2` command cutover + IPC swap
- Plan 04: Full-pipeline integration test (this plan)

v0.4.0 milestone copy pipeline cutover is locked and regression-tested.

## Self-Check: PASSED

- `src-tauri/tests/copy_ticket_v2_integration.rs` exists: FOUND
- Task commit `638360b`: FOUND (git log confirms)
- grep gate copy_pipeline.rs: 0
- grep gate commands.rs: 0
- Test passes: 1 passed; 0 failed

---
*Phase: 23-copy-ticket-v2-wiring*
*Completed: 2026-04-28*
