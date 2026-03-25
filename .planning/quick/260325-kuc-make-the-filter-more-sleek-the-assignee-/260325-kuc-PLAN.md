---
phase: quick
plan: 260325-kuc
type: execute
wave: 1
depends_on: []
files_modified:
  - src/features/tickets/TicketFilterBar.tsx
  - src/features/tickets/TicketListPage.tsx
  - src/features/tickets/IgnoredTicketsPage.tsx
  - src/features/tickets/LinkedTicketsPage.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
autonomous: true
requirements: [QUICK]
must_haves:
  truths:
    - "Typing in assignee field queries real Jira users via search_jira_users"
    - "Selecting a user from dropdown filters tickets by that assignee"
    - "Filter bar looks sleek with separate key search and assignee autocomplete"
    - "Keyboard navigation works in assignee dropdown (arrows, enter, escape)"
  artifacts:
    - path: "src/features/tickets/TicketFilterBar.tsx"
      provides: "Sleek filter bar with assignee autocomplete"
  key_links:
    - from: "src/features/tickets/TicketFilterBar.tsx"
      to: "search_jira_users Tauri command"
      via: "invoke with debounced query"
      pattern: "invoke.*search_jira_users"
    - from: "TicketListPage/IgnoredTicketsPage/LinkedTicketsPage"
      to: "TicketFilterBar"
      via: "assigneeFilter prop for filtering tickets"
---

<objective>
Redesign TicketFilterBar to be sleeker with a dedicated assignee autocomplete that queries real Jira users via the existing `search_jira_users` Tauri command. Split the single search input into a key filter and a separate assignee autocomplete dropdown.

Purpose: Better UX — users can find tickets by specific assignee with real-time user suggestions from Jira instead of manually typing display names.
Output: Updated TicketFilterBar with assignee autocomplete, updated consumer pages with assignee filtering.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/tickets/TicketFilterBar.tsx
@src/features/tickets/TicketListPage.tsx
@src/features/tickets/IgnoredTicketsPage.tsx
@src/features/tickets/LinkedTicketsPage.tsx
@src/features/tickets/types.ts
@src/features/connections/SettingsPage.tsx (lines 140-180 — reference for search_jira_users invoke pattern)
@src/i18n/locales/en.json
@src/i18n/locales/sk.json

<interfaces>
<!-- Existing Tauri command -->
search_jira_users(base_url: String, query: String) -> Vec<JiraUser>
// Returns array of { name?, accountId?, displayName, emailAddress? }

<!-- JiraUser type from types.ts -->
```typescript
export interface JiraUser {
  name?: string;       // Server v2
  accountId?: string;  // Cloud v3
  displayName: string;
  emailAddress?: string;
}
```

<!-- Current TicketFilterBar props -->
```typescript
interface TicketFilterBarProps {
  searchText: string;
  onSearchChange: (v: string) => void;
  sortDirection: 'asc' | 'desc';
  onToggleSort: () => void;
  resultCount: number;
}
```

<!-- connectionStore access pattern -->
```typescript
import { useConnectionStore } from '../connections/connectionStore';
const serverConn = useConnectionStore((s) => s.serverConnection);
// serverConn.baseUrl needed for search_jira_users invoke
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Redesign TicketFilterBar with assignee autocomplete</name>
  <files>src/features/tickets/TicketFilterBar.tsx, src/i18n/locales/en.json, src/i18n/locales/sk.json</files>
  <action>
Redesign TicketFilterBar with two distinct filter controls and a sleeker appearance:

**New props interface:**
```typescript
interface TicketFilterBarProps {
  searchText: string;
  onSearchChange: (v: string) => void;
  assigneeFilter: string;        // displayName of selected user, empty = no filter
  onAssigneeChange: (v: string) => void;
  sortDirection: 'asc' | 'desc';
  onToggleSort: () => void;
  resultCount: number;
}
```

**Layout:** Single row, compact. Left-to-right: key search (max-w-[200px]) | assignee autocomplete (max-w-[220px]) | sort toggle | result count pushed to right. Container: `py-1.5 px-4 border-b border-brand-border flex items-center gap-2.5`. All inputs h-8.

**Key search input:** Same as current but narrower (max-w-[200px]), with Search icon and X clear. Placeholder: "Filter by key..." (new i18n key `tickets.filter.keyPlaceholder`). Use `bg-brand-surface/50 text-sm rounded-md border border-brand-border` styling with focus ring.

**Assignee autocomplete (self-contained within TicketFilterBar):**
- Import `invoke` from `@tauri-apps/api/core` and `useConnectionStore` for baseUrl.
- Internal state: `userQuery`, `suggestions: JiraUser[]`, `showSuggestions`, `noResults`, `selectedIdx`, `debounceRef`, `inputRef`, `dropdownRef`.
- On typing in assignee input, debounce 250ms then `invoke<JiraUser[]>('search_jira_users', { baseUrl: serverConn.baseUrl, query: userQuery.trim() })`.
- Show dropdown absolutely positioned below input: `absolute top-full left-0 right-0 mt-1 bg-brand-surface border border-brand-border shadow-lg rounded-md max-h-48 overflow-y-auto z-50`.
- Each suggestion row: `px-3 py-1.5 text-sm hover:bg-brand/10 cursor-pointer` showing displayName and faded emailAddress if available.
- Highlight active suggestion with `bg-brand/10`.
- Keyboard: ArrowDown/ArrowUp navigate, Enter selects highlighted, Escape closes.
- On select: call `onAssigneeChange(user.displayName)`, clear query, close dropdown.
- When assigneeFilter is set (non-empty), show selected user as a chip: `inline-flex items-center gap-1 bg-brand/10 text-brand text-sm rounded-full px-2.5 py-0.5` with X button calling `onAssigneeChange('')`.
- Click-outside closes dropdown: useEffect with mousedown listener on document, checking if click is outside dropdownRef and inputRef.
- When no assignee selected, show input with placeholder "Filter by assignee..." (i18n key `tickets.filter.assigneePlaceholder`). When assignee IS selected, show the chip instead of the input.
- "No users found" message when query returns empty results.

**Sort toggle and result count:** Same as current, keep styling.

**i18n keys to add/update in both en.json and sk.json:**
- `tickets.filter.keyPlaceholder`: "Filter by key..." / "Filtrovať podľa kľúča..."
- `tickets.filter.assigneePlaceholder`: "Filter by assignee..." / "Filtrovať podľa riešiteľa..."
- `tickets.filter.noUsersFound`: "No users found" / "Žiadni používatelia"
- `tickets.filter.clearAssignee`: "Clear assignee filter" / "Vymazať filter riešiteľa"
- Update `tickets.filter.placeholder` is no longer needed (replaced by keyPlaceholder) — keep it for backward compat but it won't be used.
- Update `tickets.filter.searchLabel` to "Filter tickets by key" / "Filtrovať tikety podľa kľúča"
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>TicketFilterBar has two separate controls (key search + assignee autocomplete), assignee invokes search_jira_users with debounce, chip display for selected assignee, keyboard nav works, i18n keys in both languages.</done>
</task>

<task type="auto">
  <name>Task 2: Update consumer pages to pass assignee filter</name>
  <files>src/features/tickets/TicketListPage.tsx, src/features/tickets/IgnoredTicketsPage.tsx, src/features/tickets/LinkedTicketsPage.tsx</files>
  <action>
Update all three ticket list pages to add assignee filter state and pass it to TicketFilterBar:

**In each page (TicketListPage, IgnoredTicketsPage, LinkedTicketsPage):**

1. Add state: `const [assigneeFilter, setAssigneeFilter] = useState('');`

2. Update TicketFilterBar usage to pass new props:
```tsx
<TicketFilterBar
  searchText={searchText}
  onSearchChange={setSearchText}
  assigneeFilter={assigneeFilter}
  onAssigneeChange={setAssigneeFilter}
  sortDirection={sortDirection}
  onToggleSort={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
  resultCount={sorted.length}  // or sortedCandidates.length for TicketListPage
/>
```

3. Update the filtering logic in the `useMemo` to apply assignee filter separately from key search:
- `searchText` filters on `ticket.key` only (partial match, case-insensitive)
- `assigneeFilter` filters on `ticket.fields.assignee?.displayName` (exact match, case-insensitive)
- Both combine with AND logic

For TicketListPage, update the `sortedCandidates` useMemo:
```typescript
const sortedCandidates = useMemo(() => {
  let filtered = candidateTickets;
  if (searchText.length > 0) {
    const lower = searchText.toLowerCase();
    filtered = filtered.filter((ticket) => ticket.key.toLowerCase().includes(lower));
  }
  if (assigneeFilter.length > 0) {
    const assigneeLower = assigneeFilter.toLowerCase();
    filtered = filtered.filter((ticket) =>
      (ticket.fields.assignee?.displayName ?? '').toLowerCase() === assigneeLower
    );
  }
  return [...filtered].sort((a, b) => {
    const diff = new Date(b.fields.updated).getTime() - new Date(a.fields.updated).getTime();
    return sortDirection === 'desc' ? diff : -diff;
  });
}, [candidateTickets, searchText, assigneeFilter, sortDirection]);
```

Apply the same pattern to IgnoredTicketsPage and LinkedTicketsPage `sorted` useMemo.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>All three pages pass assigneeFilter to TicketFilterBar, filtering uses AND logic (key partial match + assignee exact match), TypeScript compiles clean.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors
- TicketFilterBar.tsx imports invoke and useConnectionStore
- TicketFilterBar.tsx calls search_jira_users with debounce
- All three consumer pages pass assigneeFilter and onAssigneeChange props
- i18n keys present in both en.json and sk.json
</verification>

<success_criteria>
- Filter bar has two distinct controls: key search and assignee autocomplete
- Assignee autocomplete queries real Jira users via search_jira_users command
- Selected assignee shown as chip with clear button
- Keyboard navigation works in dropdown (arrows, enter, escape)
- Click-outside closes dropdown
- Key and assignee filters combine with AND logic across all three pages
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/quick/260325-kuc-make-the-filter-more-sleek-the-assignee-/260325-kuc-SUMMARY.md`
</output>
