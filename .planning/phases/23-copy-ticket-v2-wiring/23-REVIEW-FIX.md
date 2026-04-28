---
phase: 23-copy-ticket-v2-wiring
fixed_at: 2026-04-28T00:00:00Z
review_path: .planning/phases/23-copy-ticket-v2-wiring/23-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 23: Code Review Fix Report

**Fixed at:** 2026-04-28T00:00:00Z
**Source review:** .planning/phases/23-copy-ticket-v2-wiring/23-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: User-edited summary silently dropped in confirmCopy

**Files modified:** `src/features/tickets/copyStore.ts`
**Commit:** 4a64a4b
**Applied fix:** In `confirmCopy`, the `overrideValues` passed to `copy_ticket_v2` now spreads `{ summary: state.targetSummary, ...state.overrideValues }` so the user's edited summary is always sent as a base value, with any explicit override in `overrideValues` taking precedence.

---

### WR-01: targetIssueTypeId null guard missing in confirmCopy

**Files modified:** `src/features/tickets/copyStore.ts`
**Commit:** 46ccb84
**Applied fix:** Added an early-return guard immediately after the `sourceKey`/`cloudMeta` check. If `state.targetIssueTypeId` is null or empty-string falsy, `confirmCopy` transitions directly to the `result` phase with a synthetic failure step (`create_issue: false, detail: 'No target issue type selected.'`) instead of proceeding to the backend invoke.

---

### CR-02: Silent worklog failure path — zero CopyStepResult entries on error

**Files modified:** `src-tauri/src/copy_pipeline.rs`
**Commit:** a9be3df
**Applied fix:** Replaced the nested `if let Ok` / `if is_success()` structure in `copy_worklogs` with explicit `match` arms. Network error, non-2xx status, and JSON parse failure now each push a `CopyStepResult { step: "worklog:fetch", success: false, detail: Some(...) }` entry and early-return. The per-worklog POST loop error arm also captures `e` for diagnostic detail.

---

### WR-02: Err(_) arms discard network error details across pipeline helpers

**Files modified:** `src-tauri/src/copy_pipeline.rs`
**Commit:** 6e15d68
**Applied fix:** Changed all `Err(_)` match arms in the pipeline helpers to `Err(e)` and included `{e}` in the `detail` field string: `add_remote_link` (remote link network error), `copy_attachments` (upload network error and download network error), `copy_comments` (comment POST network error), and `copy_subtasks` (sub-task create network error). The existing per-worklog POST `Err` arm was updated in the same pass.

---

### WR-03: Dead _audit bindings in four field-discovery commands

**Files modified:** `src-tauri/src/commands.rs`
**Commit:** 7da8b9c
**Applied fix:** Removed the `db: State<'_, Arc<Mutex<AuditDb>>>` parameter and the `let _audit = build_audited_client(Arc::clone(db.inner()))` line from all four commands: `discover_source_fields`, `get_target_field_schema_for_issuetype`, `probe_createmeta`, and `pre_warm_target_issue_types`. Tauri injects state by type so removing an unused state parameter from the handler signature is safe and does not affect the IPC call surface.

---

### WR-04: migrate_triage_check_constraint errors silently discarded

**Files modified:** `src-tauri/src/triage_db.rs`
**Commit:** 8f5ed54
**Applied fix:** Changed `migrate_triage_check_constraint` signature from `fn(...) -> ()` to `fn(...) -> AppResult<()>`. The inner `let _ = conn.execute_batch(...)` is now `conn.execute_batch(...)?` to propagate errors. Both callers in `open()` and `open_in_memory()` updated from `Self::migrate_triage_check_constraint(&conn)` to `Self::migrate_triage_check_constraint(&conn)?`.

---

_Fixed: 2026-04-28T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
