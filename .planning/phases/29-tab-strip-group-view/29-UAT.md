---
status: complete
phase: 29-tab-strip-group-view
source: [29-01-SUMMARY.md, 29-02-SUMMARY.md, 29-03-SUMMARY.md, 29-04-SUMMARY.md, 29-05-SUMMARY.md, 29-06-SUMMARY.md, 29-HUMAN-UAT.md]
started: 2026-10-12T12:09:30Z
updated: 2026-10-12T12:18:08Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Create a group from the + control
expected: To the right of the core tabs (New / Not mine / Linked) there is a divider and a "+" icon button. Clicking it opens a small popover with a name field. Typing a name and pressing Enter (or the create button) closes the popover, a new tab with that name appears in the strip, it becomes the active tab, and the group view opens.
result: pass

### 2. Create-group validation
expected: With the popover open, an empty field shows no error (create is just disabled). Entering a name that matches an existing group (case-insensitively, e.g. "alpha" vs "Alpha") shows a duplicate-name error; an overly long name shows a length error. Esc closes the popover without creating anything, and rapid double Enter creates only one group.
result: pass

### 3. Tab strip overflow with many long-named groups
expected: Create enough groups (some with long names) to overflow the bar. Core tabs (New / Not mine / Linked) stay fixed; the group strip scrolls horizontally with edge fades and scroll arrows (mouse wheel also scrolls it); the + button stays pinned at the end; long names truncate with a tooltip on hover; the active or keyboard-focused group tab is not hidden under a scroll arrow.
result: pass

### 4. Empty group view
expected: Opening a group that has no issues shows an empty state: "No issues in this group yet" with a line explaining how issues get added. No error, no spinner stuck.
result: pass

### 5. Populated group view with triage badges
expected: A group with members shows a flat list of issue cards (no sub-sections), each with a pill: New / Dismissed / Already Linked / Done. Dismissed cards offer Restore. (No add-to-group UI exists yet; seed members from devtools with window.__TAURI_INTERNALS__.invoke('add_issues_to_group', {groupId: <id>, issues: [{issueKey: 'KEY-1', ticketJson: '<ticket json>'}]}) then reload.)
result: skipped
reason: deferred until add-to-group UI ships (phase 31); no way to populate a group from the UI yet

### 6. Live triage sync between group view and core tabs
expected: Dismiss a card in the group view, then switch to New — it is gone from New and appears under Dismissed. Restore it (from the group view or Dismissed page) — the pill flips back to New and it reappears on the New tab immediately, no reload.
result: skipped
reason: deferred until add-to-group UI ships (phase 31); needs a populated group

### 7. Filter bar in group view
expected: The group view has the same filter/search bar as the core lists. Typing a search or applying a filter narrows the group's cards the same way it does on the New tab.
result: skipped
reason: deferred until add-to-group UI ships (phase 31); needs a populated group

### 8. Core tabs unchanged and switching
expected: New / Not mine / Linked look and behave as before. Clicking between a group tab and core tabs switches views cleanly; after an app restart the app opens on New (active group tab is not remembered).
result: pass

### 9. Slovak locale
expected: Switching the app language to Slovak translates the + popover (label, placeholder, errors), the empty-group state, and the pills; counts use correct Slovak plural forms.
result: pass

## Summary

total: 9
passed: 6
issues: 0
pending: 0
skipped: 3
blocked: 0

## Gaps

[none yet]
