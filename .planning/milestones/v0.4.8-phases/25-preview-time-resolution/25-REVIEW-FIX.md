---
phase: 25
fixed_at: 2026-05-05T00:00:00Z
review_path: .planning/phases/25-preview-time-resolution/25-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 25: Code Review Fix Report

**Fixed at:** 2026-05-05
**Source review:** `.planning/phases/25-preview-time-resolution/25-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: `resolve_users_preview` uses frontend-supplied `cloud_base_url` without origin validation

**Files modified:** `src-tauri/src/commands.rs`
**Commit:** a7df6bb
**Applied fix:** Changed line 1232 to destructure the first tuple element as `stored_base_url` instead of `_`, then use `stored_base_url.trim_end_matches('/')` for `trimmed_base` instead of the frontend-supplied `cloud_base_url`. Added `let _ = cloud_base_url;` to suppress unused-variable warning while retaining the parameter in the command signature for API compatibility.

### WR-01: Array-of-user fields silently skip without audit log entry

**Files modified:** `src/features/tickets/CopyPreviewPage.tsx`
**Commit:** 5129ce8
**Applied fix:** Added an `Array.isArray(fieldVal)` branch before the existing single-user object path (lines ~330–356). When the field is an array, the first element is extracted; if its `name`/`key` username cannot be determined, a `logEntries` entry is pushed with `outcome: 'skipped'` and `failureReason: 'array user field: username not extractable'` before `continue`-ing. If extraction succeeds, the entry is added to `userEntries`/`rowsWithEntry` normally.

### WR-02: Stale `overrideValues` closure in async `.then()` callbacks

**Files modified:** `src/features/tickets/CopyPreviewPage.tsx`
**Commit:** 5129ce8
**Applied fix:** Replaced both stale closure reads:
- `overrideValues[descRow.targetFieldId] !== undefined` → `useCopyStore.getState().overrideValues[descRow.targetFieldId] !== undefined` (in the `resolve_description_to_adf` `.then()` callback)
- `overrideValues[row.targetFieldId] !== undefined` → `useCopyStore.getState().overrideValues[row.targetFieldId] !== undefined` (in the `resolve_users_preview` `.then()` callback)
`useCopyStore` was already imported at the top of the file.

### WR-03: `resolve_users_preview` async path overwrites user-entered override values

**Files modified:** `src/features/tickets/CopyPreviewPage.tsx`
**Commit:** 5129ce8
**Applied fix:** Wrapped the `setOverrideValue(row.targetFieldId, resolvedUser)` call with a guard: `if (useCopyStore.getState().overrideValues[row.targetFieldId] === undefined)`. This prevents the async resolution result from overwriting a value the user has explicitly set between the time the invoke was dispatched and the time it resolved.

### WR-04: Integration test uses fixed 300ms sleep for mock server startup

**Files modified:** `src-tauri/tests/resolve_users_preview_integration.rs`
**Commit:** 107de25
**Applied fix:** After the existing `thread::sleep(Duration::from_millis(300))`, added a TCP probe loop that attempts `std::net::TcpStream::connect("127.0.0.1:8081")` up to 30 times with 20ms between attempts, breaking on success. This adds up to ~600ms of additional wait time only when needed, making the test robust under CI load without unconditionally increasing the sleep duration.

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-05-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
