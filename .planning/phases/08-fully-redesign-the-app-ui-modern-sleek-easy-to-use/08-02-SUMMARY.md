---
phase: 08-fully-redesign-the-app-ui-modern-sleek-easy-to-use
plan: 02
subsystem: ui
tags: [react, typescript, tailwind, shadcn, tickets, card-layout]

# Dependency graph
requires:
  - phase: 08-01
    provides: shadcn/ui skeleton component, AppShell redesign, i18n keys for empty states
provides:
  - Shared TicketCard component with 3-line compact layout, StatusDot, PriorityDot, actionSlot
  - SkeletonCards loading component using shadcn Skeleton
  - TicketListPage converted from table to card list with skeleton loading and empty states
  - IgnoredTicketsPage converted from table to card list with Restore actionSlot
  - LinkedTicketsPage converted from table to card list with linked key badge actionSlot
  - TicketTable deprecated (retained for reference)
affects: [08-03, 08-04, 08-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared TicketCard component reused across all three list tabs (New, Ignored, Linked)"
    - "actionSlot prop pattern for tab-specific card actions without forking the component"
    - "Cards flush with only border-b dividers, no shadow, hover:bg-brand-surface-hover 150ms"

key-files:
  created:
    - src/features/tickets/TicketCard.tsx
  modified:
    - src/features/tickets/TicketListPage.tsx
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/features/tickets/LinkedTicketsPage.tsx
    - src/features/tickets/TicketTable.tsx
    - src/features/tickets/TicketListPage.test.tsx
    - src/features/tickets/IgnoredTicketsPage.test.tsx

key-decisions:
  - "actionSlot prop on TicketCard enables tab-specific actions (Restore button, linked key badge) without component forking"
  - "TicketTable retained as deprecated reference rather than deleted to preserve sort/compare logic for future use if needed"
  - "Tests updated to query by card content (ticket key text, summary text) instead of table elements"

patterns-established:
  - "TicketCard: 3-line compact card with key+time / summary / status+priority+assignee"
  - "StatusDot and PriorityDot as inline helper components inside TicketCard file"
  - "SkeletonCards uses shadcn Skeleton, count=3 default matching UI-SPEC"
  - "List pages use flex-1 flex flex-col overflow-hidden without fixed height calc"

requirements-completed: [UI-02, UI-07]

# Metrics
duration: 3min
completed: 2026-03-24
---

# Phase 08 Plan 02: Card Layout Conversion Summary

**Shared TicketCard component (3-line compact, statusDot, priorityDot, actionSlot) replacing tables across all three ticket list tabs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T00:01:02Z
- **Completed:** 2026-03-24T00:04:00Z
- **Tasks:** 2
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- Created TicketCard with compact 3-line layout: key+time row, summary row, status+priority+assignee row
- StatusDot and PriorityDot helpers with correct UI-SPEC color mappings (In Progress=blue, Done=green, Blocked=red; Highest=red, High=orange, Medium=yellow, Low=blue)
- SkeletonCards loading component (3 placeholder shapes) replacing table skeleton rows
- TicketListPage fully converted: removed TicketTable/TicketDetailPanel/SpinnerIcon, added Loader2 spinner, card list with sortedCandidates (updated DESC), new empty state with .heading/.body i18n keys
- IgnoredTicketsPage converted: table replaced with TicketCard list, Restore button as actionSlot
- LinkedTicketsPage converted: table replaced with TicketCard list, linked key Badge as actionSlot
- Tests updated to match card DOM (ticket key text, summary text queries replace table element assertions)

## Task Commits

1. **Task 1: Create TicketCard component** - `4c8e68f` (feat)
2. **Task 2: Convert list pages from table to card layout** - `da52191` (feat)

## Files Created/Modified

- `src/features/tickets/TicketCard.tsx` - Shared card component, StatusDot, PriorityDot, SkeletonCards
- `src/features/tickets/TicketListPage.tsx` - Converted from table+side panel to card list
- `src/features/tickets/IgnoredTicketsPage.tsx` - Converted from table+side panel to card list
- `src/features/tickets/LinkedTicketsPage.tsx` - Converted from table+side panel to card list
- `src/features/tickets/TicketTable.tsx` - Marked deprecated
- `src/features/tickets/TicketListPage.test.tsx` - Updated for card DOM
- `src/features/tickets/IgnoredTicketsPage.test.tsx` - Updated empty state body assertion

## Decisions Made

- Used `actionSlot?: React.ReactNode` prop to allow tab-specific actions without forking TicketCard
- Retained TicketTable with DEPRECATED comment rather than deleting (sort logic may be useful for reference)
- Tests updated to query by card content (text nodes) instead of table roles/headers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TicketCard is ready for use in Plan 03 (full-page detail navigation from App.tsx)
- IgnoredTicketsPage and LinkedTicketsPage remove side panel — App.tsx detail routing (Plan 03) must handle navigation from all three tabs
- All three list pages no longer render TicketDetailPanel — Plan 03 must wire the `selectedTicketKey` store value to show the detail view as a full page

---
*Phase: 08-fully-redesign-the-app-ui-modern-sleek-easy-to-use*
*Completed: 2026-03-24*
