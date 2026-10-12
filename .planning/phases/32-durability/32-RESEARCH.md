# Phase 32: Durability - Research

**Researched:** 2026-10-12
**Domain:** Brownfield Tauri 2 (Rust/rusqlite) + React 19/Zustand 5 feature work: "missing member" state, snapshot refresh, bulk remove
**Confidence:** HIGH (all findings come from reading this repo's code; no new libraries)

## Summary

No new dependencies are needed. Every building block already exists: the `issue_snapshot` table with GC on remove/delete (`groups_db.rs`), atomic `remove_members`, `removeIssuesWithFeedback` (bulk remove plus toast), the confirm-popover pattern (`SelectionBar`), and the tab-anchored popover pattern (`RenameGroupPopover` with `anchorRef`). The phase has four real work items:

1. **Fetch-completeness state.** It must move out of `TicketListPage` local state into the session-only `ticketStore`, together with a query signature.
2. **A Rust bulk "refresh snapshots" command.** It must be UPDATE-only (never INSERT) so it cannot resurrect GC'd rows.
3. **A present/missing split in `useGroupMembers`** plus the missing block in `GroupViewPage`/`TicketCard`.
4. **A "Remove all missing" popover** with two entry points (subheading button, group tab menu item).

Research flag answer (ROADMAP): the built-in presets exclude Done. `buildMineBatchJql` and `buildUserBatchJql` in `TicketListPage.tsx` lines ~40-55 both add `statusCategory != Done`. Custom JQL is user-defined. So a resolved issue becomes "missing" on the next complete fetch (D-01, accepted, no lookup). [VERIFIED: codebase grep]

Exact gating rules are in the "Gating rules" section below. The key points:
- The "complete" flag is set in the same store update as the tickets.
- Query identity is a derived signature compared at read time, not a setter-side invalidation.
- Any non-complete outcome, including the "all batches failed" early return and the outer `catch`, must explicitly clear the flag.

**Primary recommendation:** Add `lastCompleteFetchSignature: string | null` to `ticketStore` (session-only). Add a pure `computeFetchSignature()` and a `useHintsEligible()` hook. Add one Rust command `refresh_group_snapshots`. Make `useGroupMembers` return `{ members, missingKeys }`, with `GroupViewPage` rendering a second block.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** There is no key lookup. No extra Jira requests for absent members. A member is "missing" if it is absent from the latest complete fetch, whatever the reason (including resolved; presets filter `statusCategory != Done`). Card shows the last-seen snapshot status (may be stale, accepted).
- **D-02:** Hint copy is just "No longer in results", no explanation.
- **D-03:** Missing cards sink to the bottom of the group list as one block. Present members follow the chosen sort; missing follow after, same sort among themselves. Search and filter apply to both blocks.
- **D-04:** The block starts with a subheading with a count, e.g. "No longer in results (3)", EN and SK with Slovak plurals. The subheading also holds the "Remove all missing" button (D-09).
- **D-05:** On a missing card, content is dimmed (reduced opacity), controls are not. Under the card: a small "No longer in results" line, and a labelled "Remove" button at the right of that line, full contrast for WCAG AA.
- **D-06:** Per-card Remove asks for confirmation in a small popover anchored to the button: "Remove 'KEY' from '<group>'?" with Cancel / Remove. Mirrors Phase 31 chip x. Read GDUR-03's "one-click" as one explicit button. Non-silent feedback on failure (Phase 30/31 pattern).
- **D-07:** Missing cards stay clickable and open detail as today; detail needs no changes. Chips and other card controls keep working.
- **D-08:** Tab count still includes missing members (list length equals tab count, Phase 29 D-14).
- **D-09:** Two entry points: (1) labelled "Remove all missing" button at the right of the missing subheading; (2) "Remove all missing (N)" item in the group's ... menu, above `Delete group...`.
- **D-10:** Both entry points appear whenever there is at least one missing member (including exactly one), and only while hint gating holds. The menu item is hidden, not disabled.
- **D-11:** Confirmation is a popover: "Remove N issues from '<group>'? They are no longer in results." Cancel / Remove, Slovak plurals. From the subheading button it is anchored to that button; from the menu it is anchored to the group tab (like Rename, Phase 30 D-06). One atomic bulk `removeMembers` call; a sonner toast confirms.
- **D-12:** Every fully successful fetch counts: manual, F5, poll-triggered refetch, preset, or custom JQL. "Fully successful" = every batch succeeded, `truncated` false, no error.
- **D-13:** Hints always reflect only the latest fetch. If the latest fetch is partial, truncated or failed, no member is flagged (absent members render normally from snapshot, undimmed). Hints return after the next complete fetch. No hints before the first complete fetch of the session (GDUR-04).
- **D-14:** Changing JQL preset or custom JQL hides all hints until the next fetch.
- **D-15:** Any successful fetch refreshes snapshots, even partial/truncated. Each member the fetch returned gets its stored snapshot updated. Only the missing flags need a complete fetch.
- **D-16:** Cleanup exists: `gc_snapshots` runs on remove and delete (Phase 28 D-20). Make sure Remove and Remove-all-missing go through the same path, and add regression tests.
- Carried forward: Phase 28 D-20/D-21 (`issue_snapshot`; atomic bulk membership; never hold triage lock while taking groups lock); D-22 never `?? []` in a Zustand selector; Phase 29 D-14/D-15; Phase 30 D-03 menu order; Phase 31 D-05/D-18 confirm popover; explicit labelled controls, never hover-revealed; no drag and drop.

### Claude's Discretion
- Where fetch-completeness state lives (probably `ticketStore`, session-only, plus query identity).
- How snapshot refresh is wired: one Rust bulk-upsert command after `setTickets`, applied only to keys that are members, in scope.
- Exact dimming values, as long as WCAG AA holds for hint text and Remove button.
- How missing cards interact with select mode (selectable like any card; keep consistent).
- Exact EN/SK copy and toast wording.

### Deferred Ideas (OUT OF SCOPE)
- Looking up missing members by key (rejected by the user).
- Undo after remove (GRP-F1, deferred).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GDUR-01 | Never auto-remove members | Nothing in the current fetch path touches membership (`useGroupMembers` only reads). Keep it that way: the refresh command is UPDATE-only on `issue_snapshot`; add a regression test that a refresh and a "complete fetch without the member" leave `group_member` rows untouched. |
| GDUR-02 | Persisted snapshot renders absent cards | Already implemented (Phase 28/29: `add_members` upserts, `get_group_members` joins, `useGroupMembers` falls back to snapshot). Phase work: keep snapshots fresh (GDUR-06) and make the hook's cached snapshot map reload after a refresh. |
| GDUR-03 | Dimmed + "No longer in results" + labelled Remove after complete fetch | Missing = key not in live `tickets` AND hints eligible. `TicketCard` change: dim wrapper plus a sibling control row. Popover confirm per D-06. |
| GDUR-04 | Never before first fetch / after partial / on truncated | Single derived gate (`useHintsEligible`) backed by store signature. See Gating rules. |
| GDUR-05 | "Remove all missing" with confirmation | Reuse `removeIssuesWithFeedback` (one `removeFromGroup` call = one atomic `remove_issues_from_group`). Two entry points; menu one anchored to the tab via the existing `pending`/`anchorRef` machinery in `GroupTabStrip`. |
| GDUR-06 | Snapshots refreshed on successful fetch; GC when unreferenced | New `refresh_group_snapshots` command; GC already in `remove_members`/`delete_group`; add regression tests. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch-completeness + query signature | Browser/Client (`ticketStore`, session-only) | none | Fetch orchestration (batches, truncation, errors) lives in `TicketListPage`; Rust `fetch_tickets` returns Err on any page failure and a `truncated` flag. Never persisted (D-13). |
| Missing determination (present vs missing) | Browser/Client (`useGroupMembers`) | none | Pure function of live `tickets`, member keys, and the gate. No backend involvement (no key lookup). |
| Snapshot refresh | Backend (Rust `GroupsDb`) | Client chooses keys | Rust resolves scope (never from frontend), runs a single transaction; client filters to member keys to keep the IPC payload small. |
| Snapshot cleanup | Database (`gc_snapshots`) | none | Already inside remove/delete transactions. |
| Remove / Remove all missing | Backend (atomic `remove_members`) | Client (confirm UI, toast) | One IPC call = one transaction. |
| Missing block, dimmed card, popovers | Browser/Client (React) | none | Presentational. |

## Standard Stack

No new packages. Everything below is already in the repo. [VERIFIED: package.json, codebase]

| Library | Purpose | Use here |
|---------|---------|----------|
| zustand ^5.0.12 | stores | `ticketStore` gets the completeness state; `groupStore` gets a snapshot-refresh action and revision counter |
| radix popover via `@/components/ui/popover` (`Popover`, `PopoverAnchor`, `PopoverTrigger`, `PopoverContent`) | confirm popovers | per-card, subheading, tab-anchored |
| sonner | toasts | success/error |
| react-i18next | copy | EN/SK keys with `_one/_few/_other` (the repo also carries `_many`; mirror the existing `groups.toast.removed*` quintet) |
| rusqlite (bundled in Cargo) + chrono + serde_json | refresh command | `UPDATE issue_snapshot ...` in one transaction |
| vitest ^4.1.1 + @testing-library/react + user-event; Rust `cargo test` | tests | see Validation Architecture |

**Package Legitimacy Audit:** not applicable. This phase installs no external packages.

## Architecture Patterns

### Data flow

```
fetch (manual / F5 / poll-complete -> handleFetch in TicketListPage)
  |-- custom JQL: 1 invoke        -> complete = !result.truncated
  |-- presets: N batches           -> complete = (failed === 0) && !anyTruncated
  |-- all batches fail / throw     -> markFetchIncomplete()   (tickets kept)
  v
ticketStore.setTickets(..., complete?)  -> sets tickets, truncated, lastCompleteFetchSignature
  |
  +--> refreshSnapshots(memberKeysInResult)  -> invoke('refresh_group_snapshots') [UPDATE-only, scope in Rust]
  |       \--> groupStore.snapshotRevision++ (on ok)
  v
GroupViewPage
  useGroupMembers(groupId): live Map(tickets)
    present = keys with live ticket  (live preferred)
    missing = hintsEligible ? keys without live ticket (render from snapshot) : []
    (eligible shows undimmed snapshot cards among "present" order when gate is off)
  -> sort/filter both lists -> [present cards] + [missing subheading + missing cards]
  -> Remove (per card popover) / Remove all missing (popover) -> removeIssuesWithFeedback -> remove_issues_from_group (atomic + gc)
```

### Gating rules (answer to the research flag)

A member is rendered as missing if and only if ALL of the following hold:

1. `ticketStore.lastCompleteFetchSignature !== null`: a complete fetch finished this session. It is session-only, initial `null`, and not touched by `hydrateFetchConfig`.
2. `lastCompleteFetchSignature === currentFetchSignature()`: the query on screen is still the query the results came from (D-14).
3. The key is not in `ticketStore.tickets`.
4. The member has a renderable ticket (live or snapshot). Unparseable snapshots are already skipped by existing behaviour and cannot be flagged.

Complete means (D-12):
- Custom JQL path: `fetch_tickets` resolved and `result.truncated === false`. Rust returns `Err` on any HTTP or parse error for any page, so a resolved result is never page-partial.
- Preset path: `localFailedUsers.length === 0 && !anyTruncated`.
- A fetch that ends in the WR-01 early return (all batches failed) or in the outer `catch` sets the signature to `null` (hints off, tickets untouched, D-13).
- Partial and truncated: `setTickets` still runs (tickets/snapshots refresh), but with `complete=false` the signature is set to `null`.

Signature contents (recommended, derive from state at fetch start, not at end, to avoid a race with a settings change mid-fetch): `baseUrl | jqlPreset | jqlCustom (only if preset==='custom') | sourceProjectKey | watched-user identifiers (only if preset==='all_watched') | mine username`. Compare using the same function at read time. `sourceProjectKey` and `watchedUsers` live in `connectionStore`/`ticketStore` and change the batch JQL, so ignoring them would leave hints visible against a different query. Derived comparison is better than clearing inside `setJqlPreset`/`setJqlCustom`: a no-op setter call (e.g. `SettingsPage` re-saving the same value, `hydrateFetchConfig` on mount) does not blank hints, and switching back to the fetched query correctly re-shows them. Do still satisfy D-14's wording: any real change hides hints until the next fetch.

During `fetchStatus === 'loading'` keep the previous eligibility (avoid flicker; UI-SPEC says no loading indicator). The next `setTickets`/`markFetchIncomplete` settles it. A selector returning a primitive string is safe against the Zustand loop; compute the signature with `useMemo` from primitive selectors, never return a fresh array/object from a selector (project memory: no `?? []`).

### Snapshot refresh (D-15, GDUR-06)

- New Rust method `GroupsDb::refresh_snapshots(&self, scope, items: &[NewMember]) -> GroupResult<usize>`:
  - validate keys and JSON as in `add_members`;
  - one `unchecked_transaction`;
  - `UPDATE issue_snapshot SET ticket_json = ?3, updated_at = ?4 WHERE scope = ?1 AND issue_key = ?2 AND ticket_json != ?3`.
- UPDATE-only is mandatory. `INSERT ... ON CONFLICT` would create snapshot rows with no membership, bypassing GC until the next remove, and `get_group_members` joins from `group_member`, so such rows would be silent orphans. Updating only existing rows is exactly the "applied only to keys that are members, in scope" requirement.
- No `gc_snapshots` call is needed (nothing is deleted).
- Add `refresh_group_snapshots_inner` and a `#[tauri::command]` in `groups_commands.rs` following the `require_scope` then `lock_groups` order (triage lock released first), and register it in `src-tauri/src/main.rs` next to `groups_commands::remove_issues_from_group` (line ~212).
- If there is no scope (`NoScope`), the frontend ignores the error silently (best-effort, `console.warn`). A refresh failure must never fail the fetch or show a toast.
- Frontend: after `store.setTickets(...)` in both the custom and the batch path, compute `keys = tickets.filter(t => groupIdsByIssue[t.key])` from `useGroupStore.getState().groupIdsByIssue`, skip the invoke if empty, otherwise `invoke('refresh_group_snapshots', { issues: [{ issueKey, ticketJson }] })`. Put this in a small helper (e.g. `groupStore.refreshSnapshots(tickets)`), fire-and-forget, not awaited ahead of the change-detection loop. Do NOT call `mutate()` (it re-hydrates all groups; a refresh does not change membership).
- `useGroupMembers` loads the snapshot map once per `keys` identity. Add a `snapshotRevision` counter to `groupStore`, bumped after a successful refresh, and include it in the effect deps. Without this, a member that was live at mount and later goes missing renders from a snapshot loaded before the refresh. Do not `setResult(null)` on the revision change (no skeleton flicker). The effect already keeps the old `result` until the new one lands.

### Present/missing split

- Extend `useGroupMembers` to return `members` (unchanged contract, all renderable members, used for tab count semantics and existing tests) plus `missingKeys: ReadonlySet<string>` (empty `Set` constant, not `?? []`) computed with `useHintsEligible()`.
- `GroupViewPage`: `sorted = sortTickets(filterTickets(members,...))` as today, then partition by `missingKeys`. Because sorting is stable and applied before partitioning, "same sort among themselves" (D-03) holds with one sort call. Render `present`, then (if `missingVisible.length > 0`) a `role="group"` block with an `h3` heading, `Remove all missing` button, then missing cards.
- Edge from UI-SPEC: subheading count N = visible (filtered) missing; popover/menu count = group-wide `missingKeys.size`. If a filter hides all missing, hide the subheading but the menu item remains.
- The existing `noResults`/`isEmpty` logic keys off `sorted.length`; keep as-is (missing counted inside `sorted`).
- Selection: `useListSelection(visibleKeys)` should receive keys in DOM order (present then missing) so Shift-range selection matches visual order. Build `visibleKeys` from the partitioned order.
- The group menu needs the missing count for the tab's group. `GroupTabStrip` renders `GroupMenuItems` for every group, but `useGroupMembers` is per-view. Compute a lightweight `missingCountForGroup(groupId)` from `memberKeysByGroup[groupId]`, live `tickets` keys, and eligibility, without needing snapshots (missing is a key-only test). Caveat: a member with an unparseable snapshot would be counted in the menu but not shown. To keep the menu count equal to the popover count, either exclude only keys known unrenderable or accept it. Recommended: have the Remove-all action operate on the same key-only set used for the menu count and note that unrenderable-snapshot members are still removed, which is consistent with "removal always explicit" and the popover count. Flag in Open Questions.
- Add `GroupMenuItems` prop `missingCount: number` and `onRemoveMissing`. Render the item only when `missingCount > 0` (hidden, not disabled), directly above the final Separator and the Delete item. Add a `'remove-missing'` kind to the `pending` intent in `GroupTabStrip` and a new `RemoveMissingPopover` (anchored via the same `anchorRef` as Rename, `onCloseAutoFocus` returning focus to the group tab through `focusGroupTrigger`). Study `recordIntent`/`handleMenuCloseAutoFocus` in `GroupTabStrip.tsx` to reuse the focus-return mechanics. Existing Phase 30 tests (`GroupTabStripOverlays.test.tsx`) show the pattern.
- The subheading-button variant of the popover: a `PopoverTrigger asChild` wrapping the Button (like `SelectionBar`). Extract one shared presentational `ConfirmRemovePopover` (question, Cancel focus-on-open, destructive Remove) used by the per-card, subheading and tab-anchored variants to avoid three copies.
- Race: when the user confirms, remove keys captured at popover-open time or recomputed at confirm time? Recompute the group-wide missing set at confirm time and guard against an empty set. If a fetch landed in between and gating turned off, abort the removal and close the popover (an issue that came back is no longer missing; never remove a now-present member silently). The popover's displayed count should come from the same live value, so it re-renders if it changes.

### TicketCard

- Current structure: root `div` with an absolute stretched `button`, content in `pointer-events-none`, and controls with `pointer-events-auto relative z-10`. Add a prop `missing?: { onRemove: ReactNode }` or better `footerSlot?: ReactNode` plus `dimmed?: boolean`.
- Apply `opacity-60` to the content wrapper only (the `pointer-events-none relative px-4 py-3` div's inner content), not the root, per UI-SPEC. The chips/selection checkbox must stay un-dimmed, so dim line 1, summary and the status/priority/assignee cluster separately, or wrap those and keep the `GroupChips` span and the select checkbox outside the dimmed wrapper. Opacity on a parent cannot be undone by a child, so the dim wrapper must not contain the chips or the Remove row. Add `transition-opacity duration-150 motion-reduce:transition-none` as UI-SPEC says.
- Footer row (hint text left, Remove button right) must be a sibling of the stretched button with `pointer-events-auto relative z-10` and `e.stopPropagation()`; place it after the content div so DOM/tab order is: card button, chips, Remove.
- Existing `actionSlot` is wrapped in a click-stopping span in line 1 and is not suited for a full-width row. Add a new footer slot instead of reusing it.

### Anti-Patterns to Avoid
- **Hover-revealed Remove or icon-only Remove** (project feedback): use the labelled button.
- **Returning `?? []` / new object from a Zustand selector.** Use `null`, a module-level frozen empty `Set`, or select primitives and derive with `useMemo`.
- **One-click remove without popover** (D-06 overrides the requirement text).
- **`INSERT ... ON CONFLICT` for refresh.** Creates orphan snapshots.
- **Awaiting the snapshot refresh before the change-detection loop** or letting its failure surface to the user.
- **Persisting the completeness flag** or resetting it in `hydrateFetchConfig`.
- **Clearing eligibility only in setters** (misses `sourceProjectKey`/watched users changes).
- **Calling `mutate()`/`hydrate()` after refresh.** Unneeded IPC and re-render churn on every poll.
- **Drag and drop** (project feedback).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bulk removal + GC | A new Rust remove path | existing `remove_issues_from_group` / `removeIssuesWithFeedback` | Atomic and already runs `gc_snapshots` (D-16) |
| Confirm popover | Custom dialog | `Popover` + SelectionBar markup (Cancel autofocus, destructive Remove) | Consistent a11y/focus behaviour |
| Tab-anchored popover and focus return | New anchoring logic | `anchorRef` + `PopoverAnchor virtualRef` + `focusGroupTrigger` from `GroupTabStrip` | Rename/Color already solve menu-close focus fights |
| Slovak plurals | Manual string building | i18next plural suffixes (mirror `groups.toast.removed_*`) | Existing convention |
| Sorting/filtering | New sorters | `sortTickets` / `filterTickets` | Same ordering as present block |

## Runtime State Inventory

Not a rename/refactor phase. One schema note: no DB migration is needed (the `issue_snapshot` and `group_member` tables are unchanged; the refresh command only updates existing rows). Stored data: existing snapshots may be stale and get refreshed lazily on the next fetch; no backfill. [VERIFIED: groups_db.rs schema]

## Common Pitfalls

### Pitfall 1: Hints flash on first load or after a failed refetch
**What goes wrong:** members are flagged because `tickets` is `[]` (before first fetch) or because a partial/failed fetch left a subset.
**How to avoid:** the gate is the signature compare, never `tickets.length`. The WR-01 early return and the outer `catch` both clear the signature. Test each path.

### Pitfall 2: Race between a settings change and an in-flight fetch
**What goes wrong:** the signature is computed at fetch end from changed state and matches a result from the old query.
**How to avoid:** capture the signature at the start of `handleFetch` and pass it to `setTickets`. (`fetchInFlightRef` serialises fetches but not settings edits.)

### Pitfall 3: Dimming the controls
**What goes wrong:** `opacity-60` on the card root dims chips, Remove and the checkbox, failing AA.
**How to avoid:** dim only a content wrapper; keep the footer row and chips outside it. Hint text uses `text-brand-text-secondary` (not `text-brand-muted`, ~3.3:1 fails).

### Pitfall 4: Stale snapshot map in `useGroupMembers`
See Snapshot refresh: bump `snapshotRevision` and add it to the effect deps.

### Pitfall 5: Refresh resurrecting or leaking snapshots
UPDATE-only; regression test: refresh with a key that is not a member leaves no row (`SELECT COUNT(*) FROM issue_snapshot`).

### Pitfall 6: Remove-all after gating flipped
See the race note above: re-check eligibility at confirm time.

### Pitfall 7: `poll-complete` listener lives only in `TicketListPage`
Poll-triggered refetch only happens while that page is mounted, so while a group view is active, background polls do not refetch, and hints persist until the next fetch on the New tab. This is acceptable and consistent with Phase 29 D-15; just do not add fetch logic to group views. The completeness state must be in the store (not component state) so it survives the New tab unmounting. [VERIFIED: TicketListPage.tsx listen effect]

### Pitfall 8: `total` vs truncation
`truncated` is the only signal for "result cap hit" (`MAX_PAGINATION_ITEMS`), already aggregated as `anyTruncated`. Do not invent a `total > issues.length` check. [VERIFIED: commands.rs fetch_tickets comments]

### Pitfall 9: Unparseable snapshot members
`useGroupMembers` already drops members whose snapshot is unreadable and no live ticket exists (user decision from Phase 29). Such a member cannot be flagged or individually removed; it is covered by the existing `incomplete` banner. Out of scope here; note it for UAT.

### Pitfall 10: Slovak plural `_many`
The repo defines `_many` alongside `_one/_few/_other` for these keys. Follow the existing quintet so `groupI18n` style tests pass.

## Code Examples

### Rust refresh (pattern from `add_members`/`remove_members`, groups_db.rs) [VERIFIED: codebase]
```rust
/// Refresh stored snapshots of existing members only (D-15). Never inserts, never deletes.
pub fn refresh_snapshots(&self, scope: &str, items: &[NewMember]) -> GroupResult<usize> {
    for item in items {
        if !is_valid_issue_key(&item.issue_key) {
            return Err(GroupError::new(GroupErrorCode::InvalidIssueKey));
        }
        match serde_json::from_str::<serde_json::Value>(&item.ticket_json) {
            Ok(serde_json::Value::Object(_)) => {}
            _ => return Err(GroupError::new(GroupErrorCode::InvalidTicket)),
        }
    }
    let now = chrono::Utc::now().to_rfc3339();
    let tx = self.conn.unchecked_transaction()?;
    let mut changed = 0usize;
    for item in items {
        changed += tx.execute(
            "UPDATE issue_snapshot SET ticket_json = ?3, updated_at = ?4
             WHERE scope = ?1 AND issue_key = ?2 AND ticket_json != ?3",
            params![scope, item.issue_key, item.ticket_json, now],
        )?;
    }
    tx.commit()?;
    Ok(changed)
}
```

### Store additions (shape)
```ts
// ticketStore.ts (session-only; do not persist or hydrate)
lastCompleteFetchSignature: string | null; // null = no hints
setTickets(tickets, triageMap, total, truncated = false, completeSignature: string | null = null)
markFetchIncomplete: () => void; // set({ lastCompleteFetchSignature: null })
```
`setTickets` callers: only `TicketListPage` (two sites) plus tests. Default `null` keeps old callers/tests hint-free (safe default).

### Eligibility hook (shape)
```ts
export function useHintsEligible(): boolean {
  const sig = useTicketStore((s) => s.lastCompleteFetchSignature);
  const preset = useTicketStore((s) => s.jqlPreset);
  const custom = useTicketStore((s) => s.jqlCustom);
  const watched = useTicketStore((s) => s.watchedUsers); // stable ref from store
  const projectKey = useConnectionStore((s) => s.sourceProjectKey);
  const baseUrl = useConnectionStore((s) => s.serverConnection?.baseUrl ?? null);
  return useMemo(
    () => sig !== null && sig === fetchSignature({ preset, custom, watched, projectKey, baseUrl }),
    [sig, preset, custom, watched, projectKey, baseUrl],
  );
}
```
`fetchSignature` is a pure function shared with `handleFetch` (put it in `src/features/tickets/fetchSignature.ts`). The username for the "mine" batch comes from `serverConnection.username`; include it.

## State of the Art

N/A (internal feature). Relevant project conventions: Phase 31 confirmation popover, Phase 30 tab-anchored popovers, sonner toasts, Slovak plural quintet.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Including `baseUrl`, `sourceProjectKey`, watched-user identifiers and username in the query signature (beyond preset/custom JQL named in D-14) is desired | Gating rules | Low: it only hides hints in more cases; user may prefer the minimal D-14 reading |
| A2 | Menu-item count may include members with unreadable snapshots (key-only test), matching the popover count | Present/missing split | Low: tiny count mismatch vs visible cards in a rare corrupt-snapshot case |
| A3 | On confirm, abort bulk removal if gating flipped off in the meantime | Present/missing split | Low: safer behaviour; planner may choose a toast instead of silent close |
| A4 | Keeping hints (not blanking) while `fetchStatus === 'loading'` | Gating rules | Low: purely a flicker choice; D-13 only constrains the latest finished fetch |

## Open Questions

1. **Failure to refresh snapshots: any user feedback?**
   - Recommendation: none (console warn). D-15 is best-effort and must not disturb the fetch.
2. **Menu count when a filter is active?**
   - UI-SPEC already says group-wide. Resolved.
3. **Unreadable-snapshot members (Pitfall 9, A2).**
   - Recommendation: accept; flag for UAT.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm / vitest | frontend tests | yes (vitest binary present in node_modules) | ^4.1.1 | none needed |
| cargo | Rust tests | yes | 1.95.0 | none needed |

No external services needed; the mock server is not required (no new Jira requests).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Frontend | vitest ^4.1.1, jsdom, @testing-library/react + user-event, `globals: true` |
| Frontend config | `/Users/mimo/Documents/Projects/pmkar/vitest.config.ts` (setup `src/test-setup.ts`) |
| Backend | Rust `cargo test` (inline `#[cfg(test)]` modules in `groups_db.rs` and `groups_commands.rs`; in-memory DBs) |
| Quick run | `npx vitest run src/features/groups src/features/tickets/__tests__/ticketStore.test.ts src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx` |
| Rust quick run | `cargo test --manifest-path src-tauri/Cargo.toml groups_` |
| Full suite | `npm test` and `cargo test --manifest-path src-tauri/Cargo.toml`; lint `npm run lint` (biome), `tsc` via `npm run build` |

Test conventions to copy: `GroupViewPage.test.tsx` mocks `@tauri-apps/api/core` `invoke` and `sonner`, seeds `useGroupStore.setState` / `useTicketStore.setState`; `TicketListPage.handleFetch.test.tsx` mocks `invoke` and `@tauri-apps/api/event` `listen` and has a `deferred()` helper.

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GDUR-01 | Fetch result without member leaves `group_member` intact; refresh never changes membership | Rust unit | `cargo test ... refresh_snapshots_never_changes_membership` | Wave 0 (new test in groups_db.rs) |
| GDUR-01 | `GroupViewPage` still renders absent member from snapshot when gate is off | component | `npx vitest run src/features/groups/__tests__/GroupViewPage.test.tsx` | extend existing |
| GDUR-02 | Absent member renders from snapshot (existing) | component | same + `useGroupMembers.test.tsx` | exists |
| GDUR-03 | Eligible + absent: dimmed content, hint text, labelled Remove with aria-label, controls undimmed, card still opens detail | component | `npx vitest run src/features/groups/__tests__/GroupViewPage.test.tsx` and `src/features/tickets/__tests__/TicketCard.test.tsx` | extend existing |
| GDUR-03 | Per-card Remove popover: Cancel focused, confirm calls `remove_issues_from_group` with one key; failure toasts error and member stays | component | same | Wave 0 (new cases) |
| GDUR-04 | No hints: before first fetch; after partial (one batch fails); on truncated; after all-batches-failed; after thrown custom JQL; after preset/custom JQL change; after `sourceProjectKey` change | store + component | `npx vitest run src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx src/features/tickets/__tests__/ticketStore.test.ts` plus new `fetchSignature.test.ts` / `useHintsEligible.test.tsx` | Wave 0 |
| GDUR-04 | Hints return after next complete fetch; poll-triggered refetch counts | component | handleFetch test (poll-complete mock of `listen`) | Wave 0 |
| GDUR-05 | Subheading shows "No longer in results (N)"; "Remove all missing" popover shows group-wide count; confirm makes ONE `remove_issues_from_group` call with all missing keys; toast success; error leaves all | component | GroupViewPage test | Wave 0 |
| GDUR-05 | Menu item appears only when missing > 0 and gate on, above Delete; hidden otherwise (not disabled); opens tab-anchored popover | component | `npx vitest run src/features/groups/__tests__/GroupMenuItems.test.tsx src/features/groups/__tests__/GroupTabStripOverlays.test.tsx` | extend existing |
| GDUR-05 | Missing block: sorted after present; same sort; filter applies to both; tab count unchanged; one missing -> still offered | component | GroupViewPage test | Wave 0 |
| GDUR-06 | Refresh updates ticket_json for members only; unchanged JSON not rewritten; non-member key creates no row; invalid key/JSON rejected | Rust unit | `cargo test ... refresh_snapshots` | Wave 0 |
| GDUR-06 | Command wiring: scope derived in Rust, NoScope error, triage lock released | Rust unit | `cargo test ... groups_commands` | Wave 0 |
| GDUR-06 | GC regression: after remove / remove-all / delete_group, snapshot rows with no membership are gone; snapshot kept while another group references it | Rust unit | `cargo test ... gc` | Wave 0 (verify what exists in the current test module, then add missing) |
| GDUR-06 | Frontend: after `setTickets` the handleFetch invokes `refresh_group_snapshots` only with member keys; skipped when none; failure does not change fetch status; partial/truncated still refresh | component | handleFetch test | Wave 0 |
| GDUR-06 | `useGroupMembers` reloads snapshots when `snapshotRevision` bumps | hook | `npx vitest run src/features/groups/__tests__/useGroupMembers.test.tsx` | extend |
| i18n | EN/SK keys exist with plural forms (`_one/_few/_many/_other`) for subheading, menu item, confirm, toast | unit | `npx vitest run src/features/groups/__tests__/groupI18n.test.ts` | extend |

### Sampling Rate
- **Per task commit:** quick vitest command for touched files (or `cargo test groups_` for Rust tasks).
- **Per wave merge:** `npm test` + `cargo test --manifest-path src-tauri/Cargo.toml` + `npm run lint`.
- **Phase gate:** full suites green plus `tsc` (`npm run build` type check) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Rust tests for `refresh_snapshots` and for remove / remove-all / delete GC regression in `src-tauri/src/groups_db.rs` (inline `mod tests`).
- [ ] Rust command-level test in `groups_commands.rs` for `refresh_group_snapshots_inner` (follow `dbs()` / `set_meta()` helpers).
- [ ] Frontend: new `fetchSignature` and `useHintsEligible` tests; completeness cases in `TicketListPage.handleFetch.test.tsx` (reuse `makeFetchResult(keys, truncated)` and `deferred`).
- [ ] No framework install needed.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2/V3 Authentication/Session | no | n/a |
| V4 Access Control | yes (scope isolation) | scope derived in Rust from `connection_meta`, never accepted from the frontend (existing rule); refresh UPDATE and removal are scope-constrained by `WHERE scope = ?` |
| V5 Input Validation | yes | validate issue key shape (`is_valid_issue_key`) and JSON-object `ticket_json` in the new command, same as `add_members`; parameterised SQL only |
| V6 Cryptography | no | n/a |

| Threat | STRIDE | Mitigation |
|--------|--------|------------|
| SQL injection via key/JSON | Tampering | rusqlite `params!` only |
| Cross-server snapshot overwrite | Tampering | scope in every WHERE clause; test with two scopes |
| Oversized IPC payload on large fetches | DoS | frontend sends only member tickets; command validates before the transaction |
| Data loss by silent removal | Integrity (GDUR-01) | UPDATE-only refresh, popover-confirmed removals, regression tests |

## Sources

### Primary (HIGH confidence, this repo as of 2026-10-12)
- `src-tauri/src/groups_db.rs` (schema, `add_members`, `remove_members`, `gc_snapshots`, `get_group_members`)
- `src-tauri/src/groups_commands.rs`, `src-tauri/src/main.rs` (command registration at ~line 203-212), `src-tauri/src/commands.rs` `fetch_tickets` (pagination, `truncated`, Err on failure)
- `src/features/tickets/TicketListPage.tsx` (`handleFetch`, presets JQL with `statusCategory != Done`, poll-complete listener), `ticketStore.ts`
- `src/features/groups/{useGroupMembers,GroupViewPage,GroupMenuItems,GroupTabStrip,RenameGroupPopover,SelectionBar,membershipActions,groupStore}.ts(x)`, `src/features/tickets/TicketCard.tsx`
- `.planning/phases/32-durability/32-CONTEXT.md`, `32-UI-SPEC.md`, `.planning/REQUIREMENTS.md`

### Secondary / Tertiary
- none (no external sources needed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (no new dependencies)
- Architecture: HIGH (derived from existing code and locked decisions)
- Pitfalls: HIGH for code-derived items; MEDIUM for the exact focus-return mechanics in `GroupTabStrip` (read `recordIntent`/`handleMenuCloseAutoFocus` while planning)

**Research date:** 2026-10-12
**Valid until:** 30 days (stable internal code), or until Phases 30-31 files change
