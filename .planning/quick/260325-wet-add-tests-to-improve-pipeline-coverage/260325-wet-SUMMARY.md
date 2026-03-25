---
phase: quick
plan: 260325-wet
subsystem: frontend-tests
tags: [testing, coverage, ci, vitest]
dependency_graph:
  requires: []
  provides: [ci-coverage-thresholds-met]
  affects: [ci-pipeline]
tech_stack:
  added: []
  patterns:
    - vi.useFakeTimers + vi.runAllTimersAsync for debounce testing
    - Zustand setState for store setup in tests
    - vi.mocked(invoke) for typed Tauri command mocks
    - renderWithI18n wrapper for i18n-dependent components
key_files:
  created:
    - src/features/tickets/__tests__/CopyPreviewPage.test.tsx
    - src/features/tickets/__tests__/CopyResultPage.test.tsx
    - src/features/update/__tests__/VersionHistoryModal.test.tsx
  modified:
    - src/features/update/__tests__/UpdateModal.test.tsx
    - src/features/update/__tests__/AboutSection.test.tsx
    - src/features/connections/__tests__/connectionStore.test.ts
    - src/features/theme/__tests__/themeStore.test.ts
    - src/features/tickets/__tests__/TicketFilterBar.test.tsx
    - src/__tests__/App.test.tsx
decisions:
  - vi.runAllTimersAsync() required after vi.advanceTimersByTime() to flush async promise callbacks in fake timer context
  - type assertion (as any) used for Tauri Update mock — Update type has many internal fields not relevant to test behavior
metrics:
  duration: 11 min
  completed: 2026-03-25
  tasks: 3
  files: 9
---

# Phase quick Plan 260325-wet: Add Tests to Improve Pipeline Coverage Summary

Added tests to bring frontend coverage from below-threshold to passing all four CI thresholds — unblocking the CI pipeline.

## Coverage Results

**Before:**
- Lines: 69.43% (need 80%) — FAIL
- Functions: 65.52% (need 75%) — FAIL
- Branches: 55.99% (need 65%) — FAIL
- Statements: 68.31% (need 79%) — FAIL

**After:**
- Lines: 80.56% — PASS
- Functions: 77.47% — PASS
- Branches: 70.07% — PASS
- Statements: 80.17% — PASS

All 528 tests pass. `npm run test:coverage` exits with code 0.

## Tasks Completed

### Task 1: CopyPreviewPage and CopyResultPage tests (63f651a)

Created two new test files for pages with 0% coverage — largest single coverage impact:

**CopyPreviewPage.test.tsx (47 tests):**
- Loading spinner state (phase=loading_preview)
- Source panel: summary, status, priority, assignee (with/without), labels, attachments count, comments count, subtasks, linked issues (inward + outward), description
- Target panel: editable summary, status dropdown, priority dropdown, label checkboxes, description textarea
- Action buttons: Discard calls reset(), Confirm calls confirmCopy() with URLs, disabled states during copying/loading
- Copying state: progress bar, step text, opacity-50 overlay
- getProgressPercent helper: all 12 step variants (creating, description, attachment/image, comment/worklog, done/complete/link, unknown)

**CopyResultPage.test.tsx (24 tests):**
- Headings: "Copy Complete" vs "Copy Finished with Errors"
- Target key display and null handling
- Step result icons (check/X) and error detail text
- All stepLabel() variants: create_issue, convert_description, upload_image*, add_remote_link, attach:filename, comment:N, worklog:N, subtask:KEY, unknown fallback
- "Open in Jira" button: shown/hidden based on issueCreated + targetUrl
- Close button: calls get_triage_state then reset(), handles rejection gracefully

### Task 2: Expand low-coverage files (a11e864)

**UpdateModal.test.tsx** — Added 7 new tests: installing state with progress bar, error state message, Try Again button, disabled state during installing, changelog hidden during downloading, subtitle version number display.

**AboutSection.test.tsx** — Added 11 new tests: update available badge, version history link/modal trigger, last-checked time display, all check() outcome paths (up-to-date, available, Could-not-fetch/404/Network error as up-to-date, unexpected error as error state).

**VersionHistoryModal.test.tsx** — New test file (8 tests): dialog open/close, version history title, version badge display, first entry expanded by default, accordion expand/collapse behavior, onOpenChange callback, "current" label on latest version.

**connectionStore.test.ts** — Added 10 new tests: setSourceProjectKey (set/null/independence), setTargetProjectKey (set/null), setSourceProjectName (set/null), setTargetProjectName (set/null).

**themeStore.test.ts** — Added 6 new tests: dark system theme via matchMedia mock, light system theme via matchMedia mock, localStorage read-back for all three modes.

**TicketFilterBar.test.tsx** — Added 11 new autocomplete tests: debounce triggers invoke after 250ms, suggestions dropdown appears, no-results state, user selection via mouseDown, ArrowDown/ArrowUp/Enter/Escape keyboard navigation, clear suggestions on empty query, no invoke when serverConnection null, graceful invoke error handling.

**App.test.tsx** — Added 4 new tests: CopyPreviewPage branch (copyPhase=previewing with detail shown), CopyResultPage branch (copyPhase=result), settings page navigation via gear click.

### Task 3: Cleanup (8b69d39)

- Removed unused `waitFor` import from TicketFilterBar tests
- Fixed TypeScript error in AboutSection test (Tauri Update type mocking)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.advanceTimersByTime() insufficient for async debounce in fake timer context**
- **Found during:** Task 2 (TicketFilterBar autocomplete tests)
- **Issue:** Tests were timing out because fake timers don't automatically flush Promise microtasks. The setTimeout callback fires but the `await invoke(...)` inside it never resolves.
- **Fix:** Added `await vi.runAllTimersAsync()` after `vi.advanceTimersByTime(300)` inside `act()` to properly flush both timers and microtasks.
- **Files modified:** src/features/tickets/__tests__/TicketFilterBar.test.tsx

**2. [Rule 1 - Bug] TypeScript type mismatch for Tauri Update mock in AboutSection**
- **Found during:** Task 3 (tsc --noEmit)
- **Issue:** `mockCheck.mockResolvedValue({version, body, downloadAndInstall})` fails TS strict check because Tauri's `Update` type has many required internal fields not readable from test code.
- **Fix:** Used `as any` type assertion. Not ideal but unavoidable for external library mocking; documented with lint warning acknowledgment.
- **Files modified:** src/features/update/__tests__/AboutSection.test.tsx

## Self-Check

Checking created files exist:
- [x] src/features/tickets/__tests__/CopyPreviewPage.test.tsx — created
- [x] src/features/tickets/__tests__/CopyResultPage.test.tsx — created
- [x] src/features/update/__tests__/VersionHistoryModal.test.tsx — created

Checking commits exist:
- [x] 63f651a — Task 1: CopyPreviewPage + CopyResultPage tests
- [x] a11e864 — Task 2: Expanded low-coverage tests
- [x] 8b69d39 — Task 3: Cleanup

## Self-Check: PASSED
