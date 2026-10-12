---
status: complete
phase: 31-membership-entry-points
source: [31-01-SUMMARY.md, 31-02-SUMMARY.md, 31-03-SUMMARY.md, 31-04-SUMMARY.md, 31-05-SUMMARY.md, 31-06-SUMMARY.md, 31-07-SUMMARY.md, 31-08-SUMMARY.md, 31-09-SUMMARY.md]
started: 2026-10-12T12:00:00Z
updated: 2026-10-12T13:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Detail Groups picker toggles membership
expected: Open a ticket detail and click the "Groups" button. A popover opens with the search field focused. Typing filters groups (case- and diacritic-insensitive). Ticking a checkbox adds the issue to that group immediately and a chip appears in the detail row; unticking removes it. The picker stays open while toggling. Esc closes the picker, focus returns to the Groups button, and the detail view stays open.
result: pass

### 2. Inline create from the detail picker
expected: In the detail Groups picker, type a new name. A "Create '<name>'" row appears. Activating it creates the group (default color) and adds the issue in one step, without navigating away. A too-long or reserved name shows a disabled Create row with an inline message; an existing name highlights the match instead of offering Create.
result: pass

### 3. Detail chips: remove and navigate
expected: In detail, each group chip has an x. Clicking x asks for confirmation; confirming removes the issue from the group and focus moves to the Groups button. Clicking a chip's name closes the detail and switches to that group's tab, with keyboard focus on the tab.
result: pass

### 4. Card chips and +N tooltip
expected: On list cards, an issue in groups shows colored-dot chips with the group name (max 2), plus a "+N" control when in 3+ groups. Hovering or focusing +N shows a tooltip listing the remaining groups. Clicking a chip switches to that group's tab. In a group's own view, that group's chip is hidden on its cards.
result: pass

### 5. Changed badge tooltip on New-tab cards
expected: On a New-tab card with unseen changes, hovering the "Changed" badge opens the tooltip listing the changed fields. Clicking elsewhere on the card still opens the detail.
result: pass

### 6. Select mode in lists
expected: In New, Not mine, Linked and a group view, a "Select" toggle in the filter bar turns on select mode: checkboxes appear on cards, clicking a card toggles it instead of opening detail, shift-click selects a range. Esc exits select mode (clearing selection) and returns focus to the Select toggle. Switching tabs clears the selection. Pressing Esc inside the assignee autocomplete only closes the autocomplete and keeps the selection.
result: pass

### 7. Bulk add to group via selection bar
expected: With issues selected, a floating bar shows the count and an "Add to group" button. Choosing a group (or creating one inline) adds all selected issues in one operation, shows a toast with the real count (mentioning skipped ones already in the group), clears the selection, and the issues stay in their original tab with unchanged triage state.
result: pass

### 8. Bulk remove in group view
expected: In a group view with issues selected, the bar offers "Remove from group" (not offered in New/Not mine/Linked). Clicking it opens a confirm popover with Cancel focused; confirming removes all selected issues in one operation, toasts the count, and clears selection. Add to group in that view excludes the current group.
result: pass

### 9. Actions blocked during New-tab refresh
expected: While the New tab is refreshing, the Select toggle and the selection bar's actions are disabled; they become usable again once the refresh finishes.
result: pass

### 10. Slovak copy
expected: Switching the UI to Slovak shows translated picker, chip, Select, selection bar and toast texts, with correct plural forms (e.g. 1 / 3 / 5 selected issues).
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
