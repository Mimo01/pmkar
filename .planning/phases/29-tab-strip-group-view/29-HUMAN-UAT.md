---
status: partial
phase: 29-tab-strip-group-view
source: [29-VERIFICATION.md]
started: 2026-10-12T11:40:22Z
updated: 2026-10-12T11:40:22Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Tab strip overflow with many long-named groups
expected: Create enough groups (some with long names) to overflow the bar. Core tabs (New / Not mine / Linked) stay fixed; group strip scrolls horizontally with fades and arrows; long names truncate with a tooltip on hover; the active or keyboard-focused group tab is not hidden under a scroll arrow (review WR-07).
result: [pending]

### 2. Group view badges and live triage sync
expected: Open a populated group and an empty group. Populated group shows a flat list with New / Dismissed / Already Linked / Done pills; empty group explains how to add issues. Dismiss and restore a card in the group view, then switch to core tabs — the change is reflected immediately in both places.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
