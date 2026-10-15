---
phase: 37-consistency-accessibility-and-uat
plan: 05
subsystem: testing
tags: [uat, a11y, webview2, validation]
requires: [37-01, 37-02, 37-03, 37-04]
provides:
  - 37-HUMAN-UAT.md WebView2 manual checklist (7 pending items)
  - 36-HUMAN-UAT.md superseded
  - finalized 37-VALIDATION.md
key-files:
  created:
    - .planning/phases/37-consistency-accessibility-and-uat/37-HUMAN-UAT.md
  modified:
    - .planning/phases/36-detail-and-group-ui/36-HUMAN-UAT.md
    - .planning/phases/37-consistency-accessibility-and-uat/37-VALIDATION.md
metrics:
  completed: 2026-10-15
---

# Phase 37 Plan 05: Manual UAT checklist and validation gate Summary

Single Windows/WebView2 checklist (7 items, all `[pending]`, status partial) covering focus, keyboard, Undo reachability (alt+T, documentation only), Narrator/NVDA announcements, an SK run and focus rings; Phase 36's two pending items folded in and its file marked superseded.

## Tasks

1. Wrote 37-HUMAN-UAT.md and superseded 36-HUMAN-UAT.md. Commit 244c8b9.
2. Full gate: `npm test` passed (133 files, 1768 tests), `npx tsc --noEmit` clean. Updated 37-VALIDATION.md (frontmatter complete / nyquist_compliant / wave_0_complete, task map filled, boxes ticked).

## Deviations from Plan

- The validation map had 5 placeholder rows, not 7. They were filled with 37-01-01, 37-02-01, 37-02-02, 37-03-01 and 37-04-01 (plan/wave values assigned by best fit to the plan list; 37-01-02 and 37-04-02 have no separate row). Wave numbers are approximate.
- The only "consisten" match in 37-HUMAN-UAT.md is the phase slug in frontmatter; the body has no consistency steps.
- Pre-commit hook reports pre-existing Biome warnings (useLiteralKeys) in unrelated files; not touched.

## Known Stubs

None.

## Self-Check: PASSED
