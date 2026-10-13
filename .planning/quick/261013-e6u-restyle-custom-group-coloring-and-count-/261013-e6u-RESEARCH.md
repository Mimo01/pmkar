# Quick Task 261013-e6u: Restyle group coloring and count badges - Research

**Researched:** 2026-10-13
**Domain:** Tailwind v4 styling with CSS custom properties, React inline styles, jsdom tests
**Confidence:** HIGH (all key claims verified in this session by compiling Tailwind classes, running jsdom, and computing contrast)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Group coloring (replaces dots)**
- Chips (ticket cards, overflow tooltip, detail groups row if it uses GroupChipLabel) and picker option rows: soft tint of the group color as background (~12% via `color-mix(in srgb, var(--color-group-x) 12%, transparent)` or similar) with a slightly stronger border in the group color (~35–45%). Text stays neutral (brand-text / brand-text-secondary), no colored text.
- Group tabs: the ACTIVE tab underline uses the group's color instead of `border-brand`. Hover shows a faint tint of the group color.
- Color dots are removed from tabs, chips and picker rows.
- This deliberately OVERRIDES Phase 28 decision D-07 ("color shown as an 8px dot, never as a tinted background"). Update the D-07 doc comment in `src/features/groups/colors.ts` to describe the new rule. Keep neutral text so text contrast is unaffected; the colored border/underline must stay visible in both light and dark themes.

**Count style**
- Group tab member count: neutral rounded counter pill (rounded-md or rounded-full, small horizontal padding, subtle neutral background such as `bg-brand-surface-hover`/border-subtle token, `tabular-nums`, `text-xs`). Slightly stronger (darker text / bg) when the tab is active. Not group-tinted.
- Keep the existing `aria-label` (`groups.tab.aria` with count). The counter stays visual only, consistent with current a11y.

**Overflow "+N"**
- The card "+N more" overflow trigger on ticket cards matches the new counter pill style (e.g. renders "+2" as a pill). Keep its aria-label (`groups.chip.moreAria`) and tooltip behaviour.

### Claude's Discretion
- Whether inactive tabs show any at-rest color hint (e.g. a faint group-colored underline) so tabs stay distinguishable by color without hovering. Planner/executor decides; prefer subtle.
- Exact tint/border percentages, provided both themes look good and nothing reads as a disabled state.
- Whether to extract a small shared helper (e.g. `groupTintStyle(token)` in colors.ts) and/or a `CountPill` component. Encouraged, to avoid duplicated inline styles.
- Tab layout must not shift width between active/inactive (the existing invisible-bold trick for the name must be preserved).

### Deferred Ideas (OUT OF SCOPE)
- `GroupColorSwatches.tsx` (swatches stay circular), palette tokens/hex values, core nav tabs in `AppShell.tsx`.
</user_constraints>

## Project Constraints

No `./CLAUDE.md` exists in the repo root. Memory rules that apply: no drag and drop; Zustand selectors must not return `?? []` (no selector changes are needed here).

## Summary

There are 5 render sites, and none has a hidden consumer: GroupTab (dot and count), GroupChipLabel (dot), CardGroupChip (bordered wrapper), DetailGroupsRow (its own bordered wrapper `<span>` around GroupChipLabel and an X button), and the GroupPicker option row (dot). The "+N" trigger lives in GroupChips. Only GroupColorSwatches uses `groupColorVar` and stays as it is.

**Primary recommendation:** Expose the group color as one CSS custom property on the container, `style={{ '--group-color': groupColorVar(token) }}`, then style it with Tailwind v4 classes such as `bg-(--group-color)/12`, `border-(--group-color)/45` and `hover:bg-(--group-color)/8`. This is the only approach that supports `hover:` states, which inline styles cannot do. It also keeps the "never interpolate raw strings" rule, because the value still comes from `groupColorVar`. Make GroupChipLabel name-only and move the tint onto the chip containers.

## Inventory of render sites

| File:line | Current | Change |
|---|---|---|
| `src/features/groups/GroupTab.tsx:85-87` | wrapper `border-b-2` + `border-brand` / `border-transparent` | active: `border-(--group-color)`. Inactive: keep `border-transparent` (or a faint at-rest hint, see discretion note below). Set `--group-color` on the wrapper div |
| `GroupTab.tsx:101-105` | 2x2 dot span `style={{backgroundColor}}` | remove |
| `GroupTab.tsx:115` | `<span className="text-xs text-brand-text-secondary">{memberCount}</span>` | CountPill (aria-hidden is optional; the button already has aria-label) |
| `src/features/groups/GroupChip.tsx:12-17` (GroupChipLabel) | dot + name with tooltip | remove dot, keep tooltip + `max-w-[160px] truncate` name |
| `GroupChip.tsx:37` (CardGroupChip) | `border border-brand-border-subtle text-brand-text-secondary` | tint bg + group border, `text-brand-text`, keep `relative z-10` |
| `src/features/groups/DetailGroupsRow.tsx:80-83` | outer `<span>` with `border-brand-border-subtle`, wraps GroupChipLabel + remove X | apply the same tint/border here (the container is this span, not GroupChipLabel) |
| `src/features/groups/GroupChips.tsx:44-46` | overflow tooltip lists bare `GroupChipLabel`s | wrap each in a tinted chip span (non-interactive) so the tooltip matches the cards |
| `GroupChips.tsx:30-39` | "+N" plain `text-xs` button | CountPill styling on the button; keep `relative z-10`, aria-label, stopPropagation |
| `src/features/groups/GroupPicker.tsx:384-388` | dot in option row | remove; see the picker pitfall below |
| `src/features/groups/colors.ts:8-10` + `src/index.css:47-48` comment | D-07 text | rewrite both comments (the CSS comment also says "dot color only, never tinted backgrounds") |

`memberCount` is also used in `GroupTabStrip.tsx:294` and `DeleteGroupDialog.tsx`, but those are data uses, not rendering, so they are out of scope.

## Tailwind v4 findings (verified by compiling with `@tailwindcss/node` 4.2.2)

- `bg-(--group-color)/12` compiles to `background-color: var(--group-color)` with `@supports (color: color-mix(in lab, red, red)) { background-color: color-mix(in oklab, var(--group-color) 12%, transparent) }`. The same pattern applies to `border-(--group-color)/45`. `border-b-(--group-color)` gives a solid `border-bottom-color`. `hover:` variants are wrapped in `@media (hover: hover)`. [VERIFIED: local compile]
- Arbitrary `bg-[color-mix(in_srgb,var(--group-color)_12%,transparent)]` also works but is noisier. Prefer the `/NN` modifier, which the codebase already uses heavily (`bg-brand/8`, `border-brand/40`, ...). [VERIFIED: grep]
- **Fallback pitfall:** without color-mix support, Tailwind's fallback is the solid color. Tailwind v4 already needs Safari 16.4+/Chrome 111+, and the app already depends on color-mix through every `bg-brand/8`, so this adds no new requirement. [VERIFIED: compiled output; browser baseline ASSUMED from Tailwind v4 docs]
- Tauri webviews: WKWebView follows system Safari (macOS 13.3+/Safari 16.4+ supports color-mix), and WebView2 is evergreen Chromium. `tauri.conf.json` sets no `minimumSystemVersion`. [ASSUMED for exact OS floor]
- `--color-group-*` live in plain `:root` and `body.dark` (index.css:49-58, 106-114), not in `@theme`. Do NOT add new group vars to those blocks: `colors.test.ts` asserts exactly 8 `--color-group-*` declarations per block and 0 in `@theme`. Put `--group-color` only in inline style, so no CSS changes are needed besides the comment.
- React supports custom properties in `style` (needs a cast: `{ '--group-color': groupColorVar(t) } as React.CSSProperties`). jsdom 29 preserves both `color-mix(... var(...))` and `--group-color: var(--color-group-blue)` in the style attribute. [VERIFIED: ran jsdom]

**Suggested helper (colors.ts):**
```ts
export function groupColorStyle(token: GroupColorToken): React.CSSProperties {
  return { '--group-color': groupColorVar(token) } as React.CSSProperties;
}
```
Also a `CountPill` (e.g. `src/features/groups/CountPill.tsx`) with base classes like `inline-flex items-center h-4 min-w-4 justify-center px-1.5 rounded-full text-xs font-medium tabular-nums leading-none`. Inactive: `bg-brand-surface-hover text-brand-text-secondary`. Active: `bg-brand-surface-raised text-brand-text`.

## Neutral tokens and contrast (computed in session from index.css hex values)

| Token | Light | Dark |
|---|---|---|
| brand-surface (tab strip + cards) | #ffffff | #1e1e20 |
| brand-surface-hover | #f0f0f2 | #28282a |
| brand-surface-raised | #eaeaec | #1a1a1c (darker than the surface in dark mode, so it does NOT look "stronger") |
| brand-border-subtle | #ebebed | #252527 |
| brand-text / text-secondary | #231f20 / #5c585a | #e4e4e6 / #95959a |

- Pill text-secondary on surface-hover: 6.15:1 light, 4.94:1 dark (passes AA). text-brand on surface-hover: 14.3 / 11.6.
- **For the "stronger when active" pill, do not use `bg-brand-surface-raised` in dark mode**, because it is darker than the surface. Use the same `bg-brand-surface-hover` and switch the text to `text-brand-text`, or add `border border-brand-border` on the active pill. Changing only text color avoids any width shift.
- **Chip text must be `text-brand-text`, not text-secondary.** In dark mode, text-secondary (#95959a) on a 12% tint over the card hover background (#28282a) drops to **3.78:1** at worst (amber/green), which fails AA for `text-xs`. Even 8% gives 4.15. `text-brand-text` stays at 8.9:1 or higher on every tint. In light mode text-secondary is 5.18 or higher and is fine. A per-theme switch is unnecessary; use `text-brand-text` throughout.
- Tint vs surface is only ~1.15-1.44:1, so the tint alone barely shows. The **border carries the color identity**: at 45% it reaches 1.7-2.1 light and 2.3-3.1 dark. Recommend `/12` bg + `/45` border (or `/50` if light teal/green look washed out). The active tab underline should be the solid `--group-color`, which reaches 3:1 or more by the existing palette contrast test.

## Pitfalls

1. **Width shift on active tabs.** The `<button>` gets `font-semibold` when active, and the count span currently inherits it, so digit widths change. Give CountPill an explicit `font-medium tabular-nums` so it does not inherit. Keep the pill's padding, border width and weight identical across states. Change only colors. Keep the invisible-bold name grid as it is.
2. **Tab hover tint placement.** The button has `py-2` and no horizontal padding, so a bg tint on the button hugs the text and ends abruptly before the `…` button. Put `hover:bg-(--group-color)/8` (and `rounded-t`) on the wrapper div, which contains both the tab button and `…`, or add `px-1.5` to the wrapper. If you add padding, apply it to every tab so widths stay constant across states.
3. **Inactive at-rest hint (discretion).** If inactive tabs get a faint underline such as `border-(--group-color)/30`, the test `GroupTabStrip.test.tsx:518` (`toContain('border-transparent')`) breaks and must be updated. Simplest option: keep inactive transparent and show only the hover tint.
4. **Focus rings.** Tab buttons use `ring-offset-2`. The offset ring paints the default offset color, white unless overridden. This problem already exists and the tint does not make it worse, but avoid adding `overflow-hidden` to the tinted wrapper or the ring gets clipped. Chips use `outline-2 outline-focus-ring`, which tints do not affect.
5. **Card overlay.** CardGroupChip and "+N" rely on `relative z-10` to sit above TicketCard's full-card click overlay. Keep `relative z-10` on both and keep `e.stopPropagation()`. TicketCard rows have `hover:bg-brand-surface-hover`, and the chip tint is transparent-based, so it composites over that. The contrast figures above already account for this.
6. **Picker active row.** Option rows show the active state with `bg-brand-surface-hover`. A full-row group tint would hide that keyboard-highlight signal. Recommendation: in the picker, do not tint the whole row. Wrap the name in a small tinted chip (`inline-flex px-1.5 rounded border` + tint) inside the row, so the row highlight still works. This is a "chip" treatment and fits the decision ("picker option rows: soft tint"). Alternatively, tint the row and switch the active row to a stronger tint (`/20`) plus `ring-1 ring-(--group-color)/60`, though that path needs more care.
7. **Detail row structure.** The tint has to go on DetailGroupsRow's outer `<span>`, not inside GroupChipLabel. Otherwise the X button sits outside the colored area.
8. **Tooltip chips.** TooltipContent uses `bg-popover` (= surface), so the tinted chips in the overflow tooltip look the same as on cards. They are non-interactive, so use a `<span>` and not a button.

## Tests that must be updated (keep the coverage, change the assertions)

| Test | Current assertion | Update to |
|---|---|---|
| `__tests__/GroupTabStrip.test.tsx:130` | dot `style.backgroundColor === 'var(--color-group-blue)'` | wrapper `style.getPropertyValue('--group-color') === 'var(--color-group-blue)'`; count pill `toHaveTextContent('3')` + `tabular-nums` |
| `GroupTabStrip.test.tsx:139` | active wrapper className contains `border-brand` | contains `border-(--group-color)` (note `'border-brand'` would also substring-match `border-brand-border`, so use an exact class check) |
| `GroupTabStrip.test.tsx:518` | inactive wrapper has `border-transparent` | still valid if inactive stays transparent |
| `__tests__/GroupTabStripOverlays.test.tsx:249-250` | "Change color updates the dot" via first `span[aria-hidden]` in the tab button | read `--group-color` from `tabButton('QA').parentElement` and expect `--color-group-purple`; rename the test |
| `__tests__/GroupChips.test.tsx:141-147` | dot `style.backgroundColor === groupColorVar('green')` | chip button `style.getPropertyValue('--group-color') === groupColorVar('green')`, plus a class check for `bg-(--group-color)/12` |
| `GroupChips.test.tsx:54` | "+2" text | still valid; optionally assert the pill classes |
| `__tests__/a11y.axe.test.tsx:340-385` (3 tests) | `[style*="background-color"]` elements must be aria-hidden | after the change no element matches, so these pass vacuously. Rewrite them to assert that no `[style*="background-color"]` dots remain and that elements with `[style*="--group-color"]` carry the group name in their accessible name/text (color is never the only signal). axe `color-contrast` is disabled in this file (jsdom), so contrast stays a manual/UAT check |
| `__tests__/colors.test.ts` | parity (8 vars per block, 0 in @theme), contrast >= 3:1, `groupColorVar` | unchanged if no CSS vars are added. Add a test for `groupColorStyle` if the helper is created. Optionally add a dark-mode tint contrast test using the existing `mix()` helper in `src/test-utils/contrast.ts` (text-brand-text on `mix(dark, '#28282a', 0.12)` >= 4.5) |
| `GroupChips.test.tsx:137`, `GroupTabStrip.test.tsx:159-162` | name `max-w-[160px] truncate` | keep that markup and these still pass |

GroupPicker.test.tsx, DetailGroupsRow.test.tsx and TicketCard.test.tsx have no dot or color assertions, so they need no changes (checked by grep).

## Validation Architecture

| Property | Value |
|---|---|
| Framework | Vitest 4.1 + jsdom 29 + Testing Library |
| Quick run | `npx vitest run src/features/groups` |
| Full suite | `npm test` (vitest run) |

Automated tests cover structure (custom property present, classes present, dots gone, aria labels unchanged, "+N" behavior). Visual quality in both themes (tint visibility, underline, no width jump) needs a manual check in the Tauri app on light and dark, including WebView2.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Supported macOS WKWebView versions all have color-mix (Safari 16.2+) | Low. The app already depends on it through `bg-brand/8` |
| A2 | oklab mixing (Tailwind `/NN`) looks close enough to the srgb figures used for contrast math | Low. The differences are small at 8-12% |

## Sources
- Local Tailwind 4.2.2 compile of the candidate classes (`@tailwindcss/node`), local jsdom 29.0.1 style round-trip, contrast computed from `src/index.css` hex values
- Codebase grep of `src/features/groups/**`, `src/features/tickets/TicketCard.tsx`, `src/components/ui/tooltip.tsx`, `src/test-utils/contrast.ts`
