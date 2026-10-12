# Phase 31: Membership Entry Points - Research

**Researched:** 2026-10-12
**Domain:** React 19 / Zustand 5 / Radix UI / i18next front-end work on a Tauri app. No new backend work and no new dependencies.
**Confidence:** HIGH (everything below was verified against the repo and the locked CONTEXT/UI-SPEC)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
D-01 to D-20 in `31-CONTEXT.md` are locked. The planner must read that file. Short form:
- D-01: Detail "Groups" row sits under the title/status block and above the action buttons, with a "Groups ▾" button followed by chips. The real target is `TicketDetailPage`, not `TicketDetailPanel`.
- D-02/D-03: The picker is a popover with an autofocused search input and checkbox rows in tab order. Search ignores case and diacritics. Toggling adds or removes immediately, with no confirm, and the picker stays open.
- D-04: Inline "Create ‘<name>’" row. It uses `pickDefaultColor`, adds the issue, keeps the picker open and does not navigate. `too_long` and `reserved` show inline, `empty` hides the row.
- D-05/D-06: Detail chips have a visible × with a confirm popover. Clicking the chip name goes to the group tab and leaves detail.
- D-07 to D-10: Card chips sit right-aligned on metadata line 3. Max 2 chips by tab order, then a "+N" tooltip. The current group's chip is hidden inside a group view. Names truncate at about 24 chars. A chip click only switches tab (no detail open). The `TicketCard` root `<button>` must be restructured.
- D-11 to D-14: "Select" toggle in `TicketFilterBar` (`aria-pressed`). Select mode shows a checkbox per card, and clicking the card body toggles selection. Shift-click selects a range. There is no "Select all". Selection and select mode clear on tab change or toggle off.
- D-15 to D-19: Floating selection bar with count (polite live region), "Add to group ▾" (same picker in plain-list mode, atomic `addToGroup`), "Remove from group" (group views only, confirm popover) and an × clear button. Already-member issues are skipped silently and the toast reports the real count. Success clears the selection, ends select mode and shows a sonner toast.
- D-20: Membership never changes triage state or core-tab placement. Regression tests only.
- Carried forward: chips are a dot plus neutral text with no tint (28 D-07). `pickDefaultColor` (28 D-08). Rust-authoritative validation with a TS mirror. Never hold the triage lock while taking the groups lock. No `?? []` in a Zustand selector. Explicit labelled controls. No drag and drop.

### Claude's Discretion (UI-SPEC adopted defaults)
Failed toggle feedback is an inline error line in the picker, and `toast.error` in plain-list mode. Esc leaves select mode. Search or filter changes drop selected issues that are no longer visible. The bar picker excludes the current group inside a group view. Picker primitive is Popover plus a custom listbox (no cmdk). Lift tab state out of `App.tsx` or pass callbacks. Range anchor rules. EN/SK copy with `_one/_few/_many/_other` plurals.

### Deferred Ideas (OUT OF SCOPE)
"Select all visible" (rejected), tri-state bulk picker, chip click that also highlights the issue, undo (GRP-F1), shortcut (GMEM-F1), missing-member dimming (Phase 32), WCAG audit and copy polish (Phase 33).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GMEM-01 | Any number of groups, still appears in core tab | Phase 28 data model already allows it. Regression tests only (see Validation) |
| GMEM-02 | Detail "Groups" button, searchable checkbox picker, immediate toggle | `GroupPicker` (checkbox mode), `addToGroup`/`removeFromGroup` single-key calls, ticket-resolution pitfall |
| GMEM-03 | Inline create then add in one step | `createGroup` then `addToGroup`. Two commands, with the failure mode described below |
| GMEM-04 | Card chips (max 2, +N tooltip, hide current group) | `GroupChips` component, `selectGroupIdsForIssue`, card restructure |
| GMEM-05 | Chip click switches tab | Lift the tab setter (see Architecture) |
| GMEM-06 | Select toggle, checkboxes, shift-range, clear on tab change | `useListSelection` hook, `TicketFilterBar` props, per-page wiring |
| GMEM-07 | Selection bar, atomic add with inline create | `SelectionBar`, plain-list `GroupPicker` |
| GMEM-08 | Remove from group inside group view | Confirm popover, `removeFromGroup` |
| GMEM-09 | Remove via detail picker or chip | Detail chips with × confirm, picker uncheck |
</phase_requirements>

## Summary

This is a pure front-end phase. The Rust commands (`add_issues_to_group`, `remove_issues_from_group`, `create_group`) and the Zustand store (`groupStore.ts`) already exist from Phases 28 to 30. The work is five things:
1. A shared `GroupPicker` component (checkbox mode and plain-list mode).
2. A `TicketCard` restructure that allows interactive children.
3. A select-mode state hook plus `TicketFilterBar` and `SelectionBar` UI.
4. Lifting tab navigation out of `App.tsx` so chips can switch tabs.
5. EN/SK strings with Slovak plurals.

The highest-risk items are (a) restructuring `TicketCard` without breaking existing tests and the stop-propagation `actionSlot` buttons, (b) resolving a full `JiraTicket` from the detail page for `addToGroup`, and (c) navigation state living in `App.tsx` local `useState`, which must be shared with deep descendants.

**Primary recommendation:** Build `GroupPicker` and `useListSelection` first as pure, unit-testable units. Then restructure `TicketCard` and add `GroupChips`. Then wire the four list pages and `App.tsx` navigation. Do the detail row last. Use a tiny Zustand `navStore` (or a React context) for `navigateToGroup`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Membership persistence, atomicity, dedupe count | Backend (Rust `groups_db.rs`) | — | `add_members` is one transaction, returns the count of newly created rows `[VERIFIED: src-tauri/src/groups_db.rs:570-612]` |
| Name validation (duplicate/reserved/too_long) | Backend (authoritative) | Browser (`validation.ts` mirror for UX) | Phase 28 D-16 |
| Membership reverse index, group order | Browser store (`groupStore`) | — | `groupIdsByIssue` and `groups` sorted by position |
| Picker, chips, select mode, selection bar | Browser (React components) | — | UI only |
| Tab navigation from chips | Browser (`App.tsx` state, shared) | — | `currentTab` is local `useState` today |
| Bulk count / skipped computation | Browser | Backend returns added count | skipped = selected.length - added |

## Standard Stack

No new packages. Everything is already installed `[VERIFIED: package.json]`.

| Library | Version | Purpose |
|---------|---------|---------|
| react | ^19.0.0 | UI |
| zustand | ^5.0.12 | `groupStore`; selectors must return stable refs |
| @radix-ui/react-popover | 1.3.0 | Picker and confirm popovers (`Popover`, `PopoverAnchor`, `PopoverContent` already exported from `src/components/ui/popover.tsx`) |
| @radix-ui/react-tooltip | ^1.2.8 | "+N" tooltip and truncated-name tooltips |
| sonner | ^2.0.7 | Success and error toasts |
| i18next / react-i18next | ^25 / ^16 | EN/SK strings; Slovak plural keys `_one/_few/_many/_other` |
| lucide-react | existing | `ChevronDown`, `Check`, `X`, `Plus`, `AlertCircle`, `CheckSquare` |
| vitest + @testing-library/react + user-event | ^4.1.1 / ^16.3.2 / ^14.6.1 | Tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom listbox | cmdk | Locked out by the UI-SPEC (no new dependency) |

## Package Legitimacy Audit

No external packages are installed in this phase. slopcheck was not needed. None removed, none flagged.

## Architecture Patterns

### System Architecture Diagram

```
 Detail page                    List pages (New / Not mine / Linked / GroupView)
 [Groups ▾] --opens--+          [TicketFilterBar: Select toggle] --> useListSelection(visibleKeys)
 detail chips (x) ---|--confirm   |                                   |
                     v            v                                   v
                GroupPicker (checkbox mode)     TicketCard (div + stretched button + GroupChips + checkbox)
                     |                                   |  chip click
                     |                                   v
 SelectionBar --> GroupPicker (plain-list)         navigateToGroup(id) --> App currentTab
   |  Remove --> confirm popover                         (detail: also closes detail)
   v                                                               
 groupStore.addToGroup / removeFromGroup / createGroup --invoke--> Rust (one txn) --> hydrate() --> groupIdsByIssue, memberKeysByGroup
                                                                         |
                       cards/chips/picker re-render from store (never optimistic)
```

### Recommended Project Structure
```
src/features/groups/
├── GroupPicker.tsx          # combobox+listbox, props: mode 'checkbox'|'list', issues, excludeGroupId, onDone
├── GroupChip.tsx            # card variant (button) and detail variant (name button + x button)
├── GroupChips.tsx           # card row: first 2 by tab order, +N tooltip, hides current group
├── DetailGroupsRow.tsx      # Groups button + picker + chips + remove confirm
├── SelectionBar.tsx         # count live region, Add (picker), Remove (confirm), clear
├── useListSelection.ts      # selectMode, selectedKeys, anchorKey, toggle/range/clear/prune
├── membershipActions.ts     # pure helpers: addIssuesWithFeedback, removeIssuesWithFeedback (toast + counts)
└── navStore.ts (or context) # navigateToGroup(id)
src/features/tickets/TicketCard.tsx         # restructure
src/features/tickets/TicketFilterBar.tsx    # + selectMode/onToggleSelectMode/selectDisabled props
```

### Pattern 1: Card restructure
**What:** Root becomes `<div className="relative ...">` containing a primary `<button>` that fills the card (carrying `aria-label={summary}` and `onClick`) and sibling interactive elements raised with `relative z-10`.
**Constraint:** Today `actionSlot` already contains buttons (Restore) that call `e.stopPropagation()` while living inside the root button. That is invalid nesting (button in button) and will be fixed by the restructure. Keep the `stopPropagation` anyway for safety.
**Layout caution:** The simplest way to keep the visual layout is to keep the existing content in the primary button as-is, but move the line-3 chips outside. A stretched overlay (`absolute inset-0` button with `aria-label`) plus a non-interactive visual content div with `pointer-events-none` and interactive pieces `pointer-events-auto relative z-10` is the usual approach. Verify hover (`hover:bg-brand-surface-hover`) moves to the wrapper via `group`/`hover:`.
**Select mode:** In select mode the primary button's `onClick` receives the event and calls `onToggleSelect(e.shiftKey)`. Do not open detail. The card checkbox is a sibling `role="checkbox"` button that calls the same handler. Capture `shiftKey` from `MouseEvent` and also handle Shift+Space for keyboard users (a keydown handler cannot rely on click's `shiftKey`, but a `click` fired by keyboard Space/Enter does carry `shiftKey` in browsers, so reading `e.shiftKey` in onClick covers both `[ASSUMED]`, verify in a test using `userEvent.keyboard('{Shift>} {/Shift}')`).

### Pattern 2: Selection hook (view-scoped, not global)
```typescript
// useListSelection(visibleKeys: readonly string[])
// state: selectMode, selected: Set<string>, anchor: string | null
// toggle(key, shift): if shift && anchor && visibleKeys includes both -> add range [anchor..key] in visible order; else toggle key; anchor = key
// prune: useEffect on visibleKeys -> drop selected keys not visible; reset anchor if not visible
// exit(): selectMode=false, selected=new Set(), anchor=null
```
Tab change clears selection for free because each list page unmounts when `effectiveTab` changes (`GroupViewPage` has `key={groupId}`; core pages are conditionally rendered `[VERIFIED: src/App.tsx]`). Do NOT use a global store for selection (PITFALLS.md "Selection leakage"). Still add a test that proves tab switch clears it. Selection must also clear if the displayed group is deleted. The page unmounts there too.
Prune caution: `visibleKeys` must be a memoized array (derived from `sorted`) or the prune effect will loop. Compare by content, not identity, before calling `setState`.

### Pattern 3: Navigation lift
`App.tsx` owns `currentTab`/`setCurrentTab` and `detailTicketKey`/`showDetail`. Chips in cards (deep in list pages) and detail need `navigateToGroup(groupId)`. Options: (a) a small Zustand `navStore` with `requestedTab`, which App consumes in an effect. (b) a React context `NavigationProvider` wrapping the tree that exposes `navigateToGroup`. Recommend (b), since it is declarative and testable. The App-provided function must: `setCurrentTab(groupTabId(id))`, `handleDetailBack()` (clears `showDetail`, `detailTicketKey`, `selectTicket(null)`), and set the existing `pendingFocusId` mechanism in `GroupTabStrip` so focus moves to the tab `[VERIFIED: UI-SPEC mentions pendingFocusId/tabRefs; check the exact export in GroupTabStrip.tsx at plan time]`. Components must tolerate a missing provider in tests (default no-op context value) so existing tests that render `TicketCard` alone do not break.
Note `TicketDetailPage` also has a document-level Escape handler that calls `onBack`. Popovers inside detail must stop Esc from also leaving detail. Radix Popover handles Esc on its own keydown listener, but the document listener still fires. Fix: check `e.defaultPrevented` in the detail handler, or have the picker call `preventDefault`/`stopPropagation` on Esc keydown. Radix `DismissableLayer` listens at document level on capture-phase `keydown` and does call `onEscapeKeyDown`, but does not call `preventDefault` by default `[ASSUMED]`. Test it explicitly: open picker in detail, press Esc, expect the picker to close and detail to remain.

### Pattern 4: Resolving the JiraTicket for `addToGroup`
`addToGroup(groupId, tickets: JiraTicket[])` serialises the full ticket as the snapshot (`ticketJson`). Lists already hold `JiraTicket`s, so the bar is straightforward: map `selectedKeys` to tickets from the visible `sorted` array. Detail only has `JiraTicketDetail`. Resolve: `useTicketStore.getState().tickets.find(k)` first; otherwise build a `JiraTicket` from the detail's overlapping fields (`id, key, fields.summary/status/priority/assignee/created/updated`). The snapshot must satisfy `isRenderableTicket` in `useGroupMembers.ts`, because that guard is what makes snapshot-backed members render later. Extract a `detailToTicket()` helper with a unit test that feeds the result through `isRenderableTicket`.

### Pattern 5: Inline create then add
Two commands (`createGroup`, then `addToGroup`) with a `hydrate()` after each. Failure handling:
- `createGroup` fails: show the Rust error code inline using the existing `groups.error.*` keys. Nothing was created.
- `createGroup` ok but `addToGroup` fails: the empty group now exists. Report the add error, keep the group (it is a valid empty group), and let the user retry from the picker (it is now in the list). Do not try to roll back by deleting.
- Guard against double submit (Enter pressed twice) with an in-flight ref and a disabled create row. Reuse the stale-response pattern from `GroupNameForm`/`useGroupNameForm`.
- The `createGroup` color argument: `pickDefaultColor(useGroupStore.getState().groups.map((g) => g.color))` (same call as `CreateGroupPopover`).

### Pattern 6: Picker combobox (a11y)
Focus stays in the search `<input role="combobox" aria-expanded aria-controls aria-activedescendant>`. Listbox `role="listbox"` (`aria-multiselectable` in checkbox mode). Options `role="option"` with stable ids. Arrow/Home/End, Enter/Space. Space must NOT toggle while the user is typing a space in the query. Rule: Space toggles only when the query is empty, otherwise it types a space. The UI-SPEC says "Space or Enter toggles"; implement Space as a toggle only when the input value is empty, and flag this deviation in the plan. Radix `PopoverContent` auto-focuses the first focusable on open. Use `onOpenAutoFocus` to focus the input explicitly. Options use `onMouseDown={(e) => e.preventDefault()}` so clicks do not steal focus from the input. Reset query and active index on every open (render the content only when open; Radix unmounts by default).
Active row must be scrolled into view (`scrollIntoView({block:'nearest'})` is stubbed in `test-setup.ts`).
Search matching: use `groupNameKey(normalizeGroupName(...))` for both query and names, then `includes`. Exact-match detection for hiding the Create row: use `validateGroupName(query, existingNames)`, where `code === 'duplicate'` means "hide Create and highlight the match".

### Anti-Patterns to Avoid
- `?? []` inside selectors, or `.filter()`/`.map()` in selectors. Use `selectGroupIdsForIssue` and coalesce in render. For the chip row, derive `groups` with `useGroupStore((s) => s.groups)` (a stable ref) and compute the chip list with `useMemo`.
- Selection in a global store.
- Optimistic checkbox state. Store state is the only truth, and `mutate()` re-hydrates before resolving.
- Per-key `addToGroup` loops for bulk. One call with all tickets.
- Putting the card's per-render `useGroupStore` subscription on the whole `groupIdsByIssue`. Use `selectGroupIdsForIssue(ticket.key)` so a card re-renders only when its own membership array changes. Note that `load()` rebuilds all arrays on every hydrate, so every card gets a new array reference after any mutation. Acceptable at current list sizes, but if it matters, add a shallow comparison. Zustand 5 `useShallow` handles it: `useGroupStore(useShallow(selectGroupIdsForIssue(key)))`. Not needed to start `[ASSUMED]`.
- Hover-revealed controls and drag and drop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Name normalisation / duplicate / reserved | New string logic | `validateGroupName`, `groupNameKey`, `normalizeGroupName` in `validation.ts` |
| Default color | Cycling logic | `pickDefaultColor` |
| Color dot style | Inline hex | `groupColorVar(token)` + `isGroupColorToken` |
| Error code mapping | New map | `toGroupErrorCode`, `groups.error.*` keys, `toast.error` |
| Popover / tooltip / toast | Custom overlays | `popover.tsx` (with `PopoverAnchor`), `tooltip.tsx`, `sonner` |
| Slovak plurals | Manual `if` on count | i18next `count` option with `_one/_few/_many/_other` keys. `groupI18n.test.ts` already enforces key parity |
| Bulk atomicity | Loop of single adds | `addToGroup(groupId, tickets)` / `removeFromGroup(groupId, keys)` |
| Dedupe count | Client-side membership diff | The returned count (newly inserted). `skipped = selected.length - count`. |

## Common Pitfalls

### Pitfall 1: Nested interactive elements in `TicketCard`
**What goes wrong:** Chips or a checkbox inside a `<button>` is invalid HTML. React warns about `validateDOMNesting`, and click and keyboard behavior is inconsistent.
**How to avoid:** Restructure as described. The existing Restore button inside `actionSlot` is already nested, so the restructure fixes it.
**Warning signs:** Console warning "button cannot be a descendant of button" in tests.

### Pitfall 2: Existing tests locate the card with `closest('button')`
`src/features/groups/__tests__/GroupViewPage.test.tsx:60` does `screen.getByText(key).closest('button')`. After the restructure the key text is not inside a button. Update that helper (for example `getByRole('button', {name: summary})` or `closest('[data-testid="ticket-card"]')`). Also scan `TicketListPage.test.tsx`, `IgnoredTicketsPage.test.tsx`, `LinkedTicketsPage.test.tsx`, `ticketListParity.test.tsx` for card queries (button role plus summary name still works if the primary button keeps `aria-label={summary}`). Keep `aria-label={ticket.fields.summary}` on the primary button.

### Pitfall 3: Detail Esc handler vs popovers
See Pattern 3. The document-level Escape in `TicketDetailPage` would send the user back while closing the picker.

### Pitfall 4: Stale `selectedTicketKey` / detail routing
Chip click inside detail must clear `selectedTicketKey` via `selectTicket(null)`. `App.tsx` has an effect that re-opens detail whenever `selectedTicketKey` is truthy. If `handleDetailBack` is not used, detail pops back open.

### Pitfall 5: `mutate()` hydrate race on rapid toggles
Each `mutate` awaits `hydrate()`, and `hydrate` is sequenced with `hydrateSeq`. Rapid checkbox toggles are safe on the data side. UI side: disable the row (or ignore clicks) while its own request is in flight so a fast double toggle cannot send add and remove in the wrong order. A per-group in-flight set in the picker is enough.

### Pitfall 6: `hydrate` failure after a successful mutation
`mutate` returns `ok: true` even if the follow-up hydrate fails (store keeps the last good state, `hydrateError` is set). The checkbox will then not reflect the change. Mitigation: after an ok mutation, check the store (as `CreateGroupPopover` does with `present`) and show the generic error if the expectation is not met. Worth one test.

### Pitfall 7: Selection counts vs visible
Search or filter changes must prune selection (prune effect). Also prune on refetch. Count in the bar and the keys passed to `addToGroup` both come from the pruned set, so they cannot diverge from the screen.

### Pitfall 8: Focus loss after the bar unmounts
After a successful bulk action the bar unmounts. Focus the Select toggle explicitly (needs a ref passed from the page through `TicketFilterBar`, via `forwardRef` or a `selectToggleRef` prop). Same for chip removal in detail: focus the Groups button.

### Pitfall 9: Popover inside a bar that sits inside a scroll container
Radix portals the content, so clipping is not a problem. The bar itself should be `sticky bottom-8` inside the non-scrolling parent, or absolutely positioned relative to the list wrapper, not inside the scrolling element (otherwise sticky works but the wrapper needs `relative`). Add `pb-20` to the scrolling list only when the bar is visible.

### Pitfall 10: Dark/light chip contrast
Use the existing `--color-group-*` variables via `groupColorVar`. Do not tint backgrounds.

### Pitfall 11: Slovak plural rules in i18next
Slovak CLDR categories are one (1), few (2 to 4), many (fractions, never integers), other (0, 5+). Existing keys define `_many` equal to `_few`, which is harmless. Always provide all four, as `groupI18n.test.ts` expects parity `[VERIFIED: sk.json has _few/_many pairs]`. The "already in group" suffix needs a second interpolation (`skipped`), so keep it as a separate key (`addedWithSkipped`) rather than concatenating.

## Code Examples

### Bulk add with feedback (sketch)
```typescript
// membershipActions.ts
export async function addIssuesWithFeedback(group: {id:number; name:string}, tickets: JiraTicket[], t: TFunction) {
  const r = await useGroupStore.getState().addToGroup(group.id, tickets);
  if (!r.ok) { toast.error(t(errorKey(r.code))); return false; }
  const skipped = tickets.length - r.value;
  if (r.value === 0) toast.info(t('groups.toast.allAlreadyIn', { name: group.name }));
  else if (skipped > 0) toast.success(t('groups.toast.addedWithSkipped', { count: r.value, skipped, name: group.name }));
  else toast.success(t('groups.toast.added', { count: r.value, name: group.name }));
  return true; // caller clears selection + ends select mode + focuses toggle
}
```
When `r.value === 0` the UI-SPEC copy still applies. Decide whether to also end select mode (D-19 says "after a successful bulk Add"; recommend yes, treated as success).

### Stable chip derivation
```typescript
const ids = useGroupStore(selectGroupIdsForIssue(ticket.key)); // number[] | null
const groups = useGroupStore((s) => s.groups);                 // stable ref
const chips = useMemo(() => {
  const set = new Set(ids ?? []);                              // coalesce here, not in selector
  return groups.filter((g) => set.has(g.id) && g.id !== currentGroupId); // tab order
}, [ids, groups, currentGroupId]);
```
`currentGroupId` has to reach the card: pass `hideGroupId` as a prop from `GroupViewPage`.

### Esc-safe detail handler
```typescript
const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onBack(); };
```
Also verify that Radix calls `preventDefault` or otherwise make the picker's `onEscapeKeyDown` call `e.preventDefault()`... `onEscapeKeyDown` receives the native event, so calling `preventDefault()` on it does mark it handled for the later document listener only if that listener runs after (Radix attaches in capture on `document`, so ordering likely works; confirm with the test).

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| Selector returning `?? []` | `null` fallback and coalesce in render | Prevents the React 19 + Zustand 5 infinite-loop |
| Whole-card `<button>` | Wrapper div + stretched button + sibling controls | Valid interactive nesting |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A keyboard-triggered click carries `shiftKey`, so `onClick` covers Shift+Space range select | Pattern 1 | Need a separate keydown handler for keyboard range select |
| A2 | Radix Popover's Esc does not stop the detail page's document keydown listener | Pattern 3 | If it does, the `defaultPrevented` guard is harmless but unnecessary |
| A3 | `useShallow` is not needed for card re-render cost | Anti-patterns | Many-card lists may re-render on every mutation (perf only) |
| A4 | The `pendingFocusId`/`tabRefs` mechanism is reachable from the new navigate function | Pattern 3 | May need a small export from `GroupTabStrip.tsx` |
| A5 | Space toggles a picker row only when the search is empty (deviation from "Space or Enter") | Pattern 6 | Planner or user may want a different rule |

## Open Questions

1. **How does the nav function reach the focus mechanism of `GroupTabStrip`?** Inspect `GroupTabStrip.tsx` (`pendingFocusId`). It may need to be lifted or exposed via ref/context. Recommend deciding in the plan's first wave.
2. **All-already-members bulk add:** the toast is informational (count 0). Recommend treating it as success and still ending select mode.
3. **Group-less issue in `Linked`/`Ignored` list opened from a group snapshot:** detail-to-ticket fallback (Pattern 4) covers it. Confirm `ticketStore.tickets` includes ignored and linked issues (it appears to, as `IgnoredTicketsPage` filters it).
4. **Esc to leave select mode** requires focus inside the list or the bar. Choose a scoped `onKeyDown` on the page wrapper, not a document listener, so it does not conflict with popovers or the detail view.

## Environment Availability

Step 2.6: SKIPPED. Code and config only, with no new external tools. The existing Node, vitest and biome toolchain is used.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.1 + @testing-library/react ^16.3.2 + user-event ^14.6.1 (jsdom) `[VERIFIED: package.json]` |
| Config file | `vitest.config.ts`, setup `src/test-setup.ts` (polyfills pointer capture and `scrollIntoView`; imports i18n) |
| Quick run command | `npx vitest run src/features/groups src/features/tickets/__tests__/TicketFilterBar.test.tsx` |
| Full suite command | `npm test && npm run lint` (`vitest run`, `biome check src/`) |

Test conventions: `vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))`, seed state with `useGroupStore.setState({...})` and `useTicketStore.setState({...})` `[VERIFIED: GroupViewPage.test.tsx]`. Tests need `TooltipProvider` where tooltips render (check how existing tests wrap). Rust tests: none needed (no backend change). If a GMEM-01 backend regression is desired, `add_members_atomic_and_idempotent` in `groups_db.rs` already covers idempotency.

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GMEM-01 | Adding to groups does not change `triageMap`; the issue stays in the core list (`isNewCandidate`) | unit/integration | `npx vitest run src/features/groups/__tests__/membershipRegression.test.tsx` | Wave 0 |
| GMEM-02 | Picker lists groups in tab order, search ignores case/diacritics, toggle calls add/remove immediately, stays open, no optimistic state | component | `npx vitest run src/features/groups/__tests__/GroupPicker.test.tsx` | Wave 0 |
| GMEM-02 | Combobox keys (Arrows, Home/End, Enter, Esc returns focus) | component | same | Wave 0 |
| GMEM-03 | Create row appears only for non-duplicate valid text. too_long/reserved show inline and disable. Create calls `createGroup` then `addToGroup`. Stays on view | component | same | Wave 0 |
| GMEM-04 | Max 2 chips + "+N" tooltip, current group hidden and not counted, tab order, no chips for `null` | component | `npx vitest run src/features/groups/__tests__/GroupChips.test.tsx` | Wave 0 |
| GMEM-05 | Chip click calls `navigateToGroup` and does NOT call `onClick` (detail). Enter/Space work | component | `npx vitest run src/features/tickets/__tests__/TicketCard.test.tsx` | Wave 0 |
| GMEM-06 | Select toggle `aria-pressed`, checkbox per card, shift-range in visible order, unmount/tab change clears, filter prunes, Esc exits | hook + component | `npx vitest run src/features/groups/__tests__/useListSelection.test.tsx src/features/tickets/__tests__/TicketFilterBar.test.tsx` | Wave 0 / extend |
| GMEM-07 | Bar shows count (Slovak plural), Add picker calls `addToGroup` once with all selected tickets, skipped toast text, success clears and ends select mode, failure preserves selection | component | `npx vitest run src/features/groups/__tests__/SelectionBar.test.tsx` | Wave 0 |
| GMEM-08 | "Remove from group" only in a group view, confirm popover, `removeFromGroup` once with all keys | component | `npx vitest run src/features/groups/__tests__/GroupViewPage.test.tsx` | extend |
| GMEM-09 | Detail picker uncheck removes with no confirm. Detail chip × asks to confirm. Chip name navigates and closes detail | component | `npx vitest run src/features/tickets/__tests__/TicketDetailPage.test.tsx` | extend |
| (all) | i18n key parity EN/SK, Slovak plural keys present for each new count key | unit | `npx vitest run src/features/groups/__tests__/groupI18n.test.ts` | extend |
| (all) | Selector stability: rendering cards with `groupIdsByIssue = {}` does not loop (bounded renders) | component | in `GroupChips.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <the touched feature folder>`
- **Per wave merge:** `npm test && npm run lint`
- **Phase gate:** full suite and lint green, then `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `GroupPicker.test.tsx`, `GroupChips.test.tsx`, `SelectionBar.test.tsx`, `useListSelection.test.tsx`, `TicketCard.test.tsx`, `membershipRegression.test.tsx` (new)
- [ ] Update the card lookup in `GroupViewPage.test.tsx` (`closest('button')`) and any other card queries once `TicketCard` is restructured
- [ ] Shared test factory for `mk()` tickets (currently local to `GroupViewPage.test.tsx`). Optional extraction to `src/test-fixtures/`
- [ ] Framework install: none

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no (single-user local app, scope derived in Rust) | `require_scope` already enforced in Rust |
| V5 Input Validation | yes | The typed group name goes through `validateGroupName` for UX. Rust re-validates (Phase 28 D-16). The color goes through `isGroupColorToken` before use in styles |
| V6 Cryptography | no | — |

| Threat | STRIDE | Mitigation |
|--------|--------|------------|
| Bidi/invisible characters in names spoofing chip or tab labels | Spoofing | Display name is normalised by `normalizeGroupName`. Render names as text children only, never `dangerouslySetInnerHTML` |
| Unsafe stored color string injected into a style | Tampering | `groupColorVar(token)` only after `isGroupColorToken` (`load()` already coerces to `slate`) |
| Oversized or malformed snapshot JSON | Tampering | Rust validates `ticketJson` is an object and the issue key format. Send only a real `JiraTicket` |

## Sources

### Primary (HIGH confidence, read in this session)
- `.planning/phases/31-membership-entry-points/31-CONTEXT.md` and `31-UI-SPEC.md`
- `.planning/REQUIREMENTS.md` (GMEM-01..09)
- `src/features/groups/groupStore.ts`, `validation.ts`, `colors.ts`, `CreateGroupPopover.tsx`, `GroupViewPage.tsx`, `groupTabs.ts`, `useGroupMembers.ts`
- `src/features/tickets/TicketCard.tsx`, `TicketFilterBar.tsx`, `TicketDetailPage.tsx`, `IgnoredTicketsPage.tsx`
- `src/App.tsx`, `src/components/ui/popover.tsx`, `src/test-setup.ts`, `package.json`
- `src-tauri/src/groups_commands.rs` and `groups_db.rs` (`add_members` and `remove_members` semantics)
- `.planning/research/PITFALLS.md` (selection leakage, selector loop, hover icons)

### Tertiary (LOW)
- Browser/Radix event-ordering claims (A1, A2) come from training knowledge and must be confirmed by tests.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, since no new dependencies and every asset was inspected.
- Architecture: HIGH for the data and store layers. MEDIUM for the nav lift and focus-mechanism details (A4).
- Pitfalls: HIGH for the repo-specific ones. MEDIUM for Radix and Esc behavior (A2).

**Research date:** 2026-10-12
**Valid until:** 2026-11-12 (stable, internal codebase)
