---
phase: 29-tab-strip-group-view
reviewed: 2026-10-12T13:45:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - package.json
  - src-tauri/src/groups_db.rs
  - src/__tests__/App.test.tsx
  - src/App.tsx
  - src/components/ui/__tests__/popover.test.tsx
  - src/components/ui/AppShell.tsx
  - src/components/ui/popover.tsx
  - src/features/groups/__tests__/CreateGroupPopover.test.tsx
  - src/features/groups/__tests__/groupBadge.test.ts
  - src/features/groups/__tests__/groupI18n.test.ts
  - src/features/groups/__tests__/groupStore.test.ts
  - src/features/groups/__tests__/groupTabs.test.ts
  - src/features/groups/__tests__/GroupTabStrip.test.tsx
  - src/features/groups/__tests__/GroupViewPage.test.tsx
  - src/features/groups/__tests__/useGroupMembers.test.tsx
  - src/features/groups/CreateGroupPopover.tsx
  - src/features/groups/groupBadge.ts
  - src/features/groups/groupStore.ts
  - src/features/groups/GroupTab.tsx
  - src/features/groups/groupTabs.ts
  - src/features/groups/GroupTabStrip.tsx
  - src/features/groups/GroupViewPage.tsx
  - src/features/groups/useGroupMembers.ts
  - src/features/groups/validation.ts
  - src/features/tickets/IgnoredTicketsPage.tsx
  - src/features/tickets/triageActions.ts
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
  - src/test-fixtures/group-vectors.json
findings:
  critical: 0
  warning: 8
  info: 7
  total: 15
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-10-12T13:45:00Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

I reviewed the phase 29 diff (`07ceb60..HEAD`): the group tab strip, the create-group popover, the group view page, the `useGroupMembers` hook, the new hydrate sequencing and error-retention in `groupStore`, the TS and Rust name-key changes (format-character stripping), and the App/AppShell wiring. The 12 related test files pass (155 tests).

Project rules:
- **Zustand selectors:** compliant. `useGroupMembers` uses a `?? null` fallback, and the App selectors return stored references.
- **Drag and drop:** none added.
- **Labelled controls:** no hover-revealed controls were added. The icon-only "+" trigger is noted as Info.

No proven blockers. The main problems sit where three changes meet: the new hydrate sequence numbers, the "keep last good state on failure" behaviour, and the App fallback that permanently rewrites `currentTab`. Together they let a successful create bounce the user back to "New", strand a pending focus request, and leave groups from the previous scope interactive after a scope change. The `hydrateError` flag that should surface this is never read. Name-key hardening is incomplete because bidi controls and invisible filler characters still produce look-alike names. The group view also has no "no results" state, and failures to load snapshots are silent.

## Warnings

### WR-01: `mutate()` can resolve before the store reflects the write; App then bounces the new group tab to "New"

**File:** `src/features/groups/groupStore.ts:66, 89-96`; `src/App.tsx:110-113`
**Issue:** `mutate()` does `await get().hydrate()` so callers can rely on state being current. With the new `hydrateSeq` guard, if another hydrate starts while this one is in flight, the older one returns early at line 96 without calling `set`. `createGroup` then resolves `{ok:true}` while `groups` still lacks the new group. Possible sources of a concurrent hydrate are the startup hydrate (App.tsx:84-90), `rehydrateAfter`, and any other mutation. `CreateGroupPopover` then calls `onCreated` → `onTabChange('group:N')`. `resolveActiveTab` sees `hydrated === true` and no group with that id, so it returns `'new'`. The App effect at 111-113 then permanently overwrites `currentTab` with `'new'`. When the newer hydrate lands with the group, the selection is already gone. The tests cover "latest started wins" but not the caller-visible effect.
**Fix:** Make superseded callers wait for the latest hydrate instead of returning early:
```ts
let latest: Promise<void> | null = null;
hydrate: () => {
  const seq = ++hydrateSeq;
  const p = (async () => { /* existing body; skip set() when seq !== hydrateSeq */ })();
  latest = p;
  return p.then(() => (seq === hydrateSeq ? undefined : latest!));
},
```
Also, do not write the fallback back into `currentTab`. Render with `effectiveTab` only, and drop the `useEffect` at App.tsx:111-113. A transient absence then won't destroy the user's selection.

### WR-02: Create succeeds but the follow-up hydrate fails: user is bounced, focus is lost, and focus is stolen later

**File:** `src/features/groups/GroupTabStrip.tsx:72-80, 87-90`; `src/features/groups/CreateGroupPopover.tsx:71-74, 102-104`
**Issue:** `mutate()` returns `ok:true` even when the follow-up `hydrate()` fails. The hydrate now keeps the old `groups` and only sets `hydrateError`. In that case:
1. `handleCreated` switches to a tab id that is not in `groups`, and App falls back to "New" (see WR-01).
2. `onCloseAutoFocus` prevented focus from returning to the trigger, so focus drops to `<body>`.
3. `pendingFocusId` is never cleared, because the effect returns early when the element is missing. On some later, unrelated hydrate that includes the group, the effect fires and pulls keyboard focus onto that tab out of nowhere.
**Fix:** Clear `pendingFocusId` whenever it can't be honoured. For example, in `handleCreated`, check `useGroupStore.getState().groups.some(g => g.id === id)`. If the group is missing, skip the focus/tab switch, or let focus return to the trigger by not setting `createdRef`. Also reset `pendingFocusId` when `activeTab` changes away from that group.

### WR-03: `hydrateError` is never consumed; groups from the previous scope stay interactive after a failed rehydrate on scope change

**File:** `src/features/groups/groupStore.ts:117-121`; `src/features/groups/groupTabs.ts:15-20`
**Issue:** Before this change, a failed hydrate cleared the groups. Now it keeps the "last good state". After a source/scope change through `rehydrateAfter` (SettingsPage.tsx:569, SetupWizard.tsx:64), a failure leaves the old scope's tabs visible and clickable. Rust is already on the new scope, so `get_group_members` returns `not_found` and the view renders empty with only a `console.warn`. Duplicate validation in `CreateGroupPopover` also checks against the wrong scope's names. `hydrateError` is not read anywhere in `src/`. The `resolveActiveTab` doc comment says "a scope change ... does [trigger the fallback]", which is false when the hydrate fails.
**Fix:** Either clear state on failure when the hydrate was triggered by `rehydrateAfter` (scope change), or read `hydrateError` in `GroupTabStrip`/`GroupViewPage` to show an error or retry state. Correct the comment either way.

### WR-04: Reopening the popover during an in-flight create re-enables submit and lets the stale success close the new popover

**File:** `src/features/groups/CreateGroupPopover.tsx:53-62, 64-82`
**Issue:** Cancel/Esc can close the popover while `createGroup` is pending. `handleOpenChange(true)` then resets `inFlightRef.current = false` and `submitting = false` even though the first request has not settled, so the user can submit again. When the first request resolves, it calls `setOpen(false)` and `onCreated` against the reopened popover. It closes the popover under the user and navigates. The second submit then gets a `duplicate` error from Rust, or creates a second group if the name was changed.
**Fix:** Don't reset `inFlightRef`/`submitting` on open. Keep the trigger or Create disabled while a request is in flight. Guard the post-await `setOpen(false)` with a per-open token (`const openToken = ++openSeq.current; ... if (openToken !== openSeq.current) return;`).

### WR-05: Name key still allows visually identical or invisible names (bidi controls, filler characters)

**File:** `src/features/groups/validation.ts:24-31`; `src-tauri/src/groups_db.rs:133-150`
**Issue:** The new ignored-format list covers U+200B-200F, U+2060-2064, U+00AD and U+FEFF. It misses:
- **Bidi embedding/override/isolate controls:** U+202A-202E, U+2066-2069 and U+061C. "Team\u202E" gets a key different from "team" and renders identically. An RLO in a name also visually reverses the rest of the label in the tab, aria-label and tooltip.
- **Invisible "letters":** U+3164, U+115F, U+1160, U+FFA0, U+2800 and U+180E. These are not whitespace or marks, so a name made only of them passes `empty` and renders as a blank tab.

The phase explicitly aimed to stop look-alike duplicates and empty names, so this gap is a correctness defect in that goal.
**Fix:** Extend the shared list in both languages and add vectors to `group-vectors.json`:
```ts
.replace(/[\u00AD\u061C\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\u2800\u3164\uFEFF\uFFA0]/gu, '')
```
Also consider rejecting bidi controls in the display name outright, not just ignoring them in the key.

### WR-06: Group view shows a blank pane when filters match nothing or snapshots fail to load

**File:** `src/features/groups/GroupViewPage.tsx:32, 57-105`; `src/features/groups/useGroupMembers.ts:57-60`
**Issue:** `isEmpty` is derived from `keys`, not from what can be shown. In three cases the list area renders nothing, with no message:
- the search or assignee filter excludes every member;
- `getGroupMembers` fails, which only logs a `console.warn` and sets `{}`;
- every snapshot is unparseable and there is no live ticket.

The group tab badge still shows N members. `TicketListPage` has a `tickets.empty.noresults` state for the first case; this page doesn't.
**Fix:** Render a no-results state when `!isEmpty && !loading && sorted.length === 0`, reusing the `tickets.empty.noresults.*` keys. Expose an `error` flag from `useGroupMembers` when `!res.ok` and show an inline load error instead of silently dropping snapshot-only members.

### WR-07: Scroll arrow overlays cover the active/focused tab

**File:** `src/features/groups/GroupTabStrip.tsx:66-70, 120-159`
**Issue:** The left and right arrows are `absolute` overlays (`z-10`, opaque `bg-brand-surface`) on top of the scroller. Neither the scroller nor the scroll-into-view logic accounts for them. `scrollIntoView({inline:'nearest'})`, and the browser's own scroll when tabbing to an off-screen tab, both place the tab flush with the scroller edge, which is exactly under the 28px arrow button. The active or keyboard-focused tab ends up partly or fully hidden (WCAG 2.4.11 Focus Not Obscured).
**Fix:** Add `scroll-padding-inline: 2.5rem` (`scroll-px-10`) to the scroller so `scrollIntoView` and focus scrolling leave room for the arrows. Alternatively, render the arrows as flex siblings outside the scroller instead of overlays.

### WR-08: `restoreTicket` silently swallows persistence failures after an optimistic update

**File:** `src/features/tickets/triageActions.ts:5-10`
**Issue:** `invoke('set_triage_state', ...).catch(() => {})` updates the in-memory triage map unconditionally and discards any error. The code was moved, but it is now a shared action used by the new group view as well. If the write fails, the UI shows "seen" while the DB keeps "ignored"/"handled", and the ticket reappears in Dismissed on the next launch with no feedback.
**Fix:** Roll back on failure and notify the user:
```ts
const prev = useTicketStore.getState().triageMap[issueKey];
// optimistic update ...
invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {
  useTicketStore.getState().hydrateTriageMap({ ...useTicketStore.getState().triageMap, [issueKey]: prev });
  toast.error(i18n.t('ignored.restoreFailed'));
});
```

## Info

### IN-01: Popover transform-origin class is invalid in Tailwind v4; animation classes are no-ops

**File:** `src/components/ui/popover.tsx:21`
**Issue:** `origin-[--radix-popover-content-transform-origin]` uses v3 syntax. Tailwind v4 (`^4.2.2`) needs `origin-(--radix-popover-content-transform-origin)`. The `animate-in`/`zoom-in-95`/`slide-in-*` classes need `tw-animate-css`, which is not imported in `src/index.css`. This was copied from `tooltip.tsx`, which has the same problem.
**Fix:** Use `origin-(--radix-popover-content-transform-origin)`, and either add `@import "tw-animate-css"` or drop the animation classes.

### IN-02: `@radix-ui/react-popover` pinned exactly while siblings use caret ranges

**File:** `package.json:22`
**Issue:** `"1.3.0"` is pinned exactly, while every other `@radix-ui/*` dependency uses `^`. This is inconsistent and blocks patch updates.
**Fix:** Use `"^1.3.0"`, or document why the exact pin is needed.

### IN-03: Too-long message hard-codes the limit

**File:** `src/i18n/locales/en.json:500`, `src/i18n/locales/sk.json:500`
**Issue:** "at most 40 characters" duplicates `MAX_GROUP_NAME_CHARS` / Rust `MAX_GROUP_NAME_CHARS`, so the message will drift if the limit changes.
**Fix:** Use `{{max}}` and pass `{ max: MAX_GROUP_NAME_CHARS }` from `CreateGroupPopover`.

### IN-04: Empty-state copy points to UI that does not exist yet

**File:** `src/i18n/locales/en.json:504`, `src/i18n/locales/sk.json:504`
**Issue:** The copy tells users to use "Groups" in the issue detail or "Add to group" in lists. There are no i18n keys or controls for either in this phase, so the instructions are currently impossible to follow.
**Fix:** Make sure the later phase lands these entry points before release, or soften the copy until then.

### IN-05: New-group trigger is icon-only, with the label only in a hover tooltip

**File:** `src/features/groups/CreateGroupPopover.tsx:89-98`
**Issue:** The project preference is explicit labelled controls. The "+" is always visible and has an `aria-label`, but sighted users only see "New group" on hover.
**Fix:** Consider a visible text label (for example "+ New group"), or confirm the icon-only form is intentional for the nav strip.

### IN-06: Active tab is re-scrolled into view on every `groups` change

**File:** `src/features/groups/GroupTabStrip.tsx:65-70`
**Issue:** The effect depends on `groups`, which gets a new reference on every hydrate (any mutation, rehydrate, etc.). This overrides the user's manual scroll position in the strip.
**Fix:** Depend on `activeTab` plus a derived stable value, such as the active group's index, instead of the whole `groups` array.

### IN-07: `group_name_key` changed without recomputing stored `name_key`

**File:** `src-tauri/src/groups_db.rs:144-150, 234-238, 390-396`
**Issue:** Uniqueness (`UNIQUE(scope, name_key)`) and `group_keys()` use the stored `name_key` column. Rows created before this change that contain format characters keep their old keys, so Rust would allow a duplicate that the TS mirror rejects, because TS recomputes keys from display names. Groups are not in any release tag yet, so only dev and test databases are affected.
**Fix:** Add a one-time migration that recomputes `name_key` for all rows, or note explicitly that pre-release databases must be reset.

---

_Reviewed: 2026-10-12T13:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
