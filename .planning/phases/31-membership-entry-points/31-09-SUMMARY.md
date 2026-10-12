---
phase: 31-membership-entry-points
plan: 09
subsystem: ui
tags: [react, zustand, select-mode, groups, vitest]
requires:
  - phase: 31-membership-entry-points
    provides: useListSelection, SelectionBar, TicketCard select props, NavigationContext, DetailGroupsRow
provides:
  - Select mode and SelectionBar on New, Dismissed and Linked lists
  - GMEM-01 / D-20 membership regression tests
  - App-level tests for tab-change clearing (D-14) and detail chip navigation (D-06)
affects: [31-membership-entry-points]
tech-stack:
  added: []
  patterns: [shared test-case factory for core list selection tests]
key-files:
  created:
    - src/features/groups/__tests__/membershipRegression.test.tsx
    - src/features/tickets/__tests__/coreListSelectionCases.tsx
  modified:
    - src/features/tickets/TicketListPage.tsx
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/features/tickets/LinkedTicketsPage.tsx
    - src/features/tickets/TicketListPage.test.tsx
    - src/features/tickets/IgnoredTicketsPage.test.tsx
    - src/features/tickets/__tests__/LinkedTicketsPage.test.tsx
    - src/__tests__/App.test.tsx
key-decisions:
  - "SelectionBar on TicketListPage is an unconditional sibling outside the hasTickets && !isLoading block so its live region stays mounted during refetch"
  - "Shared defineCoreSelectionCases helper avoids triplicating select/bulk-add tests across the three pages"
requirements-completed: [GMEM-01, GMEM-04, GMEM-05, GMEM-06, GMEM-07]
duration: 35min
completed: 2026-10-12
---

# Phase 31 Plan 09: Core list selection and membership regression Summary

Select mode, shift-range selection and atomic bulk "Add to group" on the New, Dismissed and Linked lists (never Remove), plus regression tests proving membership never alters triage or tab placement.

## Tasks

1. Select mode and SelectionBar on the three core pages (commit d88dd0c).
2. Membership regression, App-level tab-change clearing and detail chip navigation tests (commit 3b09bec).

## Deviations from Plan

None in production code. Notes:
- The base worktree was reset to f415dd1 as instructed by the branch check.
- Plan 31-08 (GroupViewPage wiring, `hideGroupId`) was not yet merged in this worktree, so the App chip-navigation test asserts detail closure via the "Back to tickets" button disappearing rather than the chip button disappearing (the group view card still shows the QA chip until 31-08 lands).
- Added `biome-ignore lint/a11y/noStaticElementInteractions` on the three page wrappers carrying the Esc `onKeyDown` handler (lint gate).
- Full vitest suite green (1371 tests); `tsc --noEmit` clean. Full `npm run lint` has pre-existing errors in unrelated files only (CopyPreview*, AllFieldsSection, tests with `any`); the pre-commit hook passed.

## Known Stubs

None.

## Self-Check: PASSED

Commits d88dd0c and 3b09bec exist; created files verified present.
