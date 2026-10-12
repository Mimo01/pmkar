---
phase: 32-durability
reviewed: 2026-10-12T20:05:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - src-tauri/src/groups_commands.rs
  - src-tauri/src/groups_db.rs
  - src-tauri/src/main.rs
  - src/features/groups/__tests__/ConfirmRemovePopover.test.tsx
  - src/features/groups/__tests__/groupI18n.test.ts
  - src/features/groups/__tests__/GroupMenuItems.test.tsx
  - src/features/groups/__tests__/groupStore.test.ts
  - src/features/groups/__tests__/GroupTabStripOverlays.test.tsx
  - src/features/groups/__tests__/GroupViewPage.test.tsx
  - src/features/groups/__tests__/membershipActions.test.ts
  - src/features/groups/__tests__/missingMembers.test.tsx
  - src/features/groups/__tests__/RemoveMissingPopover.test.tsx
  - src/features/groups/__tests__/useGroupMembers.test.tsx
  - src/features/groups/ConfirmRemovePopover.tsx
  - src/features/groups/GroupMenuItems.tsx
  - src/features/groups/groupStore.ts
  - src/features/groups/GroupTabStrip.tsx
  - src/features/groups/GroupViewPage.tsx
  - src/features/groups/membershipActions.ts
  - src/features/groups/missingMembers.ts
  - src/features/groups/RemoveMissingPopover.tsx
  - src/features/groups/useGroupMembers.ts
  - src/features/tickets/__tests__/fetchSignature.test.ts
  - src/features/tickets/__tests__/TicketCard.test.tsx
  - src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx
  - src/features/tickets/__tests__/ticketStore.test.ts
  - src/features/tickets/__tests__/useHintsEligible.test.tsx
  - src/features/tickets/fetchSignature.ts
  - src/features/tickets/TicketCard.tsx
  - src/features/tickets/TicketListPage.tsx
  - src/features/tickets/ticketStore.ts
  - src/features/tickets/useHintsEligible.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 1
  warning: 5
  info: 6
  total: 12
status: issues_found
---

# Phase 32: Code Review Report (re-review after gap closure 32-08 / 32-09)

**Reviewed:** 2026-10-12T20:05:00Z
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

This re-review covers the phase 32 sources and the gap-closure commits `b84d587` and `ba0589a` (32-08, CR-01) and `25cf844` (32-09, WR-01). Verification run: `tsc --noEmit` is clean, vitest passes 915/915 in `src/features/groups` and `src/features/tickets/__tests__`, and `cargo test --lib groups` passes 37/37.

**Prior CR-01 (snapshot refresh scope guard): RESOLVED for the refresh path.**
- `handleFetch` captures `fetchSig` at fetch start. Both the custom path and the batch path call `refreshSnapshots` only when `isFetchStillCurrent()` is true (TicketListPage.tsx:148-151, 168-170, 293-295).
- `refresh_group_snapshots_inner` vetoes the write when `normalize_scope(expected_base_url)` differs from the scope Rust derives (groups_commands.rs:161-164). The expected URL can only veto a write, never choose the scope. An empty or unparseable value yields `None` and is a no-op.
- The Rust check also covers the window where the frontend store has switched to B while `set_connection_meta` is still in flight or has failed silently (SettingsPage `.catch(() => {})`).
- The scope TOCTOU between `require_scope` and `lock_groups` is benign: the write still lands in the scope that equals the fetch source.
- Tests cover: base URL switched mid-flight, username changed mid-flight, preset changed mid-flight, a scope mismatch, an empty expected URL, and case- and slash-insensitive matching.

However, the same cross-scope corruption is still reachable through `add_issues_to_group` and the unguarded stale ticket list. See CR-01 below.

**Prior WR-01 (single-card confirm-time recheck): RESOLVED.**
- `removeMissingMember` returns `false` before any IPC unless `readMissingKeysNow(group.id).has(issueKey)` (membershipActions.ts:59).
- `GroupViewPage` clears `pendingFocusRef` on `false` (GroupViewPage.tsx:126-127).
- Tests cover three abort cases: the member came back, hints became ineligible, and the key is no longer a member.

**Deferred items still open** (per 32-09-SUMMARY "Deferred Review Items"): WR-02, WR-03, WR-04, IN-01, IN-02, IN-03. They are re-listed below with the tag `[DEFERRED]` and their original IDs, so the fixer's `--auto` pass can skip them.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Cross-server snapshot corruption is still possible via the add path and the stale ticket list (CR-01 only partially closed)

**File:** `src/features/tickets/TicketListPage.tsx:161-167, 286-292`, `src/features/groups/groupStore.ts:183-187`, `src-tauri/src/groups_commands.rs:127-135`, `src-tauri/src/groups_db.rs:589-596`, `src/features/groups/useGroupMembers.ts:111`

**Issue:** The 32-08 fix guards only `refresh_group_snapshots`. There are three other paths that still put one server's ticket data into another server's scope.

1. **`store.setTickets(...)` is still unconditional after a mid-flight switch** (lines 161 and 286). If the user switches from server A to B while a fetch is in flight, A's tickets become the live ticket list while B is the active connection. Nothing clears them later: `setServerConnection` (connectionStore.ts:65) only sets the connection, and no effect refetches when the connection changes. The same stale list also exists without any race: switch servers in Settings, then return to the list, and A's tickets are still shown.

2. **The add path has no scope veto, and it overwrites snapshots.** Selecting a stale A ticket and using "Add to group" calls `add_issues_to_group`. Rust resolves the scope as B, and `add_members` runs `INSERT ... ON CONFLICT(scope, issue_key) DO UPDATE SET ticket_json = excluded.ticket_json`. Issue keys are not unique across servers (the reason CR-01 was raised). If B already has `AB-1` in any group, A's `AB-1` JSON silently replaces B's snapshot in **every** B group that contains it. The bad snapshot persists until a later B fetch happens to return `AB-1`. This is the same persisted corruption CR-01 described, reached by a normal user action rather than a narrow race.

3. **Group views show A's live tickets for B's members.** `useGroupMembers` prefers `live.get(key)` over the snapshot. While the stale list is loaded, B's group views render A's summary and status for any colliding key. (`missingKeys` stays empty here because the signature no longer matches, so this is display-only, but it is wrong data.)

**Fix:**
- Apply the same `isFetchStillCurrent()` gate to `setTickets` in both paths. On a mismatch, discard the result, call `markFetchIncomplete()`, and set the status back to idle.
- When `serverConnection.baseUrl` changes, clear the stale list. For example, in the connection store or a `useConnectionStore.subscribe` in the ticket feature:
  ```ts
  useConnectionStore.subscribe((s, prev) => {
    if (s.serverConnection?.baseUrl !== prev.serverConnection?.baseUrl) {
      useTicketStore.setState({ tickets: [], lastCompleteFetchSignature: null, hasFetchedThisSession: false });
    }
  });
  ```
- Give `add_issues_to_group` the same veto as refresh. Pass `expectedBaseUrl` from `useConnectionStore.getState().serverConnection.baseUrl` (ideally the base URL the tickets were fetched from, stored alongside `tickets`). In Rust, return an error such as `GroupErrorCode::NoScope` (or a new `scope_mismatch`) instead of `Ok(0)`, because this is a user action and must fail loudly:
  ```rust
  let scope = require_scope(triage_db)?;
  if normalize_scope(expected_base_url).as_deref() != Some(scope.as_str()) {
      return Err(GroupError::new(GroupErrorCode::NoScope));
  }
  ```

## Warnings

### WR-05: Stale `confirmKey` / `confirmAll` re-open the remove popover without the user asking

**File:** `src/features/groups/GroupViewPage.tsx:63-64, 104-106, 237-250`

**Issue:** `confirmKey` and `confirmAll` are reset only through `onOpenChange`. Here is how they go stale:
1. The user opens the single-card "Remove" confirm.
2. A background `poll-complete` triggers `handleFetch` (TicketListPage.tsx:396-399), and the ticket returns to the results.
3. The card moves to `present`, `footerSlot` becomes `undefined`, and `ConfirmRemovePopover` unmounts without calling `onOpenChange(false)`.
4. `confirmKey` still holds the key.

The next time that key goes missing (a later fetch), the card renders with `open={confirmKey === ticket.key}` already `true`. The destructive confirm pops open by itself and its `onOpenAutoFocus` steals focus to Cancel.

The same thing happens with `confirmAll` when the whole missing block unmounts (every missing member came back) and later reappears. The 32-09 recheck makes the eventual click safe, but the uninvited popover and focus theft are still a bug.

**Fix:** Reset the state when its subject disappears:
```ts
useEffect(() => {
  if (confirmKey !== null && !missingVisible.some((m) => m.key === confirmKey)) setConfirmKey(null);
  if (confirmAll && missingVisible.length === 0) setConfirmAll(false);
}, [missingVisible, confirmKey, confirmAll]);
```

### WR-02 [DEFERRED]: The bulk-remove confirm count differs from the visible heading, and the action can remove members the user never saw

**File:** `src/features/groups/GroupViewPage.tsx:242, 247-250, 256-261`

**Issue:** Still open. The heading uses `missingVisible.length`, which is filtered by search and assignee. The question uses `missingKeys.size`, and the action removes every key from `readMissingKeysNow`. That includes keys hidden by the filter, and keys whose snapshot is unreadable and so never render. With a filter active, the user can see 2 missing cards and still remove 5 members. When the search hides every missing card, the "Remove all missing" button is unreachable from the view, but the tab menu (RemoveMissingPopover) still removes all of them. Deferred as a product decision (32-09-SUMMARY).

**Fix:** Either restrict the bulk action to `missingVisible` keys intersected with `readMissingKeysNow`, or make the copy state "including N hidden by filters".

### WR-03 [DEFERRED]: ConfirmRemovePopover ignores the result of `onConfirm`, always closes, and leaks rejections

**File:** `src/features/groups/ConfirmRemovePopover.tsx:39-50`, `src/features/groups/RemoveMissingPopover.tsx:35-40`

**Issue:** Still open.
- `await onConfirm()` discards the boolean, so the popover closes on failure and the user cannot retry in place.
- There is no `catch`, so a rejection becomes an unhandled promise rejection from the click handler.
- `RemoveMissingPopover` still returns `void`.
- After 32-09, the WR-01 abort (`removeMissingMember` returns `false` because the member came back) also closes silently. That is acceptable for an abort, but it cannot be told apart from a failure.

**Fix:**
```ts
try {
  const ok = await onConfirm();
  if (ok !== false) onOpenChange(false);
} catch (err) {
  console.warn('[groups] confirm failed', err);
} finally { inFlightRef.current = false; setBusy(false); }
```
Also make `RemoveMissingPopover` return the boolean from `removeAllMissingWithFeedback`.

### WR-04 [DEFERRED]: One invalid ticket aborts the whole snapshot refresh, indefinitely

**File:** `src-tauri/src/groups_db.rs:629-638`, `src/features/groups/groupStore.ts:149-163`

**Issue:** Still open. `refresh_snapshots` fails the entire batch with `InvalidIssueKey` or `InvalidTicket` if any one item is malformed. The frontend only calls `console.warn`. A single bad issue therefore turns off offline snapshot freshness for every member on every fetch.

**Fix:** For this best-effort command, skip invalid items in Rust (`continue`) instead of returning `Err`, or pre-filter them in `refreshSnapshots`.

### WR-06: The confirm-time recheck treats the pre-fetch list as authoritative while a fetch is in flight

**File:** `src/features/groups/missingMembers.ts:44-48`, `src/features/tickets/useHintsEligible.ts:36-43`, `src/features/tickets/TicketListPage.tsx:132-133`

**Issue:** `handleFetch` sets `fetchStatus = 'loading'` but leaves `lastCompleteFetchSignature` as it was. During the whole fetch, including a silent background refetch triggered by `poll-complete`, `readHintsEligibleNow()` stays `true` and `readMissingKeysNow` compares against the previous ticket list.

The T-32-23 guarantee ("a member that came back is never removed") therefore only holds against already-applied results. A confirm that lands while the fetch which would bring the member back is still running goes ahead and removes it. Both the single path (fixed in 32-09) and the bulk paths have this gap.

**Fix:** Either treat hints as ineligible while a fetch is running, or abort removals then:
```ts
export function readHintsEligibleNow(): boolean {
  const s = useTicketStore.getState();
  if (s.fetchStatus === 'loading' || s.lastCompleteFetchSignature === null) return false;
  ...
}
```
If the hook version is changed the same way, the missing UI hides during loading. That may be preferable to offering removals while the data is in flux.

## Info

### IN-04: Over-broad CR-01 gate drops valid refreshes on non-scope changes

**File:** `src/features/tickets/TicketListPage.tsx:148-151`

**Issue:** `isFetchStillCurrent` compares the full signature (preset, custom JQL, project key, watched users). Editing the watched-users list mid-fetch skips the snapshot refresh even though the data comes from the correct server. This is safe, but it is broader than the CR-01 intent. Refresh is best-effort, so this is acceptable. Add a comment so a future change does not "fix" it by gating on `baseUrl` alone without the Rust veto.

**Fix:** Document the trade-off, or gate refresh on `baseUrl` and `username` equality only.

### IN-05: The scope-mismatch veto is indistinguishable from "nothing changed"

**File:** `src-tauri/src/groups_commands.rs:162-164`

**Issue:** A mismatch returns `Ok(0)`, the same value as a refresh with no changed rows. If the frontend and Rust base URLs drift permanently (for example, `set_connection_meta` failed and is swallowed in SettingsPage), every refresh is vetoed silently forever, with no log line. There is also a needless clone: `Some(scope.clone())`.

**Fix:** Write `normalize_scope(expected_base_url).as_deref() != Some(scope.as_str())`, and emit a `log::debug!` or `eprintln!` on veto. Alternatively, return a distinct code that the frontend `console.warn`s.

### IN-01 [DEFERRED]: Remove-all leaves focus on an element that has been removed

**File:** `src/features/groups/GroupViewPage.tsx:252-261`

**Issue:** Still open. After a successful bulk removal, the missing block and `removeAllRef` unmount, so focus falls back to `body`.

**Fix:** On success, focus `listRef.current` or the select toggle.

### IN-02 [DEFERRED]: The `onConfirm: () => Promise<unknown>` type hides the success contract

**File:** `src/features/groups/ConfirmRemovePopover.tsx:11`

**Fix:** Type it as `Promise<boolean | void>` (pairs with WR-03).

### IN-03 [DEFERRED]: Redundant `_few` / `_many` plural keys in `en`

**File:** `src/i18n/locales/en.json:594-598, 603-607`

**Fix:** Keep only `_one` and `_other` for `en`, if `groupI18n.test.ts` parity rules allow it.

### IN-06: An aborted single removal gives no feedback

**File:** `src/features/groups/membershipActions.ts:59`

**Issue:** When the 32-09 recheck aborts (hints became ineligible, or the member came back), the popover closes with no message. The "came back" case is self-explanatory because the card leaves the missing block. The "hints ineligible" case (for example, filters changed in another view) looks like a click that did nothing.

**Fix:** Optional. Show a `toast.info` such as "Results changed; nothing was removed" when aborting while the key is still a member.

---

_Reviewed: 2026-10-12T20:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
