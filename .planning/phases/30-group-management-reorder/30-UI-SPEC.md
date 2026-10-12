---
phase: 30
slug: group-management-reorder
status: approved
shadcn_initialized: true
preset: existing (style default, baseColor neutral, cssVariables, lucide)
created: 2026-10-12
reviewed_at: 2026-10-12
---

# Phase 30 — UI Design Contract

> Scope: group tab "…" menu (plus right-click), Rename popover, Change color popover, swatch row in the Create popover, Delete confirm dialog, Move left/right with live-region announcement. Extends `29-UI-SPEC.md` (tab strip, create popover). Membership UI is Phase 31; undo toast (GRP-F1) and drag and drop are out of scope. Sources: 30-CONTEXT.md (D-01..D-15), 29-UI-SPEC.md, `colors.ts`, `components.json`, project memory (explicit actions, no DnD).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (existing `components.json`, no re-init) |
| Preset | existing: style `default`, baseColor `neutral`, CSS variables, Tailwind v4 via `src/index.css` |
| Component library | radix. Existing: Popover, Dialog, Tooltip, Button. New: `@radix-ui/react-dropdown-menu` and `@radix-ui/react-context-menu` as shadcn wrappers (`dropdown-menu.tsx`, `context-menu.tsx`) |
| Icon library | lucide (`MoreHorizontal` for "…", `Check` for the selected swatch, `AlertCircle` for inline error) |
| Font | existing app default (do not change) |

Menu primitive (resolves Claude's Discretion): the active tab's `…` opens a Radix `DropdownMenu`; right-click on any group tab opens a Radix `ContextMenu`. Both render the same item list from one shared `GroupMenuItems` component, so order, labels, disabled state and handlers are defined once. Both give native `role="menu"` behavior (arrows, Home/End, Enter, Esc, typeahead). Core tabs have no `onContextMenu` handler, so the native browser menu is untouched there.

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Menu item icon gap, `…` button inner padding, swatch-to-swatch gap |
| sm | 8px | Popover and dialog button gap, menu item vertical padding, gap between input and swatch row |
| md | 16px | Popover padding (Rename, Color, Create), gap between popover title, body and button row |
| lg | 24px | Delete dialog padding, and body-to-buttons spacing inside the dialog |
| xl | 32px | not used |
| 2xl | 48px | not used |
| 3xl | 64px | not used |

Exceptions:
- Swatch button: 24px square hit area containing a 16px color circle; selected swatch adds a 2px ring (offset 2px) and a 12px `Check`. The 2px ring and 2px ring offset are stroke widths (border-like), not layout spacing, so they are exempt from the 4px-multiple scale and do not affect the 24px hit area or the 220px row width. 8 swatches in one row: 8 x 24 + 7 x 4 = 220px, fits the 280px popover (248px content width).
- `…` button inside the tab: 20px square, 16px icon, placed after the count with 4px gap. Tab keeps the Phase 29 `max-w-[160px]` name truncation. The `…` slot is reserved on the active tab only (see Tab integration).
- Menu: min-width 180px, 4px container padding.
- Rename/Color popover width 280px (same as Create). Delete dialog max-width 400px.

---

## Typography

No new sizes or weights (3 sizes, 2 weights, inherited from Phase 29).

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (menu items, input text, dialog body, all button text in popovers and dialog) | 14px | 400 | 1.5 |
| Label (inline error, Create popover "Color" label; live-region text is visually hidden) | 12px | 400 | 1.5 |
| Heading (popover titles "Rename group", "Change color"; dialog title) | 16px | 600 | 1.2 |
| Display | not used | - | - |

Weights: 400 and 600 only. Menu items are 400 (no semibold). All buttons (Rename, Create, Cancel, Keep group, Delete group) use one weight: 400 at 14px. Emphasis for primary/destructive buttons comes from fill color, not weight. 600 is reserved for headings and the active tab name. No third weight.

---

## Color

Existing theme tokens; no changes.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--color-brand-bg` `#f7f7f8` / `#161617` | Page background |
| Secondary (30%) | `--color-brand-surface` `#ffffff` / `#1e1e20` | Tab nav, menu, popovers, dialog (`--color-popover`) |
| Accent (10%) | `--color-brand` `#c02232` | See reserved list |
| Destructive | `--color-destructive` `#dc2626` | "Delete group…" menu item text, Delete group confirm button, inline validation error |

Accent reserved for: active tab bottom border, keyboard focus ring (`focus-visible:ring-brand`), primary "Rename group" button in Rename popover, primary "Create group" button in Create popover.

Focal points (visual hierarchy): tab strip - the active tab's accent underline spanning name + its `…` button is the single focal element; the `…` button is secondary (`text-brand-text-secondary`) until focused or hovered. Delete dialog - the red "Delete group" button is the focal point; "Keep group" is outline and holds initial focus. Rename/Create popovers - the primary accent button, with the name input as the first focus target. Menu highlight uses neutral `bg-brand-surface-hover`, never accent.

Group colors (`--color-group-*`) appear only as the 8px tab dot (Phase 29) and the 16px swatch circles. Swatches are filled via `groupColorVar(token)`; never raw stored strings. Selected state: 2px ring (stroke) in `--color-brand-text` with offset 2px plus `Check` icon (white on dark fills is not guaranteed, so the check uses `--color-popover` stroke over a `--color-brand-text` 12px disc to keep 3:1). Non-color signals: ring, check, and the aria-label/tooltip color name.

Destructive menu item: `text-destructive` with `focus:bg-destructive/10`. Delete confirm button: `bg-destructive text-white` (white on `#dc2626` is about 4.8:1, passes AA).

---

## Component Contract

### Tab integration (`GroupTab.tsx`, `GroupTabStrip.tsx`)

- Active group tab: render `…` as a **sibling button inside the tab wrapper** (not nested in the tab `<button>`, to avoid invalid interactive nesting). Wrapper: `inline-flex items-center`, shares the `border-b-2` active underline so the underline spans tab + `…`.
- Anatomy active: dot · name · count · `…`. Inactive: dot · name · count (no `…`).
- Width stability: the `…` slot (20px + 4px gap) is always laid out but `invisible` + `aria-hidden` + `tabIndex=-1` and `pointer-events-none` on inactive tabs, so activation does not shift neighbours (extends the Phase 29 invisible-semibold-copy trick). Invisible is not hover-reveal: it is never shown on hover.
- `…` button: `MoreHorizontal` 16px, `text-brand-text-secondary hover:text-brand-text`, `rounded`, focus ring brand, `aria-haspopup="menu"`, `aria-expanded` bound to menu open state, `aria-label` "Group actions for {{name}}" (translated). Tooltip: same text, 300ms.
- Right-click on any group tab (`onContextMenu`): opens ContextMenu for that group; does not call `setCurrentTab`. Keyboard alternative for inactive tabs: ContextMenu key and Shift+F10 on a focused group tab (provided natively by Radix ContextMenu trigger).
- Context-menu on the active tab and the `…` menu show identical items.
- Focus-return contract uses existing `tabRefs` and `pendingFocusId`; extend the ref map to also hold the `…` button per group id.

### Group menu (shared `GroupMenuItems`)

Order (D-03): `Rename…`, `Change color…`, separator, `Move left`, `Move right`, separator, `Delete group…`.
- Each item has an always-visible text label. Leading 16px lucide icon optional and `aria-hidden` (Pencil, Palette, ArrowLeft, ArrowRight, Trash2); if included, all items have one.
- `Move left` disabled (`aria-disabled`, `data-disabled`, muted text) for the first group; `Move right` disabled for the last; both disabled for a single group. Disabled items stay in the menu and remain focusable-for-reading per Radix (use `disabled`).
- `Move left/right` select: runs `moveGroup`, menu closes (Radix default), focus returns to the moved group's `…` trigger once rehydrated (via `pendingFocusId`), tab is scrolled into view (`scrollIntoView({inline:'nearest'})`). If the moved group is not the active tab (context-menu path), focus returns to that tab button because it has no `…`.
- `Rename…`, `Change color…`, `Delete group…` close the menu and open their surface anchored to / owned by that group's tab. Use a controlled "pending action" state `{ groupId, kind: 'rename' | 'color' | 'delete' } | null` in `GroupTabStrip`; set it in `onSelect`, and open the overlay after the menu closes to avoid focus-trap conflicts. Popovers anchor with `PopoverAnchor` on the tab wrapper.

### Rename popover (shared `GroupNameForm` extracted from `CreateGroupPopover`)

- Anchored to the group tab wrapper, `align start`, width 280px, padding 16px, `--color-popover` background, `--color-brand-border` border.
- Title "Rename group" (16px/600). Name `<input>` 14px, prefilled with the current name, **fully selected on open**, `aria-label` "Group name", `aria-describedby` to error line, `aria-invalid` on error. Inline error line identical to Create: 12px `text-destructive`, `AlertCircle` 12px, `role="alert"`, 16px reserved min-height.
- Buttons right-aligned, 8px gap: Cancel (ghost/outline), "Rename group" (primary `bg-brand`). Enter submits when valid; Esc cancels.
- "Rename group" button disabled when: empty/whitespace, `duplicate`, `reserved`, `too_long`, unchanged (identical after trim + NFC, shows no message), or submitting. Duplicate check excludes the group's own name, so case-only/diacritic-only changes of its own name are valid (D-07).
- Rust codes shown inline on submit exactly as Create (`duplicate`, `reserved`, `too_long`, `no_scope`, `internal`; `not_found` shows the rename `not_found` copy and keeps the popover open with the primary button disabled; user dismisses with Cancel).
- Success: close, focus the tab's `…` (or the tab button when it is inactive, D-08). Cancel: same focus return. State resets on each open; stale-response guards reused from Create.

### Change color popover (shared `GroupColorSwatches`)

- Anchored to the tab wrapper, width 280px, padding 16px. Title "Change color" (16px/600). Below: one row of 8 swatches in `GROUP_COLOR_TOKENS` order.
- Implemented as a Radix-friendly radiogroup: container `role="radiogroup"` with `aria-label` "Color"; each swatch `<button role="radio" aria-checked>` with `aria-label` and Tooltip carrying the translated color name (e.g. "Teal"). Roving tabindex: arrow keys move among swatches, Tab leaves the group; selected swatch is the tab stop. Space/Enter picks.
- Picking a swatch calls `setGroupColor`, closes the popover (applies immediately; no confirm button), and returns focus to `…` / tab button. Picking the already-current color just closes. Esc closes with no change.
- The current color is pre-checked on open. No "in use" markers or warnings (D-11).
- Failure (`not_found`/`internal`): close the popover and show a `sonner` toast with the error copy below.

### Create popover additions (D-10)

- Under the name input, 8px gap, add label "Color" (12px/400 `text-brand-text-secondary`) and the same `GroupColorSwatches` row, preselected via `pickDefaultColor(groups)`. Selection is local state (not applied until Create); passed to `createGroup(name, color)`.
- Tab order inside popover: name input, swatch group, Cancel, Create group. Enter in the input still submits.
- Popover vertical order: title, input, error line (16px reserved), color label + swatches, buttons.

### Delete confirm dialog

- Existing Radix Dialog with `role="alertdialog"` (`DialogContent role="alertdialog"`, `aria-describedby` to body). Centered modal with overlay, max-width 400px, padding 24px (`lg`, intentionally larger than the 16px popover padding because it is a modal), 16px (`md`) between title and body, 24px (`lg`) between body and button row.
- Title (16px/600): `Delete “{{name}}”?` Body (14px/400, `text-brand-text-secondary`): count line, see Copywriting.
- Buttons right-aligned, 8px gap: **Keep group** (outline, receives initial focus via `onOpenAutoFocus` on its ref), **Delete group** (destructive red, focal point). Enter on Keep group dismisses; Esc dismisses.
- On confirm: call `deleteGroup`; on success close dialog. If the deleted group was active, `setCurrentTab('new')` explicitly (D-13). Focus after close (D-14): active deleted -> New core tab button; inactive deleted -> left neighbour group tab, or right neighbour if it was first; none left -> `＋`. Use `pendingFocusId` / refs; set it before the rehydrate.
- While deleting: buttons disabled; on failure keep the dialog open and show an inline error line (12px, `text-destructive`, `role="alert"`) above the buttons.
- The count is `memberCount` captured when the dialog opens (does not change while open).

### Move announcement (live region)

- One visually hidden `role="status"` / `aria-live="polite"` / `aria-atomic="true"` element mounted in `GroupTabStrip` (always present, not conditionally mounted). After a successful move set its text to the localized message; clear after ~5s or on next move. Position is 1-based among groups only (D-15). Edge no-op never announces.

---

## Copywriting Contract

All strings via i18next under `groups.*` with identical EN/SK key sets (Slovak plural suffixes `_one/_few/_many/_other` where a count is used).

| Element | EN copy | SK copy |
|---------|---------|---------|
| Primary CTA (Rename popover) | Rename group | Premenovať skupinu |
| Primary CTA (Create popover; changed from Phase 29 "Create") | Create group | Vytvoriť skupinu |
| Dismiss (Rename and Create popovers) | Cancel | Zrušiť |
| Dismiss (Delete dialog) | Keep group | Ponechať skupinu |
| `…` button aria-label + tooltip | Group actions for {{name}} | Akcie skupiny {{name}} |
| Menu: rename | Rename… | Premenovať… |
| Menu: color | Change color… | Zmeniť farbu… |
| Menu: move left | Move left | Posunúť doľava |
| Menu: move right | Move right | Posunúť doprava |
| Menu: delete | Delete group… | Odstrániť skupinu… |
| Rename popover title | Rename group | Premenovať skupinu |
| Color popover title | Change color | Zmeniť farbu |
| Swatch group label (a11y, and Create popover label) | Color | Farba |
| Color names | Blue, Teal, Green, Amber, Orange, Purple, Pink, Slate | Modrá, Tyrkysová, Zelená, Jantárová, Oranžová, Fialová, Ružová, Bridlicová |
| Delete dialog title | Delete “{{name}}”? | Odstrániť „{{name}}“? |
| Delete body (_one) | 1 issue is in this group. The issues themselves are not affected. | V tejto skupine je 1 úloha. Samotné úlohy sa nezmenia. |
| Delete body (_few / _many) | {{count}} issues are in this group. The issues themselves are not affected. | V tejto skupine sú {{count}} úlohy. Samotné úlohy sa nezmenia. |
| Delete body (_other) | {{count}} issues are in this group. The issues themselves are not affected. | V tejto skupine je {{count}} úloh. Samotné úlohy sa nezmenia. |
| Delete body (zero) | This group is empty. | Táto skupina je prázdna. |
| Delete confirm button (destructive) | Delete group | Odstrániť skupinu |
| Move announcement | “{{name}}” moved to position {{position}} of {{total}}. | „{{name}}“ presunutá na pozíciu {{position}} z {{total}}. |
| Error `not_found` (rename / move / color / delete) | This group no longer exists. | Táto skupina už neexistuje. |
| Error `internal` rename | Could not rename the group. Try again. | Skupinu sa nepodarilo premenovať. Skúste to znova. |
| Error `internal` move | Could not move the group. Try again. | Skupinu sa nepodarilo presunúť. Skúste to znova. |
| Error `internal` color | Could not change the color. Try again. | Farbu sa nepodarilo zmeniť. Skúste to znova. |
| Error `internal` delete | Could not delete the group. Try again. | Skupinu sa nepodarilo odstrániť. Skúste to znova. |
| Validation errors (duplicate, reserved, too_long, no_scope) | Reuse Phase 29 strings | Reuse Phase 29 strings |
| Empty state | not applicable (no new empty state; zero-group state unchanged from Phase 29) | - |
| Destructive confirmation | Delete group: `Delete “{{name}}”?` with issue count and "The issues themselves are not affected." Keep group is default focus; no undo (GRP-F1 deferred) | as above |

Copy decisions: (1) Phase 29 Create CTA is renamed "Create group" / "Vytvoriť skupinu" because this phase edits the Create popover (adds swatches) and the i18n keys `groups.create.submit` (or equivalent) must be updated in both locales plus any tests asserting the old label. No other Phase 29 copy is changed. (2) Popover dismiss stays "Cancel" / "Zrušiť" as an explicit, justified exception: Cancel there only closes a non-destructive, reversible form and must match the shipped Phase 29 Create popover; the Delete dialog, where dismissal means preserving data, uses the context-specific "Keep group".

Failures of move, color, and delete-after-dialog-closed use a `sonner` error toast with the matching `internal`/`not_found` string; rename and delete show errors inline. Slovak _few and _many bodies are separate keys with the wording above. Colors names must be verified by a native speaker in Phase 33.

---

## Interaction & Accessibility Notes

- No drag and drop. Reorder only via labelled Move left / Move right menu items. No hover-revealed controls: `…` is visible on the active tab at all times; right-click is a secondary shortcut to the same menu, never the sole path for the active tab. Inactive tabs are reachable via right-click or ContextMenu/Shift+F10, or by activating the tab first (then `…` appears).
- Focus map: menu actions Move -> `…` of moved tab; Rename submit/Cancel/Color pick -> `…` of that tab (tab button when inactive); Delete -> neighbour/New/`＋` per D-14.
- Menus, popovers and dialog trap focus per Radix defaults; Esc closes and restores focus to the trigger.
- Color is never the sole signal: swatch name via aria-label/tooltip, selected ring + check; tab identified by name.
- Touch/hit targets: `…` and swatch visual sizes are 20px/24px, inside a 36px nav row (a multiple of 4: 9 x 4px); acceptable for a desktop (Tauri) app.
- Reduced motion: no new animations; reuse `duration-150` transitions and Radix default fade; scroll-into-view uses `behavior: 'auto'` when `prefers-reduced-motion`.
- Contrast: `…` icon uses `text-brand-text-secondary` (not `text-brand-muted`, which fails AA). Menu disabled items are exempt from AA but must remain legible (`opacity-50` on `text-brand-text`).
- Zustand: no `?? []` in selectors; use `null` fallback.
- Menu items for tabs on a race (`not_found`) must not leave a stale open overlay: close overlay and toast.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | dropdown-menu (new), context-menu (new); existing popover, dialog, tooltip, button | not required |
| third-party | none | not applicable |

New npm dependencies: `@radix-ui/react-dropdown-menu`, `@radix-ui/react-context-menu` (same Radix family and pinning style as existing `@radix-ui/react-popover`).

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG (accepted — popover "Cancel" exception; "Rename group"/"Keep group" refine D-06/D-12 wording)
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-10-12
