---
phase: 31-membership-entry-points
fixed_at: 2026-10-12T00:00:00Z
review_path: .planning/phases/31-membership-entry-points/31-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 31: Code Review Fix Report

**Fixed at:** 2026-10-12T00:00:00Z
**Source review:** .planning/phases/31-membership-entry-points/31-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (Critical + Warning)
- Fixed: 4
- Skipped: 0

Verification: Biome, `tsc --noEmit` and `vitest run src/features` (96 files, 1274 tests) all passed after the last fix. The pre-commit hook passed on every commit.

## Fixed Issues

### WR-01: "Changed" badge tooltip on ticket cards no longer opens (regression)

**Files modified:** `src/features/tickets/TicketCard.tsx`, `src/features/tickets/__tests__/TicketCard.test.tsx`
**Commit:** 0544ac3
**Applied fix:** Added `pointer-events-auto relative z-10` to the badge's `TooltipTrigger` span, so hovering it opens the tooltip again. Added a test that hovers the badge and checks the tooltip content.

The badge is still not keyboard-focusable. `tabIndex={0}` on the span fails Biome's `noNoninteractiveTabindex` rule, and the badge wasn't focusable before phase 31 either, so this only fixes the hover regression. jsdom doesn't compute Tailwind `pointer-events`, so the new test guards the tooltip content but can't catch this exact regression. Check hover by hand.

### WR-02: Escape in the assignee autocomplete also exits select mode and wipes the selection

**Files modified:** `src/features/tickets/TicketFilterBar.tsx`, `src/features/tickets/__tests__/TicketFilterBar.test.tsx`
**Commit:** 3194198
**Applied fix:** `handleAssigneeKeyDown` now calls `e.preventDefault()` on Escape. `useListSelection.handleKeyDown` already skips events where `defaultPrevented` is set. The existing Escape test now also checks that the event was prevented.

### WR-03: New-tab selection bar stays usable while the card list is hidden during a refresh

**Files modified:** `src/features/groups/SelectionBar.tsx`, `src/features/tickets/TicketListPage.tsx`, `src/features/tickets/TicketListPage.test.tsx`
**Commit:** 55956c9
**Status:** fixed: requires human verification
**Applied fix:** I changed the approach from the review. Wrapping `<SelectionBar>` in `hasTickets && !isLoading` broke the existing test "keeps the selection bar live region mounted while loading". The UI-SPEC also requires the live region to be "always mounted". Instead:
- `SelectionBar` has a new `actionsDisabled` prop. It disables the "Add to group" and "Remove from group" buttons, forces their popovers closed, and guards `handleRemove`. The count, the live region and Clear keep working.
- `TicketListPage` passes `actionsDisabled={isLoading}`.
- `selectDisabled` is now `(sortedCandidates.length === 0 || isLoading) && !sel.selectMode`.
- The loading test now also checks that "Add to group" is disabled.

The selection is kept during a refresh and pruned once the new results arrive, as before.

### WR-04: In select mode the card overlay button toggles selection but doesn't expose selected/not-selected state

**Files modified:** `src/features/tickets/TicketCard.tsx`, `src/features/tickets/__tests__/TicketCard.test.tsx`
**Commit:** ae64ce2
**Status:** fixed: requires human verification
**Applied fix:** I changed the approach from the review. Removing the overlay from the tab order and accessibility tree (`tabIndex=-1` and `aria-hidden`) would break Space and Shift+Space keyboard range selection on the focused card. Plan 31-05 and RESEARCH A1 require that, and it's covered by tests. Instead, in select mode the overlay now has `aria-pressed={!!selected}`, so screen readers announce whether the ticket is selected. Outside select mode the attribute isn't rendered. Added a test for both states.

Select mode still has two tab stops per card (the overlay and the checkbox). If that's unwanted, the alternative is to move keyboard range selection onto the checkbox and then hide the overlay as the review suggested.

---

_Fixed: 2026-10-12T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
