---
phase: 36-detail-and-group-ui
plan: 05
subsystem: ui
tags: [triage, groups, remembered-link]
requires: [36-01]
provides:
  - RememberedLinkHint row variant rendered on Not mine tab rows and group-view Not mine rows
key-files:
  modified:
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/features/tickets/IgnoredTicketsPage.test.tsx
    - src/features/groups/GroupViewPage.tsx
    - src/features/groups/__tests__/GroupViewPage.test.tsx
requirements-completed: [RLNK-03]
completed: 2026-10-15
---

# Phase 36 Plan 05: Hint on Not mine rows Summary

Not mine rows (Not mine tab and group view) now show "Previously linked to KEY" via `RememberedLinkHint variant="row"`, placed after the handled badge and before the existing Restore button; no new buttons or hover icons.

## Commits
- Task 1: Not mine tab rows hint + tests (IgnoredTicketsPage)
- Task 2: Group view Not mine rows hint + tests (GroupViewPage)

## Verification
`vitest run src/features/groups src/features/tickets/IgnoredTicketsPage.test.tsx src/i18n` green (619 tests); biome clean on the 4 files.

## Deviations from Plan
None. Worktree base was reset to d8d4087 per startup check; node_modules symlinked (untracked).

## Self-Check: PASSED
