# Phase 32: Durability - Pattern Map

**Mapped:** 2026-10-12
**Files analyzed:** 19 (new or modified, plus test files)
**Analogs found:** 19 / 19 (the only part with no analog is the signature helper, which is pure and trivial)

All paths are relative to `/Users/mimo/Documents/Projects/pmkar`. Line numbers refer to the files as read on 2026-10-12.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/groups_db.rs` (add `refresh_snapshots` + tests) | model/db | CRUD (batch UPDATE, transaction) | `add_members` / `remove_members` in same file | exact |
| `src-tauri/src/groups_commands.rs` (add `refresh_group_snapshots_inner` + command + test) | controller (Tauri command) | request-response | `add_issues_to_group_inner` + `add_issues_to_group` | exact |
| `src-tauri/src/main.rs` (register command) | config | n/a | line 203-212 `generate_handler!` block | exact |
| `src/features/tickets/ticketStore.ts` (add `lastCompleteFetchSignature`, `markFetchIncomplete`, extend `setTickets`) | store | event-driven (session state) | `truncated` / `hasFetchedThisSession` in same file | exact |
| `src/features/tickets/fetchSignature.ts` (new, pure) | utility | transform | `buildMineBatchJql` / `buildUserBatchJql` in `TicketListPage.tsx` lines ~35-55 | role-match |
| `src/features/tickets/useHintsEligible.ts` (new hook; may live in `groups/`) | hook | request-response (derived read) | `useGroupMembers` selectors (`groups/useGroupMembers.ts` 62-65) | role-match |
| `src/features/tickets/TicketListPage.tsx` (`handleFetch` wiring) | component | request-response (fetch orchestration) | itself (lines 123-322) | exact |
| `src/features/groups/groupStore.ts` (`refreshSnapshots`, `snapshotRevision`) | store | CRUD (fire-and-forget invoke) | `mutate` + `removeFromGroup` in same file | role-match |
| `src/features/groups/useGroupMembers.ts` (return `missingKeys`, revision dep) | hook | transform | itself | exact |
| `src/features/groups/GroupViewPage.tsx` (partition, subheading block, selection order) | component | request-response | itself | exact |
| `src/features/tickets/TicketCard.tsx` (`dimmed`, `footerSlot`) | component | request-response | itself (pointer-events layering, lines 56-141) | exact |
| `src/features/groups/ConfirmRemovePopover.tsx` (new, shared presentational) | component | request-response | `SelectionBar.tsx` 100-136 and `DetailGroupsRow.tsx` 92-134 | exact |
| `src/features/groups/RemoveMissingPopover.tsx` (new, tab-anchored) | component | request-response | `RenameGroupPopover.tsx` | exact |
| `src/features/groups/GroupMenuItems.tsx` (new item above Delete) | component | event-driven | itself | exact |
| `src/features/groups/GroupTabStrip.tsx` (new `remove-missing` intent/pending + count wiring) | component | event-driven | itself (`recordIntent`, `handleMenuCloseAutoFocus`) | exact |
| `src/features/groups/membershipActions.ts` (reuse; maybe a no-toast single-remove variant) | utility | request-response | `removeIssuesWithFeedback` | exact |
| `src/i18n/locales/en.json`, `sk.json` | config | n/a | `groups.bar.removeConfirm*`, `groups.toast.removed*` (en.json 571-591) | exact |
| Tests: `GroupViewPage.test.tsx`, `GroupTabStripOverlays.test.tsx`, `GroupMenuItems.test.tsx`, `useGroupMembers.test.tsx`, `TicketListPage.handleFetch.test.tsx`, `ticketStore.test.ts`, `TicketCard.test.tsx`, `groupI18n.test.ts`; new `fetchSignature.test.ts`, `useHintsEligible.test.tsx` | test | n/a | the existing files themselves | exact |

## Pattern Assignments

### `src-tauri/src/groups_db.rs` : `refresh_snapshots` (model, batch UPDATE in one transaction)

**Analog:** `add_members` (lines 570-605) for validation and transaction shape; `remove_members` (607-624) and `gc_snapshots` (628-636) for GC.

**Validation + transaction pattern** (lines 570-605, copy the validate-all-first then `unchecked_transaction` structure, but DROP `ensure_group_in_scope` and the INSERTs):
```rust
pub fn add_members(&self, scope: &str, group_id: i64, items: &[NewMember]) -> GroupResult<usize> {
    self.ensure_group_in_scope(scope, group_id)?;
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
    ...
    tx.commit()?;
```
The exact UPDATE-only body is in 32-RESEARCH.md "Code Examples" (UPDATE ... `WHERE scope = ?1 AND issue_key = ?2 AND ticket_json != ?3`). Do not use the `INSERT ... ON CONFLICT` at lines 588-593 (that is what `add_members` does; it would create orphan snapshots here). `NewMember` is at lines 308-312 (camelCase serde) and is reused as the payload type.

**Test pattern** (lines 1017-1027, `remove_members_gcs_snapshots`; helpers `new_db()`, `S`, `member("AB-1")`, `snapshot_count(&db)`; refresh test at ~1010-1015 uses `db.add_members(S, a.id, &[refreshed])` then `get_group_members`):
```rust
#[test]
fn remove_members_gcs_snapshots() {
    let db = new_db();
    let a = db.create_group(S, "A", None).unwrap();
    db.add_members(S, a.id, &[member("AB-1"), member("AB-2")]).unwrap();
    let n = db.remove_members(S, a.id, &["AB-1".to_string()]).unwrap();
    assert_eq!(n, 1);
    assert_eq!(snapshot_count(&db), 1);
    assert_eq!(db.list_groups(S).unwrap()[0].member_count, 1);
}
```
New tests to add next to it: `refresh_snapshots_updates_members_only` (non-member key leaves `snapshot_count` unchanged), `refresh_snapshots_never_changes_membership`, unchanged JSON returns 0 changed, invalid key / non-object JSON rejected, two-scope isolation, and GC regressions (remove all of a group's members; `delete_group`; snapshot retained while another group references it). Check the existing test module first for which GC cases already exist.

---

### `src-tauri/src/groups_commands.rs` : `refresh_group_snapshots_inner` + command (controller, request-response)

**Analog:** `add_issues_to_group_inner` (lines 127-135) and `add_issues_to_group` (lines 221-229).

**Scope/lock order** (lines 39-46; scope is resolved FIRST so the triage lock is released before the groups lock is taken):
```rust
fn require_scope(triage_db: &Arc<Mutex<TriageDb>>) -> GroupResult<String> {
    resolve_scope(triage_db)?.ok_or_else(|| GroupError::new(GroupErrorCode::NoScope))
}
fn lock_groups(groups_db: &Arc<Mutex<GroupsDb>>) -> GroupResult<MutexGuard<'_, GroupsDb>> {
    groups_db.lock().map_err(|_| internal("Groups DB lock poisoned"))
}
```
**Inner + command** (lines 127-135 and 221-229):
```rust
pub fn add_issues_to_group_inner(triage_db: &Arc<Mutex<TriageDb>>, groups_db: &Arc<Mutex<GroupsDb>>,
    group_id: i64, issues: &[NewMember]) -> GroupResult<usize> {
    let scope = require_scope(triage_db)?;
    lock_groups(groups_db)?.add_members(&scope, group_id, issues)
}

#[tauri::command]
pub fn add_issues_to_group(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    groups_db: tauri::State<'_, Arc<Mutex<GroupsDb>>>,
    group_id: i64,
    issues: Vec<NewMember>,
) -> Result<usize, GroupError> {
    add_issues_to_group_inner(&triage_db, &groups_db, group_id, &issues)
}
```
New command takes only `issues: Vec<NewMember>` (no `group_id`), calls `lock_groups(groups_db)?.refresh_snapshots(&scope, issues)`.

**Registration:** `src-tauri/src/main.rs` lines 203-212, add `groups_commands::refresh_group_snapshots,` after `groups_commands::remove_issues_from_group,` (line 212).

**Test helpers** (lines 246-263 `dbs()`, `set_meta(&t, "server", "https://...", "u")`; NoScope assertion at ~289-293; lock-release assertion `assert!(t.try_lock().is_ok(), "triage lock must be released")` at ~line 280).

---

### `src/features/tickets/ticketStore.ts` (store, session-only state)

**Analog:** the `truncated` field and `setTickets` in the same file.

Interface (lines 21-23, 35-40) and implementation (lines 99-110):
```ts
  /** True when the last fetch exceeded the backend pagination cap. UI surfaces a warning. */
  truncated: boolean;
  ...
  setTickets: (tickets, triageMap, total, truncated?: boolean) => void;

  setTickets: (tickets, triageMap, total, truncated = false) => {
    const safeMap = triageMap ?? {};
    const newCount = Object.values(safeMap).filter((e) => e.state === 'new').length;
    set({ tickets, triageMap: safeMap, totalCount: total, newCount, truncated,
          fetchStatus: 'idle', fetchError: null });
  },
```
Add `lastCompleteFetchSignature: string | null` (initial `null`, next to `truncated: false` at line 85, `hasFetchedThisSession` at line 94), a 5th `setTickets` param `completeSignature: string | null = null` written in the same `set({...})`, and `markFetchIncomplete: () => set({ lastCompleteFetchSignature: null })` (style of `setHasFetchedThisSession` at line 150). Do NOT touch it in `hydrateFetchConfig` (lines 143-146) or `setJqlPreset`/`setJqlCustom` (138-139); the query-change gate is a derived signature compare. The state must not be in any persisted config.

---

### `src/features/tickets/fetchSignature.ts` (utility, transform)

**Analog:** `buildMineBatchJql` / `buildUserBatchJql` in `TicketListPage.tsx` (lines ~35-55) are pure functions taking `(identifier, sourceProjectKey)` and returning a string; copy that "pure, exported, unit-testable" style. Inputs per research: `baseUrl, preset, custom (only if preset==='custom'), projectKey, watched identifiers (only if all_watched), mine username`. Capture it at the START of `handleFetch` and pass to `setTickets` (Pitfall 2). Note `connState.sourceProjectKey` and `serverConn.baseUrl` are already read inside `handleFetch` (lines 135-141, ~205).

---

### `src/features/tickets/useHintsEligible.ts` (hook, derived read)

**Analog:** `useGroupMembers` selector discipline (`groups/useGroupMembers.ts` lines 62-65):
```ts
  // null fallback only: a fresh [] inside a selector causes an infinite re-render loop.
  const keys = useGroupStore((s) => s.memberKeysByGroup[groupId] ?? null);
  const tickets = useTicketStore((s) => s.tickets);
```
Select only primitives or stable store refs (signature string, preset, custom, `watchedUsers`, `sourceProjectKey`, baseUrl, username), then `useMemo` the compare (see RESEARCH.md "Eligibility hook (shape)"). Never return `?? []` or a new object from a selector (project memory).

---

### `src/features/tickets/TicketListPage.tsx` : `handleFetch` (component, fetch orchestration)

**Analog:** itself. Insertion points:

- Custom JQL path, line 150: `store.setTickets(result.issues, result.triageMap, result.total, result.truncated);` becomes pass `completeSig = result.truncated ? null : sig`. Then fire-and-forget `refreshSnapshots(result.issues)` BEFORE the change-detection loop at ~158 (do not await it).
- Batch path, line 265: `store.setTickets(mergedIssues, mergedTriageMap, totalCount, anyTruncated);` becomes pass `complete = localFailedUsers.length === 0 && !anyTruncated ? sig : null`. Same refresh call.
- WR-01 early return, lines 251-257 (all batches failed): add `store.markFetchIncomplete()` before `return`.
- Outer catch, lines 321-322: `store.setFetchStatus('error', ...)`; add `store.markFetchIncomplete()`.
- Existing partial-failure UI state (`setFailedUserNames(localFailedUsers)`, lines 260-262) stays as is; completeness is a separate store flag.
```ts
      if (localFailedUsers.length === batches.length) {
        store.setFetchStatus('error', `All ${batches.length} batch(es) failed. Check your connection.`);
        return;
      }
```
**Test analog:** `__tests__/TicketListPage.handleFetch.test.tsx` mocks `invoke` + `listen`, helpers `makeTicket`, `makeFetchResult(keys, truncated)`, `deferred()` (lines 1-50). Reuse for completeness cases and the `refresh_group_snapshots` invoke assertions (only member keys; skipped when none; failure does not alter fetch status).

---

### `src/features/groups/groupStore.ts` : `refreshSnapshots`, `snapshotRevision` (store, fire-and-forget IPC)

**Analog:** `mutate` (lines 56-72) and the `invoke` import (line 1). Unlike `mutate`, the refresh must NOT call `get().hydrate()` (would re-hydrate on every poll) and must swallow errors with `console.warn`:
```ts
async function mutate<T>(command: string, args: Record<string, unknown>): Promise<GroupResult<T>> {
  let value: T;
  try {
    value = await invoke<T>(command, args);
  } catch (err) {
    const code = toGroupErrorCode(err);
    if (code === 'not_found') await get().hydrate();
    return { ok: false, code };
  }
  await get().hydrate();
  return { ok: true, value };
}
```
Copy the `try { invoke } catch (err) { toGroupErrorCode(err) }` shape, filter tickets by `get().groupIdsByIssue[t.key]`, skip empty, payload `{ issues: [{ issueKey, ticketJson: JSON.stringify(t) }] }` (same shape `addToGroup` builds; check its implementation in the same file for the serialization), then `set((s) => ({ snapshotRevision: s.snapshotRevision + 1 }))` only when the Rust call reports changes (or always on ok). Add `snapshotRevision: number` to `GroupState` (interface lines 33-52).

---

### `src/features/groups/useGroupMembers.ts` (hook, transform)

**Analog:** itself.

- Effect deps at line 98: `}, [groupId, keys, attempt]);` add `snapshotRevision` (select it as a primitive: `useGroupStore((s) => s.snapshotRevision)`). Keep the old `result` until the new one lands; do not `setResult(null)` on revision change (contrast with `retry` at 113-116, which does).
- `members` memo at lines 102-112 is the place to compute `missingKeys` (key-only test: `!live.has(key)` AND `hintsEligible` AND the member is renderable). Return a module-level frozen empty `Set` constant when not eligible (no `?? []`).
```ts
    const live = new Map(tickets.map((t) => [t.key, t]));
    for (const key of keys) {
      const ticket = live.get(key) ?? snapshots?.[key];
      if (ticket) out.push(ticket);
    }
```
Return type (lines 46-56) gains `missingKeys: ReadonlySet<string>`. Existing `members` contract stays unchanged.

---

### `src/features/groups/GroupViewPage.tsx` (component)

**Analog:** itself.

- Sort/filter then partition (lines 28-31): keep one `sortTickets(filterTickets(...))` call, then split by `missingKeys`. Build `visibleKeys` (line 33) from `[...present, ...missing]` so `useListSelection` range selection matches DOM order.
- Card render loop (lines 90-128): extend `TicketCard` usage with `dimmed` + `footerSlot` for missing tickets. The `actionSlot` markup stays.
- Missing block: render after the loop inside the `overflow-y-auto` div (line 89), only when visible missing > 0. Subheading structure per UI-SPEC: `role="group"` with `aria-labelledby`, `h3` heading, `border-t border-brand-border`, `px-4`, `min-h-10`, outline sm "Remove all missing" button wrapped in the shared confirm popover.
- Keep `isEmpty` / `noResults` logic (lines 44-46) unchanged.
- Failure toast: call `removeIssuesWithFeedback` (below) for bulk; for the single remove use `removeFromGroup` + `toast.error(t(membershipErrorKey(r.code)))` and no success toast (UI-SPEC).
- Group-wide count for the bulk popover = `missingKeys.size`, subheading count = visible missing (UI-SPEC section "Missing block" item 3).
- Zustand rule: read `group` the way line 35 does (`useGroupStore((s) => s.groups.find(...))` returns `undefined`, stable).

**Test analog:** `__tests__/GroupViewPage.test.tsx` (seeds via `useGroupStore.setState({ memberKeysByGroup, hydrated: true })` and `useTicketStore.setState({ tickets, triageMap, selectedTicketKey: null })`, lines 58-59; mocks `invoke` and `sonner`).

---

### `src/features/tickets/TicketCard.tsx` (component, layering)

**Analog:** itself. Structure to respect (lines 52-141):
```tsx
<div data-testid="ticket-card" className="group relative border-b ...">
  <button type="button" aria-label={ticket.fields.summary} onClick=... className="absolute inset-0 w-full h-full ..." />
  <div className={`pointer-events-none relative px-4 py-3 ${selectMode ? 'pl-14' : ''}`}>
    ... line 1 (key, unseen badge, <span className="pointer-events-auto relative z-10" onClick={(e) => e.stopPropagation()}>{actionSlot}</span>)
    ... summary <p>
    ... metadata row ... <span className="pointer-events-auto relative z-10 ml-auto min-w-0"><GroupChips .../></span>
  </div>
  {selectMode && <button role="checkbox" className="absolute left-4 top-1/2 ... z-10 ..."/>}
</div>
```
Constraint (RESEARCH "TicketCard", Pitfall 3): `opacity` on a parent cannot be undone by a child, and `GroupChips` (line ~135) and the checkbox (line ~143) live inside/next to the content div. So dim by wrapping only the non-control pieces (key/dates line, summary, status/priority/assignee cluster) in an `opacity-60 transition-opacity duration-150 motion-reduce:transition-none` wrapper, leaving the chips span and checkbox outside it. Footer row = new sibling after the content div: `pointer-events-auto relative z-10 px-4 pb-3 flex items-center justify-between` with `onClick={(e) => e.stopPropagation()}`; the `select mode` left padding (`pl-14`) should apply to it too. Do not reuse `actionSlot`; its span (lines 83-88) is inline in line 1.

**Test analog:** `tickets/__tests__/TicketCard.test.tsx`.

---

### `src/features/groups/ConfirmRemovePopover.tsx` (new shared presentational) 

**Analog A (trigger-anchored):** `SelectionBar.tsx` lines 100-136:
```tsx
<Popover open={removeOpen && !actionsDisabled} onOpenChange={setRemoveOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm" disabled={actionsDisabled}>{t('groups.bar.remove')}</Button>
  </PopoverTrigger>
  <PopoverContent className="w-70 p-4" side="top"
    onOpenAutoFocus={(e) => { e.preventDefault(); cancelRef.current?.focus(); }}>
    <p className="text-sm font-semibold text-brand-text mb-3">
      {t('groups.bar.removeConfirm', { count, name: group.name })}
    </p>
    <div className="flex justify-end gap-2">
      <Button ref={cancelRef} type="button" variant="outline" size="sm" onClick={() => setRemoveOpen(false)}>{t('groups.cancel')}</Button>
      <Button type="button" variant="destructive" size="sm" className="text-white" onClick={handleRemove}>{t('groups.confirm.remove')}</Button>
    </div>
  </PopoverContent>
</Popover>
```
**Analog B (single-target, Phase 31 chip x):** `DetailGroupsRow.tsx` lines 92-134 (same markup; `confirmGroupId` controlled state; `cancelRef` defined at line 43).

**In-flight guard** (SelectionBar lines 40-57): `inFlightRemoveRef`, `setRemoveOpen(false)` after the awaited action, `finally` resets the ref. Copy this to prevent double submit.

Use for three variants: per-card (trigger = Remove button, aria-label `groups.card.remove...`), subheading (trigger = Remove all missing), tab-anchored (no trigger; see below). Closing/Esc returns focus to the trigger automatically for the two trigger variants.

---

### `src/features/groups/RemoveMissingPopover.tsx` (new, tab-anchored) and `GroupTabStrip.tsx` focus-return mechanics

**Analog:** `RenameGroupPopover.tsx` (whole file, 73 lines). Key excerpt, the anchor + explicit focus return (lines 56-72):
```tsx
<Popover open={open && group !== null} onOpenChange={onOpenChange}>
  <PopoverAnchor virtualRef={anchorRef} />
  <PopoverContent align="start" className="w-[280px] p-4"
    onCloseAutoFocus={(e) => {
      // No PopoverTrigger exists, so focus is returned explicitly (D-08).
      e.preventDefault();
      onReturnFocus();
    }}>
```
Props to copy: `{ group, open, anchorRef, onOpenChange, onReturnFocus }`. Add Cancel-autofocus via `onOpenAutoFocus` (SelectionBar pattern) instead of the autoFocus input.

**How the tab-anchored flow works end to end in `GroupTabStrip.tsx` (the MEDIUM-confidence item). Sequence and exact code:**

1. Types (lines 24-32) -- extend both unions with `'remove-missing'`:
```ts
export type PendingAction = { groupId: number; kind: 'rename' | 'color' | 'delete'; } | null;
type MenuIntent = { groupId: number; kind: 'rename' | 'color' | 'delete' | 'move-left' | 'move-right'; } | null;
```
2. Menu item `onSelect` only records an intent (lines 253-272, `renderMenuItems`, and lines 169-171 for the function):
```ts
  function recordIntent(groupId: number, kind: NonNullable<MenuIntent>['kind']) {
    menuIntentRef.current = { groupId, kind };
  }
  ...
  <GroupMenuItems variant={variant} ... onRename={() => recordIntent(g.id, 'rename')} ... onDelete={() => recordIntent(g.id, 'delete')} />
```
Add `missingCount={...}` and `onRemoveMissing={() => recordIntent(g.id, 'remove-missing')}`.
3. When the menu closes, Radix calls `onMenuCloseAutoFocus` = `handleMenuCloseAutoFocus` (lines 173-199). It prevents the default focus-restore, sets the anchor to the group's tab wrapper, remembers which group to refocus, then opens the pending popover:
```ts
  function handleMenuCloseAutoFocus(e: Event) {
    const intent = menuIntentRef.current;
    menuIntentRef.current = null;
    if (!intent) return;
    e.preventDefault();
    if (intent.kind === 'move-left' || intent.kind === 'move-right') { void handleMove(...); return; }
    anchorRef.current = wrapperRefs.current.get(intent.groupId) ?? null;
    returnFocusIdRef.current = intent.groupId;
    if (intent.kind === 'delete') { ... setDeleteTarget(...); return; }
    setPending({ groupId: intent.groupId, kind: intent.kind });
  }
```
`'remove-missing'` needs NO new branch here: it falls through to the final `setPending(...)` line, so only the types need widening. (`'delete'` has its own branch because it uses `DeleteGroupDialog`.)
4. Render next to Rename/Color (lines 379-397), same props:
```tsx
<RenameGroupPopover
  group={pending?.kind === 'rename' ? pendingGroup : null}
  open={pending?.kind === 'rename'}
  anchorRef={anchorRef}
  onOpenChange={(o) => { if (!o) setPending(null); }}
  onReturnFocus={() => focusGroupTrigger(returnFocusIdRef.current)}
/>
```
5. Focus return = `focusGroupTrigger` (lines 148-155): sets `pendingFocus` to the `…` button if the group tab is active, else the tab button; an effect at lines 124-134 focuses it once refs exist:
```ts
  function focusGroupTrigger(id: number) {
    if (!useGroupStore.getState().groups.some((g) => g.id === id)) return;
    setPendingFocus({ id, target: activeTab === groupTabId(id) ? 'more' : 'tab', source: 'manage' });
  }
```
6. Vanished-group guard (lines 136-142): `if (pending && pending.kind !== 'delete' && !groups.some(...)) { setPending(null); toast.error(t('groups.error.notFound')); }` already covers `remove-missing` since it only exempts `'delete'`.

Notes for the planner:
- The `onCloseAutoFocus` of the popover fires on every close (confirm success, Cancel, Esc, outside click), so confirm should just call `onOpenChange(false)` and let `onReturnFocus` run.
- A `remove-missing` removal can leave the group view with zero members; `focusGroupTrigger` is still valid because the group persists.
- `GroupTabStrip` has no per-group member data. Compute the count from `useGroupStore` `memberKeysByGroup[g.id]`, `useTicketStore` `tickets` keys and `useHintsEligible()` in a small hook/helper (RESEARCH "Present/missing split"); do not call `useGroupMembers` (it is per-view and loads snapshots).
- `GroupTab`'s `renderMenuItems` is used for both the dropdown and context-menu variants, so one prop addition in `GroupMenuItems` covers both.
- Existing overlay tests to extend: `__tests__/GroupTabStripOverlays.test.tsx` helpers `seed(groups)`, `openMoreMenu(user, name)` (lines 96-98: focus the `Group actions for <name>` button then `{Enter}`), `tabButton(name)`; Rename flow assertions at lines 133-157 (`findByRole('menuitem', { name: ... })`, then wait for the popover content, then check `document.activeElement` after close).

---

### `src/features/groups/GroupMenuItems.tsx` (component)

**Analog:** itself. Add props `missingCount: number` and `onRemoveMissing: () => void`. Render only when `missingCount > 0` (hidden, not disabled), immediately after the Move-right item's `<Separator />` and before the destructive Delete (lines 51-55 area):
```tsx
      <Separator />
      <Item destructive onSelect={onDelete}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {t('groups.menu.delete')}
      </Item>
```
Per CONTEXT D-09 the new item sits above `Delete group…`; keep the existing separator before the delete group and put the new item inside that group above Delete (it is a destructive-ish action; reuse the `destructive` prop is optional, UI-SPEC does not mandate). Pick an icon from lucide (imports at line 1 list `ArrowLeft, ArrowRight, Palette, Pencil, Trash2`). The label uses `t('groups.menu.removeMissing', { count })`. Existing test: `__tests__/GroupMenuItems.test.tsx` (extend for shown/hidden).

---

### `src/features/groups/membershipActions.ts` (utility)

**Analog:** `removeIssuesWithFeedback` (lines 35-47). Reuse for Remove all missing (one atomic call, success toast). The toast text uses `groups.toast.removed` plural keys, which already match the UI-SPEC success copy.
```ts
export async function removeIssuesWithFeedback(group, issueKeys, t): Promise<boolean> {
  const r = await useGroupStore.getState().removeFromGroup(group.id, issueKeys);
  if (!r.ok) { toast.error(t(membershipErrorKey(r.code))); return false; }
  toast.success(t('groups.toast.removed', { count: r.value, name: group.name }));
  return true;
}
```
For the single per-card remove (no success toast per UI-SPEC), either add a sibling `removeIssueQuietly` that mirrors the failure branch only, or an options arg. `membershipErrorKey` (lines 8-10) is exported for that.

---

### i18n (`src/i18n/locales/en.json`, `sk.json`)

**Analog:** en.json lines 561, 571-575, 587-591. Plural quintet convention:
```json
"groups.bar.removeConfirm": "Remove {{count}} issues from ‘{{name}}’?",
"groups.bar.removeConfirm_one": "Remove 1 issue from ‘{{name}}’?",
"groups.bar.removeConfirm_few": "...", "groups.bar.removeConfirm_many": "...", "groups.bar.removeConfirm_other": "...",
```
Reuse `groups.cancel` (line 491), `groups.confirm.remove` (line 561), `groups.toast.removed*`, `groups.error.membership`. New keys needed: hint line, subheading (plural), "Remove all missing" button, menu item `({{count}})`, per-card remove aria-label, per-card confirm (can mirror `groups.chip.removeConfirm`), bulk confirm with the "They are no longer in results." suffix (plural quintet; note the existing `groups.bar.removeConfirm` already has the same shape and can be cloned). `__tests__/groupI18n.test.ts` enforces parity and plural forms.

---

## Shared Patterns

### Confirm popover (Cancel focused, destructive Remove)
**Source:** `src/features/groups/SelectionBar.tsx` lines 100-136 and `DetailGroupsRow.tsx` 92-134
**Apply to:** per-card Remove, subheading Remove all missing, tab-anchored Remove all missing (all through one shared `ConfirmRemovePopover`)
Uses `PopoverContent className="w-70 p-4"`, `onOpenAutoFocus` that focuses `cancelRef`, `variant="destructive" size="sm" className="text-white"`, in-flight ref guard.

### Zustand selector stability
**Source:** `src/features/groups/useGroupMembers.ts` line 62 (comment: "null fallback only: a fresh [] inside a selector causes an infinite re-render loop.")
**Apply to:** `useHintsEligible`, `missingKeys` (module-level constant `Set`), tab count helper in `GroupTabStrip`, any new `snapshotRevision`/`lastCompleteFetchSignature` selector (select primitives, derive with `useMemo`).

### Error/feedback for membership mutations
**Source:** `src/features/groups/membershipActions.ts` lines 8-10, 35-47
**Apply to:** per-card Remove (error toast only), bulk Remove (error + success toast). `toast` from `sonner`; tests mock `sonner` (`toast: { error, success }`).

### Scope and lock ordering in Rust commands
**Source:** `src-tauri/src/groups_commands.rs` lines 39-46 and the `*_inner` functions
**Apply to:** `refresh_group_snapshots_inner` (resolve scope first via `require_scope`, then `lock_groups`; never take the groups lock while holding the triage lock). Scope never comes from the frontend.

### Session-only store flags
**Source:** `ticketStore.ts` `truncated` (line 23, 85, 107) and `hasFetchedThisSession` (63, 94, 150)
**Apply to:** `lastCompleteFetchSignature`. Never persisted, never reset by `hydrateFetchConfig`.

### Test conventions
**Source:** `GroupViewPage.test.tsx` (mock `@tauri-apps/api/core` `invoke` and `sonner`, seed stores with `setState`), `GroupTabStripOverlays.test.tsx` lines 1-60 (`vi.mock('sonner', ...)`, `initial = useGroupStore.getState()` reset, `renderWithI18n`, `userEvent.setup()`), `TicketListPage.handleFetch.test.tsx` lines 1-50 (`vi.mocked(invoke)`, `deferred()`, `makeFetchResult`).
**Apply to:** all new frontend tests; Rust tests use `new_db()`/`S`/`member()`/`snapshot_count()` in `groups_db.rs` and `dbs()`/`set_meta()` in `groups_commands.rs`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none outright) | | | `fetchSignature.ts` has no direct analog but is a trivial pure function; style copied from `buildMineBatchJql`/`buildUserBatchJql`. Partitioned "missing block with subheading" in `GroupViewPage` has no existing section-heading analog; follow the UI-SPEC markup and the alert row at `GroupViewPage.tsx` lines 112-128 (`px-4 ... border-b border-brand-border text-xs`) for row density and token usage. |

## Metadata

**Analog search scope:** `src/features/groups/`, `src/features/tickets/`, `src-tauri/src/groups_db.rs`, `groups_commands.rs`, `main.rs`, `src/i18n/locales/en.json`
**Files scanned:** about 20 read in full or in targeted ranges
**Pattern extraction date:** 2026-10-12
