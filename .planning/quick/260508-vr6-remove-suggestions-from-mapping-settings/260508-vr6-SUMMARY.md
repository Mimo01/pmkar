---
phase: quick-260508-vr6
plan: "01"
subsystem: field-mapping
tags: [cleanup, ui-removal, i18n]
dependency_graph:
  requires: []
  provides: []
  affects:
    - src/features/field-mapping/FieldMappingSection.tsx
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - src/features/field-mapping/FieldMappingSection.tsx
    - src/features/field-mapping/__tests__/FieldMappingSection.test.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
  deleted:
    - src/features/field-mapping/SuggestionsPanel.tsx
    - src/features/field-mapping/heuristics.ts
    - src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx
    - src/features/field-mapping/__tests__/heuristics.test.ts
decisions:
  - Suggestion UI removed entirely; dismissed-sentinel DB rows (targetFieldId='') remain valid and render as unmapped rows in the table
metrics:
  duration: "7 min"
  completed: "2026-05-08"
---

# Quick 260508-vr6: Remove Suggestions from Mapping Settings — Summary

**One-liner:** Deleted SuggestionsPanel + heuristics source and test files; stripped all suggestion wiring from FieldMappingSection.tsx; removed 3 i18n keys from both locales.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Delete suggestion source + test files | 8a03061 | SuggestionsPanel.tsx, heuristics.ts, SuggestionsPanel.test.tsx, heuristics.test.ts (deleted) |
| 2 | Strip suggestions wiring from FieldMappingSection.tsx + update test | 85cd801 | FieldMappingSection.tsx, __tests__/FieldMappingSection.test.tsx |
| 3 | Remove suggestion translation keys + run tests | b3140cb | en.json, sk.json |

## Files Deleted (4)

- `src/features/field-mapping/SuggestionsPanel.tsx`
- `src/features/field-mapping/heuristics.ts`
- `src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx`
- `src/features/field-mapping/__tests__/heuristics.test.ts`

## Files Modified (4)

- `src/features/field-mapping/FieldMappingSection.tsx` — removed imports for `SuggestionsPanel` and `findNameMatchSuggestion`; deleted `suggestions` useMemo block; deleted `handleAcceptSuggestion` and `handleDismissSuggestion` handlers; removed `<SuggestionsPanel>` JSX element and its comment
- `src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` — removed `[EDIT-02] SuggestionsPanel receives suggestions for unmapped source fields` test case
- `src/i18n/locales/en.json` — removed `settings.fieldMapping.suggestions`, `settings.fieldMapping.accept`, `settings.fieldMapping.dismiss`
- `src/i18n/locales/sk.json` — removed the matching 3 Slovak translation keys

## Translation Keys Removed (3)

| Key | en | sk |
|-----|----|----|
| `settings.fieldMapping.suggestions` | `Suggestions ({{count}})` | `Návrhy ({{count}})` |
| `settings.fieldMapping.accept` | `Accept` | `Prijať` |
| `settings.fieldMapping.dismiss` | `Dismiss` | `Zamietnuť` |

## Test Results

Frontend vitest suite: 822 passed / 3 failed. All 3 failures (`TicketListPage > auto-refetches when lastFetchedAt is set`, `SettingsPage > shows privacy warning banner...`, `SettingsPage > does NOT show privacy warning...`) are pre-existing and unrelated to this plan — confirmed by running the suite on the prior commit.

TypeScript: zero new errors introduced. One pre-existing error in `CopyPreviewModal.tsx` (TS2322 — `fieldNames` prop) was present before this work and is out-of-scope.

## Backend Confirmation

`src-tauri/` was not touched. Dismissed-suggestion sentinel rows in `mapping.db` (rows with `targetFieldId=''`) remain valid: they round-trip through the DB layer unchanged and now render as ordinary unmapped rows in the mapping table. No crashes or data loss.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- All 4 deleted files confirmed absent from disk.
- All 4 modified files updated with zero orphan suggestion references.
- Commits 8a03061, 85cd801, b3140cb verified in git log.
