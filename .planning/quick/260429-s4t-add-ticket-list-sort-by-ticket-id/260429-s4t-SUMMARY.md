---
quick_id: 260429-s4t
slug: add-ticket-list-sort-by-ticket-id
status: complete
date: 2026-04-29
commit: d6dadcd
---

# Quick Task 260429-s4t: Add ticket list sort by ticket ID

## What was done

Replaced the single "Updated" sort toggle button in the ticket list filter bar with two controls:
1. A `<select>` to choose the sort field: **Updated** or **Ticket ID**
2. A direction arrow button (↓ / ↑) to toggle asc/desc

Ticket ID sort parses the numeric suffix from Jira keys (e.g. `PROJ-123` → 123) for correct numeric ordering. Mixed-project keys sort by project prefix first, then numerically.

## Files changed

- `src/features/tickets/TicketFilterBar.tsx` — new `sortField`/`onSortFieldChange` props; `<select>` + direction button
- `src/features/tickets/TicketListPage.tsx` — `sortField` state; numeric key sort logic
- `src/i18n/locales/en.json` — `sortKey`, `sortBy`, `sortAsc`, `sortDesc` keys
- `src/i18n/locales/sk.json` — Slovak translations for the same keys
- `src/features/tickets/__tests__/TicketFilterBar.test.tsx` — updated for new props; new sort-field test

## Tests

25/25 TicketFilterBar tests pass. CopyPreviewModal failures are pre-existing and unrelated.
