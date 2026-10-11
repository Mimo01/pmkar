# Architecture Patterns

**Domain:** User-defined issue groups layered on an existing Tauri 2 / React 19 / Rust triage app (Pmkar v0.5.0)
**Researched:** 2026-10-11
**Confidence:** HIGH for integration points (read directly from the codebase); MEDIUM for UX-driven choices (reorder mechanism, management UI) which are recommendations, not verified facts.

## Existing Architecture (as found in the code)

| Concern | Where it lives today |
|---------|---------------------|
| Triage state | Rust `triage_db.rs` (`triage.db`, table `triage_state`: key, state in new/seen/ignored/copied/handled, copied_key). Commands `get_triage_state`, `set_triage_state`, `delete_done_triage` in `commands.rs`. |
| DB pattern | db-per-concern (`audit.db`, `triage.db`, `snapshot.db`, `mapping.db`). Each is `Arc<Mutex<XxxDb>>`, opened and `app.manage()`d in `main.rs` (~L113-143), commands listed in `generate_handler!`. Migrations are manual `CREATE TABLE IF NOT EXISTS` plus tolerated `ALTER`. |
| Fetch | `fetch_tickets` (Rust) returns `{issues, total, triageMap, truncated}`. It inserts `new` triage rows for unseen keys and DELETES triage rows for `statusCategory=done` issues. `TicketListPage.handleFetch` runs per-watched-user batches, merges them, then makes ONE `store.setTickets(...)`. Batches can fail partially (`failedUserNames`). |
| Frontend state | `useTicketStore` (Zustand): `tickets: JiraTicket[]`, `triageMap`, `selectedTicketKey`, `unseenChanges`, `hasFetchedThisSession`, `truncated`. Triage mutations are optimistic: `invoke('set_triage_state')` then `hydrateTriageMap({...})`. |
| Navigation | No router. `App.tsx` holds `currentTab: 'new'|'not-mine'|'linked'` in `useState`. `AppShell` renders a hard-coded 3-tab `<nav>`. Selecting a ticket sets `selectedTicketKey`; `App` then early-returns `TicketDetailPage` (or Copy preview/result) instead of the tab view. `currentTab` survives because it is App state. |
| Tab pages | `TicketListPage` (New), `IgnoredTicketsPage` (Not mine), `LinkedTicketsPage` (Linked). Each filters `tickets` by triage state AND `!isDoneTicket`, and each contains a near-identical copy of the search/assignee filter and the sort comparator (about 40 duplicated lines each). All render `TicketCard` + `TicketFilterBar`. |
| Card | `TicketCard` is ONE `<button>` (key, unseen-change badge, `actionSlot`, summary, status/priority/assignee). |
| Detail actions | `TicketDetailPage` has Copy / Ignore / Unignore / Handled buttons (labelled buttons, per user feedback preference). |
| i18n | `src/i18n/locales/en.json` + `sk.json`, parity checked by `translations.test.ts`. |
| CONI-01 root cause | `CopyResultModal.stepLabel` and a duplicate in `CopyResultPage.stepLabel` do not match what Rust emits. Rust emits `add_remotelink` (UI checks `add_remote_link`), `fetch_source`, `update_triage`, and `worklog:fetch` (falls into the `worklog:` branch and renders "fetch" as the index n). Unmatched steps fall through to `return step.step` (raw string). |

## Recommended Architecture

Groups are a **separate, orthogonal layer**: a new `groups.db` (Rust), a new `useGroupStore` (Zustand), new `features/groups/` UI, and thin hooks into App/AppShell/TicketCard/TicketDetailPage. Groups NEVER write to `triage_state` and the core tab filters are unchanged. A grouped issue therefore still appears in its core tab by construction.

```
                    groups.db (new)                    triage.db (unchanged)
          issue_group / group_member / issue_snapshot        triage_state
                          |                                       |
                 Tauri cmds (groups_cmds)                  existing triage cmds
                          |                                       |
                   useGroupStore (new)  <----joined in UI---->  useTicketStore (unchanged)
                          |                                       |
   AppShell nav (core tabs | divider | group tabs)   TicketListPage / Ignored / Linked
                          |
                 GroupTicketsPage (new, flat list)
                 = members mapped to live ticket (tickets[]) else snapshot
                          |
              TicketCard (+ selection, badge slots) -> TicketDetailPage (+ GroupMembershipButton)
```

### Why a separate `groups.db` (not extra tables in `triage.db`)
The project's recorded decision is db-per-concern (mapping.db rationale: "avoids cross-domain schema coupling"). It also keeps the `triage_state` CHECK-constraint rebuild migration out of the blast radius, and keeps lock ordering simple (separate Mutex). Cost: one more `Arc<Mutex<GroupsDb>>` in `main.rs`.

### Why NOT reuse `snapshot.db` `snapshot_store` for the cached minimal issue
It is keyed by ticket and stores full `response_json`, but it is owned by the poll/change-detection lifecycle (hash, unseen flags, pending_changes) and may be written/pruned independently. Grouped-issue durability needs its own guaranteed lifecycle: a row exists iff the issue is in at least one group. Use a small dedicated `issue_snapshot` table.

### Data Model (`groups.db`)

```sql
CREATE TABLE IF NOT EXISTS issue_group (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,              -- unique case-insensitively (enforce in cmd; UNIQUE COLLATE NOCASE ok)
  color      TEXT NOT NULL,              -- token from a fixed palette (e.g. 'blue'), not raw hex
  position   INTEGER NOT NULL,           -- dense 0..n-1, rewritten on reorder
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS group_member (
  group_id  INTEGER NOT NULL REFERENCES issue_group(id) ON DELETE CASCADE,
  issue_key TEXT NOT NULL,
  added_at  TEXT NOT NULL,
  PRIMARY KEY (group_id, issue_key)
);
CREATE INDEX IF NOT EXISTS idx_gm_issue ON group_member(issue_key);
CREATE TABLE IF NOT EXISTS issue_snapshot (
  issue_key    TEXT PRIMARY KEY,
  ticket_json  TEXT NOT NULL,   -- minimal JiraTicket: {key, fields:{summary,status{name,statusCategory},priority{name,id},assignee,created,updated}}
  updated_at   TEXT NOT NULL    -- when the snapshot was last refreshed from a live fetch
);
```

Notes:
- Must run `PRAGMA foreign_keys = ON` on the connection (rusqlite default is OFF) or cascade will not fire; alternatively delete members explicitly in `delete_group` inside a transaction. Do the explicit delete AND the pragma.
- Store the snapshot as `ticket_json` shaped exactly like the frontend `JiraTicket` so `TicketCard` renders a snapshot with zero changes.
- Orphan GC: after `remove_issue_from_group` / `delete_group`, `DELETE FROM issue_snapshot WHERE issue_key NOT IN (SELECT issue_key FROM group_member)`.
- Do not key anything on triage state. Triage rows for done issues are deleted by `fetch_tickets`; group membership must survive that (it does, being in a different DB).

### Tauri Commands (new, in a new `groups_commands` section or `groups.rs`; register in `generate_handler!`)

| Command | Purpose |
|---------|---------|
| `get_groups_state` | One hydrate call returning `{groups[], members: {groupId: [keys]}, snapshots: {key: JiraTicketLite}}`. |
| `create_group(name, color)` / `rename_group(id, name)` / `set_group_color(id, color)` / `delete_group(id)` | CRUD; validate trimmed non-empty, length cap, duplicate name -> typed `AppError`. |
| `reorder_groups(ordered_ids)` | Single transaction rewriting `position`. |
| `set_issue_groups(issue_key, group_ids, snapshot)` | Detail-panel checkbox popover: set the full membership of one issue (diff in Rust). |
| `add_issues_to_group(group_id, snapshots[])` | Multi-select "add to group"; snapshot comes from the live `tickets[]` item at call time. |
| `remove_issues_from_group(group_id, keys[])` | One-click remove (including from the "no longer in results" row) and multi-select remove. |
| `refresh_group_snapshots(snapshots[])` | Called after a successful full fetch with the live tickets whose keys are grouped; updates `ticket_json`/`updated_at`. |

Commands that only touch groups.db take `State<Arc<Mutex<GroupsDb>>>` only. None of them need credentials or Jira HTTP, so they do not touch the audit client (no audit-log noise). **Lock ordering rule:** never hold the triage lock while taking the groups lock. Do the snapshot refresh from the frontend (separate command), not inside `fetch_tickets`, which already holds the triage lock and runs per-batch.

### Frontend State: `useGroupStore` (`src/features/groups/groupStore.ts`)

```ts
type GroupColor = 'blue'|'green'|...;                 // palette tokens; map to Tailwind classes in one file
interface IssueGroup { id: number; name: string; color: GroupColor; position: number }
interface GroupState {
  groups: IssueGroup[];                                 // ordered by position
  membersByGroup: Record<number, string[]>;             // groupId -> keys
  groupsByIssue: Record<string, number[]>;              // derived inverse index
  snapshots: Record<string, JiraTicket>;
  hydrated: boolean;
  hydrate(): Promise<void>;
  createGroup/renameGroup/setColor/deleteGroup/reorder; // optimistic: update store, invoke, rollback + toast on error
  setIssueGroups(key, ids); addIssuesToGroup(groupId, tickets); removeIssues(groupId, keys);
}
```

- Follow the existing optimistic pattern (store update + `invoke(...).catch`), but ROLL BACK on failure for group ops because losing a user-curated list is worse than a stale triage flag.
- Selector discipline (project memory): never `?? []` inside a selector. Expose a module-level `const EMPTY: string[] = []` or return `null` and coalesce outside. `groupsByIssue[key]` consumers must use the null-fallback pattern.
- Hydrate once in `App.tsx`'s existing startup `Promise.all` (alongside `get_all_connection_meta`), NOT in `TicketListPage` mount (that is where triage hydrates today, but tabs other than New must not depend on the New page being mounted; `IgnoredTicketsPage` and `LinkedTicketsPage` only work today because `TicketListPage` mounts first).
- Joined view is a pure derived function, memoised in the page: `resolveGroupItems(groupId, tickets, snapshots, membersByGroup) -> {ticket, live: boolean}[]`. Live ticket wins; otherwise snapshot with `live=false`.

### Routing / Tabs

- Change `currentTab` type to `type TabId = 'new'|'not-mine'|'linked'|\`group:${number}\``. Keep it in `App` `useState` (no router introduced, consistent with the app).
- `AppShell` currently hard-codes three tabs and a literal union. Change props to `tabs`-driven: keep core tabs array, add optional `groupTabs: {id, label, color}[]`, `onCreateGroup`, plus a `<Separator orientation="vertical">` divider between core and group tabs (only render divider when groups exist or the "+ New group" button is shown). AppShell is also rendered without tab props on wizard/settings/audit/detail screens; the new props must stay optional.
- Group tab label: color dot + name + (optional) member count. Truncate long names with `title`.
- Overflow: many groups can exceed width; make the group-tab segment horizontally scrollable (`overflow-x-auto`) while core tabs stay pinned.
- If the active group is deleted, `App` falls back to `'new'`.
- Active group tab with name/color edits: the id is stable so no state loss.
- Group management (create, rename, recolor, delete, reorder): put in a per-tab menu (right-click/overflow button on the ACTIVE group tab) plus a "Manage groups" popover/dialog with the reorder list. Per user feedback ("explicit labelled buttons, one entry point per action"), avoid hover-revealed icons; use a visible "..." menu on the active tab with labelled items.
- Reorder mechanism: simplest robust option is Move up/Move down buttons in the manage dialog (keyboard accessible, WCAG AA, no new dep). Drag-and-drop (dnd-kit) is a nicer-feeling option but adds a dependency and a11y work; decision belongs to STACK/phase planning.

### Components: New vs Modified

**NEW**
| Component / module | Responsibility |
|---|---|
| `src-tauri/src/groups_db.rs` | `GroupsDb` open/open_in_memory, CRUD, membership, snapshots, GC. Unit-tested with `open_in_memory`. |
| Groups commands (in `commands.rs` or `groups_commands.rs`) | As table above. |
| `src/features/groups/groupStore.ts` (+ tests) | State above. |
| `src/features/groups/types.ts`, `colors.ts` | Types, palette tokens -> classes (check contrast in light and dark, AA). |
| `GroupTicketsPage.tsx` | Flat list for one group; filter bar; empty state; renders `TicketCard` with triage badge and, for non-live items, the "no longer in results" row. |
| `GroupMembershipButton.tsx` (+ `GroupPicker`) | Labelled button in `TicketDetailPage` action row opening a popover of checkboxes (all groups, plus inline "New group..."). Used by detail panel and by the multi-select bar. |
| `SelectionBar.tsx` + `useSelection` hook | Appears when >=1 card is selected in a list: "N selected", "Add to group...", "Clear". Selection state is local to each page (not global) and cleared on tab change. |
| `GroupManageDialog.tsx` / `GroupFormDialog.tsx` | Create/rename/color/delete (with confirm; deleting does not delete issues), reorder. |
| `GroupChips.tsx` | Small colored chips for the groups an issue belongs to (shown in detail header; optional on cards). |
| `useRefreshGroupSnapshots` (or a function called in `handleFetch`) | After the final merged `setTickets`, send snapshots for live tickets that are grouped. |
| `ticketListUtils.ts` (`filterTickets`, `sortTickets`, `SortField`) | Extracted from the three duplicated page implementations; GroupTicketsPage would otherwise be a 4th copy. |
| `copyStepLabel.ts` | Shared `stepLabel(t, step)` used by both CopyResult views (CONI-01). |

**MODIFIED**
| File | Change |
|---|---|
| `src-tauri/src/main.rs`, `lib.rs` | Open `groups.db`, `app.manage`, add `pub mod groups_db`, add commands to `generate_handler!`. |
| `src/App.tsx` | `TabId` union, hydrate groups at startup, pass group tabs/handlers to AppShell, render `GroupTicketsPage` for `group:*`, fallback when group deleted. |
| `src/components/ui/AppShell.tsx` | Data-driven tabs, divider, group tabs, "+" button, overflow handling. Keep `aria-current="page"`; nav label is currently an untranslated literal ("Main navigation"), fix opportunistically. |
| `TicketCard.tsx` | Add optional `selectable/selected/onSelectChange`, `triageBadge` (reuse `TriageIndicator`), `stale` mode. **Must restructure**: the card is a single `<button>`; a checkbox inside a button is invalid interactive nesting and breaks keyboard/AT behavior. Wrap in a `div` with a sibling checkbox and a full-card button. Existing card tests (`TicketListPage.test`, `IgnoredTicketsPage.test`, etc.) query by `aria-label=summary`; keep that on the button. |
| `TicketListPage`, `IgnoredTicketsPage`, `LinkedTicketsPage` | Adopt selection + `SelectionBar`; swap duplicated filter/sort for shared utils; call snapshot refresh after fetch (only `TicketListPage`). Core filter logic otherwise untouched. |
| `TicketDetailPage.tsx` | Add `GroupMembershipButton` + chips next to Copy/Ignore. NOTE: `App` renders `TicketDetailPage`; `TicketDetailPanel.tsx` also exists. Verify during the phase whether Panel is dead code (not confirmed here) before touching it. |
| `CopyResultModal.tsx`, `CopyResultPage.tsx` | Replace local `stepLabel` with shared helper; add keys. |
| `en.json`, `sk.json` | `groups.*`, `selection.*`, `copy.step.*` additions. |
| `ticketStore.ts` | No required change. Optionally expose nothing new; keep groups out of it so core store tests stay stable. |

### Data Flow

1. **Startup:** `App` hydrate effect -> `useGroupStore.hydrate()` -> `get_groups_state`. Tabs render immediately from persisted groups, with snapshot data, before any fetch (nice: group tab is usable offline of Jira).
2. **Add to group:** user clicks `GroupMembershipButton` (detail) or `SelectionBar` (list) -> store resolves live `JiraTicket` objects from `useTicketStore.tickets` -> trims to minimal snapshot -> optimistic store update -> `set_issue_groups` / `add_issues_to_group` persists membership AND snapshot atomically.
3. **Fetch:** `handleFetch` finishes -> single `setTickets` -> then `refresh_group_snapshots` for grouped live keys -> group store snapshots updated. Group tab recomputes via `resolveGroupItems`.
4. **View group tab:** members -> live ticket (from `tickets`) else snapshot flagged not-live. Triage badge from `triageMap[key]` (absent entry = done-and-pruned or never fetched -> show neutral/"Done" via `isDoneTicket` on the live/snapshot status, never crash on missing entry).
5. **Card actions:** card click -> `selectTicket(key)` -> existing detail flow (Copy/Ignore/Handled). On back, `currentTab` still `group:N`. After copy, `get_triage_state` re-hydrate already updates the badge.
6. **Remove:** one-click remove -> `remove_issues_from_group` -> snapshot GC.

### "No longer in results" semantics (critical to get right)

"Missing" = member key not in `tickets[]`. Naively that is wrong in at least four situations; derive an explicit flag and gate the hint:
- Before the first fetch of the session (`hasFetchedThisSession === false`): `tickets` is empty, so EVERY grouped issue looks missing. Show snapshots with no hint (optionally a "last known" muted style).
- Partial batch failure (`failedUserNames.length > 0`) or `truncated === true`: absence is not evidence. Suppress the hint, or show a softer "may be missing because the last fetch was incomplete".
- Custom JQL / project-scope / watched-user changes legitimately drop issues; hint copy should say "not in latest results", not "deleted".
- Done issues: they remain fetched in some JQL presets but are excluded from the three core tabs by `isDoneTicket`. They are NOT missing; the group view should show them (with a Done badge), since the group is a flat list independent of triage tabs. Confirm preset JQL behavior in phase research.

To support this, `useTicketStore` needs either a cheap derived `lastFetchComplete` flag or `GroupTicketsPage` reads `hasFetchedThisSession`, `truncated`, and a new `lastFetchHadFailures` that `handleFetch` sets (today `failedUserNames` is local `useState` in `TicketListPage`, so this is a small ticketStore addition: one boolean + setter).

Clicking a missing card: the detail page would try to fetch a possibly deleted/inaccessible issue. Make non-live cards non-navigable (or navigable with graceful error), with a visible labelled "Remove from group" button in the card's `actionSlot`.

## Patterns to Follow

### Pattern 1: Orthogonal overlay store joined at render time
**What:** Keep groups out of `useTicketStore`; join `tickets + triageMap + groups` in a pure memoised function.
**When:** Anywhere a view needs both (group page, chips, selection bar).
**Why:** Zero regression surface on the validated triage flow and its existing tests.

### Pattern 2: db-per-concern with `open_in_memory` tests
**What:** `GroupsDb` mirrors `SnapshotDb`/`FieldMappingDb`: `open(path)`, `open_in_memory()`, manual `CREATE IF NOT EXISTS`, `Arc<Mutex<>>`.
**Example:**
```rust
let groups_db = GroupsDb::open(&app_dir.join("groups.db")).expect("Failed to open groups database");
app.manage(Arc::new(Mutex::new(groups_db)));
```

### Pattern 3: Snapshot shaped like the live type
Persist `ticket_json` as the frontend `JiraTicket` subset so one `TicketCard` renders both live and cached items.

### Pattern 4: Transactional multi-row ops
Reorder, delete-group (members + GC), and multi-add run in one `conn.transaction()` so a crash never leaves partial lists or gaps in `position`.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Adding a 'group' dimension to `triage_state`
**Why bad:** Many-to-many membership does not fit a single-state-per-key table, and the CHECK-constraint rebuild migration is already fragile. **Instead:** separate tables/DB.

### Anti-Pattern 2: Computing "missing" from `tickets.length`/key absence alone
**Why bad:** False "no longer in results" on app start, partial failures, truncation. See above.

### Anti-Pattern 3: Fourth copy of filter/sort logic
**Why bad:** Already triplicated; any later sort fix must land in four places. Extract first.

### Anti-Pattern 4: Checkbox nested inside the card `<button>`
**Why bad:** Invalid HTML, double activation, broken a11y. Restructure card wrapper.

### Anti-Pattern 5: Relying on SQLite cascade without enabling foreign keys
**Why bad:** rusqlite leaves `foreign_keys` off; orphan `group_member` rows would reappear if an id is reused. Enable pragma and also delete explicitly. (AUTOINCREMENT also prevents id reuse.)

### Anti-Pattern 6: Hover-revealed row icons for add/remove
Conflicts with recorded user preference; use labelled buttons in detail, and the selection bar in lists.

### Anti-Pattern 7: Hydrating group state from a page that may not be mounted
Hydrate at App startup.

## Scalability Considerations

| Concern | Typical (10 groups, <=1k members) | Heavy (50 groups, 5k members) |
|---------|------|------|
| Hydrate payload | Trivial; one IPC call | Still fine; snapshots are minimal JSON (~300 B each, ~1.5 MB worst) |
| Group page render | Plain list OK | `@tanstack/react-virtual` is already a dependency if lists ever need it; note existing pages do not virtualise |
| Snapshot refresh | One IPC after fetch with only grouped+live keys | Same; batch in one transaction |
| Tab bar width | Fits | Horizontal scroll segment |

## Suggested Build Order (dependency-driven)

1. **Rust persistence layer** - `groups_db.rs`, schema, CRUD/membership/snapshot/GC/reorder, unit tests with `open_in_memory`; commands; wire `main.rs`/`lib.rs`. No UI dependencies; everything else depends on it.
2. **Store + types + hydrate** - `groupStore.ts`, types, palette, App startup hydrate, store tests (including null-fallback selectors, rollback on failure).
3. **CONI-01 (parallel, independent)** - shared `copyStepLabel` helper, fix `add_remotelink`/`fetch_source`/`update_triage`/`worklog:fetch` mappings, EN+SK keys, update both Modal and Page tests. Small, can ship in any slot; good low-risk first PR.
4. **Refactor prerequisite** - extract `filterTickets`/`sortTickets`/`SortField`, adopt in the three existing pages (behavior-preserving; existing tests are the safety net). Do before the group page.
5. **Tab infrastructure + read-only group view** - `TabId`, data-driven `AppShell` with divider, `GroupTicketsPage` rendering members (live + snapshot), triage badge on `TicketCard`, empty state, tab fallback on delete. Seed groups via commands/dev to test.
6. **Group management UI** - create/rename/recolor/delete/reorder dialogs; color AA contrast check light and dark; EN+SK.
7. **Membership entry points** - `GroupMembershipButton` in `TicketDetailPage` first (single issue, simplest), then `TicketCard` restructure + `useSelection` + `SelectionBar` on the four list pages.
8. **Durability behavior** - `lastFetchHadFailures` flag, post-fetch `refresh_group_snapshots`, "no longer in results" hint with gating rules, non-navigable stale cards with one-click remove.
9. **Polish and verification** - i18n parity test, keyboard/ARIA pass (tab list semantics, popover focus, selection announcements via live region), mock-server/E2E scenario.

Rationale: 1->2 is a hard dependency chain; 4 de-risks 5; 7 needs 5/6 so users can create groups to add to; 8 depends on 5 (the view) and on 7 (snapshots are written on add) and is isolated because its edge cases are the main correctness risk.

## Testing Notes

- Rust: `GroupsDb` tests via `open_in_memory` (cascade, GC, reorder compaction, duplicate names, FK pragma).
- Frontend: store tests with mocked `invoke`; `resolveGroupItems` pure-function tests (live vs snapshot, before-first-fetch, partial failure, done issues).
- Mock server (`fixtures.rs`): groups are local-only, so NO new Jira fixtures are required for core behavior. A "missing issue" scenario needs two sequential fetches with different results; mock fixtures are static, so cover that in frontend unit tests (mock `fetch_tickets` returns) rather than extending the mock server, unless an E2E check is wanted.
- Existing tests that will need touching: any asserting `TicketCard` structure/role, `AppShell` nav (`App.test.tsx`, `__tests__/App.test.tsx`), `CopyResultModal.test.tsx`, `CopyResultPage.test.tsx`, `translations.test.ts` (key parity).

## Open Questions for Phase-Level Research

- Reorder UX: buttons vs drag-and-drop (dnd-kit dependency + keyboard a11y).
- Is `TicketDetailPanel.tsx` still used anywhere, or only `TicketDetailPage`? (Not verified here.)
- Do default JQL presets already exclude done issues? Determines whether done grouped issues commonly appear as "missing" vs "Done".
- Should group membership optionally be dropped when an issue is copied/handled? Requirement says independent of triage, so default NO.
- Scoping: groups are global to the app, not per source project; if the user changes source project/connection, stale keys from another instance could linger (low risk, single customer Jira in this product).

## Sources

- Direct inspection of repository: `src-tauri/src/{main,lib,commands,triage_db,snapshot_db,field_mapping_db,copy_pipeline}.rs`, `src/App.tsx`, `src/components/ui/AppShell.tsx`, `src/features/tickets/{ticketStore,TicketCard,TicketListPage,IgnoredTicketsPage,LinkedTicketsPage,TicketDetailPage,CopyResultModal,CopyResultPage,utils,types}.ts(x)`, `.planning/PROJECT.md` (HIGH confidence, first-hand).
- Project memory notes on Zustand stable selectors and explicit-action UI preference.
- SQLite/rusqlite `foreign_keys` pragma default-off behavior: standard documented behavior (MEDIUM; from training knowledge, not re-verified this session).
