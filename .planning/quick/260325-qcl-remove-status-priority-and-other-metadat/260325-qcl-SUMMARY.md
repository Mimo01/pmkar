---
phase: quick-260325-qcl
plan: 01
subsystem: ui
tags: [react, ticket-detail, header, cleanup]

requires: []
provides:
  - "Simplified TicketDetailPage header — summary + action buttons only"
  - "Simplified TicketDetailPanel header — issue key + summary + action buttons only"
affects: [tickets, detail-views]

tech-stack:
  added: []
  patterns:
    - "Metadata shown once in OverviewTab field grid, not duplicated in header"

key-files:
  created: []
  modified:
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/TicketDetailPanel.tsx

key-decisions:
  - "Status, priority, assignee, reporter remain in OverviewTab — removed only from header to eliminate duplication"
  - "Outer ml-auto flex wrapper in TicketDetailPanel removed; action buttons became direct children of the mt-2 flex row"

requirements-completed: [QCL-01]

duration: 5min
completed: 2026-03-25
---

# Quick Task 260325-qcl: Remove Duplicate Metadata from Issue Detail Header

**Removed status/priority/assignee/reporter from TicketDetailPage and TicketDetailPanel headers, keeping metadata only in the OverviewTab field grid where it already lived.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-25T19:02:00Z
- **Completed:** 2026-03-25T19:04:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- TicketDetailPage header now shows only the h1 summary and action buttons — no status badge, priority icon, assignee or reporter name
- TicketDetailPanel header now shows only the close button, issue key, summary, and action buttons — no StatusBadge or PriorityIcon
- All 21 tests across both detail components continue to pass (14 in TicketDetailPage, 7 in TicketDetailPanel)

## Task Commits

1. **Task 1: Remove metadata from TicketDetailPage header** - `65a9625` (feat)
2. **Task 2: Remove metadata from TicketDetailPanel header** - `d08d256` (feat)

**Plan metadata:** see final commit below

## Files Created/Modified

- `src/features/tickets/TicketDetailPage.tsx` - Removed metadata div (StatusBadge, PriorityIcon, assignee, reporter), updated h1 margin from mb-2 to mb-6, removed unused imports
- `src/features/tickets/TicketDetailPanel.tsx` - Removed StatusBadge and PriorityIcon from header row, collapsed unnecessary ml-auto wrapper div, removed unused imports

## Decisions Made

- Margin on h1 in TicketDetailPage changed from `mb-2` to `mb-6` to preserve spacing to the action buttons after removing the metadata row that previously supplied the bottom gap
- In TicketDetailPanel the outer `flex items-center gap-2 mt-2` wrapper was retained as-is for the action buttons (removing the inner `ml-auto` sub-wrapper that no longer had a purpose)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

CopyPreviewModal test suite has 16 pre-existing failures unrelated to this task (mock for `fetch_cloud_projects` not returning a Promise). Verified pre-existing by stash-testing without changes. Out of scope per scope boundary rule.

## Next Phase Readiness

Both detail views have clean headers focused on issue identity and actions. OverviewTab remains the single source of truth for status, priority, assignee, and reporter metadata.

---
*Phase: quick-260325-qcl*
*Completed: 2026-03-25*
