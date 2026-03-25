---
phase: quick-260325-ppv
plan: 01
subsystem: tickets-ui
tags: [ui, components, consistency, status, priority]
dependency_graph:
  requires: []
  provides: [StatusBadge, PriorityIcon shared components]
  affects: [TicketCard, TicketDetailPage, TicketDetailPanel, CopyPreviewModal, CopyPreviewPage]
tech_stack:
  added: []
  patterns: [shared-component-extraction, lucide-react-icons]
key_files:
  created:
    - src/features/tickets/StatusBadge.tsx
    - src/features/tickets/PriorityIcon.tsx
  modified:
    - src/features/tickets/TicketCard.tsx
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/TicketDetailPanel.tsx
    - src/features/tickets/CopyPreviewModal.tsx
    - src/features/tickets/CopyPreviewPage.tsx
decisions:
  - SourceFieldRow updated to accept optional children for rendering badge/icon components alongside existing string value usage
  - StatusBadge uses plain span (not shadcn Badge) for flat Jira-style colored badges without border styling
  - PriorityIcon uses inline style for icon color (not Tailwind class) to support arbitrary hex values matching Jira spec
metrics:
  duration: 3 min
  completed: 2026-03-25
  tasks_completed: 2
  files_modified: 7
---

# Quick Task 260325-ppv: Consistently Display Status and Priority Summary

**One-liner:** Extracted StatusBadge (flat color-coded span) and PriorityIcon (Jira-style directional arrows) as shared components, replacing five different inline implementations across the tickets feature.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create shared StatusBadge and PriorityIcon components | ea5b9b1 | StatusBadge.tsx, PriorityIcon.tsx |
| 2 | Replace all status/priority displays with shared components | 3a899c7 | TicketCard.tsx, TicketDetailPage.tsx, TicketDetailPanel.tsx, CopyPreviewModal.tsx, CopyPreviewPage.tsx |

## What Was Built

**StatusBadge** (`src/features/tickets/StatusBadge.tsx`):
- Flat inline span with rounded-full shape and color-coded background
- Green for done/resolved/closed, blue for in-progress/review, red for blocked, neutral for to-do/default
- No border styling (unlike shadcn Badge) to match Jira's flat colored badge visual

**PriorityIcon** (`src/features/tickets/PriorityIcon.tsx`):
- Jira-style directional arrows using lucide-react icons
- ChevronsUp (red) for highest/critical, ChevronUp (orange) for high, Equal (yellow) for medium, ChevronDown (blue) for low, ChevronsDown (light blue) for lowest
- Accepts `size` prop (sm=3.5/md=4) and `showLabel` prop

**Consumer updates:**
- TicketCard: removed inline StatusDot/PriorityDot, now uses shared components
- TicketDetailPage: removed local StatusBadge function, imports shared StatusBadge + PriorityIcon
- TicketDetailPanel: replaced plain gray spans with StatusBadge + PriorityIcon
- CopyPreviewModal + CopyPreviewPage: extended SourceFieldRow to accept React children, replaced plain string display with StatusBadge/PriorityIcon via children pattern

## Verification

- `npx tsc --noEmit` passes with no errors
- `npx vitest run` 389 tests pass across 40 test files
- 5 files import `StatusBadge` from `./StatusBadge`
- 5 files import `PriorityIcon` from `./PriorityIcon`
- No `StatusDot` or `PriorityDot` inline components remain in tickets feature

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/features/tickets/StatusBadge.tsx` exists
- `src/features/tickets/PriorityIcon.tsx` exists
- Commits ea5b9b1 and 3a899c7 exist
- All 5 consumer files verified importing shared components
