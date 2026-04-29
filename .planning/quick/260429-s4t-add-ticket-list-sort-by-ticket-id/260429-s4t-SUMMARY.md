---
quick_id: 260429-s4t
slug: add-ticket-list-sort-by-ticket-id
status: complete
date: 2026-04-29
commit: 2b6c87b
---

# Quick Task 260429-s4t: Ticket list sort options

## What was done

Replaced the single "Updated" sort toggle button in the ticket list filter bar with a full sort control:
1. A `<select>` to choose the sort field (6 options)
2. A direction arrow button (↓ / ↑) to toggle asc/desc

### Sort options

| Field | Logic |
|-------|-------|
| Updated | By last-updated timestamp |
| Created | By creation date (falls back to Updated if absent) |
| Ticket ID | Numeric by key suffix — PROJ-9 before PROJ-100 |
| Priority | By Jira priority ID (1=Highest → 5=Lowest) |
| Status | Alphabetically by status name |
| Assignee | Alphabetically by assignee display name |

## Files changed

- `src/features/tickets/TicketFilterBar.tsx` — `sortField` prop expanded to 6-value union; `<select>` with all options
- `src/features/tickets/TicketListPage.tsx` — sort logic for all 6 fields
- `src/i18n/locales/en.json` — sortCreated, sortPriority, sortStatus, sortAssignee keys
- `src/i18n/locales/sk.json` — Slovak translations for the same keys
- `src/features/tickets/__tests__/TicketFilterBar.test.tsx` — updated for new props

## Tests

25/25 TicketFilterBar tests pass.
