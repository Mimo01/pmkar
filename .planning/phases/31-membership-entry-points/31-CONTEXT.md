# Phase 31: Membership Entry Points - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can add issues to any number of groups and remove them through three entry points:

1. **Ticket detail:** a "Groups" button opens a searchable checkbox picker with an inline "Create '<name>'" row. The detail view also shows the issue's group chips, each with a confirmed remove.
2. **Cards:** colored group chips, at most 2 plus "+N". Clicking a chip navigates to that group's tab.
3. **Multi-select:** a "Select" toggle in every list. While issues are selected, a selection bar offers an atomic "Add to group" (with inline create), plus "Remove from group" inside a group view.

Covers GMEM-01..09.

**Out of scope:**
- Snapshot-durability UI: missing-member dimming and the "No longer in results" hint (Phase 32).
- Undo toasts (GRP-F1).
- A keyboard shortcut for the picker (GMEM-F1).
- Full EN/SK copy polish and the WCAG audit (Phase 33). This phase still ships EN and SK strings for everything it adds.

</domain>

<decisions>
## Implementation Decisions

### Detail picker & chips (GMEM-02, -03, -09)
- **D-01:** In `TicketDetailPage`, put a **dedicated row under the title and status block, above the action buttons** (Open in Jira / Ignore / Mark handled / Copy). It contains:
  - a labelled **"Groups ▾"** button;
  - then the issue's group chips (dot + name, per Phase 28 D-07).
  - When the issue is in no groups, the row shows just the Groups button.
  - Note: `TicketDetailPanel` is only referenced by tests. `App.tsx` renders `TicketDetailPage`, so that page is the real target.
- **D-02:** The **picker** is a popover anchored to the Groups button. It contains:
  - a search input, autofocused;
  - one row per group with a checkbox, color dot and name.
  - Rows follow **tab order** (the user's group order).
  - Search filters by name, ignoring **case and diacritics**, using the same normalisation as `validation.ts`.
- **D-03:** Toggling a checkbox **adds or removes the issue immediately**, with **no confirmation** (GMEM-02). The picker stays open for more toggles.
- **D-04:** **Inline create.** When the typed text exactly matches no existing group (using the duplicate rule from Phase 28 D-17), a **"＋ Create ‘<name>’"** row appears at the bottom of the list.
  - Enter activates it when it is the only actionable row.
  - It creates the group with the least-used color (`pickDefaultColor`), adds the issue, and **keeps the picker open** with the new group checked.
  - The user **stays on the current view**. It does not navigate to the new tab, unlike the ＋ create in Phase 29 D-02.
  - Validation follows the existing rules:
    - `too_long` / `reserved` show inline in the picker and disable the Create row;
    - `empty` hides the row;
    - Rust error codes are shown inline.
- **D-05:** **Detail chips have a visible × remove button**, with aria-label "Remove from ‘<name>’".
  - Clicking × opens a **small confirmation popover anchored to the chip**: "Remove from ‘<name>’?" with Cancel / Remove.
  - Only the chip × asks for confirmation; picker unchecks do not (D-03).
- **D-06:** Clicking a **detail chip's name** navigates to that group's tab, the same as card chips (D-10). This leaves the detail view.

### Card chips (GMEM-04, -05)
- **D-07:** Chips sit **right-aligned at the end of the metadata row** (line 3, after status, priority and assignee). Card height stays the same, and line 1 keeps the key, badges and dates.
- **D-08:** The card shows at most **2 chips, chosen by tab order**, then **"+N"**.
  - "+N" only triggers a tooltip. Hover or focus shows the remaining groups as dot + name. It does not navigate.
  - Inside a group view, **that group's own chip is hidden** and does not count toward the 2 or N.
- **D-09:** Chip names truncate at **about 24 characters, the same cap as tab names** (Phase 29 D-08), with an ellipsis and a full-name tooltip.
- **D-10:** Clicking a card chip **only switches to that group's tab**. It must not also open detail; isolate the event from the card's click.
  - Chips are focusable with Enter/Space.
  - Their aria-label reads like "Go to group ‘<name>’".
  - The current card root is a `<button>`, so interactive chips cannot nest inside it. The planner restructures the card, e.g. an outer div with a stretched primary button plus sibling chip buttons.

### Select mode (GMEM-06)
- **D-11:** A labelled **"Select"** toggle sits on the **right side of the shared `TicketFilterBar`**, next to the result count.
  - Every list gets it, both core tabs and group views.
  - It shows a pressed state (`aria-pressed`) while active.
- **D-12:** In select mode, each card shows a **checkbox**, and **clicking the card body toggles selection**. Detail does not open in select mode.
  - **Shift-click** on the card or its checkbox selects the range from the last clicked card, in the current visible sort order.
  - Chips stay clickable and still navigate.
- **D-13:** **There is no "Select all"**. Range selection is shift-click only, strictly per GMEM-06.
- **D-14:** Selection **clears, and select mode ends, on tab change** (GMEM-06) and when the toggle is turned off.

### Selection bar & bulk feedback (GMEM-07, -08)
- **D-15:** A **floating bar sticks to the bottom of the list area**. It appears once one or more issues are selected and contains:
  - "<N> selected", with Slovak plurals;
  - **"Add to group ▾"**;
  - **"Remove from group"**, in group views only;
  - an × that clears the selection.
  - The count change is announced in a polite live region.
- **D-16:** The **"Add to group" picker** is the same picker component as detail, in a **plain list mode**: groups in tab order, search, and inline "Create ‘<name>’". It has **no checkboxes or tri-state**.
  - Choosing a group adds **all selected issues in one atomic call** (`addToGroup(groupId, tickets)`).
  - Create plus add is one step from the user's point of view.
- **D-17:** Selected issues that are **already members are skipped silently**. The toast reports the real count, e.g. "Added 3 issues to ‘QA’ (2 already in group)", with Slovak plurals.
- **D-18:** **"Remove from group"** opens a **confirmation popover** anchored to the button: "Remove <N> issues from ‘<name>’?" with Cancel / Remove. This matches D-05.
- **D-19:** After a **successful** bulk Add or Remove:
  - the selection clears;
  - **select mode ends**;
  - a **sonner toast** confirms the result.
  - Undo is deferred (GRP-F1).

### Membership semantics (GMEM-01)
- **D-20:** Membership never changes the triage state or core-tab placement. An issue can be in any number of groups and still appears in its core tab. This is already guaranteed by the Phase 28 data model; it needs regression tests only.

### Carried forward (locked, not re-discussed)
- Phase 28 D-07: chips use a dot plus neutral text, with no tinted background. The dot needs at least 3:1 non-text contrast.
- Phase 28 D-08: new groups get the least-used color by default (`pickDefaultColor`).
- Phase 28 D-14/D-16/D-17/D-18: 40-character max, Rust-authoritative validation with a TS mirror, and diacritic-aware duplicate and reserved checks.
- Phase 28 D-21: bulk membership commands are atomic. Never hold the triage lock while taking the groups lock.
- Phase 28 D-22: never use `?? []` in a Zustand selector. `selectGroupIdsForIssue` already returns `null`.
- Phase 29 D-14: group views render members from snapshots when they are absent from the fetch. No dimming yet.
- Phase 29 D-18: the empty-state copy already promises "Groups" in detail and "Add to group" in select mode. Verify the wording matches the shipped labels.
- Explicit labelled controls, never hover-revealed. No drag and drop.

### Claude's Discretion
- **Feedback when a picker toggle fails**, e.g. `not_found` after a race. It must not be silent. Preference: the checkbox reflects store state, so it never shows success optimistically, and an inline error line in the picker or a `toast.error` follows the Phase 30 pattern.
- **Other ways to leave select mode.** Lean:
  - Esc leaves select mode and clears the selection;
  - changing search or filter **drops selected issues that are no longer visible**, so the bar count always matches the screen.
- **Bar picker inside a group view.** Lean: exclude the current group from the list, since every selected issue is already in it.
- **Picker primitive.** Reuse `src/components/ui/popover.tsx` with a custom list, or add a cmdk-style command list. It needs proper listbox/checkbox semantics, arrow-key navigation and Esc.
- **Shared selection state.** Lift `currentTab` and selection out of `App.tsx` local state, or pass callbacks down, so card and detail chips can switch tabs.
- **Range anchor rules.** Choose when the shift-click anchor resets.
- **Exact EN/SK copy and toast wording.** Use Slovak `_one/_few/_many/_other` plurals.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — GMEM-01..GMEM-09, plus the deferred GRP-F1 (undo) and GMEM-F1 (shortcut)
- `.planning/ROADMAP.md` §"Phase 31: Membership Entry Points" — success criteria 1–5

### Prior phase decisions
- `.planning/phases/28-foundations/28-CONTEXT.md` — palette and dot style, validation rules, atomic bulk commands, Zustand selector rule
- `.planning/phases/29-tab-strip-group-view/29-CONTEXT.md` — tab truncation width, group view cards and badge, empty-state copy (D-18)
- `.planning/phases/29-tab-strip-group-view/29-UI-SPEC.md` — visual contract for tabs and the popover, which the chips and picker should match
- `.planning/phases/30-group-management-reorder/30-CONTEXT.md` — popover and confirm patterns, error-feedback pattern (sonner `toast.error`)
- `.planning/phases/30-group-management-reorder/30-UI-SPEC.md` — swatch, menu and popover styling to reuse
- `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md` — milestone research covering multi-select, store and a11y pitfalls

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/groups/groupStore.ts`:
  - `addToGroup(groupId, tickets[])` and `removeFromGroup(groupId, issueKeys[])` are already atomic bulk Rust commands. They return a count, which feeds the D-17 toast numbers.
  - `createGroup(name, color)`.
  - `groupIdsByIssue` reverse index and `selectGroupIdsForIssue` (null fallback).
- `src/features/groups/validation.ts`: name normalisation, plus duplicate and reserved checks for the picker's create row and search matching.
- `src/features/groups/colors.ts`: `pickDefaultColor` and the color tokens for chip dots.
- `src/features/groups/GroupNameForm.tsx` / `CreateGroupPopover.tsx`: live validation and stale-response guard patterns.
- `src/components/ui/`: `popover.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`, `tooltip.tsx`, `dialog.tsx`, `sonner.tsx`.
- `src/features/tickets/TicketFilterBar.tsx`: the shared header across all four lists, which hosts the Select toggle (D-11).

### Established Patterns
- `TicketCard` root is a `<button>` with an `actionSlot`. Interactive chips and checkboxes need the card restructured (D-10).
- List pages (`TicketListPage`, `IgnoredTicketsPage`, `LinkedTicketsPage`, `GroupViewPage`) each own their local filter and sort `useState`. Select mode is similarly per page, or shared through a small hook.
- Errors from group mutations go through `toast.error` with `groups.error.*` keys (Phase 30).

### Integration Points
- `src/App.tsx`: `currentTab` is local `useState` (`setCurrentTab`), with `resolveActiveTab`. Chip navigation from cards and detail needs access to it. Detail is shown via `detailTicketKey`, so a chip click in detail must also exit detail.
- `src/features/tickets/TicketDetailPage.tsx` (around lines 220–320): the title and action-button area where the Groups row goes (D-01).

</code_context>

<specifics>
## Specific Ideas

- Detail layout mockup:
  ```
  PROJ-123 · updated 2h ago
  Fix login redirect loop
  [In Progress]
  Groups ▾   ● Sprint 12 ×   ● QA ×
  [Open in Jira] [Ignore] [Mark handled] [Copy]
  ```
- Card metadata row mockup: `[In Progress] ▲ (JD) John Doe        ● Sprint 12  ● QA  +2`
- Filter bar mockup: `[🔎 Search…] [Assignee ▾] [Updated ↓]     12 results  [Select]`
- Selection bar mockup, floating at the bottom of the list: `2 selected  [Add to group ▾] [Remove from group] ✕`
- Toast example: “Added 3 issues to ‘QA’ (2 already in group)”

</specifics>

<deferred>
## Deferred Ideas

- **"Select all visible"** was considered and **rejected** for this phase; range selection is shift-click only. It could be revisited after UAT.
- A tri-state bulk picker (add and remove across the selection from any tab) was considered and not chosen. The bar picker is add-only, and remove is available only in group views.
- Clicking a chip to go to the group and also highlight or scroll to the issue there was not chosen; the chip only switches tabs.
- Undo after bulk add or remove remains GRP-F1, which is already deferred.

</deferred>

---

*Phase: 31-membership-entry-points*
*Context gathered: 2026-10-12*
