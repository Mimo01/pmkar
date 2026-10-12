---
status: complete
phase: 29-tab-strip-group-view
source: [29-VERIFICATION.md]
started: 2026-10-12T11:40:22Z
updated: 2026-10-12T12:18:09Z
---

## Current Test

[testing complete — see 29-UAT.md]

## Tests

### 1. Tab strip overflow with many long-named groups
expected: Create enough groups (some with long names) to overflow the bar. Core tabs (New / Not mine / Linked) stay fixed; group strip scrolls horizontally with fades and arrows; long names truncate with a tooltip on hover; the active or keyboard-focused group tab is not hidden under a scroll arrow (review WR-07).
result: pass

### 2. Group view badges and live triage sync
expected: Open a populated group and an empty group. Populated group shows a flat list with New / Dismissed / Already Linked / Done pills; empty group explains how to add issues. Dismiss and restore a card in the group view, then switch to core tabs — the change is reflected immediately in both places.
result: skipped
reason: deferred until add-to-group UI ships (phase 31); see 29-UAT.md tests 5-7

## Summary

total: 2
passed: 1
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps
