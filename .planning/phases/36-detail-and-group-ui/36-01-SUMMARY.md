---
phase: 36-detail-and-group-ui
plan: 01
subsystem: ui
tags: [i18n, react-i18next, triage]
requires: []
provides:
  - detail.deny, detail.deny.tooltip, detail.restoreLink, detail.restoreLink.tooltip, detail.previouslyLinked in EN and SK
  - RememberedLinkHint component (detail and row variants)
affects: [36-03, 36-04, 36-05]
key-files:
  created:
    - src/i18n/__tests__/detailLocale.test.ts
    - src/features/tickets/RememberedLinkHint.tsx
    - src/features/tickets/__tests__/RememberedLinkHint.test.tsx
  modified:
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
requirements-completed: [RQA-02, RLNK-03]
completed: 2026-10-15
---

# Phase 36 Plan 01: Detail strings and RememberedLinkHint Summary

Five EN/SK detail strings (SK uses "tiket") with a placeholder/tag parity guard, plus a shared `RememberedLinkHint` that renders "Previously linked to KEY" (key in font-mono via Trans) only for ignored entries with a copiedKey.

## Commits
- e3d6906: locale keys + detailLocale guard test
- 8c175e3: RememberedLinkHint component + tests

## Deviations from Plan
None. Worktree base was reset to b996c7b per the startup check; node_modules was symlinked (untracked, not committed) to run tests.

## Notes
Biome reports pre-existing warnings in unrelated files; not touched. Existing detail.ignored keys were left in place as instructed.

## Self-Check: PASSED
