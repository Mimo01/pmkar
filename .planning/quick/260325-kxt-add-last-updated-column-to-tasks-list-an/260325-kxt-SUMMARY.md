---
phase: quick
plan: 260325-kxt
type: summary
status: complete
date: 2026-03-25
---

# Quick Task 260325-kxt: Add last updated column to tasks list

## What was done

### Task 1: Enhanced TicketCard with prominent last-updated display
- Added a dedicated "Updated" line (line 3) to each ticket card showing both relative time and formatted timestamp (e.g. "2 hours ago — Mar 25, 2026, 2:30 PM")
- Uses Clock icon from lucide-react for visual indicator
- Moved the relative time from the small muted corner position to a prominent dedicated line between summary and metadata

### Task 2: Extended search filter to match updated dates
- Search input now matches against ticket key, assignee name, relative time, and formatted timestamp in all three pages (TicketListPage, LinkedTicketsPage, IgnoredTicketsPage)
- Updated search placeholder to reflect broader matching: "Filter by key, assignee, date..."
- Updated both en.json and sk.json translations

## Files modified
- `src/features/tickets/TicketCard.tsx` — prominent last-updated line with Clock icon
- `src/features/tickets/TicketListPage.tsx` — extended search filter to match dates
- `src/features/tickets/LinkedTicketsPage.tsx` — extended search filter to match dates
- `src/features/tickets/IgnoredTicketsPage.tsx` — extended search filter to match dates
- `src/i18n/locales/en.json` — updated search placeholder
- `src/i18n/locales/sk.json` — updated search placeholder
- `src/features/tickets/__tests__/TicketFilterBar.test.tsx` — updated placeholder text in tests

## Verification
- TypeScript: `npx tsc --noEmit` passes clean
- Tests: All 14 TicketFilterBar tests pass. 2 pre-existing test failures in unrelated files (AuditLogPage, CopyPreviewModal)
