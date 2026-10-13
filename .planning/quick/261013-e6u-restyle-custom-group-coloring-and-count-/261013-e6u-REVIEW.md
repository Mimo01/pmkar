---
phase: 261013-e6u
reviewed: 2026-10-13T00:00:00Z
depth: quick
files_reviewed: 13
files_reviewed_list:
  - src/features/groups/CountPill.tsx
  - src/features/groups/DetailGroupsRow.tsx
  - src/features/groups/GroupChip.tsx
  - src/features/groups/GroupChips.tsx
  - src/features/groups/GroupPicker.tsx
  - src/features/groups/GroupTab.tsx
  - src/features/groups/__tests__/GroupChips.test.tsx
  - src/features/groups/__tests__/GroupTabStrip.test.tsx
  - src/features/groups/__tests__/GroupTabStripOverlays.test.tsx
  - src/features/groups/__tests__/a11y.axe.test.tsx
  - src/features/groups/__tests__/colors.test.ts
  - src/features/groups/colors.ts
  - src/index.css
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Quick Task 261013-e6u: Code Review Report

**Depth:** quick (pattern scan plus diff read). No hardcoded secrets, dangerous functions, debug artifacts or empty catches were found. The tests were not examined in depth.

## Warnings

### WR-01: Tinted chip rendered inside TooltipContent may have unverified contrast

**File:** `src/features/groups/GroupChips.tsx:~46-52`
**Issue:** The overflow chips use `text-brand-text` (via `groupChipClass`) on a 12% tint. They sit inside `TooltipContent`, which usually has its own (often inverted) background. Neutral text on that surface can be unreadable, and the axe tests probably do not cover the portal-rendered tooltip. In addition, `GroupChipLabel` renders its own `Tooltip` inside this `TooltipContent`, so there is a tooltip nested in a tooltip.
**Fix:** Check the tooltip background token in both themes. If it is inverted, use the tooltip foreground color for this variant. Render a plain truncated span here instead of `GroupChipLabel`.

### WR-02: `groupColorStyle` does not validate its input at runtime

**File:** `src/features/groups/colors.ts:~62`
**Issue:** The `colors.ts` header says stored strings must be checked with `isGroupColorToken`. `groupColorStyle` trusts the `GroupColorToken` type. If a persisted group has an unknown or legacy color, the output is `var(--color-group-<junk>)`. That variable is undefined, so `--group-color` is invalid and the tint, border and active underline silently disappear. The active tab then has no underline at all, which loses the only active indicator apart from font weight. This is not an injection risk, because the value only goes into a custom property.
**Fix:** Fall back to a default token, for example `groupColorVar(isGroupColorToken(token) ? token : GROUP_COLOR_TOKENS[0])`. Also give the active tab `border-(--group-color,var(--color-brand))` as a fallback.

### WR-03: "+N" pill is a very small interactive target

**File:** `src/features/groups/CountPill.tsx:9`, `src/features/groups/GroupChips.tsx:~39`
**Issue:** `countPillClass` is shared by the non-interactive count pill and the interactive "+N" trigger. It sets `h-4` (16px), and the trigger is a button of that size. On cards the target is tiny, and it also sits below `h-5` chips, so it will not align with them. The focus outline on a `rounded-full` 16px pill is also cramped.
**Fix:** Give the trigger `h-5` and `focus-visible:outline-offset-2`, or pass a size variant into `countPillClass`.

## Info

### IN-01: Layout shift from the added tab padding

**File:** `src/features/groups/GroupTab.tsx:~83`
**Issue:** `px-1.5 rounded-t` was added to the tab wrapper. Each tab is now 12px wider and the active underline spans the padding. The hover tint (`hover:bg-(--group-color)/8`) also applies to the whole wrapper, including the menu trigger. Verify visually in WebView2. The `mr-4` spacing may need to shrink.
**Fix:** Reduce `mr-4` to `mr-2.5`, or confirm the spacing is intentional.

### IN-02: Duplicated chip markup

**File:** `src/features/groups/DetailGroupsRow.tsx:~83`, `src/features/groups/GroupChips.tsx:~46`, `src/features/groups/GroupPicker.tsx:~385`
**Issue:** The `style={groupColorStyle(...)}` plus `inline-flex ... h-5 rounded text-xs ${groupChipClass}` combination is repeated in three places with slightly different padding (`px-1.5` in some, none in others).
**Fix:** Export a small `GroupChipShell` component, or a `groupChipProps(color)` helper, from `GroupChip.tsx`.

---

_Reviewed: 2026-10-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
