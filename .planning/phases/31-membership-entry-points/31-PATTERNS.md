# Phase 31: Membership Entry Points - Pattern Map

**Mapped:** 2026-10-12
**Files analyzed:** 22 (12 new, 10 modified) plus tests and locales
**Analogs found:** 20 / 22 (two have only partial analogs: `GroupPicker` listbox and `useListSelection`)

All paths are relative to `/Users/mimo/Documents/Projects/pmkar`. Locale files are flat JSON keyed by dotted strings (`"groups.tab.aria_few": ...`), not nested.

## Resolved: Open Question 1 (how `navigateToGroup` reaches GroupTabStrip focus)

### Facts from the code

- `GroupTabStrip.tsx:35-39,59` holds `pendingFocus` as **internal** `useState`. It is not exported and not a prop. `tabRefs` (line 51) is a `useRef<Map<number, HTMLButtonElement>>` that is also internal.
- The only existing producer of a tab focus request is `handleCreated` (lines 260-265):
  ```tsx
  function handleCreated(id: number) {
    if (!useGroupStore.getState().groups.some((g) => g.id === id)) return;
    setPendingFocus({ id, target: 'tab', source: 'create' });
    onTabChange(groupTabId(id));
  }
  ```
- The consumer effect (lines 132-141) focuses and scrolls the element once `tabRefs` has it, and re-runs on `[pendingFocus, groups]`:
  ```tsx
  useEffect(() => {
    if (pendingFocus === null) return;
    const map = pendingFocus.target === 'more' ? moreRefs.current : tabRefs.current;
    const el = map.get(pendingFocus.id);
    if (!el) return;
    el.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
    el.focus();
    setPendingFocus(null);
  }, [pendingFocus, groups]);
  ```
- The drop effect (lines 126-130) clears a `source: 'create'` request when `activeTab !== groupTabId(p.id)`. It deliberately keeps `source: 'manage'` requests.
- **Critical in `App.tsx`:** when `showDetail && detailTicketKey` is true (lines 224-246), App returns a **different tree** (`AppShell` without `navExtension`). `GroupTabStrip` is **unmounted** while detail is open and **remounts** when detail closes. Any focus request stored inside the strip's own state would be lost for the detail-chip case (D-06).
- `GroupTabStrip` is rendered only at `App.tsx:261` (`navExtension={<GroupTabStrip activeTab={effectiveTab} onTabChange={setCurrentTab} />}`). `onTabChange` is `setCurrentTab` (a bare `useState` setter), so card chips cannot reach it without lifting.
- `selectedTicketKey` re-opens detail via the effect at `App.tsx:140-145`, so `navigateToGroup` from detail must call the existing `handleDetailBack` (`App.tsx:147-151`), which also calls `selectTicket(null)`.

### Recommended mechanism (keep the request in App, pass it down as a prop)

1. **New file `src/features/groups/NavigationContext.tsx`** (context, default value is a no-op so existing isolated `TicketCard` and `TicketDetailPage` tests keep working):
   ```tsx
   import { createContext, useContext } from 'react';
   export interface GroupNavigation { navigateToGroup: (groupId: number) => void }
   export const NavigationContext = createContext<GroupNavigation>({ navigateToGroup: () => {} });
   export const useGroupNavigation = () => useContext(NavigationContext);
   ```
2. **`App.tsx`** (all hooks must stay above the early `if (!hydrated) return null` at line 162, same as the existing `handleDetailBack`):
   ```tsx
   const [focusRequest, setFocusRequest] = useState<{ id: number; seq: number } | null>(null);
   const navigateToGroup = useCallback((groupId: number) => {
     setShowDetail(false);                       // no-op from lists, closes detail from detail chips
     setDetailTicketKey(null);
     useTicketStore.getState().selectTicket(null); // prevents the effect at :140 re-opening detail
     setCurrentTab(groupTabId(groupId));
     setFocusRequest((p) => ({ id: groupId, seq: (p?.seq ?? 0) + 1 }));
   }, []);
   const navValue = useMemo(() => ({ navigateToGroup }), [navigateToGroup]);
   ```
   Wrap **both** the detail return (`:224-246`) and the main return (`:250-281`) in `<NavigationContext.Provider value={navValue}>`. The setup, settings and audit returns do not need it. Pass to the strip:
   `<GroupTabStrip activeTab={effectiveTab} onTabChange={setCurrentTab} focusRequest={focusRequest} onFocusRequestHandled={() => setFocusRequest(null)} />`.
3. **`GroupTabStrip.tsx`**: add the two optional props and one effect that converts the prop into the existing mechanism. Use `source: 'manage'` and `target: 'tab'` so the drop effect at `:126-130` cannot clear it when ordering of state updates varies:
   ```tsx
   useEffect(() => {
     if (!focusRequest) return;
     if (useGroupStore.getState().groups.some((g) => g.id === focusRequest.id)) {
       setPendingFocus({ id: focusRequest.id, target: 'tab', source: 'manage' });
     }
     onFocusRequestHandled?.();
   }, [focusRequest, onFocusRequestHandled]);
   ```
   The existing consumer effect (`:132-141`) then focuses and scrolls the tab. It waits for `tabRefs` to be populated and re-runs on `groups`, so it also works for the detail-chip path, where the strip remounts after `showDetail` flips to false. Refs attach during commit before effects run, so the request lands after the tab button exists.
4. **Why not the alternatives:** exporting `tabRefs` or a `focusTab()` handle fails the detail case, because the strip is unmounted. A zustand `navStore` also works but makes the "close detail" side effect (App-local `useState`) awkward. Context plus an App-owned request is the smallest change.
5. **Tests to extend:** `src/features/groups/__tests__/GroupTabStrip.test.tsx` (new `focusRequest` prop focuses the tab and calls `onFocusRequestHandled`). Add an App-level test or `TicketDetailPage` test with a stub provider (detail chip name calls `navigateToGroup`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/features/groups/NavigationContext.tsx` (new) | provider/context | event-driven | none in repo (Zustand-only so far) | no analog, see below |
| `src/App.tsx` (mod) | provider/container | event-driven | itself (`handleDetailBack`, `setCurrentTab`) | exact (self) |
| `src/features/groups/GroupTabStrip.tsx` (mod) | component | event-driven | itself (`handleCreated`, `pendingFocus`) | exact (self) |
| `src/features/groups/GroupPicker.tsx` (new) | component | request-response / CRUD | `src/features/groups/GroupNameForm.tsx` (+ `CreateGroupPopover.tsx`) and the combobox in `TicketFilterBar.tsx:174-220` | role-match |
| `src/features/groups/GroupChip.tsx` (new) | component | request-response | `src/features/groups/GroupTab.tsx:85-118` (dot + truncated name + tooltip) | role-match |
| `src/features/groups/GroupChips.tsx` (new) | component | transform | `GroupTab.tsx` + RESEARCH "Stable chip derivation" | role-match |
| `src/features/groups/DetailGroupsRow.tsx` (new) | component | CRUD | `CreateGroupPopover.tsx` (Popover + trigger) | role-match |
| `src/features/groups/SelectionBar.tsx` (new) | component | CRUD (batch) | `DeleteGroupDialog.tsx` (confirm + in-flight guard + error) | role-match |
| `src/features/groups/useListSelection.ts` (new) | hook | transform | `useGroupMembers.ts` (hook with effect + memo) | partial |
| `src/features/groups/membershipActions.ts` (new) | utility | batch | `GroupTabStrip.tsx:176-199` (`handleMove` toast.error pattern) | role-match |
| `src/features/groups/detailToTicket.ts` (new, name at planner discretion) | utility | transform | `useGroupMembers.ts` `isRenderableTicket` (target shape) | role-match |
| `src/features/tickets/TicketCard.tsx` (mod) | component | request-response | itself | exact (self) |
| `src/features/tickets/TicketFilterBar.tsx` (mod) | component | request-response | itself | exact (self) |
| `src/features/tickets/TicketListPage.tsx` (mod) | page | CRUD | `GroupViewPage.tsx` | exact |
| `src/features/tickets/IgnoredTicketsPage.tsx` (mod) | page | CRUD | `GroupViewPage.tsx` | exact |
| `src/features/tickets/LinkedTicketsPage.tsx` (mod) | page | CRUD | `GroupViewPage.tsx` | exact |
| `src/features/groups/GroupViewPage.tsx` (mod) | page | CRUD | itself | exact (self) |
| `src/features/tickets/TicketDetailPage.tsx` (mod) | page | CRUD | itself | exact (self) |
| `src/i18n/locales/en.json`, `sk.json` (mod) | config | n/a | existing `groups.*` keys | exact |
| `src/features/groups/__tests__/*.test.tsx` (new) | test | n/a | `GroupViewPage.test.tsx`, `CreateGroupPopover.test.tsx`, `groupI18n.test.ts` | exact |

## Pattern Assignments

### `src/features/groups/GroupPicker.tsx` (component, CRUD via store)

**Analogs:** `src/features/groups/CreateGroupPopover.tsx` (popover plus `pickDefaultColor` plus create), `src/features/groups/GroupNameForm.tsx` (validation, in-flight and stale guard, error slot), `src/features/tickets/TicketFilterBar.tsx:174-220` (existing in-repo combobox and listbox markup).

**Imports pattern** (CreateGroupPopover.tsx:1-10, GroupNameForm.tsx:1-8):
```tsx
import { AlertCircle, Plus } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { groupColorVar, pickDefaultColor } from './colors';
import { useGroupStore, selectGroupIdsForIssue } from './groupStore';
import { groupNameErrorKey } from './GroupNameForm';
import { groupNameKey, normalizeGroupName, validateGroupName } from './validation';
```

**Default color + create call** (CreateGroupPopover.tsx:28, 36):
```tsx
setColor(pickDefaultColor(useGroupStore.getState().groups.map((g) => g.color)));
const r = await form.submit((d) => useGroupStore.getState().createGroup(d, color));
```

**Verify the group actually landed in the store after `ok`** (CreateGroupPopover.tsx:38-41, covers research Pitfall 6):
```tsx
const present = useGroupStore.getState().groups.some((g) => g.id === r.value.id);
```

**Validation and error-message mapping** (GroupNameForm.tsx:10-25, 63, 70-74):
```tsx
export function groupNameErrorKey(code: GroupErrorCode, action: 'create' | 'rename'): string { ... }
const validation = useMemo(() => validateGroupName(name, existingNames), [name, existingNames]);
else if (!validation.ok && validation.code !== 'empty') messageCode = validation.code;
```
Reuse `groupNameErrorKey(code, 'create')` for the Rust and TS codes. Handle `duplicate` specially (no error, hide Create row, highlight the matching group, per UI-SPEC). Do not reuse `useGroupNameForm` directly. It owns a `name` input for a form, while the picker needs the query as a search box. Copy its **in-flight ref plus open-sequence token** idiom (GroupNameForm.tsx:51-53, 94-108).

**In-flight and stale-response guard to copy** (GroupNameForm.tsx:91-109):
```tsx
if (!canSubmit || inFlightRef.current || !validation.ok) return null;
inFlightRef.current = true;
setSubmitting(true);
const token = openSeq.current;
try {
  const r = await run(validation.display);
  if (token !== openSeq.current) return null; // popover reopened while pending
  if (!r.ok) setSubmitError(r.code);
  return r;
} finally { inFlightRef.current = false; setSubmitting(false); }
```

**Inline error slot markup** (GroupNameForm.tsx:166-177), matches UI-SPEC `role="alert"`, 16px min-height, `AlertCircle` 12px:
```tsx
<p id={errorId} role="alert" className="mt-1 min-h-4 flex items-center gap-1 text-xs text-destructive">
  {form.message && (<><AlertCircle className="w-3 h-3" aria-hidden="true" />{form.message}</>)}
</p>
```

**Combobox and listbox markup to copy** (TicketFilterBar.tsx:174-220, 104-122): input `role="combobox"` with `aria-expanded` and `aria-autocomplete="list"`, container `role="listbox"`, rows `role="option"` with `aria-selected` and `onMouseDown={(e) => { e.preventDefault(); ... }}` so clicks do not steal input focus, and ArrowUp and ArrowDown handlers with `Math.min` and `Math.max` clamping (no wrap). Add `aria-activedescendant`, stable option ids via `useId`, Home and End. Per RESEARCH A5, Space toggles only when the query is empty.

**Search matching** (validation.ts:18-41): compare `groupNameKey(normalizeGroupName(query))` with `groupNameKey(normalizeGroupName(g.name))` using `includes`.

**Popover autofocus:** `PopoverContent` (`src/components/ui/popover.tsx:12-28`) default is `w-70 p-4`. Override `className="w-70 p-2"` and use `onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}`. The `onCloseAutoFocus` prop pattern is at CreateGroupPopover.tsx:66-68.

**Store calls:** `useGroupStore.getState().addToGroup(groupId, tickets)` and `removeFromGroup(groupId, [key])` (groupStore.ts:50-51, 161-167). `mutate` re-hydrates before resolving, so the checkbox reflects `selectGroupIdsForIssue(key)` and is never optimistic.

**Selector rule** (groupStore.ts:180-183):
```ts
export const selectGroupIdsForIssue = (issueKey: string) => (s: GroupState): number[] | null =>
  s.groupIdsByIssue[issueKey] ?? null;
```
Coalesce in render, never in the selector.

---

### `src/features/groups/GroupChip.tsx` and `GroupChips.tsx` (component, transform)

**Analog:** `src/features/groups/GroupTab.tsx:85-118`.

**Dot and truncated name and tooltip** (GroupTab.tsx:100-117):
```tsx
<span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0"
  style={{ backgroundColor: groupColorVar(group.color) }} />
<span className="grid max-w-[160px]"> ... <span className="col-start-1 row-start-1 truncate">{group.name}</span></span>
...
<TooltipContent aria-hidden="true">{group.name}</TooltipContent>
```
Tooltip import: `import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';`. `GroupTabStrip` wraps its tree in `<TooltipProvider delayDuration={300}>` (line 268), and `TicketCard.tsx:41` wraps its own local provider, so chips inside a card should do the same. Color dot via `groupColorVar(group.color)` only. `group.color` is already coerced to a token in `load()` (groupStore.ts:93-96).

**Stable derivation** (from RESEARCH, consistent with the null-fallback rule in groupStore.ts:180):
```tsx
const ids = useGroupStore(selectGroupIdsForIssue(ticket.key)); // number[] | null
const groups = useGroupStore((s) => s.groups);                 // stable ref, already in tab order
const chips = useMemo(() => {
  const set = new Set(ids ?? []);
  return groups.filter((g) => set.has(g.id) && g.id !== hideGroupId);
}, [ids, groups, hideGroupId]);
```
`groups` is sorted by `position` in `load()` (groupStore.ts:97), which is the "tab order" rule.

**Aria-label for chip navigation:** `t('groups.chip.goTo', { name })` ("Go to group ‘{{name}}’"). Chip click: `e.stopPropagation(); navigateToGroup(g.id)` via `useGroupNavigation()`.

---

### `src/features/tickets/TicketCard.tsx` (component restructure)

**Analog:** itself. Current root is a `<button>` at lines 30-35, and `actionSlot` renders inside it at line 60, so the Restore button in `GroupViewPage.tsx:115-123` is already a nested button.

**Current props and root** (TicketCard.tsx:14-35):
```tsx
interface TicketCardProps { ticket; triageEntry?; onClick: () => void; actionSlot?: React.ReactNode }
<button type="button" onClick={onClick} aria-label={ticket.fields.summary}
  className="w-full text-left px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-brand-surface-hover border-b border-brand-border focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px]">
```
**Target shape:** `<div className="relative group ... border-b border-brand-border hover:bg-brand-surface-hover">` containing (a) the primary `<button aria-label={summary} className="absolute inset-0 ...">`, (b) a `pointer-events-none` content div, and (c) interactive pieces (`actionSlot`, chips, checkbox) with `pointer-events-auto relative z-10`. Keep `aria-label={ticket.fields.summary}` on the primary button. `GroupViewPage.test.tsx:58-62` and others find the card via `getByText(key).closest('button')`. After the change that helper must be updated (RESEARCH Pitfall 2).

**New props to add:** `hideGroupId?: number`, `selectMode?: boolean`, `selected?: boolean`, `onToggleSelect?: (shift: boolean) => void`. In select mode the primary button's click handler calls `onToggleSelect(e.shiftKey)` instead of `onClick`.

**Metadata row** (TicketCard.tsx:80-90) is where chips go (`ml-auto`). Note the file's comment says "Line 4" though it is line 3 of the visible layout.

**Hooks already in use** (lines 23-28) show the store selector style: `useTicketStore((s) => s.unseenChanges[ticket.key])`.

**Callers (all must pass new props or take the defaults):** `TicketListPage.tsx:524-529`, `IgnoredTicketsPage.tsx:85-86`, `LinkedTicketsPage.tsx:67-68`, `GroupViewPage.tsx:98-134`.

---

### `src/features/tickets/TicketFilterBar.tsx` (component, add Select toggle)

**Analog:** itself. Insert after the result count (lines 260-263):
```tsx
<span className="text-xs text-brand-muted shrink-0 ml-auto">
  {t('tickets.filter.showing', { count: resultCount })}
</span>
```
Add the props `selectMode`, `onToggleSelectMode`, `selectDisabled`, and `selectToggleRef` to `TicketFilterBarProps` (lines 9-21). Icon-button style in this file: `text-brand-muted hover:text-brand-text transition-colors duration-150` (line 250). Button primitive: `@/components/ui/button` (`Button variant="outline" size="sm"`, as used at `TicketDetailPage.tsx:258`). Pressed style is `aria-pressed` plus `bg-brand/10 text-brand-text border-brand`. Make the new props optional so `TicketFilterBar.test.tsx` keeps passing without changes.

---

### `src/features/groups/useListSelection.ts` (hook, transform)

**Analog (partial):** `src/features/groups/useGroupMembers.ts` is the closest existing hook with effect, memo, and cancel guard. No existing selection hook exists. Use the pseudo-code in RESEARCH Pattern 2.

Conventions to follow:
- Pass in the memoized `sorted.map(t => t.key)`. The prune effect must compare content before calling `setState` to avoid loops.
- Per-page `useState`, never global. Each page already unmounts on tab change: `App.tsx:270-275` renders pages conditionally, and `GroupViewPage` is mounted with `key={activeGroupId}` (`App.tsx:274`), with the comment "State resets per visit" at `GroupViewPage.tsx:20`.
- Biome rule: effect deps need a `// biome-ignore lint/correctness/useExhaustiveDependencies: <reason>` comment when intentionally incomplete (see `GroupTabStrip.tsx:93,116,132`).

**Page wiring pattern** (GroupViewPage.tsx:21-35, same shape in the other three pages):
```tsx
const [searchText, setSearchText] = useState('');
...
const sorted = useMemo(() => sortTickets(filterTickets(members, searchText, assigneeFilter), sortField, sortDirection), [...]);
```
Add `const keys = useMemo(() => sorted.map((t) => t.key), [sorted]); const sel = useListSelection(keys);` directly after `sorted`.

---

### `src/features/groups/SelectionBar.tsx` (component, batch CRUD)

**Analogs:** `DeleteGroupDialog.tsx` (confirm and in-flight and error), `GroupTabStrip.tsx:176-199` (`toast.error` plus focus restoration).

**In-flight guard, confirm button layout, error text** (DeleteGroupDialog.tsx:48-66, 102-131):
```tsx
async function handleConfirm() {
  if (!snapshot || inFlightRef.current) return;
  inFlightRef.current = true; setSubmitting(true); setError(null);
  try {
    const r = await useGroupStore.getState().deleteGroup(snapshot.id);
    if (r.ok) { ...; onOpenChange(false); } else { setError(r.code); }
  } finally { inFlightRef.current = false; setSubmitting(false); }
}
<Button ref={keepRef} type="button" variant="outline" size="sm" disabled={submitting} onClick={...}>
<Button type="button" variant="destructive" size="sm" className="text-white" disabled={submitting} onClick={handleConfirm}>
```
Cancel is the initial-focus button (`onOpenAutoFocus` at DeleteGroupDialog.tsx:86-89 does `e.preventDefault(); keepRef.current?.focus();`). For the bulk and chip confirm use `Popover` plus `PopoverAnchor` (exported from `popover.tsx:10`) with the same focus logic, and `PopoverContent className="w-70 p-4"`.

**Toast error pattern for failure** (GroupTabStrip.tsx:182-185):
```tsx
if (!r.ok) {
  toast.error(t(r.code === 'not_found' ? 'groups.error.notFound' : 'groups.error.move'));
  return;
}
```
Import: `import { toast } from 'sonner';`.

**Live region markup** (GroupTabStrip.tsx:270-278):
```tsx
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="group-move-status">{announcement}</div>
```
Announcement timer pattern with clear/set delays: GroupTabStrip.tsx:168-174.

**Focus after unmount:** `afterUnmount(fn)` at GroupTabStrip.tsx:233-236 (rAF with setTimeout fallback) is the in-repo idiom for "focus something after the current element disappears". Copy it for focusing the Select toggle after a bulk success.

---

### `src/features/groups/membershipActions.ts` (utility, batch)

**Analog:** RESEARCH "Bulk add with feedback (sketch)" plus the `GroupResult` shape from `groupStore.ts:45-51`. Key detail: `addToGroup` resolves to `{ ok: true, value: number }` where `value` is the count of newly inserted rows (RESEARCH cites `groups_db.rs:570-612`), so `skipped = tickets.length - value`. Error key resolution: reuse `groupNameErrorKey(code, 'create')` for validation codes and add `groups.error.membership` for `internal`.

---

### `src/features/groups/detailToTicket.ts` (utility, transform)

**Analog:** the required shape is the `isRenderableTicket` guard in `useGroupMembers.ts:11-24+`. Requires `key: string`; `fields.summary: string`; `fields.status.name`; `fields.priority.{id,name}`; `fields.created`; `fields.updated`. Build from `JiraTicketDetail` when `useTicketStore.getState().tickets` has no match, and assert in a unit test that `isRenderableTicket(detailToTicket(detail))` is true. Check `JiraTicket` in `src/features/tickets/types.ts` for exact fields (the test fixture `mk()` in `GroupViewPage.test.tsx:15-35` shows a minimal valid `JiraTicket`).

---

### `src/features/tickets/TicketDetailPage.tsx` (page, add Groups row and Esc guard)

**Insertion point:** between the `<p className="text-xs text-brand-muted mb-6">` updated-time line (lines 223-231) and `<TooltipProvider delayDuration={300}>` action buttons (line 234). `JiraTicketDetail` has no separate status block in this file's header, so the Groups row goes at that line gap. Use `<div className="flex flex-wrap items-center gap-2 mb-6">`. Change the `mb-6` of the `<p>` to `mb-3` as needed.

**Esc handler to patch** (lines 125-133):
```tsx
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if (e.key === 'Escape') { onBack(); }
}, [onBack]);
```
becomes `if (e.key === 'Escape' && !e.defaultPrevented) onBack();`. Verify with a test (RESEARCH A2): open the picker in detail, press Esc, picker closes and detail stays. If Radix does not mark the event handled, call `e.preventDefault()` in the picker and confirm popovers' `onEscapeKeyDown`.

**Button usage:** `import { Button } from '@/components/ui/button'` with `variant="outline" size="sm"`, as at lines 258 and 262.

**Props available:** `issueKey` and `onBack` (lines 23-24). Memberships: `useGroupStore(selectGroupIdsForIssue(issueKey))`.

---

### `src/App.tsx` (mod) and `src/features/groups/GroupTabStrip.tsx` (mod)

See "Resolved: Open Question 1" above for exact edits and line references. Existing style to copy: `useCallback` handler pattern at `App.tsx:147-151`:
```tsx
const handleDetailBack = useCallback(() => {
  setShowDetail(false);
  setDetailTicketKey(null);
  useTicketStore.getState().selectTicket(null);
}, []);
```
Add `useMemo` to the React import at `App.tsx:4`, and `groupTabId` to the `groupTabs` import at `App.tsx:16`.

---

### `src/features/groups/GroupViewPage.tsx` and the three core list pages (mod)

**Analog:** `GroupViewPage.tsx` itself, as the template for all four.

Edits per page:
1. Add `useListSelection(keys)` after `sorted` (see above).
2. Pass `selectMode`, `onToggleSelectMode`, `selectDisabled={sorted.length === 0}` and `selectToggleRef` to `TicketFilterBar`.
3. Wrap the scroll container (`GroupViewPage.tsx:93`, `TicketListPage.tsx:522`, `IgnoredTicketsPage.tsx:84`, `LinkedTicketsPage.tsx:66`) in a `relative` parent so the `SelectionBar` can position absolutely at the bottom. Add `pb-20` to the scroller only while the bar is visible.
4. Pass `hideGroupId={groupId}` (GroupViewPage only) and selection props to each `TicketCard`.
5. Render `<SelectionBar ... />` only when `sel.selected.size > 0`. In `GroupViewPage` pass `group={...}` so "Remove from group" appears and the picker excludes the current group.
6. Esc handler: a scoped `onKeyDown` on the page wrapper div (RESEARCH Open Question 4), not a document listener.

Note `GroupViewPage.tsx:102` passes `onClick={() => useTicketStore.getState().selectTicket(ticket.key)}`. Core pages use `handleSelectTicket(ticket.key)` (`TicketListPage.tsx:528`). Keep each.

---

### i18n: `src/i18n/locales/en.json` and `sk.json`

**Analog:** the plural block at en.json lines 494-498 and 529-533. Flat keys, with all four plural suffixes provided in both locales, even when `_many` equals `_few`:
```json
"groups.delete.body": "{{count}} issues are in this group. ...",
"groups.delete.body_one": "1 issue is in this group. ...",
"groups.delete.body_few": "{{count}} issues ...",
"groups.delete.body_many": "{{count}} issues ...",
"groups.delete.body_other": "{{count}} issues ...",
```
SK example (sk.json:531-532): `_few` and `_many` share wording, for example "V tejto skupine sú {{count}} úlohy.". `src/features/groups/__tests__/groupI18n.test.ts` enforces EN/SK key parity, so extend it for the new keys. Existing reusable keys: `groups.cancel`, `groups.error.duplicate|reserved|tooLong|noScope|notFound|internal`, `groups.empty.body` (already says "Groups" and "Add to group", D-18 check). New keys go under `groups.picker.*`, `groups.chip.*`, `groups.bar.*`, `groups.toast.*`, `tickets.filter.select`.

---

## Shared Patterns

### Zustand selector stability
**Source:** `src/features/groups/groupStore.ts:180-183`
**Apply to:** `GroupChips`, `DetailGroupsRow`, `GroupPicker`, `TicketCard`. Never `?? []`, `.filter` or `.map` inside a selector. Select `s.groups` (stable ref) and derive with `useMemo`.

### Group mutation result and error handling
**Source:** `groupStore.ts:55-72` (`mutate` returns `{ ok: true, value } | { ok: false, code }`, hydrates before resolving, and hydrates on `not_found`), `groupStore.ts:27-35` (`toGroupErrorCode`)
**Apply to:** all add and remove and create call sites. Branch on `r.ok`. Failure shows `t(...)` in the picker's inline `role="alert"` line, or `toast.error` for closing popovers (GroupTabStrip.tsx:182-185).

### Popover with controlled open and focus return
**Source:** `CreateGroupPopover.tsx:20-31, 48-69`, `popover.tsx:6-10`
**Apply to:** `GroupPicker` (detail and bar), the chip-remove confirm, the bulk-remove confirm. Reset local state in `onOpenChange(true)`. Use `onCloseAutoFocus` plus `e.preventDefault()` when focus must go to a non-trigger target.

### In-flight and stale-response guards
**Source:** `GroupNameForm.tsx:51-53, 91-109`, `DeleteGroupDialog.tsx:31-65`
**Apply to:** picker toggle and create, bulk add and remove, chip remove.

### Tooltip for truncated or supplementary text
**Source:** `GroupTab.tsx:85-118`, `GroupTabStrip.tsx:268` (`<TooltipProvider delayDuration={300}>`)
**Apply to:** chip names, "+N", bar clear button. Tests that render tooltips need a `TooltipProvider` wrapper.

### Live regions
**Source:** `GroupTabStrip.tsx:270-278`
**Apply to:** `SelectionBar` count, picker toggle announcements.

### Test conventions
**Source:** `src/features/groups/__tests__/GroupViewPage.test.tsx:1-35, 47-58`
```tsx
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
import { invoke } from '@tauri-apps/api/core';
const mockInvoke = vi.mocked(invoke);
useGroupStore.setState({ memberKeysByGroup, hydrated: true });
useTicketStore.setState({ tickets, triageMap, selectedTicketKey: null });
```
The `mk(key, updated, opts)` ticket factory is local to this file. Extract it to `src/test-fixtures/` (the directory already holds `group-vectors.json`) for the new tests. Other analogs: `CreateGroupPopover.test.tsx` (picker create flow), `GroupTabStrip.test.tsx` (focus and tab behavior), `groupI18n.test.ts` (key parity).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/features/groups/NavigationContext.tsx` | context provider | event-driven | No React context in the feature code today. All shared state is Zustand or props. Use the standard `createContext` with a no-op default, so isolated component tests work without a provider. |
| Shift-click range select (inside `useListSelection`) | hook logic | transform | No existing multi-select or range logic. Follow RESEARCH Pattern 2. |
| Checkbox listbox with `aria-multiselectable` (inside `GroupPicker`) | component | request-response | The only listbox in the repo is the single-select assignee suggestions at `TicketFilterBar.tsx:188-220`. Reuse its markup and key handling, and extend as described above. |

## Metadata

**Analog search scope:** `src/App.tsx`, `src/features/groups/`, `src/features/tickets/`, `src/components/ui/popover.tsx`, `src/i18n/locales/`
**Files read:** App.tsx, GroupTabStrip.tsx, GroupTab.tsx, groupStore.ts, validation.ts, colors.ts (head), CreateGroupPopover.tsx, GroupNameForm.tsx, DeleteGroupDialog.tsx, GroupViewPage.tsx, TicketCard.tsx, TicketFilterBar.tsx, TicketDetailPage.tsx (lines 120-320), popover.tsx, GroupViewPage.test.tsx (head), useGroupMembers.ts (excerpts)
**Pattern extraction date:** 2026-10-12
