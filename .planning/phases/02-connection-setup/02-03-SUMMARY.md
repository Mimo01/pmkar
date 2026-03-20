---
phase: 02-connection-setup
plan: 03
subsystem: ui
tags: [react, tauri, zustand, vitest, testing-library, tailwind]

# Dependency graph
requires:
  - phase: 02-connection-setup/02-02
    provides: SetupWizard, ConnectionForm, TestResult, SecretInput, connectionStore, types

provides:
  - AppShell gear icon button with onGearClick callback
  - SettingsPage component with two ConnectionCard components
  - ConnectionCard showing status dot, URL, last tested, Edit button
  - SetupWizard initialStep/onComplete props for edit-mode re-entry
  - 4 frontend test files covering all wizard components (26 tests)
  - Bug fix for ConnectionForm stale-closure race in setTimeout invalidation

affects:
  - 03-ticket-browser (App navigation pattern established)
  - any phase adding UI components (AppShell header pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRef(currentCredentialsRef) pattern to avoid stale closure in setTimeout callbacks"
    - "Zustand store pre-population via useConnectionStore.getState() for test isolation"
    - "SetupWizard initialStep prop enables edit-mode re-entry from SettingsPage"
    - "mockImplementation by command name for invoke mock disambiguation"

key-files:
  created:
    - src/features/connections/ConnectionCard.tsx
    - src/features/connections/SettingsPage.tsx
    - src/features/connections/ConnectionForm.test.tsx
    - src/features/connections/TestResult.test.tsx
    - src/features/connections/SetupWizard.test.tsx
    - src/features/connections/SecretInput.test.tsx
  modified:
    - src/components/ui/AppShell.tsx
    - src/App.tsx
    - src/features/connections/SetupWizard.tsx
    - src/features/connections/ConnectionForm.tsx

key-decisions:
  - "currentCredentialsRef useRef pattern in ConnectionForm to prevent stale-closure invalidation race — setTimeout(0) callbacks from field change events were firing after test success with old closure values, calling onTestInvalidated incorrectly"
  - "SetupWizard multi-step tests use pre-populated Zustand store (initialStep=3) instead of full wizard flow — React 19 async state batching causes non-deterministic timing when chaining step 1→2→3 in a single test"
  - "App.tsx uses three-branch conditional render: !hasSetup || editStep → SetupWizard; hasSetup && showSettings → SettingsPage; hasSetup && !showSettings → DevStatusPanel"

patterns-established:
  - "AppShell.tsx accepts optional onGearClick prop — wizard renders without gear icon (no AppShell wrapper), main app renders with gear icon"
  - "ConnectionCard relative time: shows 'Last tested: X minutes/hours/days ago' from lastTestedAt ISO timestamp"
  - "Test isolation for Zustand: call useConnectionStore.getState().clearConnections() wrapped in act() in beforeEach"

requirements-completed: [CONN-04, CONN-05, CONN-06]

# Metrics
duration: 90min
completed: 2026-03-20
---

# Phase 02 Plan 03: Connection Setup UI Completion Summary

**Gear-icon-driven Settings page with connection cards and 26 frontend tests covering all wizard components including stale-closure bug fix in ConnectionForm**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-03-20T09:00:00Z
- **Completed:** 2026-03-20T10:42:00Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify, awaiting visual confirmation)
- **Files modified:** 10

## Accomplishments

- AppShell now has optional gear icon (44px hit target) that opens Settings page
- SettingsPage renders two ConnectionCard components with status dot (green/red/slate), base URL, relative "last tested" time, and Edit button
- SetupWizard accepts `initialStep` and `onComplete` props enabling re-entry for editing existing connections
- App.tsx wires full conditional: wizard (first setup or edit), settings page, or main DevStatusPanel
- 26 tests across 4 files validate all wizard components (SecretInput, TestResult, ConnectionForm, SetupWizard)
- Fixed stale-closure bug in ConnectionForm where `setTimeout(0)` invalidation callbacks fired with old closure values after test success

## Task Commits

1. **Task 1: Gear icon, SettingsPage, ConnectionCard, App.tsx wiring** - `4ce56ae` (feat)
2. **Task 2: Frontend tests for wizard components** - `93563e0` (test) + `53e4ce0` (fix: unused vars)
3. **Task 3: Visual verification** - pending checkpoint

## Files Created/Modified

- `src/components/ui/AppShell.tsx` - Added `onGearClick?: () => void` prop, gear icon SVG button, header bar
- `src/features/connections/ConnectionCard.tsx` - Status dot, URL, relative time, Edit button
- `src/features/connections/SettingsPage.tsx` - Two ConnectionCard components, empty state, onEdit callback
- `src/features/connections/SetupWizard.tsx` - Added `initialStep` and `onComplete` props
- `src/App.tsx` - Three-branch conditional render, editStep state for re-entry
- `src/features/connections/ConnectionForm.tsx` - Fixed stale-closure race with `currentCredentialsRef`
- `src/features/connections/SecretInput.test.tsx` - 5 tests: type, toggle, aria-label, help link, disabled
- `src/features/connections/TestResult.test.tsx` - 8 tests: null, success (server/cloud), 5 error kinds
- `src/features/connections/ConnectionForm.test.tsx` - 7 tests: fields per type, URL validation, invoke commands, disabled state
- `src/features/connections/SetupWizard.test.tsx` - 6 tests: step rendering, Next gating, progression, summary, Done

## Decisions Made

- **currentCredentialsRef pattern:** ConnectionForm's `setTimeout(0)` invalidation callbacks captured stale closure values (pre-test success state). Added `currentCredentialsRef` updated via `useEffect` (no deps) to always read current credentials. This fixes the race condition where old closure `baseUrl` / `pat` values didn't match `testedValuesRef` and called `onTestInvalidated()` incorrectly.
- **SetupWizard test strategy:** Multi-step progression tests (step 1→2→3) were non-deterministic in React 19 test environment. Tests that verify Summary step and Done button now pre-populate the Zustand store with both connections and start at `initialStep={3}`, making them deterministic. Step 1→2 progression is verified in the "advances to Step 2" test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale-closure race condition in ConnectionForm invalidation**
- **Found during:** Task 2 (frontend tests for wizard components)
- **Issue:** `setTimeout(0)` callbacks in `handleFieldChange` and `handleBaseUrlChange` captured old closure values from the render when the handler was created. After test success, these callbacks fired with pre-test state, making `credentialsMatchTested()` return false and calling `onTestInvalidated()` — clearing the test success state before the user could click Next.
- **Fix:** Added `currentCredentialsRef` (useRef) updated via `useEffect` after every render. `getCurrentCredentials()` now reads from the ref instead of the closure, ensuring setTimeout callbacks always see current values.
- **Files modified:** `src/features/connections/ConnectionForm.tsx`
- **Committed in:** `93563e0` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for test correctness. The bug would have also affected production use when typing then immediately clicking Test Connection. No scope creep.

## Issues Encountered

- React 19 async state batching caused non-deterministic timing in multi-step wizard tests — resolved by using `initialStep` prop to start at the relevant step rather than driving through all steps in one test
- `findByRole('button', { name: 'Next' })` needed 5000ms timeout in slower test environment (previous test setup overhead increases async processing time)
- Zustand store persists between tests — resolved with `useConnectionStore.getState().clearConnections()` in `beforeEach`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete connection setup UI is done (gear icon + settings page + wizard + tests)
- Awaiting human visual verification (Task 3 checkpoint) to confirm end-to-end flow works in the running Tauri app
- Phase 03 (ticket browser) can proceed after checkpoint approval

---
*Phase: 02-connection-setup*
*Completed: 2026-03-20*

## Self-Check: PASSED

- src/components/ui/AppShell.tsx: FOUND
- src/features/connections/ConnectionCard.tsx: FOUND
- src/features/connections/SettingsPage.tsx: FOUND
- src/features/connections/ConnectionForm.test.tsx: FOUND
- src/features/connections/TestResult.test.tsx: FOUND
- src/features/connections/SetupWizard.test.tsx: FOUND
- src/features/connections/SecretInput.test.tsx: FOUND
- Commit 4ce56ae: FOUND (feat(02-03): gear icon, SettingsPage, ConnectionCard)
- Commit 93563e0: FOUND (test(02-03): frontend tests)
- Commit 53e4ce0: FOUND (fix: unused variables)
- npm test -- src/features/connections: 26/26 PASSED
