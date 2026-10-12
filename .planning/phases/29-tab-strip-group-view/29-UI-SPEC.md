---
phase: 29
slug: tab-strip-group-view
status: approved
reviewed_at: 2026-10-12
shadcn_initialized: true
preset: existing (style default, baseColor neutral, cssVariables, lucide)
created: 2026-10-12
---

# Phase 29 — UI Design Contract

> Scope: `＋` create popover, group tab strip with overflow, flat group view (badge, filter bar, list), empty group state. Rename, recolor, delete, reorder and the tab "…" menu are Phase 30; add/remove UI is Phase 31; "no longer in results" is Phase 32. Sources: 29-CONTEXT.md (D-01..D-19), 28-UI-SPEC.md, existing `AppShell.tsx` and `index.css`.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (existing `components.json`, no re-init) |
| Preset | existing: style `default`, baseColor `neutral`, CSS variables, Tailwind v4 via `src/index.css` |
| Component library | radix (Tooltip, Badge, ScrollArea, Button exist; add shadcn `Popover` = `@radix-ui/react-popover`, per Claude's discretion in CONTEXT) |
| Icon library | lucide (`Plus`, `ChevronLeft`, `ChevronRight`, `AlertCircle` for inline error) |
| Font | existing app default (do not change) |

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Dot-to-name gap, name-to-count gap, badge inner vertical padding |
| sm | 8px | Popover button gap, badge gap from issue key, divider horizontal margin |
| md | 16px | Popover padding, nav horizontal padding (existing `px-4`), empty state inner gaps |
| lg | 24px | Empty state heading-to-body block spacing |
| xl | 32px | Empty state top offset |
| 2xl | 48px | Empty state vertical padding |
| 3xl | 64px | not used |

Exceptions:
- Group color dot: 8px diameter (Phase 28).
- Overflow arrow buttons: 28px square (`w-7 h-7`, matches header icon buttons); fade edges 24px wide.
- Icon-only `＋` button: 28px square visual, hit area extended to at least 32px height via the nav row (tab row height ~36px).
- Tab truncation cap: `max-w-[160px]` on the name span (about 24 characters at 14px). Max name length remains 40 (Phase 28 D-14).
- Popover width: 280px (`w-70`).
- Vertical divider between core tabs and groups: 1px wide, 16px tall.

---

## Typography

Only existing sizes and weights are used (3 sizes, 2 weights).

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (tab label `text-sm`, input text, empty-state body, card text unchanged) | 14px | 400 (active tab: 600) | 1.5 |
| Label (member count, triage pill, inline error, button text in popover, Cancel/Create) | 12px | 400 (pill: 600 NOT used; pill stays 400) | 1.5 |
| Heading (popover title "New group", empty-state heading) | 16px | 600 | 1.2 |
| Display | not used | - | - |

Weights: regular 400 and semibold 600 only. The existing `text-[10px]` blue change indicator on cards is unchanged; the new triage pill must not add a fourth size (uses 12px).

---

## Color

Existing theme tokens in `src/index.css`; no changes.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--color-brand-bg` `#f7f7f8` / `#161617` | Page background, group view list area |
| Secondary (30%) | `--color-brand-surface` `#ffffff` / `#1e1e20` | Tab nav bar, cards, popover (`--color-popover`) |
| Accent (10%) | `--color-brand` `#c02232` | See reserved list |
| Destructive | `--color-destructive` `#dc2626` | Inline validation error text/icon in the create popover only (no destructive actions this phase) |

Accent reserved for: active tab bottom border (`border-brand`, shared by core and group tabs), keyboard focus ring (`focus-visible:ring-brand`), and the primary "Create" button. Nothing else.

Group colors (`--color-group-*`) are used only as the 8px dot fill in the tab. Never tinted tab backgrounds, never colored text. Name text stays `text-brand-text` (active) or `text-brand-muted` (inactive); count is `text-brand-text-secondary` (muted fails AA at 12px; see Accessibility).

Triage pill: neutral `bg-brand-surface-hover text-brand-text-secondary` with `border border-brand-border-subtle`, `rounded` , 12px text. Same style for New, Not mine, Linked and Done (no per-state color; the label carries the meaning).

---

## Component Contract

### Tab strip (extends `AppShell` `<nav aria-label="Main navigation">`)

Layout (left to right): core tabs (fixed, unchanged) | divider | scrollable group section (`flex-1 min-w-0 overflow-x-auto`, scrollbar hidden) | `＋` pinned right.
- Group tab: `<button>` with `aria-current="page"` when active; same classes as core tabs (`text-sm py-2 border-b-2`, active `border-brand font-semibold text-brand-text`, inactive `text-brand-muted border-transparent hover:text-brand-text`, same focus ring). Content: dot (8px, `aria-hidden`), name (truncate, `max-w-[160px]`), count (12px `text-brand-text-secondary`). Items separated by 16px (`mr-4`, same as core tabs).
- Accessible name per tab: `"{name}, {count} issues"` via i18next plural (`_one/_few/_many/_other` in SK); count text itself is visible number only.
- Truncated names: Tooltip (300ms delay, existing provider) shows full name; only rendered when text is actually truncated (or always, acceptable). Tooltip content `aria-hidden`; the full name is in the button's aria-label.
- Active tab stays active-underlined (semibold causes width shift; reserve width by rendering a hidden semibold copy or `font-semibold` on an invisible `::after` so tabs do not jitter).
- Overflow: left/right fade edges (24px gradient from `--color-brand-surface` to transparent) and `‹` `›` buttons (28px, `ChevronLeft/Right` 16px, `text-brand-muted hover:text-brand-text`, ring on focus) rendered only when content overflows in that direction. Click scrolls by ~200px (smooth, respects `prefers-reduced-motion`). Wheel/trackpad scrolls horizontally (vertical wheel delta mapped to horizontal over the group section). Arrow buttons labelled `aria-label` "Scroll tabs left/right". Activated or newly created tab calls `scrollIntoView({inline:'nearest'})`.
- Keyboard: keep consistent with core tabs: all tabs are natively focusable buttons in DOM order (Tab key), Enter/Space activates; no roving tabindex. Arrow buttons are focusable only while visible.
- Zero groups: divider + icon-only `＋` (`Plus` 16px) with Tooltip and `aria-label` "New group". No labelled CTA.
- `＋` button: 28px, `text-brand-muted hover:text-brand-text`, `aria-haspopup="dialog"`, `aria-expanded` bound to popover state. Never moves when tabs scroll.

### Create popover (shadcn Popover, anchored below `＋`, align end)

- Padding 16px, width 280px, background `--color-popover`, border `--color-brand-border`.
- Title "New group" (16px / 600). Name `<input>` (14px, autofocus, `maxLength` not enforced so `too_long` message can show; `aria-describedby` to error line, `aria-invalid` when error). Inline error line under input (12px, `text-destructive`, `AlertCircle` 12px icon + message, `role="alert"`), min height reserved (16px) to prevent layout jump.
- Buttons row, right aligned, 8px gap: Cancel (ghost/outline) then Create (primary, `bg-brand`). Create disabled when empty/whitespace, `duplicate`, `reserved`, `too_long`, or while submitting.
- Enter submits (when valid), Esc closes and returns focus to `＋`. Click outside closes. State (input, error) resets on each open.
- Live validation per D-04 via `validation.ts`. `empty` shows no message. Rust codes on submit shown in the same error line; `internal` uses generic message.
- On success: close popover, switch to the new tab, scroll it into view, focus moves to the new tab button. The group view mounts with its empty state.

### Group view (`GroupViewPage`)

Mirrors `IgnoredTicketsPage` structure: `TicketFilterBar` (unchanged) above a scrollable list of `TicketCard`. No Fetch button, last-checked line or warnings (D-15). Default sort Updated descending; search/filter/sort reset on each visit (D-16).
- Card line 1: `KEY  [pill]  action-slot`. Pill sits 8px right of the issue key. Existing TriageIndicator (red dot / copied key), "Handled" badge and blue change indicator remain.
- Pill mapping (D-11): `isNewCandidate` -> "New"; `isNotMineCandidate` -> "Not mine"; `isLinkedCandidate` -> "Linked"; `isDoneTicket` -> "Done". Check order: done check only when none of the three core predicates match.
- Action slot (D-13): Not-mine cards show an explicit labelled "Restore" button (same as Ignored page); Linked cards show the copied-key badge; others none. Clicking the card opens detail. No hover-revealed icons.
- Members absent from live tickets render from snapshot `ticketJson` as normal cards (D-14); no dimming.
- States: before hydrate/loading -> use existing skeleton pattern if the other pages do, otherwise render nothing flashy; filtered-to-zero result reuses the existing "no results" copy of the filter bar/pages.

### Empty group state (D-18)

Centered block (same structure as `ignored.empty.*`): heading 16px/600 `text-brand-text`, body 14px/400 `text-brand-muted`, max-w 384px, vertical padding 48px. No illustration, no button (Phase 31 adds entry points; do not add an "Add to group" control).

---

## Copywriting Contract

All strings via i18next in `en.json` and `sk.json` with identical key sets. Suggested keys under `groups.*`.

| Element | EN copy | SK copy |
|---------|---------|---------|
| Primary CTA (popover) | Create | Vytvoriť |
| Secondary | Cancel | Zrušiť |
| Popover title | New group | Nová skupina |
| Input label (visually hidden) / placeholder | Group name | Názov skupiny |
| `＋` tooltip + aria-label | New group | Nová skupina |
| Scroll arrows aria-label | Scroll tabs left / Scroll tabs right | Posunúť karty doľava / doprava |
| Tab aria-label | `{{name}}, {{count}} issues` (_one: "1 issue") | `{{name}}, {{count}}` s plurálmi `_one` "1 úloha", `_few` "{{count}} úlohy", `_many` "{{count}} úlohy", `_other` "{{count}} úloh" |
| Error `duplicate` | A group with this name already exists | Skupina s týmto názvom už existuje |
| Error `reserved` | This name is reserved for a built-in tab | Tento názov je vyhradený pre vstavanú kartu |
| Error `too_long` | Name can be at most 40 characters | Názov môže mať najviac 40 znakov |
| Error `no_scope` | No project scope is selected. Choose one in Settings and try again. | Nie je vybraný rozsah projektu. Vyberte ho v Nastaveniach a skúste znova. |
| Error `internal` / unknown | Could not create the group. Try again. | Skupinu sa nepodarilo vytvoriť. Skúste to znova. |
| Pills | New / Not mine / Linked / Done | Nové / Nie moje / Prepojené / Hotové (reuse `nav.*` values for the first three) |
| Empty state heading | No issues in this group yet | V tejto skupine zatiaľ nie sú žiadne úlohy |
| Empty state body | Open an issue and use "Groups", or select issues in any list and choose "Add to group". | Otvorte úlohu a použite „Skupiny“, alebo vyberte úlohy v ľubovoľnom zozname a zvoľte „Pridať do skupiny“. |
| Destructive confirmation | none in this phase (delete is Phase 30) | - |

Phase 31 must verify the empty-state wording against the shipped control labels. Rust-originated error codes outside the list fall back to the `internal` copy.

---

## Interaction & Accessibility Notes

- No drag and drop; no hover-revealed controls. Every action has an always-visible labelled control (Restore, Create, Cancel) except the icon-only `＋` and scroll arrows, which carry tooltip + aria-label (explicit decision D-10, D-07).
- Color never the sole signal: the group is identified by name; the dot is decorative (`aria-hidden`). Pill text conveys triage state.
- Dot colors need non-text contrast >= 3:1 (verified in Phase 28). Muted count text on surface must be >= 4.5:1; `--color-brand-muted` (`#8c8c92` on white is about 3.3:1) FAILS AA for 12px text. Use `text-brand-text-secondary` for the member count and pill text instead, and keep `text-brand-muted` for inactive tab names only if matching the existing core tabs (consistency with existing tabs is accepted; flag for Phase 33 GQA-02).
- Focus: popover traps no focus beyond Radix defaults; Esc returns focus to `＋`. Selecting a tab keeps focus on that tab.
- Respect `prefers-reduced-motion` for scroll animation; transitions use the existing `duration-150`.
- Zustand: selectors for `groups`/`memberKeysByGroup` must not return `?? []`; use `null` fallback.
- If the active group disappears (scope change, rehydrate failure), fall back to the New tab silently.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | popover (new); existing tooltip, badge, button, scroll-area | not required |
| third-party | none | not applicable |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG (non-blocking)
- [x] Dimension 2 Visuals: FLAG (non-blocking)
- [x] Dimension 3 Color: PASS (count color contradiction resolved)
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS (tab gap contradiction resolved, 16px)
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-10-12
