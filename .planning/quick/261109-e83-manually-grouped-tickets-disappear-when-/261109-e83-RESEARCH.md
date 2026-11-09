# Quick Task 261109-e83: Auto-remove missing group members - Research

**Researched:** 2026-11-09
**Domain:** Frontend group membership (React + Zustand + Tauri IPC); no new packages
**Confidence:** HIGH (all findings verified by reading this codebase)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- AUTO-REMOVE MEMBERSHIP: when a member is missing (same eligibility rule as today: only after a complete, successful fetch, never on a partial, truncated, errored or in-flight fetch), delete it from the group in the DB automatically. No confirmation. It is not re-added if Jira returns it later. Group chip counts must reflect the removal.
- Safety is critical: keep the existing eligibility gate (hints eligible / not fetching) so a transient or partial fetch never wipes group memberships. Recheck at removal time (like `readMissingKeysNow`) to guard races.
- DELETE ENTIRELY: the dimmed missing section, the per-card Remove and bulk Remove all confirms in GroupViewPage, the tab-level RemoveMissingPopover and its menu entry, the related i18n strings (all locales), and obsolete tests. Replace them with tests for auto-removal.

### Claude's Discretion
- Where auto-removal runs (a frontend effect reacting to the ticket store, or the backend after a poll).
- Whether to show feedback. Default: silent.

### Specifics
- The Slovak UI says "tiket" (a guard test enforces it). No drag and drop. Never return `?? []` inside a Zustand selector.
</user_constraints>

## Summary

How "missing" works today: a member key counts as missing when two things are true. First, `readHintsEligibleNow()` returns true. That needs `fetchStatus !== 'loading'`, `lastCompleteFetchSignature !== null`, and the stored signature equal to the current signature built from {baseUrl, username, preset, custom JQL, projectKey, watched ids} (`src/features/tickets/useHintsEligible.ts:52-59`, `fetchSignature.ts:15-24`). Second, the key is not in `useTicketStore.tickets`. `TicketListPage.handleFetch` sets the signature only when the fetch fully succeeds: on the custom path only if not truncated (`TicketListPage.tsx:189-196`), on the batch path only if no batch failed and none was truncated (`:323-330`). Every failure, total failure, stale-server discard or thrown error calls `markFetchIncomplete()` (`:170, :309, :393`). `resetForServerSwitch` clears both tickets and the signature (`ticketStore.ts:173-187`). So the gate already blocks partial, truncated, errored and in-flight fetches. Reuse it unchanged.

**Primary recommendation:** Add a non-hook `pruneMissingMembers()` in `missingMembers.ts`, plus a hook `useAutoRemoveMissingMembers()` mounted once in `App.tsx`, next to the group hydrate effect (`App.tsx:91-97`). The effect watches `tickets`, `lastCompleteFetchSignature`, `fetchStatus`, `memberKeysByGroup` and `hydrated`. For each group it recomputes the missing keys with `readMissingKeysNow(groupId)` at run time and calls `useGroupStore.getState().removeFromGroup(id, keys)` silently. A module-level in-flight flag stops re-entry. Do not do this in the backend: the Rust poll does not know the fetch signature or whether a fetch completed. The frontend owns `lastCompleteFetchSignature`, and the poll only triggers `handleFetch` (`TicketListPage.tsx:428-446`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Decide eligibility (fetch complete + signature match) | Browser (ticketStore / useHintsEligible) | — | The signature is session-only frontend state; Rust cannot see it |
| Compute missing keys | Browser (missingMembers.ts) | — | Already there; key-only diff |
| Delete memberships + GC snapshots | Rust (`remove_issues_from_group` → `GroupsDb::remove_members`) | — | Scope-checked (`ensure_group_in_scope` → NotFound), transactional, GCs snapshots (`groups_db.rs:610-628, 433-445`) |
| Chip counts | Rust `list_groups.member_count` via `hydrate()` | Browser | `mutate()` always re-hydrates after success (`groupStore.ts:63-79`) |

## Trigger Design (prescriptive)

```ts
// missingMembers.ts (sketch)
let pruning = false;
export async function pruneMissingMembers(): Promise<void> {
  if (pruning) return;
  const gs = useGroupStore.getState();
  if (!gs.hydrated) return;
  pruning = true;
  try {
    for (const id of Object.keys(gs.memberKeysByGroup).map(Number)) {
      const keys = readMissingKeysNow(id);          // rechecks eligibility + loading at call time
      if (keys.size === 0) continue;
      const r = await useGroupStore.getState().removeFromGroup(id, [...keys]);
      if (!r.ok) console.warn(`[groups] auto-remove failed for group ${id}: ${r.code}`);
    }
  } finally { pruning = false; }
}
// hook: useEffect(() => { void pruneMissingMembers(); }, [tickets, sig, fetchStatus, memberKeysByGroup, hydrated]);
```

Notes:
- Run `readMissingKeysNow` inside the loop for each group, after the previous `await`. Each `removeFromGroup` awaits a `hydrate()`, and a fetch may have started meanwhile. `readHintsEligibleNow` returns false while loading.
- If the in-flight flag skips a run, a later change re-triggers the effect: each successful remove re-hydrates, which changes `memberKeysByGroup`. That is enough. You can optionally re-run once in `finally` if a trigger arrived during pruning.
- Failure: `mutate` only re-hydrates on `not_found`. Other errors leave the state unchanged, so the effect does not spin. It retries on the next fetch. Keep failures silent (console.warn), per the "default silent" discretion.
- There is no cross-group bulk command. One call per affected group is fine (each is atomic). A new Rust command is not needed.
- Scope race: on a server switch, `memberKeysByGroup` can briefly hold the old scope's group ids. Rust rejects those with NotFound (`ensure_group_in_scope`), and `mutate` then re-hydrates. That is safe. `removeFromGroup` passes no `expectedBaseUrl` (unlike add and refresh). Optionally extend `remove_issues_from_group` with an `expected_base_url` veto for defense in depth. Not required.
- GroupViewPage renders absent members from snapshots until removal lands (`useGroupMembers.ts:104-115`). The cards show for one IPC round trip and then vanish. That is acceptable. Hiding `missingKeys` members in the view is optional.

## Legitimate-absence cases (IMPORTANT: user confirmation needed)

Groups are scoped by **baseUrl only** (`groups_commands.rs:25-41`). The fetch signature also includes username, preset, custom JQL, projectKey and the watched-user ids. After any of these changes, the first complete fetch under the new signature is eligible. Every member outside the new query is then auto-removed **permanently**. Today such members only show as dimmed "missing", which can be undone.

| Case | Today | With auto-remove |
|---|---|---|
| Ticket resolved (`statusCategory != Done` in both JQL builders, `TicketListPage.tsx:40-58`) | dimmed | removed (intended) |
| Unassigned / unwatched in Jira | dimmed | removed (intended) |
| User changes Source project (`sourceProjectKey`) | dimmed | **all other-project members removed** |
| Preset `all_watched` → `mine`, or a watched user removed | dimmed | **watched users' tickets removed** |
| Custom JQL edited to a narrower query | dimmed | **everything outside it removed** |
| Different username on the same server | dimmed | **removed** (groups shared per baseUrl) |
| Category (linked/declined/watched/not-mine), list search, assignee filter | not missing | not affected. Categories come from `triageMap` over the same `tickets`; filters are local |
| Server switch | not missing | safe (reset + scope veto) |

The decision text says "same eligibility rule as today", which allows the bold rows. The planner should keep the locked rule but raise this as a checkpoint question for the user. A cheap mitigation if the user wants one: skip pruning on the first complete fetch after an in-session signature change. That means remembering the previous complete signature and only pruning when `prev === current`. The cost: a ticket resolved while the app was closed is removed on the second fetch of the session, not the first.

## Missing-UI Deletion Inventory

**Production code**
- `src/features/groups/RemoveMissingPopover.tsx`: delete the file.
- `src/features/groups/GroupTabStrip.tsx`: lines 14 (`useRemovalBlockedByFetch` import), 30-31, the `'remove-missing'` kind at 39 and 44, 67-68, 395-397 (props), 470-476 (popover render).
- `src/features/groups/GroupMenuItems.tsx`: props `missingCount`, `onRemoveMissing`, `removeMissingDisabledReason` (14-17, 30-32), the item at 58-67, and the `ListX` icon import.
- `src/features/groups/GroupViewPage.tsx`: imports at 18-19 and 22-23; the `present` / `missingVisible` / `ordered` partition at 44-53 (use `sorted` directly); `fetching` / `refreshingHint` at 63-64; `headingId`, `confirmKey`, `confirmAll`, `removeAllRef`, `pendingFocusRef` and both effects at 66-93; the `missing` parameter, `dimmed` and `footerSlot` in `renderCard` at 99-149; the missing block at 247-284. `listRef` can stay.
- `src/features/groups/membershipActions.ts`: delete `removeMissingMember` and `removeAllMissingWithFeedback` (57-95) and the `readMissingKeysNow` import. This also removes a circular-ish import.
- `src/features/groups/useGroupMembers.ts`: drop `missingKeys` (48-52, 117-120, return value) and the `useHintsEligible` / `computeMissingKeys` imports.
- `src/features/groups/missingMembers.ts`: keep `computeMissingKeys` / `readMissingKeysNow` / `EMPTY_MISSING`. Remove `useMissingKeysByGroup` (no consumer left). Add the prune function and hook here.
- `src/features/tickets/useHintsEligible.ts`: `useRemovalBlockedByFetch` loses all consumers, so delete it. `useHintsEligible` loses its consumers too (only useGroupMembers and missingMembers used it); delete it or keep it, and update its tests to match. Keep `readHintsEligibleNow`.
- `src/features/groups/ConfirmRemovePopover.tsx`: only GroupViewPage and RemoveMissingPopover use it in production, so it becomes dead. Delete it along with `__tests__/ConfirmRemovePopover.test.tsx`, and fix the comment reference at `a11y.keyboard.test.tsx:11`.
- `src/features/tickets/TicketCard.tsx`: the `dimmed` and `footerSlot` props (29-33, 46-47, 55-57, 184-193) are only used by GroupViewPage, so they become dead. Recommendation: remove them. That requires the test edits below, because `contrast.test.ts:18-21` **throws at module load** if TicketCard has no `opacity-NN`.

**i18n** (only `en.json` and `sk.json` exist): delete `groups.menu.removeMissing` (line 565) and all `groups.missing.*` (lines 635-652, including the `heading_*` and `removeAllConfirm_*` plural variants) from **both** files. `groupLocale.test.ts:52-64` requires every SK `_one` base to have one/few/many/other in SK and EN. Removing whole bases in both files keeps it green. Do not leave orphan suffixes.

**Tests to delete or edit**
- Delete: `__tests__/RemoveMissingPopover.test.tsx`; `__tests__/GroupTabStripOverlays.test.tsx` from `seedMissing` (~144) through the "remove all missing" describe (156-210); `GroupViewPage.test.tsx` describe "GroupViewPage missing members" (425 to end of block; keep a variant of the "gated off" case as a negative test); `a11y.keyboard.test.tsx` describe "Escape and focus return: missing members" (493-540), plus the `missing` option in its setup (361-366) if unused after; `a11y.axe.test.tsx` case "12. group view with a missing block" (282+); `membershipActions.test.ts` describes at 157-235 and the imports at 22-24; `useGroupMembers.test.tsx` describe "useGroupMembers missingKeys" (149-190); `groupI18n.test.ts` describe "Phase 32 missing copy" (161-215); `GroupMenuItems.test.tsx` missing-item cases (113-160) and the `missingCount` / `onRemoveMissing` props in its render helpers (15, 29, 103, 153); `missingMembers.test.tsx` tests for `useMissingKeysByGroup`.
- If `dimmed` is removed: `contrast.test.ts` (remove the opacity regex at 15-21 and the dimmed loop at ~71-74), `groupTokenUsage.test.ts:67-71` ("dims missing cards with opacity-70"), and `TicketCard.test.tsx:208+` ("dimmed and footerSlot").
- The guard tests (`groupI18n`, `groupLocale`, `noLiteralStrings`, SK "tiket") are unaffected as long as no new copy is added. Silent removal needs no new copy.

## Tests to Add (pattern: vitest + `vi.mock('@tauri-apps/api/core')`, `useXStore.setState`, `makeEligible()` helper from `missingMembers.test.tsx:19-26`)

In `src/features/groups/__tests__/missingMembers.test.tsx` (or a new `autoRemoveMissing.test.tsx`), with an invoke mock handling `remove_issues_from_group`, `list_groups` and `list_group_memberships` as in `GroupViewPage.test.tsx:463-488`:
1. Eligible plus an absent member: one `remove_issues_from_group` call per affected group with exactly the absent keys. Afterwards, `memberKeysByGroup` and `memberCount` reflect the removal.
2. Not eligible (`lastCompleteFetchSignature: null`): no call.
3. `fetchStatus: 'loading'` with a matching signature: no call. Then flip to `'idle'`: the call happens.
4. Signature mismatch (for example, change `jqlPreset` or `sourceProjectKey` after setting the signature): no call.
5. `truncated` / partial: covered by `setTickets(..., null)`. Assert that `setTickets(tickets, {}, n, true, null)` triggers no removal.
6. Race: a fetch starts (`beginFetch()`) between group A and group B. Group B is not pruned.
7. Re-entrancy: two triggers in one tick produce one call per group.
8. Remove failure (`throw 'boom'`): no toast, no infinite loop, state unchanged.
9. All members present: no call.
10. Hook mounted (renderHook `useAutoRemoveMissingMembers`) prunes after a `setTickets` with a complete signature. That is the integration path.
11. `GroupViewPage`: no "No longer in results" text or Remove buttons in any state; the group menu has no "Remove all missing" item.

Commands: `npx vitest run src/features/groups` (quick), `npm test && npm run lint && npx tsc --noEmit` (full). Run Rust tests only if the Rust remove command changes: `cargo test --manifest-path src-tauri/Cargo.toml groups`.

## Common Pitfalls
- **Using `useHintsEligible()` as the gate.** It deliberately ignores `fetchStatus` (`useHintsEligible.ts:12-14`). Always gate the actual removal with `readHintsEligibleNow()` (through `readMissingKeysNow`) at call time.
- **Pruning before groups hydrate**, or after a hydrate that failed with `clearOnError` (empty map, harmless). Check `hydrated`. With `hydrateError: true` and the last good state kept, the keys are still real memberships, so pruning is fine.
- **Unstable selector refs.** Select `memberKeysByGroup` / `tickets` as store references. No `?? []`.
- **Mounting inside TicketListPage.** That page unmounts during the Settings round trip. Mount at App level.
- **Leaving `ListX` / `useRemovalBlockedByFetch` imports.** Biome `lint` fails on unused imports.

## Assumptions Log
| # | Claim | Risk if wrong |
|---|---|---|
| A1 | The user accepts permanent removal on project, preset, custom-JQL or username change (bold rows above) | Silent loss of curated groups. Confirm before execution |
| A2 | Deleting `ConfirmRemovePopover`, `TicketCard.dimmed`/`footerSlot` and `useHintsEligible` is in scope as dead-code cleanup | Low. They can be kept instead |

## Open Questions
1. Should pruning be skipped on the first complete fetch after an in-session signature change? (See Legitimate-absence cases.) Recommendation: ask the user. Default to the locked rule if there is no answer.

## Security Domain
Not applicable beyond existing controls. Removal is local and scope-vetted in Rust; there is no new input surface.

## Sources
Codebase only (HIGH): files and line numbers cited inline. No external libraries are involved.
