---
phase: 28-foundations
plan: 06
subsystem: frontend
tags: [zustand, groups, validation, hydration]
requires: [28-03, 28-04, 28-05]
provides:
  - Group types and TS validation mirror verified against shared Rust vectors
  - useGroupStore with hydrate, rehydrateAfter, CRUD/membership actions, reverse index
  - Startup hydration in App.tsx; source-change re-hydration sequenced after set_connection_meta
affects: [phase-29, phase-30, phase-31]
key-files:
  created:
    - src/features/groups/types.ts
    - src/features/groups/validation.ts
    - src/features/groups/groupStore.ts
    - src/features/groups/__tests__/validation.test.ts
    - src/features/groups/__tests__/groupStore.test.ts
  modified:
    - src/App.tsx
    - src/features/connections/SettingsPage.tsx
    - src/features/connections/SetupWizard.tsx
    - src/features/connections/SetupWizard.test.tsx
    - src/features/connections/__tests__/SettingsPage.test.tsx
key-decisions:
  - "Re-hydration on source change uses rehydrateAfter(persist promise), not a baseUrl-keyed effect, so list_groups never races set_connection_meta (D-01, D-21)"
  - "selectGroupIdsForIssue falls back to null; reverse index built in actions (D-22)"
  - "Mutations return GroupResult typed codes instead of throwing; hydration failures silent"
requirements-completed: [GRP-06]
duration: 20min
completed: 2026-10-12
---

# Phase 28 Plan 06: Frontend group store Summary

Frontend side of group persistence: TS name-validation mirror checked against the shared vectors, `useGroupStore` with typed-result actions and a stable reverse index, startup hydration, and group re-hydration strictly after `set_connection_meta` settles.

## Commits
- 762b0ef: types + validation mirror (24 vector tests)
- 4d209ea: groupStore + App startup hydration (12 store tests)
- a4091e5: rehydrateAfter wiring in SetupWizard/SettingsPage with ordering tests

## Deviations from Plan
- groupStore test uses `createElement` instead of JSX because the file is `.ts` (plan named `groupStore.test.ts`).
- SettingsPage tests drive the real ConnectionForm; mock returns `[]` as default so ProjectSelector does not crash.

## Verification
- vitest groups, connections, App tests pass; the only failures are the 2 known pre-existing SettingsPage Domain Search tests.
- `tsc --noEmit` and `biome check` clean on touched dirs.
- Full `npm run test`, cargo, and the manual restart check were not run.

## Known Stubs
None.

## Self-Check: PASSED
