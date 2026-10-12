---
phase: 31
slug: membership-entry-points
status: draft
shadcn_initialized: true
preset: existing (style default, baseColor neutral, cssVariables, lucide)
created: 2026-10-12
---

# Phase 31 — UI Design Contract

> Scope: detail "Groups" row (button, chips, chip-remove confirm), shared group picker (checkbox mode and plain-list mode, inline create), card group chips with "+N" tooltip, Select toggle in `TicketFilterBar`, select-mode cards, floating selection bar, bulk Add/Remove feedback. Extends `29-UI-SPEC.md` and `30-UI-SPEC.md` (tokens, popover, swatch, toast and error patterns). Out of scope: missing-member dimming (Phase 32), undo (GRP-F1), picker shortcut (GMEM-F1), copy polish and WCAG audit (Phase 33). Sources: 31-CONTEXT.md (D-01..D-20), REQUIREMENTS.md (GMEM-01..09), 29/30-UI-SPEC.md, `components.json`, project memory (explicit labelled actions, no drag and drop, Zustand null fallback).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (existing `components.json`, no re-init) |
| Preset | existing: style `default`, baseColor `neutral`, CSS variables, Tailwind v4 via `src/index.css` |
| Component library | radix. Existing and reused: Popover (`popover.tsx`), Tooltip, Button, Badge, `sonner`. No new Radix dependency |
| Icon library | lucide (`ChevronDown` for "▾", `Check` in checked box, `X` for chip remove and bar clear, `Plus` for create row, `AlertCircle` for inline error) |
| Font | existing app default (do not change) |

Picker primitive (resolves Claude's Discretion): reuse `PopoverContent` with a custom `GroupPicker` list (no cmdk dependency). Combobox pattern: search `<input role="combobox" aria-expanded="true" aria-controls aria-activedescendant>` keeps DOM focus; the list is `role="listbox"` and each row `role="option"`. Up/Down move the active row (wraps off; Home/End jump), Space or Enter toggles/chooses the active row, Esc closes the popover and returns focus to the trigger. In checkbox mode the listbox has `aria-multiselectable="true"` and each option has `aria-selected` mirroring store membership; in plain-list mode options carry no `aria-selected`.

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Dot-to-name gap in chips, chip-to-chip gap in the row, chip inner horizontal padding, `×` inner padding |
| sm | 8px | Gap between Groups button and first chip, bar item gap, picker row gap (checkbox / dot / name), popover button gap |
| md | 16px | Popover padding for the chip-remove and bulk-remove confirms, bar horizontal padding, card checkbox-to-content gap |
| lg | 24px | not used |
| xl | 32px | Bar offset from the list bottom edge |
| 2xl | 48px | not used |
| 3xl | 64px | not used |

Exceptions:
- Group dot: 8px diameter in chips (Phase 28 D-07), 8px in picker rows.
- Picker popover: width 280px (same as Phase 29/30 popovers), padding 8px around the list and 8px around the search input, list max-height 240px (scrolls), row height 32px (8 x 4). Row hit area is the whole row.
- Chip: height 20px, 12px text, `rounded-full` is NOT used; chips use `rounded` with `border border-brand-border-subtle`, no tinted background. Name truncation `max-w-[160px]` (about 24 characters, Phase 29 D-08/Phase 31 D-09).
- Detail chip `×` button: 16px visual inside the chip, hit area 20px (chip height). Card chips have no `×`.
- Card checkbox: 16px visual box, 24px hit area, placed at the card's left edge; card content shifts right by 16px + 24px only while select mode is on (reserved so cards do not jump between rows, applied to all cards simultaneously).
- Selection bar: height 48px, max-width 560px, centered horizontally in the list area, 32px (`xl`) above the list bottom edge, 16px horizontal padding, `rounded-lg`, 1px border `--color-brand-border`, shadow `shadow-lg`.
- Confirm popovers (chip remove, bulk remove): width 280px, padding 16px.
- Select toggle button: height 28px (matches filter bar controls), 12px horizontal padding.

---

## Typography

No new sizes or weights (3 sizes, 2 weights, inherited from Phase 29/30).

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (picker rows, search input, popover question text, bar count, bar button text, Select toggle text, toast text) | 14px | 400 | 1.5 |
| Label (chips on card and detail, "+N", inline picker error, create-row validation message, tooltip list) | 12px | 400 | 1.5 |
| Heading (none new; confirm popovers use a single 14px/600 question line, see below) | 16px | 600 | 1.2 |
| Display | not used | - | - |

Weights: 400 and 600 only. Bar count "N selected" is 600 at 14px (the only semibold element added in this phase, as the focal text of the bar). Confirm popover question line is 14px/600 so no new 16px heading is needed inside a 280px popover. Chips and buttons are 400.

---

## Color

Existing theme tokens; no changes.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--color-brand-bg` `#f7f7f8` / `#161617` | Page background, list area |
| Secondary (30%) | `--color-brand-surface` `#ffffff` / `#1e1e20` | Cards, chips background (none, transparent over card), picker popover, selection bar, confirm popovers (`--color-popover`) |
| Accent (10%) | `--color-brand` `#c02232` | See reserved list |
| Destructive | `--color-destructive` `#dc2626` | Inline validation error text/icon in the picker; confirm button "Remove" in both confirm popovers; error toasts |

Accent reserved for: keyboard focus ring (`focus-visible:ring-brand`) on every new control, checked state fill of the picker checkbox and the card select checkbox, selected-card left border (3px accent inset marker, see Select mode), and the pressed state of the Select toggle (`bg-brand/10 text-brand-text border-brand`). Nothing else. Primary buttons in this phase are not accent-filled: "Add to group" in the bar is `outline` weight because the bar is transient chrome; the destructive confirm buttons use destructive red.

Focal points: Detail - the Groups row sits between the status block and action buttons; the labelled "Groups ▾" button is the only interactive element in the row that is outlined, chips are quiet. List with selection - the floating bar's "N selected" is the focal point. Picker - the autofocused search input, then the checked rows.

Chips: dot (`groupColorVar(token)`, `aria-hidden`, >= 3:1 non-text contrast verified in Phase 28) + name in `text-brand-text-secondary` (not `text-brand-muted`, which fails AA at 12px). No tinted background. Group identity is carried by the name; color is never the sole signal.

Selected card: `bg-brand-surface` unchanged plus a 3px inset left marker in `--color-brand` and a checked checkbox. Non-color signal: the checked checkbox with `Check` icon and `aria-checked`.

---

## Component Contract

### Detail Groups row (`TicketDetailPage`, D-01, D-05, D-06)

- Placement: dedicated row directly under the title and status block, above the action buttons. `flex flex-wrap items-center gap-2`, chips wrap to a second line rather than truncating the row. With no memberships the row contains only the Groups button.
- "Groups" button: `Button variant="outline" size="sm"`, text "Groups" + `ChevronDown` 16px, `aria-haspopup="dialog"`, `aria-expanded` bound to popover state. Always visible, never hover-revealed. When the issue has memberships the label stays "Groups" (count is conveyed by the chips beside it).
- Chip (detail variant): `inline-flex items-center`, 20px high, 4px gap, composed of two sibling buttons inside a wrapper (no nested interactive): (a) name button = dot + truncated name, `aria-label` "Go to group ‘{{name}}’", click navigates to the group tab and leaves detail (D-06); (b) `×` button, `X` 12px, `aria-label` "Remove from ‘{{name}}’", `text-brand-text-secondary hover:text-brand-text`, always visible.
- `×` opens a confirm popover anchored to the chip wrapper (`PopoverAnchor`): question "Remove from ‘{{name}}’?" (14px/600), buttons right-aligned, 8px gap: Cancel (outline, initial focus) and Remove (destructive). Esc or Cancel returns focus to that chip's `×`. After Remove succeeds, focus moves to the "Groups" button (chip no longer exists).
- Chip order in the row: tab order (the user's group order), same as the picker.
- Chips use a Tooltip with the full name only when the name is truncated.

### Group picker (`GroupPicker`, shared by detail and bar; D-02, D-03, D-04, D-16)

Anatomy top to bottom inside a 280px popover: search input, list (max 240px, scroll), optional create row, inline error line.
- Search input: 14px, `aria-label` "Search groups", placeholder "Search groups…", autofocused on open, state resets on each open. Filters by name ignoring case and diacritics via `validation.ts` normalisation. Search does not filter out already-checked groups.
- Row (checkbox mode): `[box] ● Name`. The box is a 16px square (`rounded-sm`, 1px border `--color-brand-border`; checked: `bg-brand`, white `Check` 12px). Box is `aria-hidden`; state is exposed through `aria-selected` on the option. Row highlight (active descendant) uses `bg-brand-surface-hover`, never accent. Whole row toggles on click or Space/Enter. Picker stays open (D-03).
- Row (plain-list mode, bar): `● Name` with no box and no `aria-selected`; choosing a row runs the atomic add and closes the popover. In a group view the current group is excluded from the list (Claude's Discretion default adopted: all selected issues are already members).
- Name truncates with ellipsis (`max-w` fills row), Tooltip with full name when truncated.
- Create row (D-04): appears at the bottom of the list only when the trimmed query is non-empty, passes validation and matches no existing group name exactly (Phase 28 D-17 duplicate rule). Content: `Plus` 16px + "Create ‘{{name}}’". Selecting it (click, or Enter when it is the only actionable row) calls `createGroup(name, pickDefaultColor(groups))` then adds the issue(s); in checkbox mode the picker stays open with the new group listed and checked; in plain-list mode the popover closes after the atomic add. Never navigates (user stays on the current view).
- Create-row validation: `empty` hides the row; `too_long` and `reserved` show an inline error line below the list (12px, `text-destructive`, `AlertCircle` 12px, `role="alert"`, 16px reserved min-height) and render the row disabled (`aria-disabled`, muted). `duplicate` is not shown as an error: an exact match simply means no Create row and the matching group row is highlighted. Rust codes returned on submit (`duplicate`, `reserved`, `too_long`, `no_scope`, `internal`, `not_found`) show in the same inline line with the Phase 29/30 strings.
- Empty list states: no groups at all - a single non-interactive line "No groups yet. Type a name to create one." (14px, `text-brand-text-secondary`); search matches nothing and the create row is unavailable - "No groups match ‘{{query}}’".
- Toggle failure (Claude's Discretion default adopted): the checkbox reflects store state only and is never optimistic. On failure (`not_found` after a race, `internal`) show the inline error line in the picker with the matching `groups.error.*` copy and also nothing else (no toast while the picker is open, so the message is next to the control). In plain-list mode (popover closes on choose) failure uses `toast.error` per Phase 30.
- A live region (`role="status"`, `aria-live="polite"`, visually hidden, always mounted) announces "Added to ‘{{name}}’" / "Removed from ‘{{name}}’" after each successful toggle.
- Focus: Esc closes and returns focus to the trigger button (Groups button or Add to group button).

### Card chips (`TicketCard`, D-07 to D-10)

- Restructure: card root becomes a `div` containing a stretched primary `<button>` (absolute `inset-0` overlay or full-card button for the existing open-detail behavior) and sibling interactive elements (chips, action slot, checkbox) layered above it (`relative z-10`). Existing visual layout, height and action slot are unchanged. Chip clicks must stop propagation so detail never opens.
- Position: right-aligned at the end of metadata line 3 (after status, priority, assignee), `ml-auto`, flex gap 4px. Height unchanged: the row is already at least 20px tall.
- Content: at most 2 chips by tab order, then "+N" for the rest. Inside a group view that group's own chip is hidden and not counted. Zero remaining memberships renders nothing.
- Chip (card variant): single `<button>` = dot (8px) + truncated name (`max-w-[160px]`), 12px, `aria-label` "Go to group ‘{{name}}’". Click and Enter/Space switch to that group's tab only (D-10). Hover style: `text-brand-text`. Focus ring brand.
- "+N" element: a `<button type="button">` 12px `text-brand-text-secondary`, `aria-label` "{{count}} more groups: {{names}}" (plural-aware), opens a Tooltip on hover and keyboard focus (300ms hover delay, immediate on focus) listing remaining groups as dot + name, one per line. Activating it does nothing besides showing the tooltip (does not navigate, does not open detail).
- In select mode chips remain clickable and navigate (D-12) and leave select mode via tab change (D-14).

### Select toggle (`TicketFilterBar`, D-11)

- Right side of the bar, immediately after the result count, 8px gap. `Button variant="outline" size="sm"`, text "Select" (always visible label, plus `CheckSquare` lucide 16px optional), `aria-pressed` true/false. Pressed style uses the accent border/tint described in Color.
- Present in every list (New, Not mine, Linked, Ignored if it is shown as a list, and group views). The toggle stays visible but `disabled` when the list is empty, so layout does not shift.
- Turning it off clears the selection (D-14). Esc while select mode is on and focus is inside the list area or the bar leaves select mode and clears the selection; focus returns to the Select toggle (Claude's Discretion default adopted).

### Select-mode cards (D-12, D-13)

- A 16px checkbox appears at the left edge of every card (`role="checkbox"` button with `aria-checked`, `aria-label` "Select {{key}}"; visual same as picker box). Content shifts right as specified in Spacing; all cards shift at once.
- Clicking anywhere on the card body toggles selection instead of opening detail. Shift-click on the card or its checkbox selects the contiguous range from the last clicked card to this one in the current visible sort order (anchor = last toggled card; anchor resets on leaving select mode, tab change, or when the anchor card is no longer visible). Shift-click adds the range, it does not toggle individual states off.
- There is no "Select all" and no header checkbox (D-13).
- Changing search or filter drops selected issues that are no longer visible; the bar count always matches what the user can see (Claude's Discretion default adopted).
- Action slot buttons (Restore etc.) and the copied-key badge keep working in select mode.

### Selection bar (`SelectionBar`, D-15 to D-19)

- Floating, `position: sticky`/`absolute` at the bottom of the list area (not the viewport), centered, shown only when 1+ issues are selected. Background `--color-popover`, border and shadow per Spacing. Does not cover the last card permanently: the list gets bottom padding of 80px (`pb-20`) while the bar is visible so the last card can scroll above it.
- Content left to right, 8px gaps: "{{count}} selected" (14px/600, Slovak plurals), "Add to group ▾" (outline button, `aria-haspopup="dialog"`), "Remove from group" (outline button, group views only), then an icon-only `X` clear button (`aria-label` "Clear selection", 28px, tooltip same text).
- The count sits in a polite live region (`aria-live="polite"`, `aria-atomic="true"`, not announced on initial mount of the bar beyond the count itself).
- "Add to group ▾" opens `GroupPicker` in plain-list mode (anchored above the button, `side="top"`, `align="start"`). Choosing a group or the Create row performs one atomic `addToGroup(groupId, tickets)` call. Create and add is a single step for the user.
- "Remove from group" opens a confirm popover anchored above the button: "Remove {{count}} issues from ‘{{name}}’?" (14px/600), Cancel (outline, initial focus) / Remove (destructive), same layout as the chip confirm. Esc returns focus to the button.
- After a successful bulk add or remove (D-19): selection clears, select mode ends, a `sonner` success toast is shown, focus moves to the Select toggle (the bar unmounts, so focus must not be lost to `body`).
- On failure: selection and select mode are preserved, the picker or confirm popover closes, and a `sonner` `toast.error` with the `groups.error.*` copy is shown (Phase 30 pattern).
- Bar buttons are always labelled text; no hover-revealed controls. One entry point per action: no per-card "Add to group" icons.

### Navigation from chips (D-06, D-10)

- Card chip and detail chip name both call the shared tab-change function lifted from `App.tsx` (`currentTab` state or a context/callback). From detail the same call also clears `detailTicketKey` so the detail view closes. After switching, focus moves to the target group tab button (existing `pendingFocusId`/`tabRefs` mechanism), and the tab is scrolled into view (`scrollIntoView({inline:'nearest'})`).

### Zustand and state

- Selectors for per-issue memberships use `selectGroupIdsForIssue` (returns `null` when none); consumers coalesce at render time, never inside the selector (no `?? []`). Selection state (`selectedKeys: Set<string>`, `anchorKey: string | null`, `selectMode: boolean`) lives in a small per-page hook or store; it is cleared on tab change.

---

## Copywriting Contract

All strings via i18next under `groups.*` (picker, chip, bar, toast keys) with identical EN/SK key sets; Slovak plural suffixes `_one/_few/_many/_other` wherever a count appears. Final polish is Phase 33; this phase ships the strings below.

| Element | EN copy | SK copy |
|---------|---------|---------|
| Primary CTA (detail) | Groups | Skupiny |
| Primary CTA (bar) | Add to group | Pridať do skupiny |
| Select toggle | Select | Vybrať |
| Picker search aria-label / placeholder | Search groups / Search groups… | Hľadať skupiny / Hľadať skupiny… |
| Create row | Create ‘{{name}}’ | Vytvoriť ‘{{name}}’ |
| Picker empty (no groups) | No groups yet. Type a name to create one. | Zatiaľ nie sú žiadne skupiny. Zadajte názov a vytvorte ju. |
| Picker no match | No groups match ‘{{query}}’ | Žiadna skupina nezodpovedá ‘{{query}}’ |
| Picker live region (added / removed) | Added to ‘{{name}}’ / Removed from ‘{{name}}’ | Pridané do ‘{{name}}’ / Odstránené zo ‘{{name}}’ |
| Detail chip remove aria-label | Remove from ‘{{name}}’ | Odstrániť zo skupiny ‘{{name}}’ |
| Chip navigate aria-label | Go to group ‘{{name}}’ | Prejsť na skupinu ‘{{name}}’ |
| "+N" visible text | +{{count}} | +{{count}} |
| "+N" aria-label (_one) | 1 more group: {{names}} | 1 ďalšia skupina: {{names}} |
| "+N" aria-label (_few / _many / _other) | {{count}} more groups: {{names}} | {{count}} ďalšie skupiny: {{names}} (_few, _many) / {{count}} ďalších skupín: {{names}} (_other) |
| Card checkbox aria-label | Select {{key}} | Vybrať {{key}} |
| Bar count (_one) | 1 selected | 1 vybraná |
| Bar count (_few / _many / _other) | {{count}} selected | {{count}} vybrané (_few, _many) / {{count}} vybraných (_other) |
| Bar clear aria-label | Clear selection | Zrušiť výber |
| Bar remove button | Remove from group | Odstrániť zo skupiny |
| Chip remove confirm question | Remove from ‘{{name}}’? | Odstrániť zo skupiny ‘{{name}}’? |
| Bulk remove confirm question (_one) | Remove 1 issue from ‘{{name}}’? | Odstrániť 1 úlohu zo skupiny ‘{{name}}’? |
| Bulk remove confirm question (_few / _many / _other) | Remove {{count}} issues from ‘{{name}}’? | Odstrániť {{count}} úlohy zo skupiny ‘{{name}}’? (_few, _many) / Odstrániť {{count}} úloh zo skupiny ‘{{name}}’? (_other) |
| Confirm buttons | Cancel / Remove | Zrušiť / Odstrániť |
| Add toast (all new, _one) | Added 1 issue to ‘{{name}}’ | Pridaná 1 úloha do skupiny ‘{{name}}’ |
| Add toast (all new, _few / _many / _other) | Added {{count}} issues to ‘{{name}}’ | Pridané {{count}} úlohy do skupiny ‘{{name}}’ (_few, _many) / Pridaných {{count}} úloh do skupiny ‘{{name}}’ (_other) |
| Add toast with skips suffix | Added {{count}} issues to ‘{{name}}’ ({{skipped}} already in group) | Pridané {{count}} úlohy do skupiny ‘{{name}}’ ({{skipped}} už v skupine) |
| Add toast, all already members (count 0) | All selected issues are already in ‘{{name}}’. | Všetky vybrané úlohy už sú v skupine ‘{{name}}’. |
| Remove toast (_one) | Removed 1 issue from ‘{{name}}’ | Odstránená 1 úloha zo skupiny ‘{{name}}’ |
| Remove toast (_few / _many / _other) | Removed {{count}} issues from ‘{{name}}’ | Odstránené {{count}} úlohy zo skupiny ‘{{name}}’ (_few, _many) / Odstránených {{count}} úloh zo skupiny ‘{{name}}’ (_other) |
| Error `not_found` | This group no longer exists. | Táto skupina už neexistuje. (reuse Phase 30) |
| Error `internal` (add / remove / toggle) | Could not update the group. Try again. | Skupinu sa nepodarilo aktualizovať. Skúste to znova. |
| Validation errors (duplicate, reserved, too_long, no_scope) | Reuse Phase 29 strings | Reuse Phase 29 strings |
| Empty state | Existing Phase 29 empty-group copy is already correct: it names the "Groups" button and "Add to group" action, matching the labels above verbatim. No new empty state in this phase; filtered-to-zero keeps existing filter bar copy. | SK Phase 29 copy uses „Skupiny“ and „Pridať do skupiny“, matching the labels above. |
| Destructive confirmation | Chip remove: `Remove from ‘{{name}}’?` with Cancel (default focus) / Remove. Bulk remove: `Remove {{count}} issues from ‘{{name}}’?` with Cancel (default focus) / Remove. Issues themselves are never deleted or changed; no undo (GRP-F1 deferred). | as above |

Copy notes: (1) Quotes use ‘…’ in EN and Phase 30's „…“ style may be used in SK strings during Phase 33 polish; keep the placeholders `{{name}}` identical. (2) Picker uncheck, picker check, and Create never confirm (D-03); only chip `×` and bulk "Remove from group" confirm. (3) Primary-action labels are specific verb + noun ("Add to group", "Remove from group", "Create ‘name’") per the explicit-actions preference; "Select" and "Groups" are the two short labels fixed by the requirements. (4) The Slovak _few/_many forms listed together share the same wording; they stay separate keys.

---

## Interaction & Accessibility Notes

- No drag and drop anywhere; range selection is shift-click. No hover-revealed controls: Groups button, chip `×`, Select toggle, card checkboxes (in select mode), and bar buttons are always visible when their context is active. Tooltips on "+N" and truncated names are supplementary; the full list is also in the "+N" aria-label.
- Keyboard: all new controls are reachable in DOM order. Card chips and the stretched card button are separate tab stops (chips after the card button). Picker: combobox pattern as described. Confirm popovers: initial focus on Cancel. Select mode: Esc exits, Space toggles the focused card, Shift+Space or Shift+click selects a range.
- Focus returns: picker (any mode) -> trigger; chip `×` confirm cancel -> that `×`; chip remove success -> Groups button; bulk add/remove success -> Select toggle; chip navigation -> target group tab.
- Live regions (always mounted, `aria-live="polite"`): bar count (D-15), picker toggle announcements. Toasts use sonner's built-in polite region.
- Color is never the sole signal: chips carry the name, selection carries a checkbox plus `aria-checked`, membership in the picker carries `aria-selected` plus a checkmark.
- Contrast: chip name and "+N" use `text-brand-text-secondary` (>= 4.5:1). Dot >= 3:1 (Phase 28). Accent used only on focus ring, checked fills, selected-card marker and pressed toggle.
- Reduced motion: no new animations; bar uses a 150ms opacity transition only (`motion-reduce:transition-none`).
- Do not hold the triage lock while taking the groups lock (Phase 28 D-21); the bar's atomic calls are single commands. Membership never changes core-tab placement or triage state (GMEM-01, D-20): regression tests only, no UI.
- Zustand: no `?? []` in selectors; `selectGroupIdsForIssue` returns `null`.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | existing popover, tooltip, button, badge, sonner, separator; no new blocks | not required |
| third-party | none | not applicable |

No new npm dependencies.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
