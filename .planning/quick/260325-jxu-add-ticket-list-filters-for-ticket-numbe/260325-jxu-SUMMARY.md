---
phase: quick-260325-jxu
plan: "01"
subsystem: tickets
tags: [filters, search, sort, i18n, ui]
dependency_graph:
  requires: []
  provides: [ticket-list-filter-bar]
  affects: [TicketListPage, IgnoredTicketsPage, LinkedTicketsPage]
tech_stack:
  added: []
  patterns: [local-useState-filter, useMemo-filter-sort, shared-filter-component]
key_files:
  created:
    - src/features/tickets/TicketFilterBar.tsx
    - src/features/tickets/__tests__/TicketFilterBar.test.tsx
  modified:
    - src/features/tickets/TicketListPage.tsx
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/features/tickets/LinkedTicketsPage.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - Filter state kept local (useState per page) so it resets on tab switch with no Zustand coupling
  - sort default is 'desc' (newest first) matching pre-existing sort behavior
  - Empty state driven by base list length (not filtered), filter bar shows "0 shown" only when filter produces no results from non-empty list
metrics:
  duration: "12 min"
  completed: "2026-03-25"
  tasks: 2
  files: 7
---

# Phase quick-260325-jxu Plan 01: Ticket List Filters Summary

**One-liner:** Client-side text search (key + assignee) and sort-direction toggle on all three ticket tabs via shared TicketFilterBar component.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create TicketFilterBar and wire to all three pages | ba5dc1e | TicketFilterBar.tsx, TicketListPage.tsx, IgnoredTicketsPage.tsx, LinkedTicketsPage.tsx, en.json, sk.json |
| 2 | Add TicketFilterBar unit and integration tests | 959c2ab | TicketFilterBar.test.tsx |

## What Was Built

A shared `TicketFilterBar` component renders above the ticket card list on all three tabs (New, Ignored, Already Linked). It provides:

- A text search input that filters by ticket key (`PROJ-123`) or assignee `displayName` — case-insensitive, partial match via `.toLowerCase().includes()`
- A sort toggle button that switches between newest-first (`desc`) and oldest-first (`asc`) by `fields.updated`
- A result count span showing how many tickets are currently shown
- A clear (X) button that appears only when search text is non-empty

Filter state is local `useState` in each page component — intentionally not persisted to Zustand, so it resets on tab switch.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/features/tickets/TicketFilterBar.tsx` exists
- `src/features/tickets/__tests__/TicketFilterBar.test.tsx` exists
- Commits ba5dc1e and 959c2ab present in git log
- TypeScript: 0 errors
- Tests: 41 files, 401 tests — all pass
