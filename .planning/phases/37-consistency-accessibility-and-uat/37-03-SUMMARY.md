---
phase: 37-consistency-accessibility-and-uat
plan: 03
subsystem: accessibility
tags: [aria-live, triage, i18n]
requires: [37-01]
provides:
  - "Live-region announcements for every triage outcome and failure"
affects: [37-HUMAN-UAT]
key-files:
  modified:
    - src/features/tickets/triageActions.ts
    - src/features/tickets/__tests__/triageActions.test.ts
key-decisions:
  - "D-05: sonner toasts are not suppressed or aria-hidden; the live region is authoritative and the toast Undo action stays reachable. Once-only speech is verified in 37-HUMAN-UAT; mitigation for confirmed double-speech is a follow-up."
requirements-completed: [RQA-03]
duration: 10min
completed: 2026-10-15
---

# Phase 37 Plan 03: Triage announcements Summary

triageActions.ts now calls `announce()` after every store write (deny with or without remembered key, undo, relink, restore, handled) and mirrors every failure toast through a `notifyError` helper that toasts and announces the same text. needs-copy link results are not announced; cloudKey comes only from the `relink_ticket` return value.

## Commits
- 3235d22: triageActions announcements and extended tests

## Deviations from Plan
None. Worktree base was reset to 9373b90 per the startup check. A temporary untracked `node_modules` symlink was used for tests (not committed). Biome format was applied to the test file.

## Verification
`npx vitest run src/features/tickets`: 41 files, 688 tests pass. Pre-commit checks pass. Ordering (announce after write) is asserted via an announcer-store subscription.

## Self-Check: PASSED
