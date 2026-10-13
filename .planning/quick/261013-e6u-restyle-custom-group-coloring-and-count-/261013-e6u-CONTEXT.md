# Quick Task 261013-e6u: Restyle custom group coloring and count badges - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Task Boundary

Make the v0.5.0 custom-group UI nicer. Replace the 8px color dots with a different coloring treatment, and restyle the member-count indicators (keep the counts, change their look).

In scope (current dot / count usages):
- `src/features/groups/GroupTab.tsx`: dot before the tab name, plain `text-xs` member count
- `src/features/groups/GroupChip.tsx`: `GroupChipLabel` dot + `CardGroupChip` bordered chip on ticket cards (also used in the overflow tooltip)
- `src/features/groups/GroupPicker.tsx`: dot in each option row
- `src/features/groups/GroupChips.tsx`: "+N more" overflow trigger on cards
- Any other place rendering `groupColorVar(...)` as a dot (grep it), EXCEPT the color chooser itself

Out of scope: `GroupColorSwatches.tsx` (the swatches ARE the color picker and stay circular), the palette tokens/hex values, core nav tabs in `AppShell.tsx` (no behaviour change there).

</domain>

<decisions>
## Implementation Decisions

### Group coloring (replaces dots)
- Chips (ticket cards, overflow tooltip, detail groups row if it uses GroupChipLabel) and picker option rows: soft tint of the group color as background (~12% via `color-mix(in srgb, var(--color-group-x) 12%, transparent)` or similar) with a slightly stronger border in the group color (~35–45%). Text stays neutral (brand-text / brand-text-secondary) — no colored text.
- Group tabs: the ACTIVE tab underline uses the group's color instead of `border-brand`. Hover shows a faint tint of the group color.
- Color dots are removed from tabs, chips and picker rows.
- This deliberately OVERRIDES Phase 28 decision D-07 ("color shown as an 8px dot, never as a tinted background"). Update the D-07 doc comment in `src/features/groups/colors.ts` to describe the new rule. Keep neutral text so text contrast is unaffected; the colored border/underline must stay visible in both light and dark themes.

### Count style
- Group tab member count: neutral rounded counter pill (rounded-md or rounded-full, small horizontal padding, subtle neutral background such as `bg-brand-surface-hover`/border-subtle token, `tabular-nums`, `text-xs`). Slightly stronger (darker text / bg) when the tab is active. Not group-tinted.
- Keep the existing `aria-label` (`groups.tab.aria` with count) — the counter remains visual only / consistent with current a11y.

### Overflow "+N"
- The card "+N more" overflow trigger on ticket cards matches the new counter pill style (e.g. renders "+2" as a pill). Keep its aria-label (`groups.chip.moreAria`) and tooltip behaviour.

### Claude's Discretion
- Whether inactive tabs show any at-rest color hint (e.g. a faint group-colored underline) so tabs remain distinguishable by color without hovering — planner/executor decides; prefer subtle.
- Exact tint/border percentages, provided both themes look good and nothing reads as a disabled state.
- Whether to extract a small shared helper (e.g. `groupTintStyle(token)` in colors.ts) and/or a `CountPill` component — encouraged to avoid duplicated inline styles.
- Tab layout must not shift width between active/inactive (existing invisible-bold trick for the name must be preserved).

</decisions>

<specifics>
## Specific Ideas

- Reference look: Linear/GitHub tab counters (neutral pill) and soft tinted label chips.
- Project rules from memory: no drag & drop; Zustand selectors must not return `?? []`.
- Existing tests in `src/features/groups/__tests__/` may assert on dots/count markup — update them to the new markup rather than deleting coverage.

</specifics>

<canonical_refs>
## Canonical References

- `src/features/groups/colors.ts` (D-05..D-08 palette doc; D-07 being overridden)
- `src/index.css` lines ~51-58 and ~106-113 (`--color-group-*` light/dark variables)

</canonical_refs>
