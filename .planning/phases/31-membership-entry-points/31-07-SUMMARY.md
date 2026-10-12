---
phase: 31-membership-entry-points
plan: 07
subsystem: ui
tags: [react, radix-popover, zustand, groups, ticket-detail]
requires:
  - phase: 31-01
    provides: groups.picker/chip i18n keys
  - phase: 31-02
    provides: useGroupNavigation
  - phase: 31-04
    provides: GroupPicker checkbox mode, membershipErrorKey
  - phase: 31-05
    provides: GroupChipLabel
provides:
  - detailToTicket / resolveTicketForIssue
  - DetailGroupsRow (Groups button, picker, chips with confirmed x remove)
  - TicketDetailPage Groups row and Escape guard
affects: [31-09]
tech-stack:
  added: []
  patterns: [defaultPrevented Escape guard for Radix popovers, afterUnmount focus idiom]
key-files:
  created:
    - src/features/groups/detailToTicket.ts
    - src/features/groups/DetailGroupsRow.tsx
    - src/features/groups/__tests__/detailToTicket.test.ts
    - src/features/groups/__tests__/DetailGroupsRow.test.tsx
  modified:
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/__tests__/TicketDetailPage.test.tsx
key-decisions:
  - "Escape guard: the plain !e.defaultPrevented path was sufficient (Radix DismissableLayer marks Escape handled in its capture listener); the closest('[data-radix-popper-content-wrapper]') fallback was NOT needed"
  - "After a successful chip remove, focus is set on the Groups button via afterUnmount directly in handleRemove (the chip's x trigger is unmounted, so onCloseAutoFocus is unreliable)"
requirements-completed: [GMEM-02, GMEM-03, GMEM-05, GMEM-09]
duration: 20min
completed: 2026-10-12
---

# Phase 31 Plan 07: Detail Groups Row Summary

Ticket detail now has a Groups row (labelled "Groups" button with checkbox picker plus chips with confirmed x remove and name navigation), with an Escape guard so Esc in a popover no longer leaves the detail view.

## Tasks
1. detailToTicket + resolveTicketForIssue - 79e5c8b
2. DetailGroupsRow + tests (9 cases) - c74a0a2
3. TicketDetailPage integration + Esc guard + 4 tests - see git log (feat(31-07) integrate)

## Deviations from Plan
- The Escape-guard tests were verified to fail without the guard (2 of 4 fail when `!e.defaultPrevented` is removed), so the tests are meaningful.
- `DetailGroupsRow` wraps its content in its own `TooltipProvider` because GroupChipLabel uses Tooltip and the row sits outside the page's action-button TooltipProvider. (Rule 3, blocking.)
- Otherwise executed as written. TicketDetailPanel.tsx and App.test.tsx untouched.

## Verification
`npx vitest run src/features/groups src/features/tickets` 868 passed; `npx tsc --noEmit` clean; Biome clean on changed files.

## Known Stubs
None.

## Self-Check: PASSED
