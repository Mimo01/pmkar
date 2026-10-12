---
phase: 29-tab-strip-group-view
plan: 02
subsystem: ui
tags: [groups, i18n, tabs, triage]
requires: []
provides:
  - groupTabs helpers (TabId, groupTabId, parseGroupTabId, resolveActiveTab, computeOverflow)
  - groupBadgeKey pill mapping
  - shared restoreTicket action
  - groups.* EN/SK locale keys
affects: [29-04, 29-05, 29-06]
key-files:
  created:
    - src/features/groups/groupTabs.ts
    - src/features/groups/groupBadge.ts
    - src/features/tickets/triageActions.ts
    - src/features/groups/__tests__/groupTabs.test.ts
    - src/features/groups/__tests__/groupBadge.test.ts
    - src/features/groups/__tests__/groupI18n.test.ts
  modified:
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
key-decisions:
  - "Pill reuses nav.* keys; only groups.badge.done is new"
requirements-completed: [GVIEW-04]
duration: 10min
completed: 2026-10-12
---

# Phase 29 Plan 02: Tab helpers, badge mapping, restore, i18n Summary

Pure tab-id/overflow helpers, triage pill key mapping, shared `restoreTicket`, and all `groups.*` EN/SK strings with Slovak plurals.

## Commits
- 0e9a89f: tab-id helpers and badge mapping (tests)
- e0a2350: extract restoreTicket, Dismissed page uses it
- Task 3 commit: locale keys + groupI18n test (also biome formatting of Task 1 files)

## Deviations from Plan
None in scope. Biome formatting applied to Task 1 files in the Task 3 commit.

## Verification
- vitest for src/features/groups, src/i18n, IgnoredTicketsPage: all pass; tsc clean.
- `npm run lint` reports 15 errors repo-wide; none in files touched by this plan (biome check on them is clean).
- A node_modules symlink to the main checkout was created in the worktree for running tests (untracked, not committed).

## Known Stubs
None.

## Self-Check: PASSED
