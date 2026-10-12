# Phase 30: Group Management & Reorder - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase lets users manage existing groups from the tab strip. They can:
- rename a group, using the same validation as create (GRP-02);
- pick a color from the fixed 8-color palette, both from the menu and in the Create popover (GRP-03);
- delete a group after a confirmation that states the issue count, with a fallback to a core tab (GRP-04);
- reorder group tabs with Move left / Move right menu actions. Core tabs stay fixed, the new position is announced, and the order persists (GRP-05).

The Rust commands and store actions already exist from Phase 28: `renameGroup`, `setGroupColor`, `moveGroup` and `deleteGroup` in `groupStore.ts`. This phase is almost entirely UI, plus i18n and tests.

This phase does **not** include membership changes (Phase 31), missing-member handling (Phase 32), undo toasts (GRP-F1) or drag and drop (never).

</domain>

<decisions>
## Implementation Decisions

### "…" menu trigger & contents
- **D-01:** The **active** group tab shows an always-visible small `…` button inside the tab, which opens the group menu.
  - Inactive group tabs show no `…`.
  - It is not hover-revealed (memory feedback_explicit_actions).
- **D-02:** **Right-click** (contextmenu) on **any** group tab opens the same menu for that group.
  - It does **not** switch tabs. The current view stays put, and the menu's actions target the right-clicked group.
  - Core tabs have no menu.
- **D-03:** Menu items, in order:
  - `Rename…`
  - `Change color…`
  - separator
  - `Move left`
  - `Move right`
  - separator
  - `Delete group…`, with destructive styling, last.
- **D-04:** The first group's `Move left` and the last group's `Move right` are **shown but disabled** (aria-disabled). With a single group both are disabled. Moves never cross into the core tabs.
- **D-05:** The menu **closes after each Move**. Focus returns to the moved tab's `…` trigger, which follows the tab to its new position, so the user can quickly reopen the menu and move again. The moved tab is scrolled into view.

### Rename flow
- **D-06:** `Rename…` opens a **popover anchored to the group tab**, reusing the Create form. The popover has:
  - a "Rename group" title;
  - the name input, prefilled and fully selected;
  - an inline error line;
  - Cancel and Save buttons. Enter submits and Esc cancels.
  - Extract and share the form logic with `CreateGroupPopover`: live validation, Rust error codes shown inline, and stale-response guards.
- **D-07:** Validation excludes the group's own name from the duplicate check.
  - An **unchanged** name, identical after trim and NFC, disables Save with no message.
  - A case-only or diacritic-only change of its own name (e.g. "sprint" → "Sprint") is **allowed**.
  - Rust stays authoritative, and its codes appear inline as in Phase 29 D-04.
- **D-08:** After Save or Cancel, focus returns to the tab's `…` trigger. If the popover was launched from a right-clicked inactive tab, which has no `…`, focus returns to that tab button.

### Color picker
- **D-09:** `Change color…` opens a **swatch popover anchored to the tab**. It shows the 8 palette swatches, with the current color checked.
  - Each swatch is a button whose aria-label and tooltip carry the translated color name, e.g. "Teal".
  - Picking a swatch **applies immediately** via `setGroupColor` and closes the popover.
  - It is keyboard navigable, and the swatch name is the non-color signal.
- **D-10:** The **Create popover (＋) gets the same swatch row** under the name input.
  - It is preselected to the least-used color via the existing `pickDefaultColor` in `colors.ts`, per Phase 28 D-08.
  - The chosen token is passed to `createGroup(name, color)`.
  - The rename popover does **not** include swatches; rename and color stay separate menu items.
- **D-11:** Duplicate colors across groups are **allowed with no warning** and no "in use" markers.

### Delete & move feedback
- **D-12:** `Delete group…` opens a **modal confirm**: the existing Radix Dialog, with `role="alertdialog"`.
  - Title: `Delete “<name>”?`
  - Body: "<N> issues are in this group. The issues themselves are not affected." For 0 issues: "This group is empty."
  - Use Slovak plural forms (`_one/_few/_many/_other`).
  - Buttons: **Cancel**, focused by default, and a destructive red **Delete group**.
  - The count is `memberCount`.
- **D-13:** If the deleted group was the active tab, land on **New**. This matches the `resolveActiveTab` fallback and the start tab. Write `'new'` explicitly into `currentTab`; don't rely on the derived fallback alone.
- **D-14:** Focus after delete:
  - If the deleted group was not active, focus moves to the neighbouring group tab: the one to its left, or the one to its right if it was first.
  - If no groups remain, focus goes to `＋`.
  - If the active group was deleted, focus goes to the **New** core tab.
- **D-15:** After a Move, a polite live region announces **name and position**, e.g. `“Sprint 12” moved to position 2 of 5.`
  - Positions count **groups only**, not core tabs.
  - The text is EN and SK with plural-safe wording.

### Carried forward (locked, not re-discussed)
- Phase 28 D-05..D-08:
  - an 8-hue palette with no red;
  - the token name, not hex, is stored;
  - rendered as a dot plus neutral text;
  - the default is the least-used color.
- Phase 28 D-14/D-16..D-18: 40-character max, Rust-authoritative validation with a TS mirror, and diacritic-aware duplicate and reserved checks.
- Phase 29 D-05/D-07: tab anatomy is dot · name · count, and the activated tab scrolls into view.
- Phase 28 D-22: no `?? []` in Zustand selectors (memory feedback_zustand_selector_stable_ref).
- No drag and drop (memory feedback_no_drag_and_drop). Use explicit labelled actions (memory feedback_explicit_actions).

### Claude's Discretion
- The menu primitive.
  - No dropdown or context-menu component exists in `src/components/ui`.
  - Options include adding `@radix-ui/react-dropdown-menu` and/or `@radix-ui/react-context-menu` as shadcn wrappers, or one menu opened by both triggers.
  - It must give proper `role="menu"` keyboard behavior (arrows, Esc, Enter) and match the Radix stack already in use.
- The keyboard alternative to right-click for inactive tabs. One option is Shift+F10 or the ContextMenu key on a focused group tab. The `…` on the active tab is the primary keyboard path.
- How the `…` fits inside the tab without breaking the Phase 29 width-stable bold trick or the truncation width. It could sit inside the button or as a sibling button in the tab wrapper.
- Error handling when move, delete, color or rename fails in Rust, e.g. `not_found` after a race.
  - Rename shows the error inline.
  - Others need minimal, non-silent feedback, e.g. an error line in the dialog or a toast through the existing sonner.
- How the shared name form is extracted from `CreateGroupPopover`, and the swatch component shape, shared between Create and Change color.
- Exact EN/SK copy, including the translated color names.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — GRP-02, GRP-03, GRP-04, GRP-05 (and the GRP-F1 undo toast, which stays deferred)
- `.planning/ROADMAP.md` §"Phase 30: Group Management & Reorder" — success criteria 1–4

### Prior phase decisions
- `.planning/phases/28-foundations/28-CONTEXT.md` — palette, validation rules and storage decisions (D-05..D-08, D-14..D-22)
- `.planning/phases/29-tab-strip-group-view/29-CONTEXT.md` — create popover, tab anatomy, overflow and focus (D-01..D-10)
- `.planning/phases/29-tab-strip-group-view/29-UI-SPEC.md` — the visual contract for the tab strip and create popover, which this phase extends
- `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md` — milestone research (reorder, a11y and store pitfalls)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/groups/groupStore.ts`
  - `renameGroup`, `setGroupColor`, `moveGroup(id, 'left'|'right')` and `deleteGroup` already invoke the Rust commands and rehydrate.
  - They return `GroupResult` with typed error codes.
- `src/features/groups/CreateGroupPopover.tsx` — the name form with live validation, `errorKey` mapping and stale-open guards. This is the base for the shared create/rename form.
- `src/features/groups/validation.ts` (`validateGroupName`) — the existing-names list can exclude the renamed group's own name.
- `src/features/groups/colors.ts`
  - `GROUP_COLOR_TOKENS`, `groupColorVar` and `pickDefaultColor` (least-used, ties by palette order).
- `src/components/ui/popover.tsx` (Radix Popover), `dialog.tsx` (Radix Dialog), `tooltip.tsx`, `button.tsx`, `sonner.tsx`
- `src/features/groups/groupTabs.ts` — `groupTabId`, `parseGroupTabId` and `resolveActiveTab` (falls back to `'new'`)

### Established Patterns
- `GroupTabStrip.tsx`
  - keeps per-group button refs (`tabRefs`) and a `pendingFocusId` mechanism for focusing a tab after a hydrate;
  - scrolls the active tab into view. Reuse these for focus after a move or delete.
- `GroupTab.tsx` uses the width-stable bold trick (an invisible semibold copy) and `max-w-[160px]` truncation. Adding `…` must keep the tab from shifting when it becomes active.
- Rust `move_group` swaps with its neighbour and renumbers densely. At an edge it is a no-op, but the UI disables those items anyway.
- Store mutations rehydrate the whole store after success. `groups` is sorted by `position`.

### Integration Points
- `src/App.tsx` owns `currentTab` and passes `setCurrentTab` to `GroupTabStrip`. A delete of the active group must set `'new'`.
- i18n: `src/i18n/locales/en.json` and `sk.json`, under the `groups.*` keys.
- Tests go in `src/features/groups/__tests__/`: `GroupTabStrip`, `CreateGroupPopover` and `groupStore` tests already exist.

</code_context>

<specifics>
## Specific Ideas

- Example move announcement: `“Sprint 12” moved to position 2 of 5.`
- Example delete dialog: title `Delete “Sprint 12”?`, body "3 issues are in this group. The issues themselves are not affected."

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within phase scope. Undo after delete remains GRP-F1, which was already deferred.

</deferred>

---

*Phase: 30-group-management-reorder*
*Context gathered: 2026-10-12*
