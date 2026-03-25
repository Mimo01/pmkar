---
phase: quick-260325-qac
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/triage_db.rs
  - src-tauri/src/commands.rs
  - src-tauri/src/main.rs
  - src/features/tickets/TicketListPage.tsx
  - src/features/tickets/IgnoredTicketsPage.tsx
  - src/features/tickets/LinkedTicketsPage.tsx
autonomous: true
requirements: [QUICK-HIDE-DONE]

must_haves:
  truths:
    - "Ticket lists (New, Ignored, Linked) never show tickets with a Done/Resolved/Closed status"
    - "Triage entries for done tickets are deleted from SQLite after each fetch"
    - "Non-done tickets continue to display normally in all tabs"
  artifacts:
    - path: "src-tauri/src/triage_db.rs"
      provides: "delete_triage_entries bulk delete method"
      contains: "delete_triage_entries"
    - path: "src-tauri/src/commands.rs"
      provides: "Done ticket cleanup after fetch + new delete_done_triage command"
      contains: "delete_done_triage"
    - path: "src/features/tickets/TicketListPage.tsx"
      provides: "Frontend filtering of done tickets"
      contains: "statusCategory"
  key_links:
    - from: "src-tauri/src/commands.rs"
      to: "src-tauri/src/triage_db.rs"
      via: "delete_triage_entries call in fetch_tickets"
      pattern: "delete_triage_entries"
    - from: "src/features/tickets/TicketListPage.tsx"
      to: "JiraTicket.fields.status.statusCategory"
      via: "filter predicate"
      pattern: "statusCategory"
---

<objective>
Hide done/resolved/closed tickets from all ticket list views and delete their triage entries from local storage.

Purpose: Users only care about active tickets. Done tickets clutter the lists and waste triage state in SQLite.
Output: All three ticket list tabs filter out done tickets; backend cleans up triage entries for done tickets after each fetch.
</objective>

<execution_context>
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/features/tickets/ticketStore.ts
@src/features/tickets/types.ts
@src/features/tickets/TicketListPage.tsx
@src/features/tickets/IgnoredTicketsPage.tsx
@src/features/tickets/LinkedTicketsPage.tsx
@src-tauri/src/triage_db.rs
@src-tauri/src/commands.rs
@src-tauri/src/main.rs

<interfaces>
From src/features/tickets/types.ts:
```typescript
export interface JiraStatus {
  name: string;
  id?: string;
  statusCategory?: { key: string };
}

export interface JiraTicket {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: JiraStatus;
    priority: JiraPriority;
    assignee: JiraUser | null;
    created?: string;
    updated: string;
  };
}
```

From src/features/tickets/ticketStore.ts:
```typescript
triageMap: Record<string, TriageEntry>;
tickets: JiraTicket[];
setTickets: (tickets, triageMap, total) => void;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add bulk delete to triage DB and clean up done tickets after fetch</name>
  <files>src-tauri/src/triage_db.rs, src-tauri/src/commands.rs, src-tauri/src/main.rs</files>
  <action>
1. In `src-tauri/src/triage_db.rs`, add a new method `delete_triage_entries(&self, keys: &[String]) -> AppResult<usize>` that executes `DELETE FROM triage_state WHERE ticket_key IN (...)` for the given keys. Use parameterized placeholders built dynamically (one `?` per key). Return the number of rows deleted.

2. In `src-tauri/src/commands.rs`, in the `fetch_tickets` function (around line 700-716 where triage state is updated), AFTER the existing triage update loop:
   - Iterate through `issues` and collect keys where `issue["fields"]["status"]["statusCategory"]["key"] == "done"` into a `Vec<String>` called `done_keys`.
   - If `done_keys` is not empty, call `tdb.delete_triage_entries(&done_keys)?` to remove their triage state.
   - This ensures done tickets have no triage entries, so they won't appear in any filtered view.

3. Also in `src-tauri/src/commands.rs`, add a new Tauri command `delete_done_triage` that accepts `ticket_keys: Vec<String>` and deletes those entries from triage_state. This allows the frontend to trigger cleanup manually if needed.

4. In `src-tauri/src/main.rs`, add `commands::delete_done_triage` to the `invoke_handler` list.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20</automated>
  </verify>
  <done>Done ticket triage entries are deleted from SQLite after each fetch. Bulk delete method exists in triage_db. New delete_done_triage command registered.</done>
</task>

<task type="auto">
  <name>Task 2: Filter done tickets from all three ticket list views</name>
  <files>src/features/tickets/TicketListPage.tsx, src/features/tickets/IgnoredTicketsPage.tsx, src/features/tickets/LinkedTicketsPage.tsx</files>
  <action>
Create a shared helper function `isDoneTicket(ticket: JiraTicket): boolean` that returns `true` if `ticket.fields.status.statusCategory?.key === 'done'` OR if the status name (lowercased) includes 'done', 'resolved', or 'closed' (fallback for APIs that don't return statusCategory). Place this in a small utility or inline it.

1. In `src/features/tickets/TicketListPage.tsx`:
   - In the `candidateTickets` filter (line ~113-116), add `&& !isDoneTicket(t)` to the existing filter predicate that already excludes 'ignored' and 'copied' states.

2. In `src/features/tickets/IgnoredTicketsPage.tsx`:
   - In the `ignoredTickets` filter (line ~25-27), add `&& !isDoneTicket(t)` to exclude done tickets from the ignored list.

3. In `src/features/tickets/LinkedTicketsPage.tsx`:
   - In the `copiedTickets` filter (line ~17-19), add `&& !isDoneTicket(t)` to exclude done tickets from the linked/copied list.

The `isDoneTicket` helper should be placed in a new file `src/features/tickets/utils.ts` (or added to an existing utils file if one exists) and imported by all three pages.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/pmkar && npx vitest run --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>All three ticket list pages (New, Ignored, Linked) filter out tickets with done/resolved/closed status. Done tickets never appear in any list view.</done>
</task>

</tasks>

<verification>
- `cargo test` passes in src-tauri
- `npx vitest run` passes for frontend
- Manual: After fetching tickets, no done/resolved/closed tickets appear in any tab
- Manual: Triage entries for done tickets are removed from SQLite (visible via audit/debug)
</verification>

<success_criteria>
- Done/Resolved/Closed tickets are hidden from all three ticket list tabs
- Triage state for done tickets is deleted from SQLite after each fetch
- Existing non-done tickets display and function normally
- All tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/260325-qac-in-the-ticket-lists-only-show-those-that/260325-qac-SUMMARY.md`
</output>
