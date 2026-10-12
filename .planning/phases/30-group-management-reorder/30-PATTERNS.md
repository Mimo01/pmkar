# Phase 30: Group Management & Reorder - Pattern Map

**Mapped:** 2026-10-12
**Files analyzed:** 22 (12 new source, 5 modified source, 5 new tests + extended tests)
**Analogs found:** 20 / 22 (two files have partial/no analog: menu-primitive wrappers use the popover/dialog shadcn wrappers as role-match; `groupMoves.ts` uses `groupTabs.ts`)

All paths are relative to `/Users/mimo/Documents/Projects/pmkar/src`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `components/ui/dropdown-menu.tsx` (new) | component (shadcn wrapper) | request-response | `components/ui/popover.tsx` | role-match |
| `components/ui/context-menu.tsx` (new) | component (shadcn wrapper) | request-response | `components/ui/popover.tsx` | role-match |
| `features/groups/GroupTab.tsx` (mod) | component | event-driven | itself (`GroupTab.tsx`) | exact (self) |
| `features/groups/GroupTabStrip.tsx` (mod) | component (orchestrator) | event-driven | itself (`GroupTabStrip.tsx`) | exact (self) |
| `features/groups/GroupMenuItems.tsx` (new) | component | event-driven | `GroupTab.tsx` (props/i18n style); Radix items from new wrappers | partial |
| `features/groups/GroupNameForm.tsx` (new) | component (extracted form) | request-response | `features/groups/CreateGroupPopover.tsx` lines 27-157 | exact (extraction) |
| `features/groups/GroupColorSwatches.tsx` (new) | component | event-driven | none for radiogroup; tooltip/button style from `CreateGroupPopover.tsx` + `colors.ts` | partial |
| `features/groups/RenameGroupPopover.tsx` (new) | component | request-response | `CreateGroupPopover.tsx` | exact |
| `features/groups/ChangeColorPopover.tsx` (new) | component | request-response | `CreateGroupPopover.tsx` (popover shell) | role-match |
| `features/groups/DeleteGroupDialog.tsx` (new) | component | request-response | `components/ui/dialog.tsx` + `CreateGroupPopover.tsx` submit/guard flow | role-match |
| `features/groups/groupMoves.ts` (new) | utility (pure helpers) | transform | `features/groups/groupTabs.ts` | role-match |
| `features/groups/CreateGroupPopover.tsx` (mod) | component | request-response | itself | exact (self) |
| `components/ui/AppShell.tsx` (mod, flagged by RESEARCH) | component | request-response | itself | exact (self) |
| `App.tsx` (mod? only if delete wiring needs it; `onTabChange` already passed) | component | event-driven | itself line 261 | exact (self) |
| `i18n/locales/en.json`, `sk.json` (mod) | config | n/a | existing `groups.*` keys lines 488-509 | exact |
| `features/groups/__tests__/GroupTabStrip.test.tsx` (extend) | test | event-driven | itself | exact |
| `features/groups/__tests__/CreateGroupPopover.test.tsx` (extend) | test | request-response | itself | exact |
| `features/groups/__tests__/groupI18n.test.ts` (extend) | test | transform | itself | exact |
| `features/groups/__tests__/validation.test.ts` (extend) | test | transform | itself | exact |
| `features/groups/__tests__/{GroupNameForm,RenameGroupPopover,GroupColorSwatches,DeleteGroupDialog}.test.tsx` (new) | test | request-response | `CreateGroupPopover.test.tsx` | role-match |
| `features/groups/__tests__/groupMoves.test.ts` (new) | test | transform | `groupTabs.test.ts` | role-match |

## Pattern Assignments

### `components/ui/dropdown-menu.tsx` and `components/ui/context-menu.tsx` (shadcn wrappers)

**Analog:** `components/ui/popover.tsx` (whole file, 31 lines). Same shape: `import * as XPrimitive`, `cn` from `@/lib/utils`, re-export primitives, `forwardRef` content wrapped in `Portal`, `displayName`.

```tsx
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';
import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'end', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content ref={ref} align={align} sideOffset={sideOffset}
      className={cn('z-50 ... rounded-md border border-brand-border bg-popover ... shadow-md outline-none animate-in fade-in-0 zoom-in-95 ...', className)} {...props} />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;
export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
```

Apply: Menu content `min-w-[180px] p-1` (UI-SPEC), items `text-sm`, highlight `focus:bg-brand-surface-hover`, destructive item `text-destructive focus:bg-destructive/10`, disabled `data-[disabled]:opacity-50`. Export `DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator` and the `ContextMenu*` equivalents. Separator analog: `components/ui/separator.tsx`.

---

### `features/groups/GroupTab.tsx` (modify; component, event-driven)

**Analog:** itself. Current props and structure (lines 6-50): `Tooltip > TooltipTrigger asChild > <button>` with `buttonRef` callback prop, `aria-label={t('groups.tab.aria', {name, count})}`, `aria-current`, and the width-stable bold trick (lines 35-43).

Width-stable trick to keep verbatim:
```tsx
<span className="grid max-w-[160px]">
  <span aria-hidden="true" className="col-start-1 row-start-1 truncate invisible font-semibold">{group.name}</span>
  <span className="col-start-1 row-start-1 truncate">{group.name}</span>
</span>
```

Changes (per RESEARCH Pattern 5 and UI-SPEC):
- Introduce a wrapper `div` (`inline-flex items-center`, `shrink-0 mr-4 border-b-2`) that takes over the border/active-color/`mr-4` classes currently at line 24-28. The inner tab button keeps `aria-label`, `aria-current`, ref, `onClick`, focus ring classes.
- `…` is a sibling button (never nested): always laid out, `invisible pointer-events-none aria-hidden tabIndex={-1}` when inactive.
- New props: `moreButtonRef`, `onContextMenuKey` etc.; the tab `Tooltip` stays on the tab button only.
- Wrap in `ContextMenu` (trigger `asChild` on the wrapper div). `onContextMenu` must NOT call `onSelect` (D-02).
- Tooltip must stay outermost around `DropdownMenuTrigger asChild` on the `…` button (Pitfall 9).

**Test-breakage warning:** `GroupTabStrip.test.tsx` lines 90-92 assert `b.className` contains `border-brand` and `font-semibold` on the tab `button`. Moving the border to a wrapper requires updating that test (assert on `b.parentElement` for border; keep `font-semibold` on the button or move deliberately). Test at lines 112-117 reads `nameEl.parentElement?.className` containing `max-w-[160px]` and `querySelectorAll('span')` on the tab: keep the span structure inside the tab button.

---

### `features/groups/GroupTabStrip.tsx` (modify; orchestrator, event-driven)

**Analog:** itself. Reusable bits:

Ref maps and pending focus (lines 23, 25, 72-86):
```tsx
const tabRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
const [pendingFocusId, setPendingFocusId] = useState<number | null>(null);

// Drop a pending focus request once the user navigates away ... (lines 72-76)
useEffect(() => {
  setPendingFocusId((p) => (p !== null && activeTab !== groupTabId(p) ? null : p));
}, [activeTab]);

// biome-ignore lint/correctness/useExhaustiveDependencies: wait for the new group to render
useEffect(() => {
  if (pendingFocusId === null) return;
  const el = tabRefs.current.get(pendingFocusId);
  if (!el) return;
  el.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  el.focus();
  setPendingFocusId(null);
}, [pendingFocusId, groups]);
```
Gotcha (RESEARCH Pattern 4): the active-tab guard at 74-76 clears focus requests for a right-clicked non-active tab. Change to `pendingFocus: {id, target: 'more'|'tab'}` and relax the guard for move/rename/color/delete (keep for create). Add a second ref map `moreRefs` and `focusGroupTrigger(id) = moreRefs.get(id) ?? tabRefs.get(id)`.

Ref-callback registration pattern to copy for `moreRefs` (lines 122-125):
```tsx
buttonRef={(el) => {
  if (el) tabRefs.current.set(g.id, el);
  else tabRefs.current.delete(g.id);
}}
```

Store selector (line 21, stable): `const groups = useGroupStore((s) => s.groups);` Derive neighbours with `useMemo`; never `?? []` in a selector.

Store-call-then-read-state pattern (copy from `CreateGroupPopover.tsx` lines 74-85; same for move/delete):
```tsx
const r = await useGroupStore.getState().createGroup(v.display);
const present = useGroupStore.getState().groups.some((g) => g.id === r.value.id);
```
Move flow: `const r = await useGroupStore.getState().moveGroup(id, dir)`; on ok read `groups`, `position = index+1`, `total = length`, set the announcement and pending focus; on error `toast.error(...)` (sonner, see `components/ui/sonner.tsx`).

`handleCreated` (lines 93-98) shows how to sync `setPendingFocusId` + `onTabChange(groupTabId(id))`. Delete of the active group: `onTabChange('new')` explicitly (D-13).

Also add: always-mounted visually hidden `role="status" aria-live="polite" aria-atomic="true"` live region; one controlled `pending` state `{groupId, kind:'rename'|'color'|'delete'}`; popovers anchored via `PopoverAnchor`; overlays opened from the menu's `onCloseAutoFocus` (RESEARCH Pattern 2). Strip already sits inside `<TooltipProvider delayDuration={300}>` (line 101); new Tooltips inherit it. `<CreateGroupPopover onCreated={handleCreated} />` at line 171 needs a forwarded trigger ref for D-14 (focus `＋`).

Core-tab focus for D-14: `AppShell` nav buttons have no ref; use `data-tab-id` + `document.querySelector` helper (see AppShell below).

---

### `features/groups/GroupNameForm.tsx` (new; extracted form)

**Analog:** `features/groups/CreateGroupPopover.tsx`. Extract lines 12-25 (`errorKey`), 27-53 (state, validation, message), 55-93 (open reset, submit with `inFlightRef` + `openSeq` guards) and the JSX 117-157.

Imports (lines 1-10):
```tsx
import { AlertCircle } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useGroupStore } from './groupStore';
import type { GroupErrorCode } from './types';
import { validateGroupName } from './validation';
```

Validation/message logic (lines 41-53) to preserve:
```tsx
const v = useMemo(() => validateGroupName(name, groups.map((g) => g.name)), [name, groups]);
let messageCode: GroupErrorCode | null = null;
if (submitError) messageCode = submitError;
else if (!v.ok && v.code !== 'empty') messageCode = v.code;
const message = messageCode ? t(errorKey(messageCode)) : null;
```
Rename adaptation (RESEARCH Pattern 7): pass `groups.filter(g => g.id !== group.id).map(g => g.name)`; `unchanged = normalizeGroupName(name) === normalizeGroupName(group.name)` disables Save with no message (suppress message when unchanged; own name no longer collides because self is excluded). Also add `not_found` / rename-specific `internal` mapping to `errorKey` (currently `internal` copy is "Could not create the group").

Input and error line markup to copy (lines 122-148): `autoFocus` with the biome-ignore comment, `aria-invalid`, `aria-describedby={errorId}`, error `<p role="alert" className="mt-1 min-h-4 flex items-center gap-1 text-xs text-destructive">` with `AlertCircle`. For rename add `onFocus={(e) => e.currentTarget.select()}` (fully selected, D-06) and prefilled initial value.

Buttons (lines 149-156): `Button variant="ghost" size="sm"` Cancel and `Button type="submit" size="sm" disabled={!v.ok || submitting}`.

The stale-guard comments at 37, 61-63, 75-77 must be preserved in the extraction (they encode earlier review fixes).

---

### `features/groups/RenameGroupPopover.tsx` (new) and `ChangeColorPopover.tsx` (new)

**Analog:** `CreateGroupPopover.tsx` popover shell (lines 96, 111-116):
```tsx
<Popover open={open} onOpenChange={handleOpenChange}>
  ...
  <PopoverContent align="end" onCloseAutoFocus={(e) => { if (createdRef.current) e.preventDefault(); }}>
```
Adaptations: controlled `open` from strip's `pending`; `PopoverAnchor asChild` around the tab wrapper (exported in `components/ui/popover.tsx`); `align="start"`; `onCloseAutoFocus` always `preventDefault()` then focus via strip's `focusGroupTrigger(id)` (no PopoverTrigger exists, D-08). Title style from line 118: `<h2 className="text-base font-semibold text-brand-text mb-3">`. Rename calls `useGroupStore.getState().renameGroup(group.id, v.display)`; ChangeColor calls `setGroupColor` and on failure closes + sonner toast.

---

### `features/groups/GroupColorSwatches.tsx` (new)

**Analog (partial):** no radiogroup exists in the codebase. Copy tokens API from `features/groups/colors.ts`:
```ts
import { GROUP_COLOR_TOKENS, groupColorVar, type GroupColorToken } from './colors';
// render each: style={{ backgroundColor: groupColorVar(token) }}  (never raw strings)
```
Tooltip per swatch: `Tooltip/TooltipTrigger asChild/TooltipContent aria-hidden="true"` as in `CreateGroupPopover.tsx` lines 97-110 (button also carries `aria-label`). Button focus-ring classes to reuse: `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`. Structure per UI-SPEC: `role="radiogroup" aria-label={t('groups.color.label')}`, `role="radio" aria-checked`, roving tabindex, 24px hit area, 16px circle, selected ring + 12px `Check`. Color names via `groups.color.<token>` i18n keys. Create popover: `pickDefaultColor(groups.map(g => g.color))` (takes `readonly string[]`, NOT `Group[]`; the UI-SPEC pseudo-code is wrong).

---

### `features/groups/DeleteGroupDialog.tsx` (new)

**Analog:** `components/ui/dialog.tsx` exports `Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription`. Submit/guard flow from `CreateGroupPopover.tsx` lines 67-93 (`inFlightRef`, `submitting`, try/finally).

Gotchas in `dialog.tsx`: `DialogContent` hardcodes an extra top-right `X` Close with English `sr-only "Close"` (lines 41-44); `max-w-lg` default must be overridden with `max-w-[400px]`; DialogTitle default is `text-lg` (UI-SPEC wants 16px/600, override via className). Use `role="alertdialog"`, `onOpenAutoFocus` to focus Cancel ("Keep group") ref, `onInteractOutside={(e) => e.preventDefault()}`, `onCloseAutoFocus` preventDefault + D-14 focus. Snapshot `{id,name,memberCount,wasActive,neighbourId}` at open. Body: `count === 0 ? t('groups.delete.bodyEmpty') : t('groups.delete.body', { count })`. Inline error `<p role="alert" className="text-xs text-destructive">` as in Create (lines 137-148). Destructive button: `Button` variant destructive if present in `components/ui/button.tsx` (verify; otherwise `className="bg-destructive text-white"`).

---

### `features/groups/groupMoves.ts` (new; utility, transform)

**Analog:** `features/groups/groupTabs.ts` (pure helpers, `Pick<Group,'id'>[]` params, no React). Style:
```ts
export function resolveActiveTab(tab: TabId, groups: readonly Pick<Group, 'id'>[], groupsHydrated: boolean): TabId { ... }
```
Implement `canMove`, `positionOf`, `deleteFocusTarget` per RESEARCH "Pure helpers" (lines 277-290). Type `MoveDirection` already exists in `types.ts`. Test analog: `__tests__/groupTabs.test.ts`.

---

### `components/ui/AppShell.tsx` (modify, flagged)

Core tab buttons (nav map, ~line 78-92) have no ref/id. Add one attribute:
```tsx
<button key={tab.id} type="button" onClick={() => onTabChange(tab.id)} data-tab-id={tab.id} ...>
```
Then a helper (e.g. in `groupTabs.ts`) `focusCoreTab('new')` = `document.querySelector<HTMLElement>('[data-tab-id="new"]')?.focus()`. Minimal blast radius; no styling change.

---

### `App.tsx` (likely no change)

Line 261: `navExtension={<GroupTabStrip activeTab={effectiveTab} onTabChange={setCurrentTab} />}`. `onTabChange('new')` from the strip satisfies D-13. Note line 110-112: App derives `effectiveTab` and intentionally never writes the fallback back; delete must explicitly write `'new'` via `onTabChange`.

---

### i18n `en.json` / `sk.json` (modify)

Existing flat dotted keys at `i18n/locales/en.json` lines 488-509, e.g.:
```json
"groups.create": "Create",
"groups.tab.aria": "{{name}}, {{count}} issues",
"groups.tab.aria_one": "{{name}}, {{count}} issue",
"groups.tab.aria_few": ..., "groups.tab.aria_many": ..., "groups.tab.aria_other": ...,
"groups.error.internal": "Could not create the group. Try again.",
```
Add (identical key sets in both locales, copy from UI-SPEC table): `groups.create` text -> "Create group", `groups.rename.*`, `groups.color.label`, `groups.color.<8 tokens>`, `groups.menu.*` (trigger, rename, color, moveLeft, moveRight, delete), `groups.delete.title`, `groups.delete.body_one/_few/_many/_other` plus `bodyEmpty`, `groups.delete.keep`, `groups.delete.confirm`, `groups.move.announce`, `groups.error.notFound`, `groups.error.{rename,move,color,delete}`. Plural keys follow the `_one/_few/_many/_other` convention; the `0` case is a separate key (sk has no `_zero`). Mind that `validation.ts` reads `nav.*` keys from the same JSON files; do not touch those. Existing `groups.error.internal` says "create": rename needs its own key.

---

### Tests

**Analog for strip tests:** `__tests__/GroupTabStrip.test.tsx`. Reuse harness (lines 1-62):
```tsx
const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
const initial = useGroupStore.getState();
// fixtures sprint / qa / ops, seed(groups), beforeAll stubs: ResizeObserver, matchMedia, scrollIntoView, scrollBy
```
Add to `beforeAll` for Radix menus: `Element.prototype.hasPointerCapture`, `releasePointerCapture` stubs (Pitfall 10). Open menus via `fireEvent.contextMenu` or keyboard Enter on the `…`.

**Analog for popover/form tests:** `__tests__/CreateGroupPopover.test.tsx` (invoke mock routed by command name: `create_group`, `list_groups`, `list_group_memberships`; `TooltipProvider` wrapper; `createBehavior` hooks). Mirror with `rename_group`, `set_group_color`, `move_group`, `delete_group`.

Update existing assertions: any `'Create'` button-name lookups in `CreateGroupPopover.test.tsx`, `GroupTabStrip.test.tsx`, `groupI18n.test.ts` (label becomes "Create group"); `border-brand`/`font-semibold` assertions on tab (see GroupTab warning). `groupI18n.test.ts` pattern for plural tests (lines 1-27) extends to `groups.delete.body` en/sk (1/3/5) and an `Intl.PluralRules('sk')` check.

## Shared Patterns

### Result handling from store actions
**Source:** `features/groups/groupStore.ts` lines 55-67 (`mutate`) and types `GroupResult<T> = {ok:true,value}|{ok:false,code}`.
**Apply to:** rename, color, move, delete callers. Mutations `await get().hydrate()` before resolving, so after `await` the store `groups` is updated (React commit still async; focus via effect).
```ts
const r = await useGroupStore.getState().moveGroup(id, dir);
if (!r.ok) { /* r.code: GroupErrorCode; toast or inline */ }
```

### Stale-response and in-flight guards
**Source:** `CreateGroupPopover.tsx` lines 35-38, 61-63, 69-77, 89-92 (`inFlightRef`, `openSeq`, `try/finally`).
**Apply to:** GroupNameForm (rename + create), DeleteGroupDialog, move (disable Move items while in flight, Pitfall 6).

### Zustand selector stability
**Source:** `GroupTabStrip.tsx` line 21 / `CreateGroupPopover.tsx` line 39: `useGroupStore((s) => s.groups)`. Never return `?? []` inside selectors (existing `selectGroupIdsForIssue` at `groupStore.ts` end returns `null` fallback).

### Error code to i18n key
**Source:** `CreateGroupPopover.tsx` lines 12-25 (`errorKey`). Reuse for rename; extend with `not_found`.

### Focus-ring and icon-button class string
**Source:** `GroupTabStrip.tsx` line 10-11 `ARROW_CLASS` and `CreateGroupPopover.tsx` line 103: `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`. Apply to `…` button and swatches.

### Tooltip usage
**Source:** `CreateGroupPopover.tsx` lines 97-110: `Tooltip > TooltipTrigger asChild > ... ; <TooltipContent aria-hidden="true">`. Provider already supplied by the strip (`delayDuration={300}`).

### Color rendering safety
**Source:** `colors.ts` `groupColorVar(token)`; `GroupTab.tsx` line 33 `style={{ backgroundColor: groupColorVar(group.color) }}`. Never interpolate raw stored strings.

### Scroll into view
**Source:** `GroupTabStrip.tsx` lines 69, 83: `el.scrollIntoView?.({ inline: 'nearest', block: 'nearest' })` (optional-call because jsdom lacks it).

## No Analog Found

| File / Concern | Role | Data Flow | Reason |
|---|---|---|---|
| Radix DropdownMenu / ContextMenu usage | component | event-driven | No menu primitive exists yet; use popover.tsx wrapper shape and RESEARCH Patterns 1-2, 9 |
| Radiogroup roving-tabindex in `GroupColorSwatches` | component | event-driven | No radiogroup or roving tabindex in the codebase; follow RESEARCH Pattern 8 / ARIA APG |
| Live region (`role="status"`) | component | event-driven | No existing always-mounted live region found; follow RESEARCH Pitfall 7 (clear then set, timer cleanup) |

## Metadata

**Analog search scope:** `src/features/groups`, `src/features/groups/__tests__`, `src/components/ui`, `src/App.tsx`, `src/i18n/locales/en.json`, `src/test-setup.ts`
**Files scanned:** about 25
**Pattern extraction date:** 2026-10-12
