---
phase: quick
plan: 260325-kxt
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tickets/TicketCard.tsx
  - src/features/tickets/TicketListPage.tsx
  - src/features/tickets/LinkedTicketsPage.tsx
  - src/features/tickets/IgnoredTicketsPage.tsx
  - src/features/tickets/TicketFilterBar.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
autonomous: true
requirements: [QUICK-KXT]

must_haves:
  truths:
    - "Each ticket card shows the last updated date/time as a clearly visible, dedicated line (not just a small muted timestamp)"
    - "The search filter matches against formatted updated date strings so users can filter by date"
    - "The assignee filter is properly wired in all three ticket list pages"
    - "Sort by updated still works correctly in all three pages"
  artifacts:
    - path: "src/features/tickets/TicketCard.tsx"
      provides: "Prominent last-updated display on each card"
    - path: "src/features/tickets/TicketListPage.tsx"
      provides: "Updated-date filtering and assignee filter wiring"
  key_links:
    - from: "TicketCard.tsx"
      to: "format.ts"
      via: "formatRelativeTime and formatTimestamp"
      pattern: "formatRelativeTime|formatTimestamp"
---

<objective>
Add a prominent "Last Updated" display to ticket cards and make the filter bar work with updated dates. Also wire the existing but disconnected assignee filter in all three ticket list pages.

Purpose: Users need to quickly see when tickets were last updated and filter/find tickets by their update time.
Output: Enhanced TicketCard with visible updated info, filter matching on dates, assignee filter wired.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/tickets/TicketCard.tsx
@src/features/tickets/TicketFilterBar.tsx
@src/features/tickets/TicketListPage.tsx
@src/features/tickets/LinkedTicketsPage.tsx
@src/features/tickets/IgnoredTicketsPage.tsx
@src/features/tickets/types.ts
@src/lib/format.ts
@src/i18n/locales/en.json
@src/i18n/locales/sk.json

<interfaces>
From src/features/tickets/types.ts:
```typescript
export interface JiraTicket {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: JiraStatus;
    priority: JiraPriority;
    assignee: JiraUser | null;
    updated: string; // ISO 8601
  };
}
```

From src/lib/format.ts:
```typescript
export function formatRelativeTime(iso: string): string;
export function formatTimestamp(iso: string): string;
```

From src/features/tickets/TicketFilterBar.tsx:
```typescript
interface TicketFilterBarProps {
  searchText: string;
  onSearchChange: (v: string) => void;
  assigneeFilter: string;
  onAssigneeChange: (v: string) => void;
  sortDirection: 'asc' | 'desc';
  onToggleSort: () => void;
  resultCount: number;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Enhance TicketCard with prominent last-updated display</name>
  <files>src/features/tickets/TicketCard.tsx, src/i18n/locales/en.json, src/i18n/locales/sk.json</files>
  <action>
Modify TicketCard to make the "last updated" information more prominent:

1. In TicketCard.tsx, add a dedicated line between the summary (line 2) and metadata row (line 3) that shows the updated timestamp more prominently. Currently the relative time is a tiny muted span in the top-right corner next to the key. Instead:
   - Keep the ticket key on line 1 (top-left) with actionSlot on the right
   - Keep summary on line 2
   - Add a new line 3 with a Clock icon (from lucide-react) showing both the relative time AND the formatted date (using `formatTimestamp`). Use `text-xs text-brand-text-secondary` styling with the Clock icon `w-3 h-3` inline. Format: "[relative] -- [formatted date]" e.g. "2 hours ago -- Mar 25, 2026, 2:30 PM"
   - Move status/priority/assignee metadata to line 4

2. Remove the old relative time from the top-right corner (line 62-69 area) since it's now on its own dedicated line.

3. Add i18n key `"tickets.card.updated"` with value `"Updated {{relative}} -- {{date}}"` in en.json and Slovak equivalent `"Aktualizované {{relative}} -- {{date}}"` in sk.json. Place these near the existing tickets.filter keys.

Import `Clock` from lucide-react and `formatTimestamp` from `../../lib/format` (formatRelativeTime is already imported).
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Each ticket card shows a dedicated "Updated" line with both relative time and formatted timestamp, clearly visible between summary and metadata</done>
</task>

<task type="auto">
  <name>Task 2: Wire assignee filter and add updated-date search in all ticket list pages</name>
  <files>src/features/tickets/TicketListPage.tsx, src/features/tickets/LinkedTicketsPage.tsx, src/features/tickets/IgnoredTicketsPage.tsx</files>
  <action>
Fix all three pages to properly wire the assignee filter AND add updated-date matching to the search filter:

**In ALL three pages (TicketListPage, LinkedTicketsPage, IgnoredTicketsPage):**

1. Add `assigneeFilter` state: `const [assigneeFilter, setAssigneeFilter] = useState('');`

2. Pass `assigneeFilter` and `onAssigneeChange={setAssigneeFilter}` to the `<TicketFilterBar>` component (these props exist on TicketFilterBar but are currently not passed by any page).

3. Update the `useMemo` filtering logic to:
   - Also filter by `assigneeFilter` if set: when `assigneeFilter` is non-empty, only include tickets where `ticket.fields.assignee?.displayName` matches (case-insensitive includes)
   - Also match `searchText` against the formatted updated date: add `formatRelativeTime(ticket.fields.updated).toLowerCase().includes(lower)` and `formatTimestamp(ticket.fields.updated).toLowerCase().includes(lower)` to the existing key/assignee filter conditions (using OR logic)
   - Import `formatRelativeTime` and `formatTimestamp` from `../../lib/format` in LinkedTicketsPage and IgnoredTicketsPage (already imported in TicketListPage)

4. Add `assigneeFilter` to the useMemo dependency array in each page.

The filtering chain should be: first apply assigneeFilter (if set), then apply searchText (matching key OR assignee name OR relative updated time OR formatted updated date), then sort.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit 2>&1 | head -30 && npx vitest run --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>All three ticket list pages pass assigneeFilter and onAssigneeChange to TicketFilterBar, search text matches against updated dates, and assignee chip filter works to narrow results by assignee</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors
- `npx vitest run` passes all existing tests
- TicketCard visually shows a dedicated "Updated" line with relative time and formatted date
- Typing a date fragment (e.g. "Mar", "hours ago") in the search field filters tickets accordingly
- Selecting an assignee from the autocomplete shows the chip and filters the ticket list
</verification>

<success_criteria>
- Ticket cards display last-updated prominently as a dedicated line (not hidden in corner)
- Search filter matches against formatted updated dates
- Assignee filter chip works in all three pages (New, Linked, Ignored tabs)
- All existing tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/260325-kxt-add-last-updated-column-to-tasks-list-an/260325-kxt-SUMMARY.md`
</output>
