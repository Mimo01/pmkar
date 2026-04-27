---
status: partial
phase: 18-v2-v3-translation-layer
source: [18-VERIFICATION.md]
started: 2026-04-27T00:00:00.000Z
updated: 2026-04-27T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. TRAN-05 — Links/blockquotes/hard-breaks pass through htmltoadf natively
expected: Calling convert_and_postprocess with HTML containing `<a href="...">link</a>`, `<blockquote>text</blockquote>`, and `<br/>` produces valid ADF with link, blockquote, and hardBreak node types (or graceful plain-text degradation). No post-processor code is needed for these types because htmltoadf handles them natively.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
