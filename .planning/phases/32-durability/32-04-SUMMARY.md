---
phase: 32-durability
plan: 04
subsystem: groups-frontend
tags: [zustand, snapshots, missing-members]
requires: [32-01, 32-02]
provides:
  - groupStore.refreshSnapshots and snapshotRevision
  - missingMembers.ts (EMPTY_MISSING, computeMissingKeys, useMissingKeysByGroup, readMissingKeysNow)
  - useGroupMembers.missingKeys
affects: [32-05, 32-06, 32-07]
key-files:
  created:
    - src/features/groups/missingMembers.ts
    - src/features/groups/__tests__/missingMembers.test.tsx
  modified:
    - src/features/groups/groupStore.ts
    - src/features/groups/useGroupMembers.ts
    - src/features/groups/__tests__/groupStore.test.ts
    - src/features/groups/__tests__/useGroupMembers.test.tsx
requirements-completed: [GDUR-02, GDUR-03, GDUR-06]
metrics:
  tasks: 2
  completed: 2026-10-12
---

# Phase 32 Plan 04: Missing members and snapshot refresh (client) Summary

Client-side best-effort snapshot refresh (member-only, no re-hydrate, errors swallowed with console.warn) plus gated, request-free missing-member computation exposed via `useGroupMembers.missingKeys` and shared helpers.

## Commits
- 3d4f954: refreshSnapshots + snapshotRevision, missingMembers.ts, tests
- Task 2 commit: useGroupMembers missingKeys and silent reload on snapshotRevision, tests (see git log)

## Deviations from Plan
- Worktree base was reset to 4f03794 per startup instructions.

## Verification
`npx vitest run src/features/groups`: 29 files, 417 tests pass; biome check on src/features/groups clean; pre-commit hooks passed.

## Known Stubs
None.

## Self-Check: PASSED
