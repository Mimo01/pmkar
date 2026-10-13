---
phase: 33-polish-verification
plan: 13
subsystem: groups
tags: [a11y, focus, wcag-2.4.7, tab-strip]
requires: [33-12]
provides: [opposite-arrow focus handoff in GroupTabStrip]
affects: [src/features/groups/GroupTabStrip.tsx]
key-files:
  modified:
    - src/features/groups/GroupTabStrip.tsx
    - src/features/groups/__tests__/GroupTabStrip.test.tsx
    - .planning/phases/33-polish-verification/33-UI-SPEC.md
requirements: [GQA-02]
metrics:
  completed: 2026-10-13
---

# Phase 33 Plan 13: Overflow-arrow focus handoff Summary

When a focused overflow arrow vanishes at a scroll end while the strip still overflows, focus now moves to the opposite arrow (via an `arrowHandoff` state and a post-commit layout effect). The active-tab fallback applies only when the strip stops overflowing.

## Tasks

| Task | Result | Commit |
|------|--------|--------|
| 1 (RED tests) + 2 (GREEN fix + UI-SPEC) | Done | 41e1667 |

## Deviations from Plan

**[Rule 3 - Blocking] RED and GREEN committed together.** The repo pre-commit hook runs the full frontend test suite and `tsc`, so a standalone failing `test(33-13)` commit was rejected and `--no-verify` was not used. RED was observed locally: the three new tests (right-end handoff, left-end handoff, opposite-arrow preventScroll) failed against the 33-12 code, with 35 of 38 passing. After the fix all 568 tests in `src/features/groups` pass. Biome and tsc are clean.

Also replaced `.at(-1)` with index access, because the tsc lib target lacks `Array.prototype.at`.

Environment note: the worktree had no `node_modules`, so an untracked symlink to the main repo's was used. It was not committed.

## Known Stubs
None.

## Self-Check: PASSED
Commit 41e1667 exists. The three modified files are in that commit.
