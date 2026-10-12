---
phase: 32-durability
reviewed: 2026-10-12T20:40:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - src-tauri/src/groups_commands.rs
  - src-tauri/src/groups_db.rs
  - src-tauri/src/main.rs
  - src/features/groups/ConfirmRemovePopover.tsx
  - src/features/groups/GroupMenuItems.tsx
  - src/features/groups/GroupTabStrip.tsx
  - src/features/groups/GroupViewPage.tsx
  - src/features/groups/RemoveMissingPopover.tsx
  - src/features/groups/__tests__/ConfirmRemovePopover.test.tsx
  - src/features/groups/__tests__/GroupMenuItems.test.tsx
  - src/features/groups/__tests__/GroupTabStripOverlays.test.tsx
  - src/features/groups/__tests__/GroupViewPage.test.tsx
  - src/features/groups/__tests__/RemoveMissingPopover.test.tsx
  - src/features/groups/__tests__/groupI18n.test.ts
  - src/features/groups/__tests__/groupStore.test.ts
  - src/features/groups/__tests__/membershipActions.test.ts
  - src/features/groups/__tests__/missingMembers.test.tsx
  - src/features/groups/__tests__/useGroupMembers.test.tsx
  - src/features/groups/groupStore.ts
  - src/features/groups/membershipActions.ts
  - src/features/groups/missingMembers.ts
  - src/features/groups/types.ts
  - src/features/groups/useGroupMembers.ts
  - src/features/tickets/TicketCard.tsx
  - src/features/tickets/TicketListPage.test.tsx
  - src/features/tickets/TicketListPage.tsx
  - src/features/tickets/__tests__/TicketCard.test.tsx
  - src/features/tickets/__tests__/TicketListPage.handleFetch.test.tsx
  - src/features/tickets/__tests__/fetchSignature.test.ts
  - src/features/tickets/__tests__/ticketListParity.test.tsx
  - src/features/tickets/__tests__/ticketStore.test.ts
  - src/features/tickets/__tests__/useHintsEligible.test.tsx
  - src/features/tickets/fetchSignature.ts
  - src/features/tickets/ticketStore.ts
  - src/features/tickets/useHintsEligible.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
findings:
  critical: 0
  warning: 6
  info: 9
  total: 15
status: issues_found
---

# Phase 32: Code Review Report (re-review after gap closure 32-10 .. 32-13)

**Reviewed:** 2026-10-12T20:40:00Z
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

This re-review covers the phase 32 sources plus the 32-10..32-13 gap-closure commits: `cea115e`/`cdf2603` (add-path veto), `40e9ef9`/`0f32c50` (stale list clear and mid-flight discard), `63fc2b0` (confirm-state reset), and `9a312c1` (loading guard).

Verification run:
- `tsc --noEmit` is clean.
- `vitest run src/features/groups src/features/tickets` passes 1026/1026.
- `cargo test --lib groups` passes 43/43.

### Status of prior findings

**CR-01 (cross-server scope via the add path and the stale ticket list): RESOLVED.** All three sub-paths are closed:
1. *Stale list.* A module-level `useConnectionStore.subscribe` in `ticketStore.ts:202-208` calls `resetForServerSwitch()` on A -> B and A -> null. That clears `tickets`, `triageMap`, the selection, `lastCompleteFetchSignature` and `hasFetchedThisSession`. It correctly skips the startup null -> A hydration. Because the list is gone, group views can no longer prefer another server's live ticket (sub-path 3).
2. *Mid-flight results.* `isSameServerAsFetch()` gates `setTickets` on both the custom and batch paths (`TicketListPage.tsx:179-182, 291-294`). There is no `await` between the check and `setTickets`, so the gate is atomic with respect to the subscription.
3. *Add path.* `add_issues_to_group_inner` vetoes with the new `ScopeMismatch` code before the groups lock is taken (`groups_commands.rs:142-144`). An empty or unparseable expected URL fails closed. The error is wired through `types.ts`, `ERROR_CODES`, `membershipErrorKey`, and both locales.

Residual weaknesses are reported below as new findings, not as reopenings:
- **WR-07:** a fetch orphaned by an unmounted `TicketListPage` can clobber the new server's state.
- **WR-09:** the veto compares the *current* frontend connection, not the origin of the tickets, and its error copy is misleading when Rust and the frontend drift.

**WR-05 (destructive confirm re-opens on its own): RESOLVED.** The new effect (`GroupViewPage.tsx:84-89`) clears `confirmKey` when its card leaves `missingVisible`, and clears `confirmAll` when the block empties.
- I checked whether the block can empty transiently and close the popover under the user. `useGroupMembers` keeps the previous `result` across `snapshotRevision` reloads, and `loading` is true only before the first load. `useHintsEligible` ignores `fetchStatus`. So `missingVisible` does not flicker on polls.
- The tab-strip variant is not re-mount based and cannot re-open on its own. It has a related cosmetic issue (IN-10).

**WR-06 (confirm-time recheck during an in-flight fetch): RESOLVED as specified.** `readHintsEligibleNow()` returns `false` while `fetchStatus === 'loading'` (`useHintsEligible.ts:43-49`). All three removal paths go through `readMissingKeysNow`, so all of them abort. The guard cannot be defeated into the unsafe direction: every path that resets `fetchStatus` to non-loading early (discard, catch, all-failed) also calls `markFetchIncomplete()`.

The fix does introduce a UX regression: during every fetch, removals silently do nothing (WR-08, which supersedes IN-06).

**Deferred items still open:** WR-02, WR-03, WR-04, IN-01, IN-02, IN-03. IN-04 and IN-05 from the previous pass are also unchanged.

## Narrative Findings (AI reviewer)

## Warnings

### WR-07: A fetch orphaned by the Settings round-trip clobbers the new server's fetch state (catch path is unguarded, discard is unconditional)

**File:** `src/features/tickets/TicketListPage.tsx:105, 129-130, 163-169, 378-381`

**Issue:** Switching servers always happens in Settings, and `App.tsx:208` returns the Settings tree, which **unmounts `TicketListPage`**. `fetchInFlightRef` is per-instance, so the remounted page starts with `false`. A fetch for server B can therefore run concurrently with A's orphaned `handleFetch`, which keeps running. The 32-11 guards assume they are the only fetch, and they are not:

1. **The catch path has no server check.** A common reason to switch servers is that A is slow or down. When A's `invoke('fetch_tickets')` later rejects (timeout, network), the catch at lines 378-381 runs `markFetchIncomplete()` and `setFetchStatus('error', <A's error>)` against the shared store. B's view then shows an error banner for a server it is not using. If B's fetch has already completed, the banner persists, and B's valid `lastCompleteFetchSignature` is wiped, which hides the missing-member hints until the next fetch.
2. **`discardStaleResult()` does not check who owns the status.** When A's orphan reaches line 179 or 291 after the switch, it sets `fetchStatus` to `'idle'` and clears the signature. If B is mid-fetch, its loader disappears while it is still running. If B has finished, B's complete signature is erased.
3. The post-`setTickets` change-detection loop (lines 204-232 and 336-370) has no server check either; see IN-08.

None of these paths can write cross-scope data (Rust vetoes and the list gate hold). They do corrupt B's UI state and hint eligibility.

**Fix:** Make fetch ownership global rather than per-instance, and make every terminal write conditional on ownership. One way:

```ts
// ticketStore: bump on every fetch start and in resetForServerSwitch
fetchGeneration: number;

// handleFetch
const gen = useTicketStore.getState().beginFetch(); // ++fetchGeneration, sets 'loading'
const owns = () => useTicketStore.getState().fetchGeneration === gen;
...
if (!owns()) return;           // replaces discardStaleResult(): someone else owns the status now
...
} catch (err) {
  if (!owns()) return;
  useTicketStore.getState().markFetchIncomplete();
  store.setFetchStatus('error', ...);
}
```

Also guard the change-detection loops with `if (!owns()) break;`. If you keep the current design, at least hoist `isSameServerAsFetch` above the `try`, and in `catch` call `if (!isSameServerAsFetch()) return;` before writing the error.

### WR-08: During any fetch, every "Remove" confirm is a silent no-op, and the tab-menu bulk path reports nothing

**File:** `src/features/tickets/useHintsEligible.ts:14-18, 43-49`, `src/features/groups/membershipActions.ts:66`, `src/features/groups/GroupViewPage.tsx:267-268`, `src/features/groups/RemoveMissingPopover.tsx:37-38`, `src/features/groups/ConfirmRemovePopover.tsx:43-45`

**Issue:** By design, `useHintsEligible` ignores `fetchStatus`. The missing block, the per-card "Remove" buttons, and the tab-menu "Remove N missing" entry therefore stay visible and enabled during a fetch. `readHintsEligibleNow` now returns `false` during that same window, so every confirm path aborts:
- `removeMissingMember` returns `false`.
- The in-view bulk confirm returns `false`.
- `RemoveMissingPopover` returns `undefined`.

`ConfirmRemovePopover` ignores the result (WR-03) and closes. The user clicks a destructive "Remove", the popover closes, and nothing happens, with no feedback.

`poll-complete` triggers `handleFetch` (`TicketListPage.tsx:424-426`). With a multi-user `all_watched` preset plus the per-ticket change-detection loop, the `'loading'` phase can be long and recurring, so this is not a rare race. This escalates prior IN-06 from Info.

**Fix:** Choose one of these:
- Disable the remove triggers while loading. Read `fetchStatus` in `GroupViewPage` and `GroupTabStrip`, and pass `disabled` to the "Remove" and "Remove all missing" buttons and to the menu item, with a tooltip such as "Refreshing results...". The hook's visibility stays as it is, so there is no flicker.
- Keep the triggers enabled, but have the abort path report itself. Return a discriminated result (`'removed' | 'aborted' | 'failed'`), keep the popover open on `'aborted'`, and show `toast.info(t('groups.missing.busy'))`.

Either way, `ConfirmRemovePopover` must stop treating every resolution as success (pairs with WR-03).

### WR-09: The add veto checks the frontend's current server, not where the tickets came from, and its error is misleading on Rust/frontend drift

**File:** `src/features/groups/groupStore.ts:188-189`, `src-tauri/src/groups_commands.rs:142-144`, `src/i18n/locales/en.json:611`, `src/i18n/locales/sk.json:611`

**Issue:**
1. `expectedBaseUrl` is `useConnectionStore.getState().serverConnection?.baseUrl` at the moment of the add, not the base URL the tickets were fetched from. The veto therefore detects "frontend and Rust disagree about the active server". It does not detect "these tickets belong to another server". The tickets-from-A case is only covered indirectly, by `resetForServerSwitch` clearing the list. Any future ticket source that outlives the reset will bypass the veto: a detail pane holding its own ticket object, a copied selection, or a group-view snapshot. The CR-01 fix suggested storing the origin with the tickets for this reason.
2. The only way the current check can fire is drift: `set_connection_meta` is still in flight, or it failed. `SettingsPage.tsx:558-567` swallows that failure with `.catch(() => {})`, after `setServerConnection` has already switched the frontend. When persistence fails, **every** add fails permanently with "These tickets are from a different server than the one now connected. Fetch tickets again, then retry." Refetching does not help, because the frontend is already fetching from B. Meanwhile every refresh is silently vetoed (IN-05). The user has no way to recover short of re-saving the connection.

**Fix:**
- Record the source of each list. Add `ticketsBaseUrl` to `ticketStore`, set it in `setTickets` from `serverConn.baseUrl`, and clear it in `resetForServerSwitch`. Pass that value (or a per-ticket origin) as `expectedBaseUrl`.
- In `SettingsPage`, surface `set_connection_meta` failures (toast, and roll back or retry) instead of swallowing them.
- Change the copy to something that holds in both cases, for example "The connected server changed. Reopen the ticket list and try again." or "The connection is out of sync. Re-save the server connection in Settings."

### WR-02 [DEFERRED]: The bulk-remove confirm count differs from the visible heading, and the action can remove members the user never saw

**File:** `src/features/groups/GroupViewPage.tsx:251, 257, 267-269`

**Issue:** Unchanged. The heading uses `missingVisible.length`, which is filtered. The question uses `missingKeys.size`, and the action removes every key in `readMissingKeysNow`, including filtered or unrenderable ones.

**Fix:** Restrict the action to the visible keys, or state the hidden count in the copy.

### WR-03 [DEFERRED]: ConfirmRemovePopover ignores the result of `onConfirm`, always closes, and leaks rejections

**File:** `src/features/groups/ConfirmRemovePopover.tsx:39-50`, `src/features/groups/RemoveMissingPopover.tsx:35-40`

**Issue:** Unchanged. It is now more visible because of WR-08: aborts, failures and successes all close the popover the same way.

**Fix:**
```ts
try {
  const ok = await onConfirm();
  if (ok !== false) onOpenChange(false);
} catch (err) {
  console.warn('[groups] confirm failed', err);
} finally { inFlightRef.current = false; setBusy(false); }
```

### WR-04 [DEFERRED]: One invalid ticket aborts the whole snapshot refresh, indefinitely

**File:** `src-tauri/src/groups_db.rs` (`refresh_snapshots` validation loop), `src/features/groups/groupStore.ts:150-165`

**Issue:** Unchanged. `add_members` (lines 578-586) has the same all-or-nothing validation, which is acceptable for a user action. For the best-effort refresh, one bad item turns off freshness for every member.

**Fix:** Skip invalid items in `refresh_snapshots` instead of returning `Err`.

## Info

### IN-07: A username-only switch keeps the previous account's ticket list live

**File:** `src/features/tickets/ticketStore.ts:202-208`, `src/features/tickets/TicketListPage.tsx:157-162`

**Issue:** The subscription resets only when `baseUrl` changes. `isSameServerAsFetch` also compares `username`. After re-saving the same server with another account, an in-flight fetch is discarded (it is treated as stale), but the already-loaded list from the old account stays visible and addable. The scope is per base URL, so this is not cross-scope corruption. It does show data under the wrong identity, and the two guards disagree on what "same server" means.

**Fix:** Also reset on a `username` change, or drop `username` from `isSameServerAsFetch`. Either way, document the chosen identity.

### IN-08: The orphaned change-detection loop keeps writing the old server's unseen markers after a switch

**File:** `src/features/tickets/TicketListPage.tsx:204-232, 336-370`, `src/features/tickets/ticketStore.ts:132-142`

**Issue:** If the switch happens after `setTickets` but during the long per-ticket detail loop, A's loop keeps running. It calls `fetch_ticket_detail` against A and `check_ticket_changes`, whose snapshot DB is unscoped, and it calls `store.setUnseenChange(<A key>)`. `resetForServerSwitch` deliberately keeps `unseenChanges`, so a colliding key on B shows a change dot that belongs to A. The snapshot DB being unscoped is pre-existing. The in-memory leak is new relative to the CR-01 intent.

**Fix:** Inside the loops, `if (!isSameServerAsFetch()) break;` (or use the generation check from WR-07).

### IN-09: Create-then-add in GroupPicker leaves an empty group behind on `scope_mismatch`

**File:** `src/features/groups/groupStore.ts:180-191` (contract), caller `GroupPicker.tsx:233-266`

**Issue:** `create_group` has no expected-scope check, so in the drift window the group is created in Rust's scope and the following add fails with `scope_mismatch`. "The group is kept even when the add fails" is documented, but in this case the new group may be in a scope the user is not looking at.

**Fix:** Pass `expectedBaseUrl` to `create_group` too, or run the scope check before the create.

### IN-10: The tab-anchored remove-missing confirm can sit open asking to "Remove 0 issues"

**File:** `src/features/groups/RemoveMissingPopover.tsx:25, 34`, `src/features/groups/GroupTabStrip.tsx:407-409`

**Issue:** This is the tab-strip counterpart of WR-05. The popover stays open while `count` is recomputed live. If every member returns (or hints turn ineligible) while it is open, the question reads "Remove 0 issues from 'X'?", and confirming silently does nothing.

**Fix:** Close it (clear `pending`) when `missingByGroup.get(group.id)` becomes empty, mirroring the `GroupViewPage` effect.

### IN-04: The over-broad refresh gate drops valid refreshes on non-scope changes

**File:** `src/features/tickets/TicketListPage.tsx:148-151, 190, 320`

**Issue:** Unchanged. The new comment at lines 153-156 explains the list gate, but not why refresh still uses the full signature.

**Fix:** Add a one-line comment, or gate refresh on server identity only.

### IN-05: The refresh scope veto is indistinguishable from "nothing changed"

**File:** `src-tauri/src/groups_commands.rs:173-175`

**Issue:** Unchanged. `Ok(0)` with no log, plus a needless `Some(scope.clone())`. The add path (line 142) already uses the clone-free `as_deref()` form, so the two vetoes are now inconsistent. This silent veto is what turns the WR-09 drift into permanent, invisible staleness.

**Fix:** Use `normalize_scope(expected_base_url).as_deref() != Some(scope.as_str())` and log the veto.

### IN-01 [DEFERRED]: Remove-all leaves focus on an element that has been removed

**File:** `src/features/groups/GroupViewPage.tsx:265-270`

**Fix:** On success, focus `listRef.current` or the select toggle.

### IN-02 [DEFERRED]: The `onConfirm: () => Promise<unknown>` type hides the success contract

**File:** `src/features/groups/ConfirmRemovePopover.tsx:11`

**Fix:** Type it as `Promise<boolean | void>` (pairs with WR-03 and WR-08).

### IN-03 [DEFERRED]: Redundant `_few` / `_many` plural keys in `en`

**File:** `src/i18n/locales/en.json`

**Fix:** Keep only `_one` and `_other` for `en`, if `groupI18n.test.ts` parity rules allow it.

---

_Reviewed: 2026-10-12T20:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
