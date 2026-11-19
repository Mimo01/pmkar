---
phase: quick-261119-iym
plan: 01
subsystem: groups
tags: [groups, auto-prune, jira]
key-files:
  created: [src/features/groups/autoPrune.ts, src/features/tickets/__tests__/doneStatus.test.ts]
  modified: [src/features/tickets/utils.ts, src/App.tsx]
  renamed: [src/features/groups/__tests__/autoPrune.test.tsx]
metrics:
  completed: 2026-11-19
---

# Quick 261119-iym: Auto-remove closed issues and children of closed parents from groups

Silent auto-prune now removes group members that are missing, done, or whose direct parent is done (live parent ticket wins, else embedded fields.parent.status), under the same eligibility gating as before and with no extra Jira calls.

## Commits
- 1f7455f: shared `isDoneStatus` helper (null-safe), `isDoneTicket` delegates
- 9f2e60b: `missingMembers.ts` renamed to `autoPrune.ts`, generalized predicate (`computePrunableKeys` etc.), App.tsx updated, tests extended

## Deviations from Plan
None. The worktree base was reset to ce3374e as instructed. Pre-commit hooks passed without --no-verify.

## Self-Check: PASSED
