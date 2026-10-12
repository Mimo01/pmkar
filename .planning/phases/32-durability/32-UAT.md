---
status: complete
phase: 32-durability
source: [32-01-SUMMARY.md, 32-02-SUMMARY.md, 32-03-SUMMARY.md, 32-04-SUMMARY.md, 32-05-SUMMARY.md, 32-06-SUMMARY.md, 32-07-SUMMARY.md, 32-08-SUMMARY.md, 32-09-SUMMARY.md, 32-10-SUMMARY.md, 32-11-SUMMARY.md, 32-12-SUMMARY.md, 32-13-SUMMARY.md]
started: 2026-10-12T21:00:00Z
updated: 2026-10-12T21:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Missing member shown dimmed in group view
expected: After a complete fetch that no longer returns a grouped issue, the group view shows it under a "No longer in results (N)" subheading as a dimmed card from snapshot, with the hint line and a labelled Remove button. Present members render normally.
result: skipped
reason: user skipped all manual tests (no missing-issue state set up)

### 2. Per-card Remove with confirm
expected: Clicking Remove on a missing card opens a confirm popover with Cancel focused. Cancel closes it with no change. Remove removes only that issue from the group (success toast); the missing count drops by one, and the popover does not re-open on its own later.
result: skipped
reason: user skipped all manual tests (no missing-issue state set up)

### 3. Remove all missing from the group view header
expected: The missing block shows "Remove all missing (N)". Clicking it opens a confirm popover; confirming removes all missing members in one action, the missing block disappears, present members stay.
result: skipped
reason: user skipped all manual tests (no missing-issue state set up)

### 4. Remove all missing from the tab menu
expected: The group tab "…" menu shows "Remove all missing (N)" above Delete when the group has missing members (absent otherwise). Choosing it opens a confirm popover anchored to the tab; confirming removes them, and focus returns to the group tab trigger.
result: skipped
reason: user skipped all manual tests (no missing-issue state set up)

### 5. No hints when results are not trustworthy
expected: (a) Change the JQL preset/query without fetching: no missing hints or Remove buttons appear in any group. (b) Run a fetch that is partial (a batch fails) or truncated: no missing hints appear. Hints come back after the next complete fetch for the current query.
result: skipped
reason: user skipped all manual tests (no missing-issue state set up)

### 6. Snapshot refresh after fetch
expected: Change a grouped issue in Jira (e.g. summary or status), fetch so it is in the results: the group view shows the updated data. Group membership is unchanged (nothing added or removed by the fetch).
result: skipped
reason: user skipped all manual tests (no missing-issue state set up)

### 7. Server switch clears the old list
expected: Switching to a different server clears the ticket list (no tickets from the old server remain), and groups show no missing hints derived from the old server's results.
result: skipped
reason: user skipped all manual tests (no missing-issue state set up)

### 8. Remove disabled while a fetch is loading
expected: While a fetch is in progress, Remove / Remove all missing on missing cards are disabled (or the block hides); nothing is removed mid-fetch. After the fetch completes, the actions work again.
result: skipped
reason: user skipped all manual tests (no missing-issue state set up)

### 9. Slovak copy
expected: With the app in Slovak, the missing-block heading, hint line, Remove, "Remove all missing" and confirm popovers are translated, with correct plural forms for 1, 2-4 and 5+ items.
result: skipped
reason: user skipped all manual tests (no missing-issue state set up)

## Summary

total: 9
passed: 0
issues: 0
pending: 0
skipped: 9
blocked: 0

## Gaps

[none yet]
