---
phase: 31-membership-entry-points
plan: 01
subsystem: i18n
tags: [i18n, groups, plurals, slovak]
requires: []
provides:
  - "EN/SK copy keys for group picker, chips, select mode, bulk bar, toasts, membership error"
affects: [31-membership-entry-points]
tech-stack:
  added: []
  patterns: ["flat dotted JSON keys with _one/_few/_many/_other in both locales"]
key-files:
  created: []
  modified:
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
    - src/features/groups/__tests__/groupI18n.test.ts
key-decisions:
  - "SK _few and _many share wording; base key equals _other"
requirements-completed: [GMEM-02, GMEM-03, GMEM-04, GMEM-06, GMEM-07, GMEM-08, GMEM-09]
duration: 10min
completed: 2026-10-12
---

# Phase 31 Plan 01: Membership i18n Copy Summary

All Phase 31 EN and SK strings added with Slovak plural forms, plus tests pinning the SK 1/3/5 forms and the D-18 empty-state labels.

## Tasks
1. Add Phase 31 EN/SK keys and plural tests - commit 694820a

## Deviations from Plan

- Biome format required wrapping three long expect lines in the new test block (formatting only).
- The worktree had no node_modules, so a local symlink to the main repo's node_modules was used for running tests (untracked, not committed).
- groups.empty.body already named "Groups"/"Add to group" and "Skupiny"/"Pridať do skupiny"; no wording change needed.

## Verification
- groupI18n.test.ts and translations.test.ts pass (19 tests); pre-commit hooks (fmt, Biome, tests) passed.

## Known Stubs
None.

## Self-Check: PASSED
