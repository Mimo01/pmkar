---
task: quick-261013-e6u
verified: 2026-10-13
status: human_needed
score: 6/6 must-haves verified (code); visual check pending
human_verification:
  - test: "Open the Tauri app (WebView2) in light and dark theme with several groups"
    expected: "Chips show a visible tint and border in the group color; the active tab underline is the group color; hover tints a tab; no tab width jump when switching tabs; the '+N' pill matches the tab count pills"
    why_human: "Rendered appearance, contrast feel and tint visibility cannot be checked with grep or jsdom"
---

# Quick 261013-e6u Verification

**Goal:** Replace color dots with tinted chips and a group-colored tab underline. Make member counts a neutral counter pill, and make the "+N" overflow match.

## Must-have truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | No color dot on tabs, card chips, tooltip chips, detail chips or picker rows | VERIFIED | `GroupTab.tsx`, `GroupChip.tsx` (`GroupChipLabel` is name only), `GroupPicker.tsx` and `DetailGroupsRow.tsx` have no dot span. `groupColorVar(` is called in only one non-test .tsx file, `GroupColorSwatches.tsx:94`. |
| 2 | Chips and picker names have a 12% tint, 45% border and neutral `text-brand-text` | VERIFIED | `groupChipClass` in `GroupChip.tsx` is `border border-(--group-color)/45 bg-(--group-color)/12 text-brand-text`. Used in `CardGroupChip`, the overflow tooltip chips in `GroupChips.tsx`, `DetailGroupsRow.tsx` (line 84) and `GroupPicker.tsx` (line 387). Each sets `groupColorStyle`. |
| 3 | Active tab underline is the group color and hover shows a faint tint | VERIFIED | `GroupTab.tsx` wrapper has `hover:bg-(--group-color)/8`, `border-(--group-color)` when active and `border-transparent` otherwise, plus `style={groupColorStyle(...)}`. |
| 4 | Tab count is a neutral pill with no width shift | VERIFIED | `CountPill.tsx` has `rounded-full tabular-nums bg-brand-surface-hover font-medium`. Only the text color differs by state. `GroupTab` applies `px-1.5` to all tabs and keeps the invisible-bold name grid. |
| 5 | "+N" uses the same pill and keeps its aria-label and tooltip | VERIFIED | `GroupChips.tsx` button uses `countPillClass()`, `groups.chip.moreAria` and `stopPropagation`, and keeps the Tooltip. |
| 6 | Swatches, palette hex values and AppShell unchanged | VERIFIED | `git diff c8ea834~1..HEAD` shows no changes under `src/components` or `GroupColorSwatches.tsx`. The only `index.css` change is one comment line, and the `GROUP_COLOR_HEX` values are untouched. |

## Artifacts and wiring

- `colors.ts` exports `groupColorStyle`, which returns `{'--group-color': groupColorVar(token)}`. The D-07 comment is rewritten.
- `CountPill.tsx` exports `CountPill` and `countPillClass`.
- `groupColorStyle` is used in all 5 consumers. `CountPill` is used in `GroupTab` and `countPillClass` in `GroupChips`.
- The literal `border-(--group-color)` and `bg-(--group-color)/12` strings required by the plan are present.

## Behavioral checks

- `npx vitest run src/features/groups src/features/tickets`: 72 files and 1163 tests passed.
- `npx tsc --noEmit -p .`: clean (no output).
- `npx biome check src/features/groups`: clean.

## Notes

- The `GroupTabStrip.tsx` diff in the 4-commit range comes from the earlier fix 7f5f380 (WR-01), not from this task. It is not scope creep.
- No TBD, FIXME or XXX markers were found in the files this task touched.

## Gaps

None in code. Visual verification (see frontmatter) is the only open item. It is deferred to milestone-end UAT, per the plan and the user's preference.
