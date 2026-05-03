---
phase: 17-field-discovery-mock-schema-fidelity
plan: "05"
subsystem: frontend
tags: [typescript, zustand, react, banner, status-pill, probe-wiring, tauri-invoke, tdd, vitest]

# Dependency graph
requires:
  - phase: 17-03
    provides: "useSchemaCacheStore with preWarm(projectKey) action"
  - phase: 17-04
    provides: "probe_createmeta Tauri command returning ProbeResult"
provides:
  - "connectionStore extended with probeStatus/probeError/probeEndpointUrl/probeStatusCode/probeBannerDismissed fields + runProbe/dismissProbeBanner/prewarmIssueTypes actions"
  - "ProbeStatusBanner component: dismissable red alert banner rendered in main app shell when probe fails"
  - "ConnectionCard updated with optional connectionType prop; red 'Discovery unavailable' pill on cloud row when probeStatus === 'failed'"
  - "App.tsx wires runProbe() after connection validation via useEffect; fires on targetProjectKey change"
affects:
  - phase-22-copy-preview
  - phase-18-translation-pipeline
  - phase-20-renderer-registry

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zustand probe action pattern: invoke Tauri command, map result to state fields, catch non-fatal, never throw"
    - "Per-session dismissable banner: probeBannerDismissed resets on app restart (not persisted to SQLite)"
    - "ConnectionCard optional connectionType prop: existing consumers unchanged; cloud pill gated on explicit prop"
    - "TDD Red-Green cycle for store + component: RED test commits precede GREEN implementation commits"

key-files:
  created:
    - src/features/connections/__tests__/connectionStore.probe.test.ts
    - src/features/connections/__tests__/ProbeStatusBanner.test.tsx
    - src/features/connections/ProbeStatusBanner.tsx
  modified:
    - src/features/connections/connectionStore.ts
    - src/features/connections/ConnectionCard.tsx
    - src/features/connections/SettingsPage.tsx
    - src/App.tsx
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-VALIDATION.md

key-decisions:
  - "ConnectionCard gets optional connectionType prop (not inferred from connection.baseUrl) — explicit typing avoids URL-heuristic fragility; SettingsPage passes 'server'/'cloud' explicitly"
  - "ProbeStatusBanner rendered in main shell AppShell children only (not settings/audit/detail branches) — satisfies plan spec; banner internally gated so zero cost when probe OK"
  - "runProbe useEffect depends on [hasSetup, targetProjectKey, runProbe] — Zustand create produces stable function refs, no infinite re-render risk per T-17-20"

patterns-established:
  - "Pattern: Zustand probe action — invoke Tauri command, set status from result.ok, non-fatal catch sets failed state with 'Probe call rejected: {msg}'"
  - "Pattern: Per-session dismissable banner — probeBannerDismissed boolean, not persisted, cleared by clearConnections()"

requirements-completed: [DISC-04]

# Metrics
duration: 8min
completed: 2026-04-27
---

# Phase 17 Plan 05: Probe Banner + Status Pill Wiring Summary

**Zustand connectionStore extended with probe state machine; ProbeStatusBanner dismissable red alert + ConnectionCard cloud pill wired to probe_createmeta Tauri command; runProbe fires on app launch after connection validation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-27T13:10:48Z
- **Completed:** 2026-04-27T13:18:00Z
- **Tasks:** 3 (Task 1 TDD: 2 commits, Task 2 TDD: 2 commits, Task 3: 1 commit)
- **Files modified:** 7 (3 created, 4 modified) + 2 test files created

## Accomplishments

- Extended `connectionStore` with 5 probe state fields (`probeStatus`, `probeError`, `probeEndpointUrl`, `probeStatusCode`, `probeBannerDismissed`) and 3 actions (`runProbe`, `dismissProbeBanner`, `prewarmIssueTypes`); `clearConnections()` resets all probe fields
- Created `ProbeStatusBanner` React component: renders `role="alert"` div with endpoint URL + HTTP status code + hint when `probeStatus === 'failed'` and not dismissed; X button calls `dismissProbeBanner()`; renders null otherwise
- Updated `ConnectionCard` with optional `connectionType` prop; red "Discovery unavailable" pill (`data-testid="probe-status-pill"`) appears on cloud rows when `probeStatus === 'failed'`
- Wired `runProbe()` into `App.tsx` via `useEffect` triggered by `hasSetup && targetProjectKey`; `<ProbeStatusBanner />` rendered at top of main shell
- Set `nyquist_compliant: true` in `17-VALIDATION.md` — all automated tests green

## Task Commits

1. **Task 1 RED: probe store failing tests** - `d316c08` (test)
2. **Task 1 GREEN: extend connectionStore with probe state** - `619bbd5` (feat)
3. **Task 2 RED: ProbeStatusBanner failing tests** - `8c7846a` (test)
4. **Task 2 GREEN: create ProbeStatusBanner + update ConnectionCard** - `943422e` (feat)
5. **Task 3: wire runProbe into App.tsx + validation** - `aee47a0` (feat)
6. **Task 3: nyquist_compliant** - `d53ba4f` (chore)

## Files Created/Modified

- `src/features/connections/__tests__/connectionStore.probe.test.ts` — 9 vitest tests covering probe state transitions (idle, skipped, ok, failed, reject), dismissBanner, clearConnections reset, prewarmIssueTypes
- `src/features/connections/__tests__/ProbeStatusBanner.test.tsx` — 5 vitest RTL tests covering renders-null/visible states, dismiss interaction, error message content
- `src/features/connections/ProbeStatusBanner.tsx` — Standalone dismissable banner component reading from connectionStore; renders null unless `probeStatus === 'failed'` and not dismissed
- `src/features/connections/connectionStore.ts` — Added ProbeStatus type, ProbeResult interface, 5 probe state fields, runProbe/dismissProbeBanner/prewarmIssueTypes actions; clearConnections resets probe; import useSchemaCacheStore
- `src/features/connections/ConnectionCard.tsx` — Added optional `connectionType?: ConnectionType` prop; red probe-status-pill span on cloud rows when probeStatus === 'failed'
- `src/features/connections/SettingsPage.tsx` — Passes `connectionType="server"` and `connectionType="cloud"` to respective ConnectionCard usages
- `src/App.tsx` — Imports ProbeStatusBanner; adds targetProjectKey + runProbe selectors; useEffect fires runProbe when hasSetup + targetProjectKey; renders `<ProbeStatusBanner />` in main shell
- `.planning/phases/17-field-discovery-mock-schema-fidelity/17-VALIDATION.md` — `nyquist_compliant: true`

## Decisions Made

- `ConnectionCard` gets explicit `connectionType?: ConnectionType` prop rather than inferring cloud status from URL heuristic — URL patterns can vary and explicit typing is more reliable
- `ProbeStatusBanner` rendered only in the main shell branch of App.tsx (not settings/audit/detail) — satisfies plan spec; the banner is internally gated so renders null when probe is not failed, making it a zero-cost additive render in any route
- `runProbe` useEffect deps are `[hasSetup, targetProjectKey, runProbe]` — Zustand's `create` produces stable function references, so no infinite re-render risk (T-17-20 mitigated)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Worktree dependency setup:** The executor worktree was created from a pre-Wave-1 branch point (106cc3f) and did not have the Wave 1 files (schemaCacheStore.ts, fieldSchema.ts) that Plan 17-05 depends on. Resolved by merging local `main` branch (which contained Wave 1 commits) into the worktree branch before starting implementation. No code changes needed.

## Known Stubs

None — all probe state fields populated from real Tauri invoke results; no hardcoded placeholders.

## User Setup Required

None - no external service configuration required. The `probe_createmeta` Tauri command is registered in Plan 17-04 (Wave 2, parallel executor).

## Next Phase Readiness

- `useConnectionStore` with `probeStatus` is ready for Phase 22 (Copy Preview) to gate issue-type chooser rendering on pre-warm completion
- `prewarmIssueTypes()` fires `useSchemaCacheStore.preWarm(targetProjectKey)` on probe success — D-01 pre-warm contract fulfilled
- `ProbeStatusBanner` can be reused in SettingsPage in future phases without changes
- Manual UAT for visual banner + pill documented in `17-VALIDATION.md` §"Manual-Only Verifications"

## Self-Check: PASSED

All files verified present: connectionStore.probe.test.ts, ProbeStatusBanner.test.tsx, ProbeStatusBanner.tsx, connectionStore.ts (modified), ConnectionCard.tsx (modified), App.tsx (modified), 17-05-SUMMARY.md.
All commit hashes verified: d316c08, 619bbd5, 8c7846a, 943422e, aee47a0, d53ba4f.

---
*Phase: 17-field-discovery-mock-schema-fidelity*
*Completed: 2026-04-27*
