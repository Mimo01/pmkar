---
status: partial
phase: 32-durability
source: [32-VERIFICATION.md]
started: 2026-10-12T18:05:07Z
updated: 2026-10-12T20:50:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Drop a grouped issue from the fetch results in a running app
expected: Card renders dimmed from snapshot with "No longer in results" and a labelled Remove button
result: [pending]

### 2. Change the JQL preset without fetching, then run a partial or truncated fetch
expected: No missing hints appear in either case
result: [pending]

### 3. Use "Remove all missing" from the tab menu and from the header
expected: Confirm popover, one removal, focus handling acceptable
result: [pending]

### 4. Switch server, and click Remove on a missing card while a poll fetch is loading
expected: Switching server clears the old list (no cross-server tickets/hints); Remove during a loading fetch removes nothing (WR-08: currently silent no-op — judge whether acceptable)
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
