---
status: resolved
phase: 30-group-management-reorder
source: [30-01-SUMMARY.md, 30-02-SUMMARY.md, 30-03-SUMMARY.md, 30-04-SUMMARY.md, 30-05-SUMMARY.md, 30-06-SUMMARY.md, 30-07-SUMMARY.md, 30-HUMAN-UAT.md]
started: 2026-10-12T14:30:00Z
updated: 2026-10-12T16:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Create group with a color
expected: Clicking ＋ in the tab strip opens a popover with a "Create group" button and a row of 8 color swatches, one already preselected. Picking a different swatch (click or arrow keys) and creating the group adds a new tab showing that color.
result: issue
reported: "some colors are not rendering, some are. Other than that, works correctly"
severity: major

### 2. Active tab "…" menu, no layout shift
expected: Only the active group tab shows a "…" button. It opens a menu with Rename…, Change color…, Move left, Move right and a red Delete group…. Switching the active tab between groups causes no width jump in the strip.
result: pass

### 3. Right-click and Shift+F10 on an inactive tab
expected: Right-clicking an inactive group tab (or focusing it and pressing Shift+F10) opens the same menu without switching to that group. Move, Rename, Change color and Delete all work from it.
result: pass

### 4. Move left / Move right
expected: Move left/right swaps the group with its neighbour immediately. Move left is disabled on the first group and Move right on the last. After moving, focus returns to the moved tab (or its "…" button).
result: pass

### 5. VoiceOver move announcement
expected: With VoiceOver on, moving a group announces "“Name” moved to position N of M."
result: skipped
reason: user skipped (VoiceOver not tested)

### 6. Rename group
expected: Rename… opens a popover anchored to the tab with the current name fully selected. Typing a new name and pressing Enter renames the tab; Esc cancels without changes. Focus returns to the tab afterwards.
result: pass

### 7. Change color
expected: Change color… opens a popover anchored to the tab with 8 swatches and the current color selected. Choosing another swatch recolors the tab right away; Esc closes without changes.
result: pass

### 8. Delete group
expected: Delete group… opens a confirmation dialog titled "Delete “Name”?" with no X button, showing the member count ("1 issue is in this group…", or "This group is empty."). "Keep group" has initial focus and closes without deleting. "Delete group" removes the tab; if it was the active group, the app switches to the New tab, otherwise focus moves to a neighbouring tab.
result: pass

### 9. Slovak copy
expected: With the app language set to Slovak, the menu, rename/color popovers, delete dialog (including correct plural forms for 1, 2–4 and 5+ issues) and the "Vytvoriť skupinu" button are all translated.
result: pass

### 10. Persistence after restart
expected: After reordering, recoloring and renaming groups, quitting and restarting the app keeps the new order, names and colors.
result: pass

## Summary

total: 10
passed: 8
issues: 1
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "All 8 group color swatches render their color in the Create popover, and the created tab shows the chosen color"
  status: resolved
  resolved_by: "30-08 (light palette moved to :root; user re-confirmed light-theme colors 2026-10-12)"
  reason: "User reported: some colors are not rendering, some are. Other than that, works correctly"
  severity: major
  test: 1
  root_cause: "Light-theme --color-group-* variables are declared inside Tailwind v4 @theme {} in src/index.css. Tailwind v4 only emits @theme variables whose names appear literally in scanned sources, but groupColorVar (colors.ts) builds `var(--color-group-${token})` at runtime. Only blue/amber/purple/slate survive (accidental literal mentions in tests and .planning docs); teal, green, orange and pink are stripped, so their swatches and tab dots render transparent in light theme. Dark theme (plain body.dark rule) has all 8."
  artifacts:
    - path: "src/index.css"
      issue: "Light group palette (lines ~44-53) lives in @theme, which tree-shakes unreferenced variables"
    - path: "src/features/groups/colors.ts"
      issue: "groupColorVar builds the variable name dynamically, invisible to Tailwind's scanner"
    - path: "src/features/groups/GroupColorSwatches.tsx"
      issue: "Renders swatch via inline var(); affected consumer"
    - path: "src/features/groups/GroupTab.tsx"
      issue: "Renders tab dot via inline var() (line ~103); affected consumer"
  missing:
    - "Declare light-theme --color-group-* in a plain :root rule (like body.dark) or @theme static so all 8 are always emitted"
    - "Update the existing colors.ts vs index.css consistency test to find values after the move"
    - "Add regression test asserting the built/declared CSS defines all 8 light-theme group variables unconditionally"
  debug_session: ".planning/debug/resolved/group-colors-not-rendering.md"
