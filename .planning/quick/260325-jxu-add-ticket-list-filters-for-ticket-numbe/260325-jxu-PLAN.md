---
phase: quick-260325-jxu
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tickets/TicketListPage.tsx
  - src/features/tickets/TicketListPage.test.tsx
  - src/features/tickets/IgnoredTicketsPage.tsx
  - src/features/tickets/LinkedTicketsPage.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
autonomous: true
requirements: [QUICK-FILTERS]
must_haves:
  truths:
    - "User can filter tickets by ticket number (key) using a text input"
    - "User can filter tickets by assignee name using a text input"
    - "User can sort tickets by last updated date (ascending or descending)"
    - "Filters apply across all three tabs (New, Ignored, Linked)"
    - "Clearing the filter text shows all tickets again"
  artifacts:
    - path: "src/features/tickets/TicketListPage.tsx"
      provides: "Filter bar with search input and sort toggle"
    - path: "src/features/tickets/IgnoredTicketsPage.tsx"
      provides: "Same filter bar on ignored tab"
    - path: "src/features/tickets/LinkedTicketsPage.tsx"
      provides: "Same filter bar on linked tab"
  key_links:
    - from: "filter state"
      to: "useMemo filtering"
      via: "useState in each page component filters sortedCandidates"
      pattern: "useState.*filter"
---

<objective>
Add client-side filters to the ticket list views: a text search that matches ticket number (key) and assignee name, plus a sort-direction toggle for the "last updated" column. Apply consistently across all three ticket tabs (New, Ignored, Already Linked).

Purpose: Users with many tickets need to quickly find specific ones by key or assignee without scrolling.
Output: Filter bar component rendered above ticket card lists on all three pages.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/tickets/TicketListPage.tsx
@src/features/tickets/TicketCard.tsx
@src/features/tickets/IgnoredTicketsPage.tsx
@src/features/tickets/LinkedTicketsPage.tsx
@src/features/tickets/ticketStore.ts
@src/features/tickets/types.ts
@src/i18n/locales/en.json

<interfaces>
<!-- Key types the executor needs -->

From src/features/tickets/types.ts:
```typescript
export interface JiraTicket {
  id: string;
  key: string;  // e.g. "PROJ-123" — filter target
  fields: {
    summary: string;
    status: JiraStatus;
    priority: JiraPriority;
    assignee: JiraUser | null;  // filter target: displayName
    updated: string;  // ISO 8601 — sort target
  };
}

export interface JiraUser {
  name?: string;
  accountId?: string;
  displayName: string;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create shared TicketFilterBar component and add filters to all three ticket list pages</name>
  <files>
    src/features/tickets/TicketFilterBar.tsx
    src/features/tickets/TicketListPage.tsx
    src/features/tickets/IgnoredTicketsPage.tsx
    src/features/tickets/LinkedTicketsPage.tsx
    src/i18n/locales/en.json
    src/i18n/locales/sk.json
  </files>
  <action>
    1. Create `src/features/tickets/TicketFilterBar.tsx` — a shared filter bar component:
       - Props: `{ searchText: string; onSearchChange: (v: string) => void; sortDirection: 'asc' | 'desc'; onToggleSort: () => void; resultCount: number; }`
       - Layout: A horizontal bar with `border-b border-brand-border px-4 py-2 flex items-center gap-3`
       - Search input: Use a plain `<input>` with Lucide `Search` icon (w-3.5 h-3.5) as left decoration, placeholder from i18n key `tickets.filter.placeholder`. Style: `bg-brand-surface text-sm text-brand-text rounded-md border border-brand-border px-3 py-1.5 pl-8 flex-1 max-w-xs`. Add a small Lucide `X` (w-3.5 h-3.5) button to clear when text is non-empty.
       - Sort toggle: A button showing `ArrowUpDown` (lucide) icon with text from i18n `tickets.filter.sortUpdated`. On click calls onToggleSort. Show `ArrowUp` when asc, `ArrowDown` when desc to indicate current direction.
       - Result count: `<span>` showing `resultCount` with i18n key `tickets.filter.showing` ("{{count}} shown").
       - Use `aria-label` on search input from i18n `tickets.filter.searchLabel`.

    2. Update `TicketListPage.tsx`:
       - Add `useState` for `searchText` (string, default '') and `sortDirection` ('asc' | 'desc', default 'desc').
       - Render `<TicketFilterBar>` between the FetchBar and the card list.
       - Update `sortedCandidates` useMemo: first filter candidateTickets by searchText (case-insensitive match on `ticket.key` OR `ticket.fields.assignee?.displayName`), then sort by `fields.updated` respecting sortDirection.
       - Pass `resultCount={sortedCandidates.length}` to filter bar.

    3. Update `IgnoredTicketsPage.tsx`:
       - Add same `useState` for searchText and sortDirection.
       - Render `<TicketFilterBar>` above the card list inside the main div.
       - Apply same filter logic to `sorted` useMemo: filter ignoredTickets by searchText on key/assignee, then sort by updated with sortDirection.

    4. Update `LinkedTicketsPage.tsx`:
       - Same pattern as IgnoredTicketsPage: add filter state, render TicketFilterBar, apply filter+sort to `sorted` useMemo.

    5. Add i18n keys to `en.json`:
       - `"tickets.filter.placeholder": "Filter by key or assignee..."`
       - `"tickets.filter.sortUpdated": "Updated"`
       - `"tickets.filter.showing": "{{count}} shown"`
       - `"tickets.filter.searchLabel": "Filter tickets by key or assignee"`
       - `"tickets.filter.clearSearch": "Clear search"`

    6. Add corresponding Slovak translations to `sk.json`:
       - `"tickets.filter.placeholder": "Filtrovať podľa kľúča alebo priradenia..."`
       - `"tickets.filter.sortUpdated": "Aktualizované"`
       - `"tickets.filter.showing": "{{count}} zobrazených"`
       - `"tickets.filter.searchLabel": "Filtrovať tikety podľa kľúča alebo priradenia"`
       - `"tickets.filter.clearSearch": "Vymazať vyhľadávanie"`

    Important notes:
    - Keep filter state LOCAL to each page component (useState, not Zustand) — filter text should reset when switching tabs, and there is no need to persist it.
    - The search should be case-insensitive and match partial strings (use `.toLowerCase().includes()`).
    - When searchText is empty, show all tickets (no filtering).
    - Empty state should still show when there are zero tickets total (before filtering). Only show "0 shown" in filter bar when filtering produces zero results from a non-empty list.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit && npx vitest run --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    - All three ticket tabs show a filter bar with search input and sort toggle
    - Typing a ticket key (e.g. "PROJ-1") filters the list to matching tickets
    - Typing an assignee name filters to tickets assigned to that person
    - Sort toggle switches between newest-first and oldest-first
    - Clear button resets search text and shows all tickets
    - TypeScript compiles without errors, existing tests pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Add tests for TicketFilterBar and filter behavior</name>
  <files>
    src/features/tickets/__tests__/TicketFilterBar.test.tsx
  </files>
  <action>
    Create `src/features/tickets/__tests__/TicketFilterBar.test.tsx` with tests:

    1. **TicketFilterBar unit tests:**
       - Renders search input with correct placeholder
       - Calls onSearchChange when typing in search input
       - Shows clear button only when searchText is non-empty
       - Calls onSearchChange('') when clear button clicked
       - Calls onToggleSort when sort button clicked
       - Displays resultCount in "shown" text

    2. **Filter integration tests (using ticketStore):**
       - Set up ticketStore with 3-4 mock tickets with different keys (PROJ-1, PROJ-2, OTHER-1) and assignees (Alice, Bob)
       - Import and render TicketListPage
       - Verify all tickets shown initially
       - Type "PROJ-1" in search — verify only PROJ-1 ticket card visible
       - Type "Alice" — verify only Alice's tickets visible
       - Clear search — verify all tickets visible again
       - Click sort toggle — verify order reverses (check first/last card keys)

    Use the same testing patterns as existing test files (vitest, @testing-library/react, mock invoke).
    Mock `@tauri-apps/api/core` invoke with vi.mock returning appropriate data.
    Use `vi.mock('react-i18next', ...)` returning passthrough t function like existing tests.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx vitest run src/features/tickets/__tests__/TicketFilterBar.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    - All TicketFilterBar unit tests pass
    - Filter integration tests confirm search by key and assignee works
    - Sort direction toggle test passes
    - Clear search test passes
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` — no TypeScript errors
- `npx vitest run` — all tests pass including new filter tests
- Filter bar renders on all three tabs (New, Ignored, Linked)
</verification>

<success_criteria>
- Ticket list pages have a filter bar with text search and sort toggle
- Search filters by ticket key (e.g. "PROJ-123") and assignee name
- Sort toggles between newest-first and oldest-first by updated date
- Filter bar appears consistently on all three ticket tabs
- All existing tests continue to pass
- New filter behavior has test coverage
</success_criteria>

<output>
After completion, create `.planning/quick/260325-jxu-add-ticket-list-filters-for-ticket-numbe/260325-jxu-SUMMARY.md`
</output>
