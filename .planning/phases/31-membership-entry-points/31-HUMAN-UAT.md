---
status: partial
phase: 31-membership-entry-points
source: [31-VERIFICATION.md]
started: 2026-10-12T00:00:00Z
updated: 2026-10-12T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Detail picker and inline create
Open ticket detail, click Groups, type a name, pick Create '<name>', toggle checkboxes, press Esc.
expected: Search is autofocused; toggles add/remove immediately with picker open; Create adds the new group and issue in one step without navigating; Esc closes and returns focus to the button
result: [pending]

### 2. Card chips, +N tooltip, chip navigation
On cards, view an issue in 3+ groups; hover/focus the +N control; click a chip; open a group view.
expected: Max 2 colored chips plus +N with tooltip; click switches to that group's tab with focus on the tab; the current group's chip is hidden in its own view
result: [pending]

### 3. Unseen-changes badge tooltip (review WR-01)
Hover the unseen-changes badge on a New-tab card.
expected: Changed-fields tooltip opens (review predicts it does not, because of pointer-events-none)
result: [pending]

### 4. Select mode in all four lists (review WR-02)
In each list (New, Not mine, Linked, group view) toggle Select, click and shift-click cards, switch tabs, press Esc; open the assignee autocomplete and press Esc.
expected: Checkboxes appear; shift-click selects a range; selection clears on tab change/exit; Esc in the autocomplete should not wipe the selection (review predicts it does)
result: [pending]

### 5. Bulk add / remove via selection bar (review WR-03)
Select several issues, use Add to group (incl. inline create), then in a group view use Remove from group; also try during a New-tab refresh.
expected: Count shown; one atomic operation; toast with real count; selection cleared; Remove confirm popover appears only in group views
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
