# Phase 29: Tab Strip & Group View - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 29 delivers the first user-facing group UI:

- A `＋` control at the end of the tab bar creates a named group (GRP-01).
- Group tabs sit right of the three core tabs after a divider. Each tab shows its color and member count. Overflowing tabs scroll horizontally and long names truncate with a tooltip (GVIEW-01, GVIEW-02).
- Opening a group tab shows its members as one flat list with a triage badge on each card. Search, filter and sort work as in core tabs, card actions match core tabs, and triage changes appear live everywhere (GVIEW-03, GVIEW-04, GVIEW-06).
- An empty group shows an empty state explaining how to add issues (GVIEW-05).

**Not in this phase:**
- Rename, recolor, delete and reorder, along with the tab "…" menu: Phase 30.
- Any UI to add or remove issues (detail picker, chips, multi-select): Phase 31.
- "No longer in results" dimming, hint and removal: Phase 32.
- Core New / Not mine / Linked behaviour stays unchanged.

Requirements: GRP-01, GVIEW-01, GVIEW-02, GVIEW-03, GVIEW-04, GVIEW-05, GVIEW-06.

</domain>

<decisions>
## Implementation Decisions

### Create flow (＋)
- **D-01:** Clicking `＋` opens a **popover** anchored to it. The popover has:
  - a "New group" title;
  - a name input, autofocused;
  - an inline error line under the input;
  - Cancel and Create buttons. Enter submits and Esc cancels or closes.
  - Do not use an inline tab input or a modal.
- **D-02:** After a successful create, **switch to the new group's tab**. The user lands on its empty state.
- **D-03:** The popover asks for the **name only**. The color is auto-assigned as least-used (Phase 28 D-08), and the color picker comes in Phase 30 (GRP-03).
- **D-04:** Validation runs **live as the user types**, using the TS mirror rules in `src/features/groups/validation.ts`.
  - `duplicate`, `reserved` and `too_long` show an inline message and disable Create.
  - `empty` (including whitespace-only) only disables Create, with no nagging message.
  - Rust remains authoritative. A Rust error code returned on submit, such as a race or `no_scope`, is shown inline in the same error line. `internal` gets a generic message.

### Tab strip anatomy & overflow
- **D-05:** Group tab anatomy is **color dot · name · muted count**, e.g. `● Sprint 12  3`.
  - Use the dot plus neutral text style from Phase 28 D-07, with no tinted background.
  - The active group tab uses the **same brand underline and semibold** as the core tabs.
- **D-06:** Layout is: core tabs (fixed), then a divider, then the scrollable group section, then `＋` **pinned at the right edge**.
  - Only the group section scrolls. Core tabs and `＋` never move.
- **D-07:** Overflow is a **horizontal scroll** with:
  - fade edges indicating more content;
  - small `‹` `›` arrow buttons that appear **only when overflowing** in that direction;
  - mouse wheel and trackpad scrolling;
  - the activated tab (and a newly created one) scrolled into view.
  - Do not use a "More" dropdown, and do not wrap.
- **D-08:** Long names truncate with an ellipsis, and a tooltip shows the full name. Claude picks the width cap; research suggests about 24 characters, with a 40-character max name.
- **D-09:** The active tab is **not persisted across restarts**. The app always starts on New, as today.
- **D-10:** With zero groups, the strip shows the **divider plus an icon-only `＋`**, with tooltip and aria-label "New group". There is no labelled CTA.

### Group view cards & badge
- **D-11:** The badge mapping follows the **core-tab predicates exactly**, from `ticketListUtils`:
  - `isNewCandidate` → **New**. This covers new, seen and no triage entry.
  - `isNotMineCandidate` → **Not mine**. This covers ignored and handled.
  - `isLinkedCandidate` → **Linked**. This covers copied.
  - A done ticket (`isDoneTicket`) → a neutral **Done** badge, because it appears in no core tab.
- **D-12:** The badge is a **small neutral text pill** carrying the core tab's name, placed beside the issue key.
  - Existing per-card details (TriageIndicator red dot / copied key, "Handled" badge, blue change indicator) still appear as in core tabs.
- **D-13:** Card actions are **the same as in that card's core tab**:
  - Not-mine cards get the "Restore" action.
  - Linked cards get the copied-key badge.
  - Clicking any card opens detail, where copy and dismiss work as today.
  - Badges and actions read the shared `useTicketStore().triageMap`, so triage changes made anywhere update the group view and core tabs immediately.
- **D-14:** Members **absent from the current fetch**, or shown before the first fetch, **render as normal cards from the stored snapshot** (`ticket_json` via `getGroupMembers`).
  - Never hide a member, so the list length always equals the tab count.
  - Prefer the live ticket from `ticketStore` when it is present.
  - There is no dimming or hint yet. That is Phase 32.
- **D-15:** The group view has **no fetch controls**: no Fetch button, last-checked line or fetch warnings. Fetch stays on the New tab, as with Not mine and Linked. The view is the filter bar plus the list.
- **D-16:** Search, filter and sort state **resets on each visit**, with a default sort of Updated descending. This matches the existing pages' local `useState`. Reuse `TicketFilterBar`, `filterTickets` and `sortTickets` unchanged.
- **D-17:** **Done** members are shown by default with the Done badge. There is no "show done" toggle.

### Empty state & testing
- **D-18:** The empty-group state uses the **final copy now**.
  - Heading along the lines of "No issues in this group yet".
  - The body explains both entry points: open an issue and use "Groups", or select issues in any list and choose "Add to group".
  - The copy is EN and SK. Phase 31 verifies the wording matches the shipped controls.
- **D-19:** **Automated tests only** for populated group views in this phase. Component and integration tests seed `useGroupStore` and `useTicketStore` directly.
  - This phase's manual UAT covers create, the tab strip, overflow and the empty state.
  - Populated-view UAT happens once Phase 31 adds entry points.
  - Do **not** add dev-only seed actions or an early "Add to group" button.

### Carried forward (locked, not re-discussed)
- Phase 28 D-07 / D-08: dot plus neutral text, and least-used default color.
- Phase 28 D-14 / D-16 / D-17 / D-18: 40-character max, Rust-authoritative validation with a TS mirror, and diacritic-aware duplicate and reserved-name checks.
- Phase 28 D-22: never use `?? []` inside a Zustand selector; use a `null` fallback (memory feedback_zustand_selector_stable_ref).
- No drag and drop anywhere (memory feedback_no_drag_and_drop). Reorder comes in Phase 30 via a menu.
- Prefer explicit labelled actions over hover-revealed icons (memory feedback_explicit_actions).

### Claude's Discretion
- The exact truncation width and the fade and arrow styling.
- How `currentTab` widens to carry a group id: a discriminated union such as `{kind:'core'|'group'}` or string ids.
- Fallback to New if the active group disappears, for example after a scope change or rehydrate failure. Phase 30 handles the delete case explicitly.
- Keyboard semantics of the tab strip: the existing `<nav>` buttons with `aria-current`, or a roving tabindex. It must meet WCAG AA and stay consistent with the core tabs.
- Whether to add `@radix-ui/react-popover` (the shadcn Popover) for D-01. No Popover exists in `src/components/ui` yet, and Phase 31's picker will need one too.
- Exact EN/SK wording for the popover, validation messages, badges and empty state. Slovak plurals for counts use i18next `_one/_few/_many/_other`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — GRP-01 and GVIEW-01..06 (this phase), plus GDUR-* for what Phase 32 adds on top of D-14
- `.planning/ROADMAP.md` §Phase 29 — success criteria; §Phase 30–32 — scope boundaries

### Prior phase decisions
- `.planning/phases/28-foundations/28-CONTEXT.md` — palette, rendering style, validation rules, scope, Zustand rule
- `.planning/phases/28-foundations/28-UI-SPEC.md` — design tokens and visual contract from Phase 28
- `.planning/phases/28-foundations/28-0{1..6}-SUMMARY.md` — what was actually built (group store API, commands)

### Milestone research
- `.planning/research/FEATURES.md` — tab strip, overflow, group view, triage-badge framing, and a shared triage source
- `.planning/research/ARCHITECTURE.md` — module layout for groups
- `.planning/research/PITFALLS.md` — Zustand selector loops and name validation

### Existing code to follow or modify
- `src/components/ui/AppShell.tsx` — the current tab `<nav>`, to extend with the divider, group section and `＋`
- `src/App.tsx` (~104, ~249–261) — `currentTab` state and the tab → page switch
- `src/features/groups/groupStore.ts`, `types.ts`, `validation.ts`, `colors.ts` — the store (`createGroup`, `getGroupMembers`, `memberKeysByGroup`, `groupIdsByIssue`), the TS validation mirror and the palette tokens
- `src-tauri/src/groups_commands.rs` — the `create_group` / `get_group_members` commands and their error codes
- `src/features/tickets/ticketListUtils.ts` — the `is*Candidate` predicates (badge mapping), `filterTickets` and `sortTickets`
- `src/features/tickets/IgnoredTicketsPage.tsx`, `LinkedTicketsPage.tsx` — the page structure to mirror, plus the Restore and copied-key action slots
- `src/features/tickets/TicketCard.tsx`, `TriageIndicator.tsx`, `TicketFilterBar.tsx` — the card, its `actionSlot` and the filter bar
- `src/features/tickets/utils.ts` — `isDoneTicket`
- `src/i18n/locales/en.json`, `src/i18n/locales/sk.json` — `nav.*` and the empty-state key patterns (`ignored.empty.*`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useGroupStore` is already hydrated at startup. It exposes `groups` (sorted by position, with `memberCount`), `memberKeysByGroup`, `createGroup` returning `GroupResult` with typed codes, and `getGroupMembers` returning snapshot `ticketJson`.
- `validation.ts` is the TS mirror of the Rust rules and has shared test vectors in `src/test-fixtures/group-vectors.json`.
- `TicketCard` supports an `actionSlot`, and `TicketFilterBar` is fully controlled. Both can be dropped into a `GroupViewPage` as they are.
- `ticketListUtils` predicates give an exact badge mapping that stays consistent with the core tabs.
- Tooltip, Badge, ScrollArea and Dialog are available in `src/components/ui`. Popover is not.

### Established Patterns
- Each list page owns its search, filter and sort state via `useState`. Each page has an empty-state block with heading and body i18n keys.
- Restore writes triage via `invoke('set_triage_state')` and then updates `ticketStore.triageMap` optimistically. Group view actions must use the same path so the core tabs reflect changes.
- The core tab button styling is `border-b-2`, with `border-brand` and semibold when active and `aria-current="page"`.

### Integration Points
- `App.tsx` `currentTab` widens from `'new'|'not-mine'|'linked'` to include a group id. `AppShell` props widen accordingly, and a new `GroupViewPage` is rendered for group tabs.
- Group members are resolved by joining `memberKeysByGroup[id]` against `useTicketStore().tickets`, falling back to the snapshot `ticketJson` (D-14).
- Detail is opened via `useTicketStore.getState().selectTicket(key)`, as on the existing pages.

</code_context>

<specifics>
## Specific Ideas

- Tab mockup: `New  Not mine  Linked │ ‹ ░● Sprint 12  3  ● Waiting on QA  7░ › ＋`
- Card mockup: `PROJ-123  [Not mine]  Restore` on line 1, then the usual summary and metadata rows.
- The create popover mockup has a "New group" title, a name field, an inline "⚠ Name already exists" line, and Cancel/Create.

</specifics>

<deferred>
## Deferred Ideas

None. The discussion stayed within phase scope. Possible scope creep was explicitly rejected: a color picker at create stays in Phase 30, and an early "Add to group" button or dev seed tool will not be built.

</deferred>

---

*Phase: 29-Tab Strip & Group View*
*Context gathered: 2026-10-12*
