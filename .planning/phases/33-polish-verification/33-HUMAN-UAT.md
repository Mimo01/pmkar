---
status: partial
phase: 33-polish-verification
source: [33-VERIFICATION.md]
started: 2026-10-13T06:38:59Z
updated: 2026-10-13T06:38:59Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Consolidated milestone UAT, 27 pending tests in 33-UAT.md
expected: Slovak strings and plurals correct; keyboard-only operation with focus return; both themes; 25-group tab bar and cards in WKWebView
result: [pending]

### 2. Keyboard walkthrough of overflow arrows with 25 groups: press Enter on 'Scroll tabs right' until the end
expected: Focus moves to the visible 'Scroll tabs left' arrow with a visible focus ring; the strip does not snap back
result: [pending]

### 3. Mouse click on the scroll arrows to the end (Windows or Linux webview, if available)
expected: Check whether the opposite arrow's tooltip pops open (review WR-01). Advisory only
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
