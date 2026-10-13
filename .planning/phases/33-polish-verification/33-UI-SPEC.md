---
phase: 33
slug: polish-verification
status: approved
reviewed_at: 2026-10-12
shadcn_initialized: true
preset: existing (style default, baseColor neutral, cssVariables, lucide)
created: 2026-10-12
---

# Phase 33 — UI Design Contract

> Scope: audit, harden and fix. No new capabilities and no new screens. This contract defines the cross-cutting rules (copy, quotes, plurals, contrast thresholds, keyboard and focus, 25-group overflow) that every v0.5.0 group surface must meet, and the only visual changes this phase may make. Inherits tokens, spacing and typography unchanged from `29-UI-SPEC.md`, `30-UI-SPEC.md`, `31-UI-SPEC.md`. Sources: 33-CONTEXT.md (D-01..D-17), REQUIREMENTS.md (GQA-01, GQA-02), `components.json`, `src/index.css`, project memory (explicit labelled actions, no drag and drop, Zustand null fallback).

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (existing `components.json`, no re-init) |
| Preset | existing: style `default`, baseColor `neutral`, CSS variables, Tailwind v4 via `src/index.css` |
| Component library | radix (Popover, Tooltip, Dialog/AlertDialog, DropdownMenu as already used). No new UI dependency |
| Icon library | lucide (existing `ChevronLeft`, `ChevronRight` for tab-strip scroll arrows) |
| Font | existing app default (do not change) |
| Dev-only additions | `vitest-axe` (or `axe-core` direct) as devDependency. Test tooling only, no runtime or registry impact |

---

## Spacing Scale

No new spacing. Declared values (multiples of 4), all inherited:

| Token | Value | Usage in this phase |
|-------|-------|---------------------|
| xs | 4px | Chip and tab inner gaps (unchanged) |
| sm | 8px | Scroll-arrow to strip gap, bar item gap (unchanged) |
| md | 16px | Popover padding, bar padding (unchanged) |
| lg | 24px | Scroll-arrow button hit area (see exception) |
| xl | 32px | Bar offset (unchanged) |
| 2xl | 48px | Selection bar height (unchanged) |
| 3xl | 64px | not used |

Exceptions:
- Tab name max width stays fixed at 160px (D-10). No adaptive shrinking.
- Tab-strip scroll arrows: 24px square hit area minimum (lucide 16px icon), fades 24px wide. If the existing arrows are smaller, raise to 24px. Core tabs (All, Ungrouped or equivalent fixed tabs) must not shift when arrows appear or disappear: arrows overlay the scroll viewport edges, they do not consume layout width.
- Picker list stays `max-h-60` (240px), row height 32px (D-12).
- Focus ring offset and width unchanged (`focus-visible:ring-brand`).

---

## Typography

No new sizes or weights (3 sizes, 2 weights, inherited).

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body (menus, picker rows, bar, hints, toasts) | 14px | 400 | 1.5 |
| Label (chips, counts, "+N", inline errors, missing hint) | 12px | 400 | 1.5 |
| Heading (dialog titles, 16px) | 16px | 600 | 1.2 |
| Display | not used | - | - |

Weights: 400 and 600 only. Slovak strings are typically 10-30% longer than English: no new fixed widths may be introduced for text containers; buttons and popovers must wrap or grow rather than clip. Verify the Slovak pass in UAT for the 280px popovers and the 560px bar.

---

## Color

No new palette colors. Token-level contrast is asserted in tests in both themes (D-04).

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--color-brand-bg` `#f7f7f8` / `#161617` | Page and list background |
| Secondary (30%) | `--color-brand-surface` `#ffffff` / `#1e1e20` | Cards, popovers, bar |
| Accent (10%) | `--color-brand` `#c02232` | See reserved list (unchanged) |
| Destructive | `--color-destructive` `#dc2626` | Delete group, Remove, Remove all missing, inline errors |

Accent reserved for: keyboard focus ring on every group control, checked checkbox fill, selected-card marker, pressed Select toggle. Nothing added by this phase.

### Contrast contract (asserted by tests, WCAG 2.x relative luminance, both themes)

| Element | Foreground / background | Threshold | Notes |
|---------|-------------------------|-----------|-------|
| Group color dots (chips, tabs, picker, swatches) | `--color-group-*` on surface and on bg | >= 3:1 non-text | Existing `colors.ts` tests, keep |
| Chip neutral text | `--color-brand-text-secondary` on card surface | >= 4.5:1 | Never `--color-brand-muted` at 12px |
| Missing hint text ("No longer in results") | `--color-brand-text-secondary` on card surface | >= 4.5:1 | Must NOT use `text-brand-muted`: `#8c8c92` on `#ffffff` is about 3.3:1 and dark `#7f7f7f` on `#1e1e20` is about 4.1:1, both fail. Fix token use, not the muted token (shared with older screens) |
| Missing "Remove" button and "Remove all missing" | Destructive text/outline on surface, undimmed | >= 4.5:1 text | If `#dc2626` on dark surface `#1e1e20` fails (about 4.0:1), use a dark-mode destructive text token (for example `#f87171`) scoped to these controls, and assert it |
| Dimmed missing-card content | Summary only at `opacity-70` (brand-text), composited over card surface | Summary composited >= 4.5:1 in both themes on surface, bg and surface-hover. Key, dates and metadata are undimmed `text-brand-text-secondary` (>= 4.5:1). Superseded the earlier 3:1 exemption via gap closure 33-11 (WR-02) | `opacity-70` on the summary paragraph only. The hint line and Remove button sit OUTSIDE the dimmed element at full contrast. contrast.test.ts derives the opacity from TicketCard.tsx and asserts >= 4.5 composited |
| Focus ring | `--color-brand` on surface | >= 3:1 | Assert in both themes; if dark fails, use `--color-brand-light` for ring in dark |
| Tab text (active and inactive) | `--color-brand-text` / `--color-brand-text-secondary` on bg | >= 4.5:1 | |

Color is never the sole signal: every dot is paired with a name; missing state is paired with text hint; selected state is paired with a checked checkbox and `aria-checked`; destructive actions are paired with text labels.

---

## Interaction Contract (keyboard and focus)

All behavior below already exists or was decided in Phases 29-32. This phase verifies it with explicit tests and fixes gaps.

| Surface | Contract |
|---------|----------|
| Tab strip | Roving tabindex (`tabIndex` 0 on active, -1 on others). Left/Right move focus, Home/End jump, wrap off. Tab leaves the strip. Active tab scrolls into view on switch and on Move left/right |
| Tab `…` menu | Enter/Space/ArrowDown opens. Esc closes and returns focus to the `…` trigger. Move left/right are explicit menu items (no drag and drop, ever). Move announces via the existing `role="status"` live region |
| Rename, Color, Delete overlays | Esc closes and returns focus to the `…` trigger (or the tab if trigger unmounted) per Phase 30 D-05/D-08/D-14. Delete is an alertdialog with Cancel focused by default |
| Create popover | Esc closes, focus returns to the create trigger. Inline validation errors `role="alert"` |
| Picker (detail and bar mode) | Search autofocused. Up/Down move active row; the active row MUST be scrolled into view (`scrollIntoView({ block: 'nearest' })`, honor reduced motion). Space/Enter toggles or chooses. Esc closes and returns focus to the trigger. Combobox/listbox semantics per Phase 31 |
| Chips | Name button and `×` button are separate focusable buttons. Enter and Space activate. Remove confirm: Cancel initial focus; Esc returns to `×`; after Remove, focus goes to the Groups button |
| Select mode and bar | Select toggle `aria-pressed`. Esc inside list area or bar exits select mode and returns focus to the toggle. Shift+Space (or Shift+Enter) on a focused card checkbox selects the range from the anchor, same as shift-click. Bar controls reachable in DOM order after the list |
| Confirm popovers | Cancel initial focus, Esc returns focus to trigger |
| Missing block | "Remove" and "Remove all missing" are visible labelled buttons (never hover-revealed) |

Scroll arrows (D-09, Claude's discretion resolved):
- Shown only while the strip overflows. At a scroll end the corresponding arrow is hidden (not disabled), and its fade is hidden too, so no dead control is focusable. If an arrow has focus when it reaches its end, move focus to the opposite arrow (which is visible because the strip still overflows). Only when the strip no longer overflows at all, move focus to the active tab with preventScroll. Focus must never land on a tab clipped by the scroller (WCAG 2.4.7).
- Scroll step: 80% of the strip viewport width (replaces fixed 200px), `behavior: 'auto'` under `prefers-reduced-motion`.
- Arrows are `<button type="button">` with `aria-label` from `groups.scrollLeft` / `groups.scrollRight`, in tab order, `tabIndex` default (0), and are NOT part of the roving tabindex group.
- Arrows and fades are `pointer-events` safe: fades `pointer-events-none`.

25-group behavior (D-11): 25 groups with mixed lengths (including 40-character and diacritic names) render with core tabs fixed, overflow arrows correct at both ends, active tab in view, names truncated at 160px with full-name Tooltip (the tab `aria-label` carries the full name and count), picker list scrolling with search filtering, card chips capped at 2 plus "+N".

---

## Copywriting Contract

Phase 33 introduces no new feature copy. It normalises existing `groups.*` copy in EN and SK.

| Element | Copy |
|---------|------|
| Primary CTA | none new (phase adds no CTA). Existing "Create group" / „Vytvoriť skupinu“ unchanged |
| Empty state heading | unchanged from Phases 29-32 (verify translated in SK) |
| Empty state body | unchanged. Must include next step in both locales |
| Error state | unchanged `groups.error.*`: problem plus next step, verified present in both locales |
| Destructive confirmation | Delete group: existing alertdialog copy, with normalised quotes (“{{name}}” EN, „{{name}}“ SK). Remove from group and Remove all missing: existing confirm popover copy, normalised |

### Quote style (D-13)

| Locale | Wrapper around interpolated `{{name}}`, `{{key}}`, `{{query}}` |
|--------|------------------------------------------------------------------|
| EN | curly double quotes: “{{name}}” (U+201C, U+201D) |
| SK | Slovak low-high quotes: „{{name}}“ (U+201E, U+201C) |

Single curly quotes (‘ ’) around interpolations are forbidden in both locales (test enforced). Apostrophes inside ordinary words are fine.

### Slovak plural contract (D-16, D-17)

- Every count-bearing `groups.*` key has `_one`, `_few`, `_many`, `_other` in SK, and `_one`, `_other` in EN.
- SK `_many` must be identical to SK `_other` (genitive plural: „úloh“, „skupín“, „vybraných“). Test enforced across all `groups.*` keys.
- Zero counts use dedicated keys, not `zero` plural category.
- Examples to satisfy the 1 / 2-4 / 5+ UAT pass: 1 úloha, 2 úlohy, 5 úloh; 1 skupina, 2 skupiny, 5 skupín; 1 vybraná, 2 vybrané, 5 vybraných.

### Locked SK glossary (D-15)

| EN | SK |
|----|----|
| issue | úloha |
| group | skupina |
| tab | karta |
| select / selection | vybrať / výber |
| remove (from a group) | odstrániť zo skupiny |
| delete (a group) | odstrániť skupinu |
| missing | „Už nie je / nie sú vo výsledkoch“; button „Odstrániť všetky chýbajúce“ |
| create | vytvoriť |
| rename | premenovať |
| color | farba |

Known fix: `groups.picker.announceRemoved` SK becomes `Odstránené zo skupiny „{{name}}“` (adds "skupiny", uses the SK quote pair).

### Untranslated-string rule (D-02)

No literal user-facing string in JSX text, `aria-label`, `title`, `placeholder`, or `alt` within group UI. Allowlist: `+`, `…`, `×`, `/`, `·`, digits-only, and i18n key format strings. Every referenced `groups.*` key exists in both locale files and is non-empty.

---

## Component Contract (changes allowed in this phase)

Only these visual or structural changes are in scope; everything else is verify-only.

1. `GroupTabStrip`: arrow hide-at-ends, 80% viewport scroll step, focus handoff when an arrow disappears, 24px arrow hit areas, fades non-interactive.
2. `GroupPicker`: scroll focused/active row into view on keyboard navigation.
3. Missing-state: move hint and Remove controls outside the dimmed wrapper, switch hint text to `text-brand-text-secondary`, set dimming to `opacity-70`.
4. Locale files: quote normalisation, `_many` alignment, `announceRemoved` fix, and any missing SK/EN keys found by the audit.
5. Any axe violation found in the key states listed in 33-CONTEXT D-01 is fixed in the component (accessible names, roles, label association, aria attributes). `color-contrast` rule is disabled in jsdom axe runs because jsdom cannot compute it; contrast is covered by the token tests above.

Accessible-name requirements verified by axe plus explicit role/name assertions: tab (`role="tab"`, name = group name plus count), tablist, menu items, alertdialog (labelled and described), checkbox rows, listbox/option, status live regions, scroll arrow buttons, chip buttons ("Go to group …", "Remove from …"), selection bar (labelled region or toolbar).

Out of scope for fixes (log in deferred): a11y or i18n gaps in non-group screens.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none new (existing Popover, Tooltip, Button, Dialog, AlertDialog, DropdownMenu only) | not required |
| Third-party | none | not applicable |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG
- [x] Dimension 2 Visuals: FLAG
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-10-12 (2 non-blocking FLAGs: copywriting references prior specs; no declared focal point)
