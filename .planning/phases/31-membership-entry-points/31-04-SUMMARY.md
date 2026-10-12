---
phase: 31-membership-entry-points
plan: 04
subsystem: ui
tags: [react, zustand, radix-popover, combobox, i18n]
requires:
  - phase: 31-01
    provides: groups.picker.* / groups.toast.* / groups.error.membership i18n keys
provides:
  - GroupPicker (checkbox and list modes)
  - addIssuesWithFeedback, removeIssuesWithFeedback, membershipErrorKey
affects: [31-06, 31-07]
tech-stack:
  added: []
  patterns: [non-optimistic store-reflected checkbox state, per-group in-flight guard, ok-result verified against store]
key-files:
  created:
    - src/features/groups/membershipActions.ts
    - src/features/groups/GroupPicker.tsx
    - src/features/groups/__tests__/membershipActions.test.ts
    - src/features/groups/__tests__/GroupPicker.test.tsx
  modified: []
key-decisions:
  - "Space toggles only when the search is empty (RESEARCH A5 accepted deviation), commented in code"
  - "Truncated names use a native title attribute instead of a Tooltip inside the listbox"
  - "Disabled Create row (too_long/reserved) coexists with the no-match line when no groups match"
requirements-completed: [GMEM-02, GMEM-03, GMEM-07, GMEM-09]
duration: 20min
completed: 2026-10-12
---

# Phase 31 Plan 04: GroupPicker and membership feedback helpers Summary

**Shared Radix-popover GroupPicker (checkbox mode for detail, atomic plain-list mode for bulk) with inline validated Create row, plus single-call add/remove helpers that toast real counts.**

## Accomplishments
- `membershipActions.ts`: one atomic store call per action, toasts added / added-with-skipped / all-already-in (info, counted as success) / removed, error mapping via `membershipErrorKey`.
- `GroupPicker.tsx`: autofocused combobox, listbox in tab order, case- and diacritic-insensitive search, clamped Arrow/Home/End, Enter and (empty-search) Space activation, Esc via Radix. Checkbox state comes only from the store; per-group in-flight guard; an ok result that the store does not reflect shows the membership error (Pitfall 6).
- Create row: validated with `validateGroupName`, disabled with inline message for too_long/reserved, hidden for empty/duplicate (duplicate makes the match active). Creates with `pickDefaultColor`, never navigates, keeps the group if the follow-up add fails; double-submit guarded.
- List mode: single `addToGroup` for all tickets, closes the popover, `onAddSucceeded` only on success.
- 32 tests across both files (9 + 23) pass; `tsc --noEmit` clean; biome clean on the groups feature.

## Task Commits
1. Task 1 helpers: 075a4a9
2. Tasks 2 and 3 (GroupPicker plus tests): committed together as they share one file and test file (the plan's Task 3 extends Task 2's file); see `git log` for the `feat(31-04): add shared GroupPicker` commit.

## Deviations from Plan
- Tasks 2 and 3 landed in a single commit rather than two (same files, written in one pass). No behavioral deviation.
- Worktree had no `node_modules`; a temporary symlink to the main repo's was used for testing and removed before return.

## Issues Encountered
- The pre-commit hook runs the whole repo lint plus cargo tests (about 2 minutes per commit). Biome reports pre-existing `useLiteralKeys` findings in `CopyPreviewModal.tsx`/`CopyPreviewPage.tsx`; they are out of scope and did not block the commit.

## Known Stubs
None.

## Self-Check: PASSED
