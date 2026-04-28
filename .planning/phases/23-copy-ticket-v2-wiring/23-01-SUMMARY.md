---
phase: 23-copy-ticket-v2-wiring
plan: 01
subsystem: api
tags: [rust, copy-pipeline, copy-ticket, refactor, helper-extraction, phase-23]

# Dependency graph
requires:
  - phase: 05-copy-attachments-and-comments
    provides: original copy_ticket with attachment/comment/worklog/subtask inline blocks
  - phase: 18-field-transform-pipeline
    provides: TransformContext and apply_mapping patterns (for Plan 23-03 consumption)
provides:
  - copy_pipeline.rs module with CopyContext struct and 5 free async helpers
  - pub(crate) credential helpers (get_server_pat, get_cloud_credentials) in commands.rs
  - copy_ticket refactored to delegate to extracted helpers (D-08 proof)
  - CUTV-04 parameterization seam via ctx.target_project_key
affects:
  - 23-02 (audit hooks — will call copy_pipeline helpers)
  - 23-03 (copy_ticket_v2 — consumes CopyContext + all 5 helpers)
  - 23-04 (integration test — tests helpers directly via CopyContext)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CopyContext: thin credentials carrier struct passed by reference to free async helpers (D-09)"
    - "Helper extraction: verbatim body copy + local variable → ctx.field translation map"
    - "pub(crate) visibility for crate-internal credential helpers"

key-files:
  created:
    - src-tauri/src/copy_pipeline.rs
  modified:
    - src-tauri/src/lib.rs
    - src-tauri/src/commands.rs

key-decisions:
  - "CopyContext.client uses reqwest_middleware::ClientWithMiddleware (not plain reqwest::Client) — matches build_audited_client return type"
  - "copy_attachments annotated with #[allow(clippy::too_many_lines)] — 107-line helper body is verbatim extraction with no clean split point"
  - "MYPROJ appears 2x in copy_pipeline.rs doc comments only — not in code paths; JSON subtask body uses ctx.target_project_key (CUTV-04)"
  - "Pre-existing CopyPreviewModal test failures (17 tests) confirmed pre-exist before this plan; Rust tests are the regression net for D-08"

patterns-established:
  - "CopyContext pattern: pub struct with no methods, no impl blocks — pure data carrier for helper injection"
  - "Helper return pattern: free helpers return Vec<CopyStepResult> (or single CopyStepResult), caller extends/pushes into top-level steps"

requirements-completed: [CUTV-02, CUTV-04]

# Metrics
duration: 25min
completed: 2026-04-28
---

# Phase 23 Plan 01: copy_pipeline.rs — CopyContext Seam and Helper Extraction Summary

**New `copy_pipeline.rs` module with `CopyContext` struct and 5 extracted free async helpers; `copy_ticket` refactored to delegate helper blocks, shrinking by 356 lines as D-08/D-09/CUTV-04 proof**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-28T20:30:00Z
- **Completed:** 2026-04-28T20:55:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `src-tauri/src/copy_pipeline.rs` (512 lines) with `CopyContext` struct and 5 free async helpers extracted verbatim from `commands.rs`
- Parameterized `target_project_key` via `ctx.target_project_key` in `copy_subtasks` (CUTV-04 seam)
- Refactored `copy_ticket` to construct a `CopyContext` and delegate to the 5 helpers — commands.rs shrinks from 2406 to 2050 lines (−356 lines)
- Promoted `get_server_pat` and `get_cloud_credentials` to `pub(crate)` so `copy_pipeline.rs` can call them in Plan 23-03

## CopyContext Final Shape

```rust
pub struct CopyContext {
    pub client: reqwest_middleware::ClientWithMiddleware,
    pub cloud_auth: String,
    pub server_pat: String,
    pub source_base_url: String,
    pub target_base_url: String,
    pub source_key: String,
    pub target_key: String,
    pub target_project_key: String,   // CUTV-04 parameterization seam
}
```

## Helper Signatures (verbatim)

```rust
pub async fn add_remote_link(ctx: &CopyContext, source_summary: &str) -> CopyStepResult
pub async fn copy_attachments(ctx: &CopyContext, source_body: &Value) -> Vec<CopyStepResult>
pub async fn copy_comments(ctx: &CopyContext, source_body: &Value) -> Vec<CopyStepResult>
pub async fn copy_worklogs(ctx: &CopyContext) -> Vec<CopyStepResult>
pub async fn copy_subtasks(ctx: &CopyContext, subtasks: &[Value]) -> Vec<CopyStepResult>
```

## Line Counts

- `copy_pipeline.rs`: 512 lines (new file)
- `commands.rs` delta: 2406 → 2050 lines (−356 lines)

## Task Commits

1. **Task 1: Create copy_pipeline.rs with CopyContext and 5 extracted helpers** - `2744ac4` (feat)
2. **Task 2: Refactor copy_ticket to call extracted free helpers** - `c742804` (refactor)

## Files Created/Modified

- `src-tauri/src/copy_pipeline.rs` — New module with `CopyContext` struct and 5 extracted free async helpers
- `src-tauri/src/lib.rs` — Added `pub mod copy_pipeline;` after `pub mod commands;`
- `src-tauri/src/commands.rs` — `get_server_pat`/`get_cloud_credentials` promoted to `pub(crate)`; added copy_pipeline imports; `copy_ticket` refactored to use CopyContext + helper calls

## Decisions Made

- `CopyContext.client` uses `reqwest_middleware::ClientWithMiddleware` (return type of `build_audited_client`) rather than the `reqwest::Client` shown in CONTEXT.md D-09 — this is consistent with the existing `copy_ticket` client and the audit.rs interface
- `copy_attachments` uses `#[allow(clippy::too_many_lines)]` — the 107-line body is a verbatim extraction with no logical split point; splitting would compromise readability
- Doc comments in `copy_pipeline.rs` mention `MYPROJ` as an example value (2 occurrences in `///` comments only) — no production code uses a literal `"MYPROJ"`; the JSON subtask body exclusively uses `ctx.target_project_key`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Doc comment backtick fixes for clippy::doc_markdown**
- **Found during:** Task 1 (cargo clippy)
- **Issue:** Clippy flagged `CopyContext`, `CopyStepResult`, `ClientWithMiddleware`, `ctx.client`, `ctx.target_key` in doc comments as needing backticks (`doc_markdown` lint with `-D warnings`)
- **Fix:** Added backticks to all flagged identifiers in doc comments; added `#[allow(clippy::too_many_lines)]` on `copy_attachments`
- **Files modified:** `src-tauri/src/copy_pipeline.rs`
- **Verification:** `cargo clippy --workspace --all-targets -- -D warnings` shows zero errors in copy_pipeline.rs
- **Committed in:** `2744ac4` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (doc_markdown clippy compliance)
**Impact on plan:** Minor cosmetic fix. No scope creep.

## Issues Encountered

- Pre-existing clippy errors exist in other parts of the codebase (`field_transform/version.rs`, test files) — confirmed pre-existing by checking `git stash` baseline. These are out of scope per deviation rule scope boundary.
- Pre-existing frontend test failures: 17 tests in `CopyPreviewModal.test.tsx` fail both before and after this plan's changes. The Rust test suite (75 tests, all pass) is the regression net for the D-08 refactor.

## Test Results Post-Refactor

- `cargo test --workspace`: 75/75 Rust tests pass
- `npm test -- --run`: 682/699 pass (17 pre-existing failures in CopyPreviewModal.test.tsx — confirmed pre-exist before this plan)

## Known Stubs

None — all helpers contain full verbatim business logic extracted from commands.rs.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. `CopyContext` is not `Debug`-derived, preventing accidental credential logging (T-23-02 mitigation in place). `ctx.target_project_key` is interpolated only into `serde_json::json!` macro (T-23-01 mitigation confirmed — no SQL or shell interpolation).

## Next Phase Readiness

- Plan 23-02 (audit hooks): `copy_pipeline.rs` is ready to receive `mapping_audit_log` calls; `CopyContext` is stable
- Plan 23-03 (`copy_ticket_v2`): All 5 helper signatures are fixed; `CopyContext` carries `target_project_key` end-to-end; `get_server_pat`/`get_cloud_credentials` are `pub(crate)`
- D-08 proof: both `copy_ticket` (refactored) and `copy_ticket_v2` (Plan 23-03) will share the same helpers — proven before deletion

---
*Phase: 23-copy-ticket-v2-wiring*
*Completed: 2026-04-28*
