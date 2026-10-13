---
status: complete
phase: quick-261013-e6u
plan: 01
commits: [c8ea834, 52292ba, 5919ab0]
---

# Quick 261013-e6u: Restyle group coloring and count badges

Replaced color dots with tinted chips and a group-colored active tab underline; member counts and the card "+N" overflow now render as a neutral CountPill.

## Changes
- `colors.ts`: new `groupColorStyle(token)` (sets `--group-color` via `groupColorVar`), D-07 comment rewritten; `index.css` comment updated (no variables changed).
- `CountPill.tsx`: `CountPill` and `countPillClass`; only text color differs between active and inactive, so tab width does not shift.
- `GroupTab.tsx`: no dot, `border-(--group-color)` active underline, `hover:bg-(--group-color)/8`, `px-1.5` on every tab, CountPill count.
- `GroupChip.tsx`: exported `groupChipClass` (12% tint, 45% border, `text-brand-text`); name-only label; tinted `CardGroupChip`.
- `GroupChips.tsx`: "+N" uses `countPillClass`; tooltip chips tinted.
- `DetailGroupsRow.tsx`, `GroupPicker.tsx`: tinted outer chip / name chip, dot removed (picker row not tinted, so the keyboard-active highlight stays visible).
- Tests updated: colors (groupColorStyle, tint contrast 4.5:1 dark), GroupTabStrip, GroupTabStripOverlays, GroupChips, a11y.axe.

## Deviations
None. Discretion choice: inactive tabs have no at-rest underline hint.

## Verification
- `vitest run src/features/groups src/features/tickets`: 72 files, 1163 tests passed
- `tsc --noEmit`: clean; biome clean; pre-commit hooks (biome, cargo, tests) passed on all three commits
- No non-swatch .tsx calls `groupColorVar(` directly
- Manual light/dark/WebView2 visual check left to milestone UAT

## Self-Check: PASSED
