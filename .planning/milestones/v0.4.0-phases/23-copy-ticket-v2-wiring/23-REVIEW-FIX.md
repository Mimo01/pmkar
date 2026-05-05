---
phase: 23-copy-ticket-v2-wiring
fixed_at: 2026-05-05T06:29:54Z
review_path: .planning/milestones/v0.4.0-phases/23-copy-ticket-v2-wiring/23-REVIEW.md
iteration: 2
findings_in_scope: 8
fixed: 7
skipped: 1
status: partial
---

# Phase 23: Code Review Fix Report

**Fixed at:** 2026-05-05T06:29:54Z
**Source review:** `.planning/milestones/v0.4.0-phases/23-copy-ticket-v2-wiring/23-REVIEW.md`
**Iteration:** 2

**Summary:**
- Findings in scope: 8 (3 Critical + 5 Warning)
- Fixed: 7
- Skipped: 1

## Fixed Issues

### CR-01: Unicode-unsafe byte slice in `format_create_failure_detail`

**Files modified:** `src-tauri/src/commands.rs`
**Commit:** 7495d20
**Applied fix:** Added `is_char_boundary` walk-back loop to both the JSON compact path and the raw text path in `format_create_failure_detail`, ensuring truncation at byte offset 1024 never splits a multi-byte UTF-8 sequence.

### CR-02: `targetPriorityId` and `selectedLabels` populated but never forwarded to backend

**Files modified:** `src/features/tickets/copyStore.ts`
**Commit:** 128d9cf
**Applied fix:** Applied Option A. In `confirmCopy`, merged `targetPriorityId` (as `{ priority: { id } }`) and `selectedLabels` (as `{ labels }`) into the `overrideValues` payload before invoking `copy_ticket_v2`. Phase 22 renderer overrides spread on top so they take precedence. `targetDescription` was not forwarded — it is not a standard Cloud Jira v3 create field in the current mapping pipeline, and no production component subscribes to the setter.

### CR-03: Integration test worklog assertion missing

**Files modified:** `src-tauri/tests/copy_ticket_v2_integration.rs`
**Commit:** c87cab2
**Applied fix:** Added `assert!(!wl_steps.is_empty(), "PROJ-1 fixture has worklogs — copy_worklogs must produce >=1 step")` before the per-step success assertions. The PROJ-1 fixture seeds exactly 1 worklog entry with `timeSpentSeconds: 7200`, confirming the assertion is valid.

### WR-01: `get_project_keys` swallows database errors

**Files modified:** `src-tauri/src/triage_db.rs`
**Commit:** 4da6a96
**Applied fix:** Replaced `.ok().unwrap_or((None, None, None, None))` with `use rusqlite::OptionalExtension; ... .optional()?`. The `optional()` method returns `Ok(None)` when no rows match and propagates real errors as `Err(...)`.

### WR-02: `ALTER_TRIAGE_ADD_COPIED_KEY` failure silently discarded

**Files modified:** `src-tauri/src/triage_db.rs`
**Commit:** 750bd09
**Applied fix:** Added `ignore_duplicate_column` free function that passes through `Ok(())` and `SQLITE_ERROR` (extended code 1, "duplicate column name") while propagating real errors. Replaced `let _ = conn.execute_batch(ALTER_TRIAGE_ADD_COPIED_KEY)` with `ignore_duplicate_column(...)?` in both `open` and `open_in_memory`.

### WR-04: `copy_worklogs` posts `timeSpentSeconds: 0` for malformed entries

**Files modified:** `src-tauri/src/copy_pipeline.rs`
**Commit:** dffac4a
**Applied fix:** Added a `if time_spent_seconds <= 0` guard after extracting `timeSpentSeconds`. Malformed entries now emit a failure `CopyStepResult` with a descriptive message and `continue` past the POST logic.

### WR-05: `confirmCopy` guard makes `targetIssueTypeId ?? ''` unreachable

**Files modified:** `src/features/tickets/copyStore.ts`
**Commit:** 1d26a30
**Applied fix:** Added a two-line comment above the `?? ''` fallback explaining that the guard at `if (!state.targetIssueTypeId)` makes this branch unreachable dead code kept only for TypeScript type narrowing.

## Skipped Issues

### WR-03: `open_external_url` on Windows passes URL as third arg to `cmd /C start`

**File:** `src-tauri/src/commands.rs`
**Reason:** Already fixed — code context differs from review. The current `open_external_url` function at lines 657-663 already uses `rundll32 url.dll,FileProtocolHandler <url>` for Windows (replaced by the Phase 19 CR-01 fix). The `cmd /C start` pattern cited in the finding is not present in the current source. No change required.
**Original issue:** `cmd /C start <url>` passes the URL as the third positional argument, which opens a new `cmd.exe` window and ignores the URL.

---

_Fixed: 2026-05-05T06:29:54Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
