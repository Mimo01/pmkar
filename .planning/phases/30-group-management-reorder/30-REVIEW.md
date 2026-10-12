---
phase: 30-group-management-reorder
reviewed: 2026-10-12T00:00:00Z
depth: standard
files_reviewed: 34
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 30 Code Review

## Project conventions
- **Zustand selectors:** no `?? []` or fresh array/object is returned inside any selector. `selectGroupIdsForIssue` uses a `null` fallback, and the `useGroupStore((s) => s.groups)` calls are stable.
- **Drag and drop:** none present. A grep for dnd, draggable and sortable returned nothing, and reorder is menu-only (Move left / Move right).
- **Explicit labelled actions:** each action has one labelled menu item. The "…" button is shown only on the active tab; inactive tabs are reached by right-click or Shift+F10.

## Warnings

### WR-01: Focus is lost when a move fails
**File:** `src/features/groups/GroupTabStrip.tsx:196-216`
**Issue:** `handleMenuCloseAutoFocus` calls `e.preventDefault()`, so Radix no longer returns focus to the trigger. `handleMove` then returns early on `!r.ok` after the toast, without calling `focusGroupTrigger(id)`. The same happens when `positionOf` or the name lookup yields nothing, for example when the group was removed concurrently. Focus drops to `<body>`, which is bad for keyboard and screen-reader users.
**Fix:** Restore focus on every exit path:
```ts
try {
  const r = await useGroupStore.getState().moveGroup(id, dir);
  if (!r.ok) { toast.error(...); focusGroupTrigger(id); return; }
  ...
  focusGroupTrigger(id);
}
```
Or call `focusGroupTrigger(id)` once in `finally`. `focusGroupTrigger` already no-ops if the group is gone.

### WR-02: Rename popover probably does not select the existing name on open
**File:** `src/features/groups/RenameGroupPopover.tsx:30-37`, `src/features/groups/GroupNameForm.tsx:61, 140-143`
**Issue:** The input is `autoFocus` with `selectOnFocus`, so `select()` runs when the input mounts. The form state is only seeded afterwards, by the `useEffect` that calls `reset(groupName)`. At focus time the value is `''`, or the name from the previous rename, so the later value change collapses the selection and the caret ends up at the end of the text. The `selectOnFocus` test only covers the form in isolation, not the rename flow.
**Fix:** Seed the name before the input mounts. For example, use `useLayoutEffect` for the reset, or key the form content by `groupId` and initialise state from `originalName`. Alternatively, call `select()` after `reset`, for example in `onOpenAutoFocus` or a ref callback. Add a RenameGroupPopover test asserting `selectionStart === 0` and `selectionEnd === name.length`.

### WR-03: Failed delete with `not_found` leaves a stale tab
**File:** `src/features/groups/groupStore.ts:68-77`, `src/features/groups/DeleteGroupDialog.tsx:52-54`
**Issue:** `mutate` only hydrates after a successful invoke. If the backend returns `not_found` (the group was already deleted), the dialog shows "This group no longer exists" but the store still lists the group. The tab stays interactive until some later hydrate. Rename and color have the same problem: the "pending group vanished" effect in `GroupTabStrip` can never fire for a `not_found` result, because nothing refreshes the store.
**Fix:** In `mutate`'s catch branch, when the code is `not_found`, call `void get().hydrate()` before returning the failure.

## Info

### IN-01: Dead `delete` branch in `PendingAction`
**File:** `src/features/groups/GroupTabStrip.tsx:23-26, 128, 331`
**Issue:** `setPending` is only ever called with `rename` or `color`, because delete goes through `deleteTarget`. The `'delete'` variant, the `pending.kind !== 'delete'` check and `setPending(null)` in the delete dialog's `onOpenChange` are dead code.
**Fix:** Narrow the type to `'rename' | 'color'` and remove the dead references.

### IN-02: `pendingFocus` is never cleared if its target never renders
**File:** `src/features/groups/GroupTabStrip.tsx:121-129`
**Issue:** The effect returns early when the element is missing, and `manage` requests are not cleared on navigation. A request for a tab that never mounts, for example when the follow-up hydrate failed, stays set and can steal focus on a later groups change.
**Fix:** Drop the request when the id is absent from `groups`, or give it a timeout.

### IN-03: More-button remounts when a tab becomes active or inactive
**File:** `src/features/groups/GroupTab.tsx:99-110`
**Issue:** The trigger is wrapped in `<Tooltip>` only when `active`. Switching between the two trees changes the element type, so the button remounts and focus is lost if it was inside the button.
**Fix:** Always render the Tooltip and disable it with `open={active ? undefined : false}`.

### IN-04: Left-overflow check has no tolerance
**File:** `src/features/groups/groupTabs.ts:49-50`
**Issue:** `canScrollRight` allows 1px of slack, but `canScrollLeft` is `scrollLeft > 0`. A fractional `scrollLeft` on high-DPI displays can show the left arrow when nothing is scrolled.
**Fix:** Use `m.scrollLeft > 1`.

_Reviewer: Claude (gsd-code-reviewer), depth: standard_
