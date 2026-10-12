---
phase: 30-group-management-reorder
reviewed: 2026-10-12T14:18:42Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - src/components/ui/__tests__/dialog.test.tsx
  - src/components/ui/__tests__/menu-wrappers.test.tsx
  - src/components/ui/AppShell.tsx
  - src/components/ui/context-menu.tsx
  - src/components/ui/dialog.tsx
  - src/components/ui/dropdown-menu.tsx
  - src/features/groups/__tests__/ChangeColorPopover.test.tsx
  - src/features/groups/__tests__/colors.test.ts
  - src/features/groups/__tests__/CreateGroupPopover.test.tsx
  - src/features/groups/__tests__/DeleteGroupDialog.test.tsx
  - src/features/groups/__tests__/GroupColorSwatches.test.tsx
  - src/features/groups/__tests__/groupI18n.test.ts
  - src/features/groups/__tests__/GroupMenuItems.test.tsx
  - src/features/groups/__tests__/groupMoves.test.ts
  - src/features/groups/__tests__/GroupNameForm.test.tsx
  - src/features/groups/__tests__/groupTabs.test.ts
  - src/features/groups/__tests__/GroupTabStrip.test.tsx
  - src/features/groups/__tests__/GroupTabStripOverlays.test.tsx
  - src/features/groups/__tests__/RenameGroupPopover.test.tsx
  - src/features/groups/__tests__/validation.test.ts
  - src/features/groups/ChangeColorPopover.tsx
  - src/features/groups/colors.ts
  - src/features/groups/CreateGroupPopover.tsx
  - src/features/groups/DeleteGroupDialog.tsx
  - src/features/groups/GroupColorSwatches.tsx
  - src/features/groups/GroupMenuItems.tsx
  - src/features/groups/groupMoves.ts
  - src/features/groups/GroupNameForm.tsx
  - src/features/groups/GroupTab.tsx
  - src/features/groups/groupTabs.ts
  - src/features/groups/GroupTabStrip.tsx
  - src/features/groups/RenameGroupPopover.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
  - src/index.css
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-10-12T14:18:42Z
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

This is a re-review after gap-closure plan 30-08 and the fixes from the earlier review (WR-01..WR-03, see 30-REVIEW-FIX.md).

**The 30-08 fix works.** I checked it against a real production build (`vite build`), not just the source:
- All eight light `--color-group-*` declarations now reach the emitted CSS.
- The eight `body.dark` overrides are emitted too.
- No variable that is still in `@theme` is dropped from the build.

The cascade is correct. The unlayered `:root` rule beats Tailwind's layered `@layer theme` `:root`. `body.dark` then overrides on `<body>`, which every portaled popover and menu inherits from. The test changes in `colors.test.ts` match the new location:
- parity is checked against `:root` and `body.dark`;
- `@theme` must contain zero group declarations;
- comments are excluded from the count.

The `colors.ts` doc comment is accurate.

The earlier fixes hold up:
- `focusGroupTrigger` in `handleMove`'s `finally` restores focus on every exit path.
- Seeding during render in `RenameGroupPopover` is correct.
- The `not_found` re-hydrate in `groupStore.mutate` works.

**The remaining problems are edge cases in the delete flow.** The `not_found` re-hydrate from WR-03 creates a new focus-loss path in the delete dialog that nothing handles or tests (WR-01). Separately, a create that the user cancels while it is still pending still switches tabs and moves focus (WR-02).

Locale key parity between `en.json` and `sk.json` is complete. Every `groups.*` key used by the reviewed components exists in both, with plural forms.

## Warnings

### WR-01: Delete failing with `not_found` drops focus to `<body>` and leaves a live "Delete" button for a group that no longer exists

**File:** `src/features/groups/DeleteGroupDialog.tsx:54-61`, `src/features/groups/GroupTabStrip.tsx:238-245`

**Issue:** Since the WR-03 fix, `mutate` awaits `hydrate()` on `not_found`, so the group is already gone from the store when `handleConfirm` receives `{ ok: false, code: 'not_found' }`. Three things go wrong:

1. The dialog stays open showing "This group no longer exists." The **Delete group** button stays enabled, so the user can retry the same impossible delete as many times as they like.
2. When the user presses **Keep group** or Esc, `onReturnFocus(false)` runs and leads to `handleDeleteReturnFocus(false)`, then `focusGroupTrigger(ctx.id)`. That function returns early because the group is no longer in the store. `onCloseAutoFocus` already called `preventDefault()`, so focus falls to `<body>`. The precomputed `ctx.focus` target (neighbour tab, New core tab, or the + button) is never used.
3. If the group was the active tab, `resolveActiveTab` quietly redirects to `new`. But `onDeleted` is never called, so `onTabChange('new')` never runs and the stored active tab still points at the vanished group.

No test covers this. `GroupTabStripOverlays.test.tsx:269` only exercises `internal`.

**Fix:** Treat `not_found` like a completed delete from the strip's point of view, and handle focus with the delete-path logic:

```tsx
// DeleteGroupDialog.handleConfirm
const r = await useGroupStore.getState().deleteGroup(snapshot.id);
if (r.ok || r.code === 'not_found') {
  deletedRef.current = true;
  onDeleted(snapshot.id);
  onOpenChange(false);
  if (!r.ok) toast.error(t('groups.error.notFound'));
} else {
  setError(r.code);
}
```

Alternatively, keep the inline message but disable Confirm when `error === 'not_found'`, and make `handleDeleteReturnFocus` fall through to the `deleted` branch when `ctx.id` is no longer in the store. Add a strip-level test that uses `deleteError = { code: 'not_found' }` and asserts where focus ends up.

### WR-02: Cancelling a pending create still switches tabs and moves focus once the create resolves

**File:** `src/features/groups/CreateGroupPopover.tsx:25-45`, `src/features/groups/GroupNameForm.tsx:83-109`

**Issue:** The stale-submit guard in `useGroupNameForm.submit` compares `openSeq`, and only `reset()` increments it. `reset()` runs on open, not on close. Here is the failing sequence:

1. The user presses Create.
2. While `create_group` is pending, they press Cancel or Esc, or click outside. `handleOpenChange(false)` closes the popover without bumping `openSeq`.
3. The user moves on, for example by clicking another tab.
4. The create resolves. `token === openSeq.current`, so `handleSubmit` continues, calls `onCreated`, and `GroupTabStrip.handleCreated` runs `onTabChange(groupTabId(id))` plus a focus request.

The user is pulled onto the new group's tab after they dismissed the popover. The comment at `GroupNameForm.tsx:100-101` ("do not close or navigate under the user") only covers the reopen case.

**Fix:** Invalidate in-flight submits on close as well as on open, for example by exposing `form.invalidate()` (`openSeq.current += 1`) and calling it from `handleOpenChange(false)`. The group is still created and shows up after hydrate; only the navigation and focus change are skipped. Apply the same idea to `RenameGroupPopover` for consistency, although a rename that resolves after close is harmless there.

## Info

### IN-01: Light-palette regression test is source-level only

**File:** `src/features/groups/__tests__/colors.test.ts:164-171`
**Issue:** The new guard asserts that `@theme` has zero group declarations. That proves the variables are not in `@theme`, but not that they reach the build. The original UAT gap passed the source-level parity tests because Tailwind's tree-shaking only shows up in compiled output. A future move into another construct that Tailwind processes, such as a `@utility` or `@layer` that gets purged, would pass this test silently. jsdom never loads `index.css`, so no component test covers this either.
**Fix:** Optionally add a small test that compiles `src/index.css` with `@tailwindcss/node` (or `compile()` from `tailwindcss`) and asserts that every `--color-group-<token>:` appears in the output. Otherwise, add a line to the verification checklist to grep `dist/assets/*.css`.

### IN-02: `PendingAction.kind` includes `'delete'`, but nothing ever sets it

**File:** `src/features/groups/GroupTabStrip.tsx:25-28, 145, 393`
**Issue:** Delete uses `deleteTarget` state instead. `setPending` is never called with `kind: 'delete'`. The `pending.kind !== 'delete'` guard in the vanished-group effect and the `setPending(null)` in the dialog's `onOpenChange` are dead code. They suggest the two mechanisms are linked when they are not.
**Fix:** Narrow `kind` to `'rename' | 'color'` and remove the dead branches.

### IN-03: Delete intent on a group that vanished between menu open and close drops focus

**File:** `src/features/groups/GroupTabStrip.tsx:209, 216-228`
**Issue:** `e.preventDefault()` runs before the code checks that the group still exists. If `g` is not found, nothing opens and nothing receives focus, so focus lands on `<body>`. Rename and color have the same window, but the vanished-group effect covers them with a toast.
**Fix:** If `g` is missing, return without calling `preventDefault()`, so Radix restores focus to the trigger. If the trigger is gone too, focus the nearest neighbour.

### IN-04: Side effect during render in `RenameGroupPopover`'s seeding

**File:** `src/features/groups/RenameGroupPopover.tsx:37-40`, `src/features/groups/GroupNameForm.tsx:83-89`
**Issue:** `reset()` mutates `openSeq.current` during render. StrictMode double renders, and discarded concurrent renders, can increment it more than once. Today that is harmless because it only happens on open transitions and the guard is an inequality check. Still, it is a ref write during render that React's rules forbid, and it relies on `reset` staying limited to `setState` plus that one counter.
**Fix:** Document the invariant on `reset`, or move the `openSeq` bump into a layout effect keyed on `seededKey`.

### IN-05: Hard-coded English `aria-label` in `AppShell`

**File:** `src/components/ui/AppShell.tsx` (nav element, `aria-label="Main navigation"`)
**Issue:** Every other user-facing string in the shell goes through `t()`. Slovak screen-reader users hear this landmark name in English.
**Fix:** Add a `nav.main` key to both locales and use `aria-label={t('nav.main')}`.

---

_Reviewed: 2026-10-12T14:18:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
