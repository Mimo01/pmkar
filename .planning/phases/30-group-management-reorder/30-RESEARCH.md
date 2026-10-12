# Phase 30: Group Management & Reorder - Research

**Researched:** 2026-10-12
**Domain:** React 19 + Radix UI menus/popovers/dialog, Zustand store wiring, i18next (EN/SK), a11y focus management (Tauri desktop app)
**Confidence:** HIGH on codebase integration, MEDIUM on Radix focus-handoff behaviour (to be proven by tests)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The **active** group tab shows an always-visible small `…` button inside the tab, which opens the group menu. Inactive group tabs show no `…`. Not hover-revealed.
- **D-02:** **Right-click** (contextmenu) on **any** group tab opens the same menu for that group. It does **not** switch tabs; actions target the right-clicked group. Core tabs have no menu.
- **D-03:** Menu items, in order: `Rename…`, `Change color…`, separator, `Move left`, `Move right`, separator, `Delete group…` (destructive styling, last).
- **D-04:** First group's `Move left` and last group's `Move right` are **shown but disabled** (aria-disabled). With a single group both are disabled. Moves never cross into core tabs.
- **D-05:** Menu **closes after each Move**. Focus returns to the moved tab's `…` trigger, which follows the tab to its new position. Moved tab scrolled into view.
- **D-06:** `Rename…` opens a **popover anchored to the group tab**, reusing the Create form: "Rename group" title, name input prefilled and fully selected, inline error line, Cancel and Save buttons, Enter submits, Esc cancels. Extract and share the form logic with `CreateGroupPopover` (live validation, Rust error codes inline, stale-response guards).
- **D-07:** Validation excludes the group's own name from the duplicate check. An **unchanged** name (identical after trim + NFC) disables Save with no message. Case-only or diacritic-only change of own name is **allowed**. Rust stays authoritative.
- **D-08:** After Save or Cancel, focus returns to the tab's `…` trigger; if launched from a right-clicked inactive tab (no `…`), focus returns to that tab button.
- **D-09:** `Change color…` opens a **swatch popover anchored to the tab**: 8 palette swatches, current checked; each swatch a button with translated color name as aria-label and tooltip. Picking **applies immediately** via `setGroupColor` and closes. Keyboard navigable.
- **D-10:** The **Create popover (＋) gets the same swatch row** under the name input, preselected via `pickDefaultColor`; chosen token passed to `createGroup(name, color)`. Rename popover does **not** include swatches.
- **D-11:** Duplicate colors allowed, no warning, no "in use" markers.
- **D-12:** `Delete group…` opens a **modal confirm** (Radix Dialog, `role="alertdialog"`). Title `Delete “<name>”?`; body "<N> issues are in this group. The issues themselves are not affected." / "This group is empty."; Slovak plural forms (`_one/_few/_many/_other`); Cancel focused by default + destructive red Delete group. Count is `memberCount`.
- **D-13:** If the deleted group was active, land on **New**; write `'new'` explicitly into `currentTab`.
- **D-14:** Focus after delete: non-active deleted -> left neighbour group tab (or right if it was first); no groups remain -> `＋`; active deleted -> **New** core tab.
- **D-15:** After a Move, a polite live region announces name and position, e.g. `“Sprint 12” moved to position 2 of 5.` Positions count groups only. EN and SK, plural-safe.
- Carried forward: Phase 28 D-05..D-08 (8-hue palette, token not hex, dot + neutral text, default least-used); D-14/D-16..D-18 (40 char max, Rust-authoritative validation with TS mirror, diacritic-aware duplicate/reserved); Phase 29 D-05/D-07 (tab anatomy dot·name·count, activated tab scrolls into view); Phase 28 D-22 no `?? []` in Zustand selectors; no drag and drop; explicit labelled actions.

### Claude's Discretion
- Menu primitive (no dropdown/context-menu in `src/components/ui`; must give proper `role="menu"` keyboard behaviour and match Radix stack).
- Keyboard alternative to right-click for inactive tabs (Shift+F10 / ContextMenu key; `…` on active tab is the primary keyboard path).
- How `…` fits inside the tab without breaking the Phase 29 width-stable bold trick or truncation.
- Error handling when move/delete/color/rename fails in Rust (`not_found` after a race). Rename inline; others minimal non-silent (error line in dialog or sonner toast).
- How the shared name form is extracted from `CreateGroupPopover`; swatch component shape shared by Create and Change color.
- Exact EN/SK copy, including translated color names.

### Deferred Ideas (OUT OF SCOPE)
None. Undo after delete remains GRP-F1 (deferred). Membership changes (Phase 31), missing-member handling (Phase 32), drag and drop (never).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GRP-02 | Rename group, same validation as create | Shared `GroupNameForm` extracted from `CreateGroupPopover`; `validateGroupName(raw, namesExcludingSelf)` already supports exclusion; `renameGroup` store action exists |
| GRP-03 | Pick color from fixed palette; new group defaults to next unused | `GROUP_COLOR_TOKENS`, `pickDefaultColor` (least-used, ties by palette order) in `colors.ts`; `setGroupColor`; `createGroup(name, color)` already accepts color |
| GRP-04 | Delete with confirmation (count, issues unaffected); active-tab fallback to core tab | Radix Dialog `role="alertdialog"`; `deleteGroup`; `memberCount` on `Group`; `setCurrentTab('new')` in App |
| GRP-05 | Reorder via Move left/right (mouse+keyboard), core tabs fixed, SR announce, persists | `moveGroup(id,'left'|'right')` (Rust swap + dense renumber, persisted in SQLite); live region in `GroupTabStrip`; Radix menu keyboard |
</phase_requirements>

## Summary

Phase 30 is almost entirely front-end. All four Rust commands (`rename_group`, `set_group_color`, `move_group`, `delete_group`) and the four store actions already exist, return a typed `GroupResult`, and rehydrate the whole store after success (verified in `groupStore.ts`). Persistence of order (GRP-05 "survives restart") is therefore a Rust/SQLite concern already done in Phase 28; Phase 30 only needs an integration test proving the UI calls `moveGroup` and re-renders from the rehydrated `groups` (sorted by `position`).

The real work is UI orchestration: (1) add two Radix packages (dropdown-menu, context-menu) and shadcn wrappers; (2) put `…` as a sibling button inside a per-group wrapper in `GroupTab`; (3) a single "pending action" state in `GroupTabStrip` that opens Rename/Color popovers or the Delete dialog after a menu closes; (4) a focus-return contract through `tabRefs` + `pendingFocusId` (extended to a second ref map for `…` buttons); (5) extract `GroupNameForm` and `GroupColorSwatches`; (6) EN/SK i18n incl. Slovak plurals; (7) tests. The highest risks are Radix focus/pointer-events handoff between menu -> popover/dialog, and core-tab focus (New core tab button has no ref today).

**Primary recommendation:** Build a controlled `pending` state machine in `GroupTabStrip`, open popovers/dialog from the menu's `onCloseAutoFocus` (preventDefault, then open), and route every focus return through one `focusGroupTrigger(id)` / `focusCoreTab('new')` helper backed by refs; cover with RTL + user-event tests.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Name validation (rename) | Browser (TS mirror, UX) | API/Backend (Rust, authoritative) | Phase 28 D-16: Rust re-validates every write; TS gives live feedback |
| Order persistence / renumber | Database (SQLite via Rust) | API/Backend | `move_group` swaps and renumbers densely; UI never computes positions to persist |
| Delete + membership cascade | API/Backend (Rust) | Browser (confirm UX) | UI only confirms and reflects; issues untouched |
| Active-tab fallback after delete | Browser (`App.tsx` state) | — | `currentTab` is React state in App |
| Menu / popover / dialog / focus | Browser | — | Pure client UI |
| Move announcement | Browser (live region) | — | Computed from rehydrated `groups` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-dropdown-menu` | 2.2.0 (npm latest, checked 2026-10-12) | `…` button menu, `role="menu"` keyboard model | Same Radix family as installed popover/dialog; approved in 30-UI-SPEC [CITED: 30-UI-SPEC.md] |
| `@radix-ui/react-context-menu` | 2.4.0 (npm latest) | Right-click menu on any group tab; has controlled `open`/`onOpenChange` [VERIFIED: package .d.ts from npm tarball] | Same family |
| `@radix-ui/react-popover` | 1.3.0 (installed, exact pin) | Rename/Color popovers via existing `PopoverAnchor` | Already wrapped in `ui/popover.tsx` |
| `@radix-ui/react-dialog` | ^1.1.15 (installed) | Delete confirm with `role="alertdialog"` | Already wrapped in `ui/dialog.tsx` |
| `sonner` ^2.0.7 | installed | Error toasts for move/color/delete failures | Existing `ui/sonner.tsx` |
| `i18next` ^25 / `react-i18next` ^16 | installed | Plurals (Intl.PluralRules; sk: one/few/many/other) | Existing keys `groups.tab.aria_*` already use all four suffixes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | installed | `MoreHorizontal`, `Check`, `Pencil`, `Palette`, `ArrowLeft/Right`, `Trash2` | Menu icons (all-or-none per UI-SPEC) |
| vitest ^4.1 + RTL ^16 + user-event ^14 | installed | Tests | See Validation Architecture |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Two menus (Dropdown + ContextMenu) | One controlled DropdownMenu with virtual anchor | Fewer deps but hand-rolls cursor anchoring; UI-SPEC already locked two Radix packages |
| Radix Dialog for delete | `@radix-ui/react-alert-dialog` | Would be a third new dep; D-12 locks Dialog + `role="alertdialog"` |

**Installation** (pin style: existing popover is exact-pinned, others caret; follow the popover precedent of exact pins, then commit lockfile):
```bash
npm install --save-exact @radix-ui/react-dropdown-menu@2.2.0 @radix-ui/react-context-menu@2.4.0
```
**Version verification:** `npm view @radix-ui/react-dropdown-menu version` -> 2.2.0; `npm view @radix-ui/react-context-menu version` -> 2.4.0; both repo `github.com/radix-ui/primitives`, no `postinstall` script, peer react `^16.8 || ... || ^19` [VERIFIED: npm registry, 2026-10-12]. Both ranges were published/modified 2026-10-12 per registry `time.modified` (version dates not individually checked); check `npm view <pkg> time` before pinning and prefer the newest version at least a few days old if a very fresh release looks odd. package-lock currently carries two `react-popper` versions (1.2.8 and 1.4.0); the new packages may add a third copy. Harmless but expect lockfile churn.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @radix-ui/react-dropdown-menu | npm | multi-year (Radix org package) [ASSUMED] | not checked | github.com/radix-ui/primitives | unavailable (no pip in env) | Approved by user in UI-SPEC; tagged [ASSUMED] -> planner adds a quick `checkpoint:human-verify` before install |
| @radix-ui/react-context-menu | npm | multi-year [ASSUMED] | not checked | github.com/radix-ui/primitives | unavailable | same |

**Packages removed:** none. **Flagged [SUS]:** none (slopcheck could not run; `scripts.postinstall` empty for both).

## Architecture Patterns

### System Architecture Diagram

```
 right-click / ContextMenu key / Shift+F10 (any group tab) --\
                                                              v
 click "…" (active tab only) --> DropdownMenu ----+--> <GroupMenuItems group, neighbours>
                         ContextMenu (per tab) ---+        |
                                                           | onSelect
              +---------------+----------------+-----------+----------------+
              v               v                v                            v
          Rename…        Change color…     Delete group…              Move left/right
              \               |               /                              |
               v              v              v                               v
        setPending({groupId, kind})   (opened from menu onCloseAutoFocus)   store.moveGroup(id,dir)
               |                                                           | ok -> rehydrate (groups re-sorted)
   +-----------+------------+---------------+                               +--> setPendingFocus(id)
   v                        v               v                                    + announce(name,pos,total)
 RenamePopover        ColorPopover     DeleteDialog(alertdialog)                  + scrollIntoView
 (GroupNameForm)   (GroupColorSwatches) memberCount snapshot                     err -> sonner toast
   | renameGroup      | setGroupColor    | deleteGroup
   v                  v                  v ok
 inline error      toast on fail     active? onTabChange('new') -> focus New core tab
 focus -> "…"/tab  focus -> "…"/tab  else focus left/right neighbour or ＋
```

### Recommended Project Structure
```
src/components/ui/
├── dropdown-menu.tsx        # NEW shadcn wrapper (Radix)
└── context-menu.tsx         # NEW shadcn wrapper
src/features/groups/
├── GroupTab.tsx             # wrapper div + tab button + "…" sibling + ContextMenu trigger
├── GroupTabStrip.tsx        # pending state, refs, live region, move/delete orchestration
├── GroupMenuItems.tsx       # NEW: one item list, parametrised by primitives (Item/Separator)
├── GroupNameForm.tsx        # NEW: extracted from CreateGroupPopover
├── GroupColorSwatches.tsx   # NEW: radiogroup, shared by Create + Change color
├── RenameGroupPopover.tsx   # NEW (or inline in strip)
├── ChangeColorPopover.tsx   # NEW
├── DeleteGroupDialog.tsx    # NEW
├── groupMoves.ts            # NEW pure helpers: canMove(groups,id,dir), positionOf, deleteFocusTarget
```

### Pattern 1: Shared menu items across two Radix menus
`DropdownMenu.Item` and `ContextMenu.Item` are different components, so `GroupMenuItems` takes `{ Item, Separator }` (or a `variant: 'dropdown'|'context'`) and renders the same list, order and handlers. Test the item list once with a pure render.

### Pattern 2: Open overlays after the menu closes
Radix modal menus set `pointer-events: none` on body and restore focus to the trigger on close. Opening a Popover/Dialog in the same tick as the menu `onSelect` causes focus-return and pointer-events fights. Pattern:
```tsx
// in GroupTabStrip
const pendingRef = useRef<Pending | null>(null);
<MenuContent onCloseAutoFocus={(e) => {
  if (pendingRef.current) { e.preventDefault(); setPending(pendingRef.current); pendingRef.current = null; }
}} />
// item: onSelect={() => { pendingRef.current = { groupId, kind: 'rename' }; }}
```
Item `onSelect` only records the intent; the overlay opens in `onCloseAutoFocus` (menu fully closed, body unlocked). Same applies to the ContextMenu. [CITED: Radix docs; known dropdown->dialog pattern] — Confidence MEDIUM; prove with a user-event test that Rename input has focus and body has no `pointer-events:none` afterwards.

### Pattern 3: Anchoring popovers to the tab wrapper
Use `Popover` (controlled, `open={pending?.kind==='rename' && pending.groupId===g.id}`) with `<PopoverAnchor asChild>` around the tab wrapper div (already exported from `ui/popover.tsx`). Render one popover per group tab or a single popover re-anchored; per-tab controlled instances are simplest. `PopoverContent` defaults `align='end'`; pass `align="start"` for UI-SPEC. `onCloseAutoFocus` must `preventDefault()` and focus via the ref helper (D-08), since no `PopoverTrigger` exists to return focus to.

### Pattern 4: Focus return through refs
Extend `GroupTabStrip` with `moreRefs: Map<number, HTMLButtonElement>`. `focusGroupTrigger(id)` = `moreRefs.get(id) ?? tabRefs.get(id)`. Existing `pendingFocusId` effect currently focuses `tabRefs` only and is **cleared when `activeTab !== groupTabId(p)`** — this will drop focus requests for a right-clicked non-active tab. Change to `pendingFocus: {id, target:'more'|'tab'}` and drop/relax the active-tab guard for move/rename/color (keep it for the create path), or call focus imperatively after `useGroupStore.getState()` shows the new order (the store `await`s the hydrate, so `await moveGroup()` resolves after `groups` is updated; React commit still async -> use effect/rAF).
Move flow: `const r = await moveGroup(id,dir)`; on ok read `useGroupStore.getState().groups`, compute `position = index+1`, `total = length`, set announcement, set pending focus. Because the `…` button is rendered only for the active tab, target = `moreRefs.get(id) ?? tabRefs.get(id)`.

### Pattern 5: Width-stable `…` slot
Reserve the 24px (20px + 4px gap) slot on every group tab and render the button `invisible pointer-events-none aria-hidden tabIndex={-1}` when inactive (UI-SPEC). The wrapper (`inline-flex items-center`, `border-b-2`, `mr-4`) replaces the button's border/margin classes; the tab `<button>` keeps `aria-label`, `aria-current`, ref. Two interactive siblings inside a wrapper is valid HTML; do not nest `<button>` in `<button>`.

### Pattern 6: Delete flow
- Capture `{ id, name, memberCount, wasActive, neighbourId }` when the dialog opens (UI-SPEC: count frozen).
- Compute focus target before calling delete; after `deleteGroup` ok: if `wasActive` call `onTabChange('new')` (D-13) and focus New core tab; else set `pendingFocus` to neighbour tab button (it has no `…` unless active; target `tabRefs`) or ＋ trigger when none.
- `AppShell` core tab buttons have **no refs or ids** -> add `data-tab-id={tab.id}` (or forward a ref map) to AppShell's nav buttons; focus via `document.querySelector('[data-tab-id="new"]')` from the strip or a `coreTabRefs` prop. This touches `src/components/ui/AppShell.tsx` (not in CONTEXT's file list: call out in plan).
- ＋ focus: `CreateGroupPopover` needs a forwarded ref/imperative handle (trigger button has no ref today).
- `onCloseAutoFocus` on Dialog content must `preventDefault()` and apply the focus rules (else Radix returns focus to a trigger that no longer exists).

### Pattern 7: Rename validation
`validateGroupName(name, groups.filter(g=>g.id!==group.id).map(g=>g.name))`. Unchanged check: `normalizeGroupName(name) === normalizeGroupName(group.name)` (NFC + trim already in `normalizeGroupName`) -> Save disabled, no message. Case-only change differs in string -> allowed; excluded-self removes the duplicate hit. Reserved check still runs (e.g., renaming to "New" -> `reserved`).

### Pattern 8: Swatch radiogroup
`role="radiogroup"`, buttons `role="radio" aria-checked`, roving tabindex (selected = tab stop; arrows move AND (for radiogroup semantics) change focus; for the Change-color popover Enter/Space picks; ARIA APG allows arrows to move focus without selecting if selection applies immediately/closes the popover — recommended: arrows move focus only in the Change-color popover (selection closes it), and arrows move+select in the Create form). Tooltip per swatch using the translated color name, with `aria-label` on the button. Add `groups.color.<token>` keys.

### Pattern 9: Keyboard alternative for inactive tabs
Radix `ContextMenu.Trigger` listens to `contextmenu` events (and touch long-press). Browsers fire `contextmenu` for the ContextMenu key/Shift+F10 on Windows/Linux; Tauri on macOS uses WKWebView where Shift+F10 / ContextMenu key behaviour is **not verified** [ASSUMED]. Make it deterministic: `onKeyDown` on the tab button for `ContextMenu` key or `Shift+F10` -> dispatch `new MouseEvent('contextmenu', { bubbles:true, cancelable:true, clientX: rect.left, clientY: rect.bottom })` on the wrapper (the Trigger handles it and positions the menu). Test with `fireEvent.keyDown`.

### Anti-Patterns to Avoid
- Drag and drop in any form (project rule). Also do not add Alt+Arrow keyboard reorder beyond the spec'd menu (not in scope).
- `?? []` inside Zustand selectors; use `useGroupStore((s) => s.groups)` (already stable) and derive neighbours with `useMemo`.
- Writing the `'new'` fallback only through `resolveActiveTab` — D-13 requires explicit `onTabChange('new')`.
- Calling `useGroupStore.getState()` results into render for the delete count; snapshot at open.
- Hover-revealed `…` (use `invisible`, never `group-hover:visible`).
- Mutating `currentTab` on right-click (D-02) — `onContextMenu` must not call `onSelect`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Menu keyboard model, typeahead, focus trap | custom `role=menu` | Radix DropdownMenu/ContextMenu | Arrows/Home/End/Esc/typeahead, collision-aware positioning |
| Modal confirm focus trap + `aria-modal` | custom overlay | Radix Dialog + `role="alertdialog"` | Focus trap, Esc, scroll lock |
| Slovak plurals | manual `count` branches | i18next `_one/_few/_many/_other` | Already used by `groups.tab.aria` |
| Name normalisation / duplicate keys | new regex | `normalizeGroupName`, `groupNameKey`, `validateGroupName` | Mirrors Rust; has test vectors |
| Position renumbering | client-side order math | `moveGroup` + rehydrate | Rust is authoritative, dense renumber |
| Least-used default color | counting loop | `pickDefaultColor(groups.map(g=>g.color))` | Note: signature takes `readonly string[]`, NOT `Group[]` (UI-SPEC pseudo-code `pickDefaultColor(groups)` is wrong) |

## Runtime State Inventory

Not a rename/refactor/migration phase. Only one string-contract note: the Create popover submit label key `groups.create` ("Create") changes to "Create group"/"Vytvoriť skupinu" per UI-SPEC; grep tests (`CreateGroupPopover.test.tsx`, `GroupTabStrip.test.tsx`, `groupI18n.test.ts`) for `'Create'` assertions and update. Stored data, live service config, OS state, secrets, build artifacts: None - verified (no persisted strings change; color tokens and positions already stored by Phase 28).

## Common Pitfalls

### Pitfall 1: Focus lost after menu -> popover/dialog handoff
**What goes wrong:** Radix returns focus to the `…` trigger as the menu closes, stealing focus from the just-opened Rename input, or body stays `pointer-events:none`.
**How to avoid:** Pattern 2 (open in `onCloseAutoFocus`). **Warning signs:** input not focused in test; clicks dead after cancel.

### Pitfall 2: Focus return target does not exist
**What goes wrong:** Right-clicked inactive tab has no `…`; moved/deleted tab unmounts/moves; `pendingFocusId` is cleared by the activeTab effect (see Pattern 4).
**How to avoid:** Single `focusGroupTrigger` helper with fallback to the tab button; replace/extend `pendingFocusId` state; test each D-08/D-14 branch.

### Pitfall 3: `…` makes the active tab jump
**How to avoid:** Always-laid-out invisible slot (Pattern 5); a snapshot/regression assertion that inactive tab renders the slot with `invisible` + `aria-hidden`.

### Pitfall 4: Duplicate-check includes self
Rename "Sprint" -> "sprint" shows `duplicate`. Exclude self by `id`, not by name. Race: another rename can still produce Rust `duplicate`; show inline.

### Pitfall 5: Stale responses after reopen / group vanished
Reuse `openSeq` + `inFlightRef` guards from Create in the shared form. If the target group disappears from `groups` while a popover is open (scope change, other delete), close the overlay; for `not_found` toast "This group no longer exists" (per UI-SPEC rename keeps popover open with Save disabled).

### Pitfall 6: Disabled menu items and Move at edges
Use Radix `disabled` (renders `data-disabled` + `aria-disabled`). Compute from the sorted `groups` index. A rapid double-activation of Move while the first is in flight can move twice; guard with an in-flight ref (disable Move items while `moving`).

### Pitfall 7: Announcement not read
A live region mounted conditionally or with unchanged text is not re-announced. Mount always; clear then set text (e.g., set `''` and set message in a following tick/rAF) so identical consecutive messages re-announce; clear after ~5s with a timer cleaned on unmount.

### Pitfall 8: Slovak plural keys
i18next sk categories: one (1), few (2-4), many (fractions), other (0, 5+). The `0` case is a separate non-plural key ("This group is empty."): select by `count === 0` in code, do not rely on a `_zero` suffix (sk has none). `groupI18n.test.ts` likely enforces identical EN/SK key sets — add keys to both. [ASSUMED: sk plural categories per CLDR; verify with `new Intl.PluralRules('sk').select(n)` in a test]

### Pitfall 9: Tooltip + Menu/Popover on the same element
`TooltipTrigger asChild` wrapping a `DropdownMenuTrigger asChild` on the `…` button is supported but order matters (Tooltip outermost). Tooltip must not open while the menu is open (Radix tooltip closes on pointer down). The existing tab `Tooltip` shows `group.name`; keep it on the tab button only, not the wrapper.

### Pitfall 10: jsdom limits
jsdom lacks `PointerEvent`/`hasPointerCapture`/`scrollIntoView`; Radix menus opened by `userEvent.click` often need `Element.prototype.hasPointerCapture/releasePointerCapture/scrollIntoView` stubs (existing tests already stub `scrollIntoView`, `ResizeObserver`, `matchMedia`). Prefer opening menus via `userEvent.keyboard('{Enter}')` on a focused `…` or `fireEvent.contextMenu`. Add stubs to the test file `beforeAll`.

## Code Examples

### Context menu + dropdown wrapper per tab (sketch)
```tsx
<ContextMenu onOpenChange={...}>
  <ContextMenuTrigger asChild>
    <div ref={wrapperRef} className="inline-flex items-center border-b-2 ...">
      <button ref={tabRef} onClick={onSelect} onKeyDown={openContextOnKey} .../>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button ref={moreRef} aria-haspopup="menu" aria-label={t('groups.menu.trigger',{name})}
                  tabIndex={active ? 0 : -1} aria-hidden={!active} className={active ? '' : 'invisible pointer-events-none'}>
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent onCloseAutoFocus={handleCloseAutoFocus}>
          <GroupMenuItems variant="dropdown" .../>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </ContextMenuTrigger>
  <ContextMenuContent onCloseAutoFocus={handleCloseAutoFocus}><GroupMenuItems variant="context" .../></ContextMenuContent>
</ContextMenu>
```
`aria-expanded` is set automatically by the Radix trigger.

### Pure helpers (unit-testable, in `groupMoves.ts`)
```ts
export const canMove = (groups: readonly {id:number}[], id: number, dir: 'left'|'right') => {
  const i = groups.findIndex(g => g.id === id);
  return i >= 0 && (dir === 'left' ? i > 0 : i < groups.length - 1);
};
export const deleteFocusTarget = (groups: readonly {id:number}[], id: number, wasActive: boolean):
  { kind: 'core-new' } | { kind: 'group'; id: number } | { kind: 'create' } => {
  if (wasActive) return { kind: 'core-new' };
  const i = groups.findIndex(g => g.id === id);
  const n = groups[i - 1] ?? groups[i + 1];
  return n ? { kind: 'group', id: n.id } : { kind: 'create' };
};
```

### Store call with error mapping
```ts
const r = await useGroupStore.getState().moveGroup(id, dir);
if (!r.ok) { toast.error(t(r.code === 'not_found' ? 'groups.error.notFound' : 'groups.error.move')); return; }
```
(`GroupResult` is `{ok:true,value}|{ok:false,code}`; `toGroupErrorCode` falls back to `'internal'`.)

### Delete dialog body (count key)
```ts
count === 0 ? t('groups.delete.bodyEmpty') : t('groups.delete.body', { count })
```
with `groups.delete.body_one/_few/_many/_other` in `sk.json`; EN may keep all four equal except `_one`.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Draggable tabs | Explicit Move left/right menu actions + live region | Locked by project rule; matches `.planning/research/PITFALLS.md` Pitfall 6 |
| Hover-revealed row actions | Always-visible `…` on active tab | Project feedback `explicit_actions` |
| `@radix-ui/react-alert-dialog` | Radix Dialog with `role="alertdialog"` | Locked by D-12; note `role` attr alone does not give alert-dialog's "no outside-click dismiss"; also set `onInteractOutside={(e)=>e.preventDefault()}` if outside-click dismiss is unwanted (Esc still closes). Cancel focus via `onOpenAutoFocus` ref. Also the shadcn `DialogContent` renders an extra top-right X close button (`sr-only` "Close", hardcoded English) — for an alertdialog consider an optional `hideClose` prop, or accept it and translate it. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Radix dropdown-menu/context-menu packages are long-established, legitimate (slopcheck could not run) | Package Legitimacy | Low; planner gates install behind human-verify |
| A2 | Shift+F10/ContextMenu key may not fire `contextmenu` in macOS WKWebView | Pattern 9 | Mitigated by explicit keydown handler either way |
| A3 | Slovak CLDR plural categories are one/few/many/other (0 -> other) | Pitfall 8 | Wrong plural wording; verified via `Intl.PluralRules` test |
| A4 | Opening overlays in menu `onCloseAutoFocus` avoids focus/pointer-events conflicts | Pattern 2 | Needs test; fallback `setTimeout(0)` |
| A5 | Latest registry versions (2.2.0 / 2.4.0) are the right pins | Standard Stack | Peer/transitive popper duplication; check `npm ls` after install |

## Open Questions

1. **Should the Create popover's `groups.create` label key be renamed?** UI-SPEC says "Create group". Recommend keep key, change text in both locales, update tests.
2. **＋ focus after deleting the last group** needs a ref on the `CreateGroupPopover` trigger: forwardRef vs `data-testid`/query. Recommend `forwardRef` on the trigger button.
3. **Core tab "New" focus** needs AppShell change (data attribute or ref map). Recommend `data-tab-id` attribute + `document.querySelector` inside a helper in `groupTabs.ts`, minimal blast radius.
4. **Dialog X close button** in shared `DialogContent` (see State of the Art).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node/npm | install, tests | yes | npm registry reachable | — |
| vitest/RTL/user-event | tests | yes (installed) | ^4.1 / ^16 / ^14 | — |
| pip / slopcheck | legitimacy audit | no | — | `checkpoint:human-verify` before install |
| ctx7 CLI | docs lookup | no | — | npm tarball `.d.ts` inspection, official Radix docs |
| Rust toolchain | only if Rust touched | not needed | — | No Rust changes expected |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.1 + jsdom + @testing-library/react ^16 + user-event ^14 |
| Config file | `vite.config.ts` (`test.environment: 'jsdom'`, `setupFiles: ./src/test-setup.ts`) |
| Quick run command | `npx vitest run src/features/groups src/components/ui` |
| Full suite command | `npm test && npm run lint && npx tsc --noEmit` |

Known baseline failures (not regressions, per Phase 29 VALIDATION): `TicketListPage` x2, `StaticMappingRow` x3, `SettingsPage` domain search x2; Rust createmeta x2.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRP-02 | Rename popover prefilled+selected; unchanged disables Save silently; case-only change allowed; duplicate/reserved inline; Rust error inline; Enter/Esc | component | `npx vitest run src/features/groups/__tests__/GroupNameForm.test.tsx src/features/groups/__tests__/RenameGroupPopover.test.tsx` | ❌ Wave 0 |
| GRP-02 | `validateGroupName` with self excluded | unit | `npx vitest run src/features/groups/__tests__/validation.test.ts` | ✅ (extend) |
| GRP-03 | Swatches: 8, aria-checked, roving arrows, names via aria-label; pick calls `setGroupColor` and closes; Create popover preselects `pickDefaultColor`, passes color to `createGroup` | component | `npx vitest run src/features/groups/__tests__/GroupColorSwatches.test.tsx src/features/groups/__tests__/CreateGroupPopover.test.tsx` | ❌ / ✅ extend |
| GRP-04 | Dialog: title, count plural EN+SK, empty copy, Cancel default focus, delete invokes `delete_group`, active -> `onTabChange('new')`, focus rules D-14, error stays open | component | `npx vitest run src/features/groups/__tests__/DeleteGroupDialog.test.tsx src/features/groups/__tests__/GroupTabStrip.test.tsx` | ❌ / ✅ extend |
| GRP-05 | Move items order/disabled at edges/single; click invokes `move_group` with direction; announcement text (name, pos, total); focus returns to `…`; core tabs untouched; context-menu on inactive tab does not change tab | component | `npx vitest run src/features/groups/__tests__/GroupTabStrip.test.tsx` | ✅ extend |
| GRP-05 | `canMove`, `deleteFocusTarget` pure helpers | unit | `npx vitest run src/features/groups/__tests__/groupMoves.test.ts` | ❌ Wave 0 |
| GRP-05 | Order survives restart | Rust integration (already covered Phase 28) + store hydrate sort | `npx vitest run src/features/groups/__tests__/groupStore.test.ts` | ✅ |
| i18n | EN/SK key parity, sk plural keys, color names | unit | `npx vitest run src/features/groups/__tests__/groupI18n.test.ts` | ✅ extend |

### Sampling Rate
- **Per task commit:** `npx vitest run src/features/groups`
- **Per wave merge:** `npx vitest run src/features/groups src/components/ui` plus `npx tsc --noEmit`
- **Phase gate:** full suite green (baseline failures excepted) + `npm run lint` before `/gsd:verify-work`; manual UAT for real-WKWebView items (Shift+F10, VoiceOver announcement, visual width stability of `…`).

### Wave 0 Gaps
- [ ] `GroupNameForm.test.tsx`, `RenameGroupPopover.test.tsx`, `GroupColorSwatches.test.tsx`, `DeleteGroupDialog.test.tsx`, `groupMoves.test.ts`
- [ ] jsdom stubs for Radix menus (`hasPointerCapture`, `releasePointerCapture`, `scrollIntoView`) in a shared test helper or `test-setup.ts`
- [ ] Update tests asserting the old "Create" label
- [ ] Framework install: none; only the two Radix packages

Manual-only (justified): VoiceOver announcement fidelity and macOS keyboard context-menu behaviour (jsdom cannot assert real AT output).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V3 Auth/Session | no | — |
| V4 Access Control | no (local per-scope data; Rust `require_scope`) | existing |
| V5 Input Validation | yes | `validateGroupName` TS mirror + Rust authoritative; color validated via `isGroupColorToken` (Rust returns `invalid_color`) |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bidi/invisible chars in group names (spoofing tab labels) | Spoofing | Existing `normalizeGroupName` strips bidi controls; reuse unchanged for rename |
| Rendering stored color string into style | Tampering | Only `groupColorVar(token)` with `isGroupColorToken` check; never raw strings |
| Name interpolated into i18n/ARIA | XSS | React text nodes and attributes only; no `dangerouslySetInnerHTML`; i18next `escapeValue` default for React is off - rely on React escaping |
| Supply chain (new deps) | Tampering | Exact-pin the two Radix packages; human-verify gate; review lockfile diff |

## Sources

### Primary (HIGH confidence)
- Codebase: `src/features/groups/*` (store, popover, tab, strip, validation, colors, groupTabs), `src/components/ui/{popover,dialog,AppShell}.tsx`, `src/App.tsx`, `src-tauri/src/groups_commands.rs`, `package.json`, `.planning/config.json`
- npm registry (`npm view`, tarball `@radix-ui/react-context-menu@2.4.0` .d.ts: Root has controlled `open`/`onOpenChange`)
- `.planning/phases/30-*/30-CONTEXT.md`, `30-UI-SPEC.md`, `.planning/research/PITFALLS.md`

### Secondary (MEDIUM confidence)
- Radix menu->dialog handoff pattern and jsdom pointer-capture stubs: community-known practice, not re-verified this session (no Context7 access)

### Tertiary (LOW confidence)
- macOS WKWebView Shift+F10 behaviour; Slovak CLDR categories (training knowledge)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH - versions verified on registry; slopcheck unavailable
- Architecture: HIGH - grounded in existing code
- Pitfalls: MEDIUM - Radix focus handoff and jsdom behaviour need test proof

**Research date:** 2026-10-12
**Valid until:** 2026-11-11
