---
phase: 02-connection-setup
plan: 02
subsystem: ui
tags: [react, zustand, tauri, tailwind, wizard, connection-setup]

# Dependency graph
requires:
  - phase: 02-01
    provides: test_jira_server_connection and test_jira_cloud_connection Tauri commands, store_credential command
  - phase: 01-foundation
    provides: AppShell, ErrorBoundary, Zustand, @tauri-apps/api invoke pattern

provides:
  - 3-step setup wizard (SetupWizard, WizardStep, StepProgress) for guided connection configuration
  - ConnectionForm component with Test Connection flow, inline results, testedValues invalidation
  - SecretInput component with eye-icon toggle for PAT/API token fields
  - TestResult component with exact copywriting contract for all 5 error kinds
  - SummaryStep showing both connections with green checkmarks and Done button
  - useConnectionStore Zustand store with server/cloud metadata and hasCompletedSetup()
  - App.tsx conditional routing: wizard on first launch, main app after completion

affects:
  - 02-03 (settings page reads from useConnectionStore, EditConnection re-uses ConnectionForm)
  - 03-ticket-search (reads hasCompletedSetup to gate ticket search)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Multi-step wizard with useState(currentStep) — no state machine library needed for 3 steps
    - testedValues snapshot pattern in ConnectionForm for "Next" invalidation on field edit
    - Tauri invoke typed with ConnectionTestResult interface (camelCase mirrors Rust snake_case serialization)
    - Zustand store for non-secret connection metadata; credentials live exclusively in OS keychain

key-files:
  created:
    - src/features/connections/types.ts
    - src/features/connections/connectionStore.ts
    - src/features/connections/SecretInput.tsx
    - src/features/connections/TestResult.tsx
    - src/features/connections/StepProgress.tsx
    - src/features/connections/WizardStep.tsx
    - src/features/connections/ConnectionForm.tsx
    - src/features/connections/SummaryStep.tsx
    - src/features/connections/SetupWizard.tsx
  modified:
    - src/App.tsx

key-decisions:
  - "SetupWizard handles store_credential invoke on test success — ConnectionForm only invokes test commands, not storage"
  - "ConnectionForm.testedValues snapshot via useRef tracks exact credential snapshot to invalidate Next button on any field change"
  - "App.tsx renders wizard without AppShell wrapper — wizard has its own full-page layout with flex centering"
  - "Cloud success message uses result.username (displayName from v3/myself) not email — email is the keychain key, displayName is the display value"
  - "showSettings state retained in App.tsx with placeholder — Settings page wired in Plan 03"

patterns-established:
  - "Pattern: ConnectionForm onTestSuccess + onTestInvalidated callbacks — parent owns testPassed, child owns field state"
  - "Pattern: Wizard step components receive connection type as prop, render different fields based on it"
  - "Pattern: Role=status for success messages, role=alert for error messages — matches existing StatusBadge pattern"

requirements-completed: [CONN-01, CONN-02, CONN-04, CONN-05, CONN-06]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 2 Plan 02: Setup Wizard UI Summary

**3-step Jira connection wizard with SecretInput, TestResult, StepProgress components, Zustand metadata store, and App.tsx conditional routing — wires Tauri test commands to guided UI flow**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T09:10:18Z
- **Completed:** 2026-03-20T09:14:03Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- TypeScript types and Zustand connection store provide typed foundation for all wizard components
- Complete 3-step wizard with url validation, secret masking, test-gating, and keychain credential storage
- App.tsx routes to wizard on first launch, main app after hasCompletedSetup() returns true

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TypeScript types and Zustand connection store** - `204df60` (feat)
2. **Task 2: Build all wizard React components and wire App.tsx routing** - `c36236a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/features/connections/types.ts` - ConnectionStatus, ConnectionMeta, ConnectionTestResult, ConnectionType interfaces
- `src/features/connections/connectionStore.ts` - useConnectionStore with setServerConnection, setCloudConnection, hasCompletedSetup
- `src/features/connections/SecretInput.tsx` - Password input with eye toggle, aria-label Show/Hide token, 44px hit area
- `src/features/connections/TestResult.tsx` - Inline success/error with role=status/role=alert and exact copy strings for all 5 error kinds
- `src/features/connections/StepProgress.tsx` - 3-dot progress indicator with role=list/listitem, green/blue/slate state colors
- `src/features/connections/WizardStep.tsx` - Step wrapper with title (text-2xl semibold) and subtitle (text-sm muted)
- `src/features/connections/ConnectionForm.tsx` - URL + secret fields, Test Connection with spinner + aria-busy, invoke calls, testedValues invalidation pattern
- `src/features/connections/SummaryStep.tsx` - Step 3 read-only cards with green checkmark SVGs, Done button
- `src/features/connections/SetupWizard.tsx` - Multi-step container with step state, Next gating, store_credential invoke, setServerConnection/setCloudConnection calls
- `src/App.tsx` - Conditional render: SetupWizard when !hasSetup, main app when hasSetup

## Decisions Made

- SetupWizard owns the `store_credential` and Zustand store update calls on test success; ConnectionForm only owns the `test_jira_*_connection` invoke calls. This separation keeps ConnectionForm reusable for the Settings edit flow in Plan 03.
- App.tsx wizard branch wraps only with ErrorBoundary (no AppShell) — wizard provides its own full-page layout centered in min-h-screen container.
- Cloud keychain storage uses `email` as the keychain `username` parameter (not displayName from /myself), matching the credential retrieval pattern documented in Phase 01.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `src/App.test.tsx` (unused `beforeEach` import) and `src/components/ui/StatusBadge.tsx` (unused `ReactNode` import) cause `npm run build` to fail via `tsc`. These exist since Phase 01 and are out of scope for this plan. Vite build (`npx vite build`) succeeds with all 46 modules transformed. Logged to deferred-items.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All wizard components available for reuse in Plan 03 settings page
- useConnectionStore ready for ConnectionCard and SettingsPage reads
- hasCompletedSetup() gating works — Plan 03 can render settings behind this check
- Pre-existing tsc errors should be cleaned up before Phase 3 build verification

---
*Phase: 02-connection-setup*
*Completed: 2026-03-20*
