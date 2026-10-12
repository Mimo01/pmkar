---
status: complete
phase: 30-group-management-reorder
source: [30-VERIFICATION.md]
started: 2026-10-12T13:46:12Z
updated: 2026-10-12T15:00:00Z
---

## Current Test

[testing complete — see 30-UAT.md]

## Tests

### 1. VoiceOver: use Move left / Move right from a tab menu
expected: The new position is announced ("X moved to position N of M") and focus returns to the moved tab or its more button
result: skipped
reason: user skipped VoiceOver check (30-UAT.md test 5)

### 2. Right-click and Shift+F10 on an inactive tab in the real Tauri WebView
expected: The context menu opens and Move, Rename, Change color and Delete all work
result: pass

### 3. Activate a tab and check the strip for layout shift from the more button slot
expected: No width jump when the active tab changes
result: pass

### 4. Rename a group and open the popover
expected: The existing name is fully selected (see WR-02 in 30-REVIEW.md)
result: pass

### 5. Restart the app after reordering, recoloring and renaming groups
expected: Order, names and colors persist
result: pass

## Summary

total: 5
passed: 4
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps
