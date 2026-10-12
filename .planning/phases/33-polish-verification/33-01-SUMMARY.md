---
phase: 33-polish-verification
plan: 01
subsystem: i18n
tags: [i18n, locale, slovak, plurals, tests]
requires: []
provides:
  - "Normalised EN/SK groups.* copy with locale guard tests"
affects: [groups, tickets]
key-files:
  created:
    - src/i18n/__tests__/groupLocale.test.ts
  modified:
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
    - src/features/groups/__tests__/groupI18n.test.ts
metrics:
  completed: 2026-10-12
---

# Phase 33 Plan 01: Groups locale normalisation Summary

EN groups.* copy now uses curly double quotes, SK uses low-high quotes, SK `_many` equals `_other`, and `groupLocale.test.ts` plus a plural-resolution loop in `groupI18n.test.ts` guard these rules against regression.

## Commits
- f96a15a: feat(33-01): normalise groups.* locale copy and add locale guard tests (Tasks 1 and 2 combined)

## SK audit changes
Quote style: every groups.* `‘{{x}}’` became `„{{x}}“` (SK) or `“{{x}}”` (EN).
`_many` aligned to `_other` (genitive plural):
- groups.tab.aria_many: "{{name}}, {{count}} úlohy" -> "{{name}}, {{count}} úloh"
- groups.delete.body_many: "V tejto skupine sú {{count}} úlohy..." -> "V tejto skupine je {{count}} úloh. Samotné úlohy sa nezmenia."
- groups.chip.moreAria_many: "{{count}} ďalšie skupiny: ..." -> "{{count}} ďalších skupín: ..."
- groups.bar.count_many: "{{count}} vybrané" -> "{{count}} vybraných"
- groups.bar.removeConfirm_many: "Odstrániť {{count}} úlohy..." -> "Odstrániť {{count}} úloh..."
- groups.toast.added_many: "Pridané {{count}} úlohy..." -> "Pridaných {{count}} úloh..."
- groups.toast.addedWithSkipped_many: same change as added_many
- groups.toast.removed_many: "Odstránené {{count}} úlohy..." -> "Odstránených {{count}} úloh..."
Wording:
- groups.picker.announceRemoved: "Odstránené zo ‘{{name}}’" -> "Odstránené zo skupiny „{{name}}“"
- groups.picker.announceAdded: "Pridané do ‘{{name}}’" -> "Pridané do skupiny „{{name}}“" (consistency)
Plural sets were already complete (one/few/many/other in EN and SK); no keys added or removed.

## Deviations from Plan

**[Rule 3 - Blocking] Tasks 1 and 2 committed together.** The pre-commit hook runs the full frontend suite, so the RED-only commit of Task 1 was rejected (the new guards failed by design: groups.picker.create quotes, groups.tab.aria_many, groups.picker.announceRemoved). Guards were verified RED first, then the locale fix was applied and both tasks landed in one commit. Hooks were not bypassed.

Also updated `src/features/tickets/__tests__/coreListSelectionCases.tsx` (not in plan's file list) which asserted old toast copy.

## Verification
Full `npx vitest run`: 118 files, 1519 tests pass.

## Self-Check: PASSED
