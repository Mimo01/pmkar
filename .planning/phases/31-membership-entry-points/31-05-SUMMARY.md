---
phase: 31-membership-entry-points
plan: 05
subsystem: ui
tags: [react, zustand, groups, ticket-card, a11y]
requires: ["31-01", "31-02"]
provides:
  - GroupChipLabel and CardGroupChip (src/features/groups/GroupChip.tsx)
  - GroupChips card chip row (max 2 plus +N, tab order, hide current group)
  - TicketCard restructured with sibling interactive elements and select mode
affects: [31-07]
key-files:
  created:
    - src/features/groups/GroupChip.tsx
    - src/features/groups/GroupChips.tsx
    - src/features/groups/__tests__/GroupChips.test.tsx
    - src/features/tickets/__tests__/TicketCard.test.tsx
  modified:
    - src/features/tickets/TicketCard.tsx
    - src/features/groups/__tests__/GroupViewPage.test.tsx
    - src/features/tickets/TicketListPage.test.tsx
requirements-completed: [GMEM-01, GMEM-04, GMEM-05, GMEM-06]
duration: 20min
completed: 2026-10-12
---

# Phase 31 Plan 05: Card group chips and select-mode TicketCard Summary

Group chips on cards (dot plus neutral name, max 2 plus a "+N" tooltip button) and a TicketCard rebuilt as a div with a stretched primary button, so chips, actionSlot and a select checkbox are non-nested siblings.

## Commits
- 43f89d8: GroupChipLabel, CardGroupChip, GroupChips and tests
- 0ab30ae: TicketCard restructure, TicketCard tests, test lookup fixes

## Decisions
- Shift-key fallback: the `onKeyDown` / `shiftRef` fallback (RESEARCH A1) was NOT needed. Keyboard-synthesised clicks carry `shiftKey` (test `{Shift>}{ }{/Shift}` passes with `e.shiftKey` alone), so it was omitted.
- Content layer is `pointer-events-none`; interactive descendants use `pointer-events-auto relative z-10`.

## Deviations from Plan

**[Rule 3 - Blocking] TicketListPage.test.tsx card click.** The test clicked the summary text, which no longer bubbles to the (now sibling) primary button. Changed to click `getByRole('button', { name: summary })`. Also GroupViewPage `cardFor` now uses `closest<HTMLElement>('[data-testid="ticket-card"]')` and the open-detail click targets the primary button. Other list-page test files needed no changes.

**Lint:** added biome-ignore comments for `useSemanticElements` (role=checkbox on a button, per plan) and the test wrapper / actionSlot stopPropagation spans.

## Verification
`npx vitest run src/features` (1158 tests) passes, `npx tsc --noEmit` clean, biome has no errors. TDD note: Task 1 tests passed on first run after implementation was written alongside; no separate RED commit.

## Known Stubs
None.

## Self-Check: PASSED
