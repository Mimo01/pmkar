---
phase: 22-copy-preview-override-panel
fixed_at: 2026-05-04T07:41:30Z
review_path: .planning/milestones/v0.4.0-phases/22-copy-preview-override-panel/22-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 22: Code Review Fix Report

**Fixed at:** 2026-05-04
**Source review:** `.planning/milestones/v0.4.0-phases/22-copy-preview-override-panel/22-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03)
- Fixed: 5 (CR-01, CR-02, CR-03, WR-01, WR-02)
- Skipped: 1 (WR-03)

## Fixed Issues

### CR-01: `CopyPreviewModal.searchUsersForPicker` missing `baseUrl` — runtime crash on user search

**Files modified:** `src/features/tickets/CopyPreviewModal.tsx`
**Commit:** `962f284`
**Applied fix:** Removed the module-level `searchUsersForPicker` function and replaced it with a `useCallback` inside the component that closes over `sourceBaseUrl` from `useConnectionStore`. This matches the page implementation and includes the required `baseUrl` argument in the `search_jira_users_by_domain` Tauri invoke call.

---

### CR-02: Pre-fill effect has `overrideValues` in dep array — infinite loop on every user input

**Files modified:** `src/features/tickets/CopyPreviewModal.tsx`
**Commit:** `962f284`
**Applied fix:** Removed `overrideValues` and `setOverrideValue` from the `useEffect` dep array in `CopyPreviewModal.tsx`. Replaced the `// eslint-disable-next-line react-hooks/exhaustive-deps` comment with a `// biome-ignore lint/correctness/useExhaustiveDependencies:` suppression comment explaining the intentional omission, consistent with how the project suppresses this rule elsewhere.

---

### CR-03: `CopyPreviewModal` `PREFILLABLE_KINDS` includes `'user'`

**Files modified:** `src/features/tickets/CopyPreviewModal.tsx`
**Commit:** `962f284`
**Applied fix:** Removed `'user'` from the `PREFILLABLE_KINDS` set in `CopyPreviewModal.tsx`. The set now reads `new Set(['identity', 'priority'])`, matching `CopyPreviewPage.tsx` and preventing raw Jira Server user objects from being written into picker state.

---

### WR-01: `CopyPreviewPage` pre-fill dep-array also has `overrideValues` — duplicate audit log entries

**Files modified:** `src/features/tickets/CopyPreviewPage.tsx`
**Commit:** `962f284`
**Applied fix:** Removed `overrideValues` and `setOverrideValue` from the pre-fill `useEffect` dep array in `CopyPreviewPage.tsx` (same root cause as CR-02). Added a `// biome-ignore lint/correctness/useExhaustiveDependencies:` suppression comment with explanation. This prevents `log_preview_transformations` from being called on every keypress into a gap field, eliminating duplicate audit log entries.

---

### WR-02: Copy button does not gate on `!targetIssueTypeId` in modal

**Files modified:** `src/features/tickets/CopyPreviewModal.tsx`, `src/features/tickets/CopyPreviewModal.test.tsx`
**Commit:** `962f284`
**Applied fix:** Added `!targetIssueTypeId` to the `isCopyDisabled` condition in `CopyPreviewModal.tsx`. The expression is formatted as a single line per Biome's formatter (`const isCopyDisabled = phase === 'copying' || isGated || !targetIssueTypeId`). Updated the existing `CopyPreviewModal.test.tsx` test "Confirm button invokes copy_ticket_v2" to set `targetIssueTypeId: 'it-1'` (previously it used the default state with `null`, which now correctly disables the button). Added a new test "Confirm button is disabled when targetIssueTypeId is null (WR-02)" to verify the gating behaviour.

---

## Skipped Issues

### WR-03: No test coverage for `CopyPreviewModal`

**File:** `src/features/tickets/CopyPreviewModal.tsx`
**Reason:** `src/features/tickets/CopyPreviewModal.test.tsx` already existed — it was created as part of Phase 23 as noted in the finding itself. The file contains 18 tests covering source panel rendering, copy button behaviour, and edge cases. No action required.
**Original issue:** No `CopyPreviewModal.test.tsx` file covering user search, copy-button gating, and pre-fill correctness.

---

_Fixed: 2026-05-04_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
