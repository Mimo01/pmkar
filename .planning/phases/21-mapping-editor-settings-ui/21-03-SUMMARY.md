---
phase: 21
plan: 03
subsystem: field-mapping
tags: [field-mapping, settings, orchestrator, navigation, i18n, drift-detection, refresh, zustand]
dependency_graph:
  requires:
    - 21-01 (types, heuristics, transformerOptions, SectionCard headerAction)
    - 21-02 (MappingRow, SuggestionsPanel, DriftWarning leaf components)
  provides:
    - src/features/field-mapping/FieldMappingSection.tsx
    - src/features/field-mapping/__tests__/FieldMappingSection.test.tsx
  affects:
    - src/features/connections/SettingsPage.tsx (ActiveSection union, Copying nav group, renderContent case)
    - src/i18n/locales/en.json (29 new keys)
    - src/i18n/locales/sk.json (29 new keys, full parity)
    - src/features/field-mapping/__tests__/MappingRow.test.tsx (updated to use translated strings)
    - src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx (updated to use translated strings)
tech_stack:
  added: []
  patterns:
    - Module-scoped Zustand store (useMappingEditorStore) for coordinating header + body without prop-drilling
    - useMemo for drift detection and heuristic suggestions (never useEffect for derived state)
    - useEffect mount-only pattern for initial data load
    - data-testid on refresh button for test stability (i18n-agnostic)
key_files:
  created:
    - src/features/field-mapping/FieldMappingSection.tsx
    - src/features/field-mapping/__tests__/FieldMappingSection.test.tsx
  modified:
    - src/features/connections/SettingsPage.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
    - src/features/field-mapping/__tests__/MappingRow.test.tsx
    - src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx
decisions:
  - Module-scoped Zustand store (useMappingEditorStore) chosen over React context or prop-drilling — consistent with existing project store pattern; both FieldMappingSection body and FieldMappingSectionHeader header share state without lifting state to SettingsPage
  - data-testid="refresh-schema-btn" added to Refresh button for test stability (i18n key values unavailable at test time since en.json is loaded at test runtime)
  - handleAddRow uses window.prompt for source field id input — deliberately minimal; future polish can replace with combobox from source fields (MAP-03 is satisfied; UX can improve later)
  - MappingRow.test.tsx and SuggestionsPanel.test.tsx updated from i18n key-fallback strings to actual translations after en.json/sk.json keys were added
metrics:
  duration: "8 min"
  completed_date: "2026-04-28"
  tasks_completed: 2
  files_created: 2
  files_modified: 5
---

# Phase 21 Plan 03: Wave 2 Integration Summary

**One-liner:** FieldMappingSection orchestrator with mount-time data load, drift detection, heuristic suggestions, Refresh schema button, and Last refreshed timestamp wired into Settings via new "Copying" nav group — 29 i18n keys added with EN/SK parity.

## What Was Built

### Task 1: FieldMappingSection orchestrator + tests

**`src/features/field-mapping/FieldMappingSection.tsx`** (260 lines)

Two named exports:

**`FieldMappingSection`** — body content:
- On mount (`useEffect` mount-only): calls `invoke<FieldMappingRow[]>('get_field_mapping')`, then `loadSchema('source', null, null)` and `loadSchema('target', targetProjectKey, firstIssueTypeId)` via schemaCacheStore
- **Drift detection** (MAP-05): `useMemo` over `mappingRows × targetFields` — rows with non-empty `targetFieldId` missing from target schema cache IDs → `driftedSourceFieldIds` Set passed as `isDrifted` prop to each `MappingRow`
- Empty-string sentinel (`targetFieldId=''`) explicitly NOT flagged drifted (MAP-05)
- **Heuristic suggestions** (EDIT-02): `useMemo` over `sourceFields` — filters out already-mapped source fields, runs `findNameMatchSuggestion()` for each remaining, renders `SuggestionsPanel` above table
- Handles `!firstIssueTypeId` edge case (Pitfall 4): shows "No issue types prewarmed" message
- **Loading state**: 3 `Skeleton` placeholders while `loading=true`

**`FieldMappingSectionHeader`** — header content:
- "Refresh schema" button with `aria-busy`, `data-testid="refresh-schema-btn"`, `disabled` while refreshing
- On click: `refresh('source')` → `refresh('target')` → `loadSchema('source')` → `loadSchema('target')` → `setLastRefreshed(Date.now())`
- On error: `toast.error(t('settings.fieldMapping.refreshError'))`
- "Last refreshed Xm ago" / "just now" / "Not yet refreshed" timestamp via `formatRelative()`

**`useMappingEditorStore`** — module-scoped Zustand store:
- State: `mappingRows`, `loading`, `refreshing`, `lastRefreshed`
- Mutations: `setMappingRows`, `updateRow`, `deleteRow`, `setLoading`, `setRefreshing`, `setLastRefreshed`
- Exported (for test `beforeEach` reset) via `export const useMappingEditorStore`

**`src/features/field-mapping/__tests__/FieldMappingSection.test.tsx`** (10 tests, all passing):

| Test | Requirement |
|------|-------------|
| On mount calls invoke get_field_mapping | EDIT-01 |
| Renders one MappingRow per loaded row | EDIT-01 |
| Shows skeleton placeholders during loading | EDIT-01 |
| Flags drifted rows (targetFieldId missing from cache) | MAP-05 |
| Does NOT flag dismissed sentinel (targetFieldId='') | MAP-05 |
| SuggestionsPanel receives suggestions for unmapped source fields | EDIT-02 |
| Clicking Refresh calls refresh + loadSchema for both sides | DISC-05 |
| On refresh failure, button returns to idle | DISC-05 |
| While refreshing, button has aria-busy=true and is disabled | DISC-05 |
| After refresh, lastRefreshed is set | DISC-05 |

### Task 2: SettingsPage wiring + 29 i18n keys

**`src/features/connections/SettingsPage.tsx`** changes:
- Import: `FieldMappingSection, FieldMappingSectionHeader` from `'../field-mapping/FieldMappingSection'`
- ActiveSection union extended with `'field-mapping'`
- `case 'field-mapping':` in `renderContent()` returns `<SectionCard title={t('settings.section.fieldMapping')} headerAction={<FieldMappingSectionHeader />}><FieldMappingSection /></SectionCard>`
- New "Copying" nav group inserted between Fetching and Polling groups: `settings.group.copying` label + single `NavItem section="field-mapping"`
- Final sidebar order: Connections → Fetching → **Copying** → Polling → Appearance → About

**`src/i18n/locales/en.json`** and **`src/i18n/locales/sk.json`** — 29 new keys:

| Key Group | Count |
|-----------|-------|
| `settings.group.copying` + `settings.nav.fieldMapping` + `settings.section.fieldMapping` | 3 |
| `settings.fieldMapping.*` (refreshSchema, refreshing, lastRefreshed*, suggestions, accept, dismiss, addRow, addRowPrompt, colSource, colTarget, colTransformer, targetPlaceholder, transformerPlaceholder, deleteAriaLabel, driftWarning, driftRemove, saved, saveError, deleteError, refreshError, emptyHeading, emptyBody, allMapped, noIssueTypes, lastRefreshedNow, lastRefreshedNever) | 26 |
| **Total** | **29** |

Parity: all 29 keys present in both en.json and sk.json.

## Drift Detection Result (on seeded mock fixture)

Seeded fixture has 2 rows:
- `labels → labels` (labels IS in target cache → not drifted)
- `priority → gone_field` (gone_field NOT in target cache → **drifted**)

Result: 1 drifted row, 1 non-drifted row. `drift-warning-priority` testId rendered correctly.

## Heuristic Suggestions Count (test fixture)

With empty mapping rows and source fields `[labels, priority]` matching target fields `[Labels, Priority]` by name → 2 suggestions generated. SuggestionsPanel visible with "Suggestions (2)".

## i18n Parity Confirmation

```
i18n parity OK: 29 keys in both files
```

## ActiveSection Union Final Shape

```typescript
type ActiveSection =
  | 'source'
  | 'destination'
  | 'jql-presets'
  | 'watched-users'
  | 'field-mapping'   // NEW — Phase 21
  | 'polling'
  | 'notifications'
  | 'theme'
  | 'language'
  | 'about';
```

## Requirement Coverage

| Requirement | Status | Test(s) |
|-------------|--------|---------|
| DISC-05 (manual refresh) | Satisfied | FieldMappingSection.test.tsx — 4 DISC-05 tests |
| MAP-05 (drift warning) | Satisfied | FieldMappingSection.test.tsx — 2 MAP-05 tests; MappingRow.test.tsx — 2 MAP-05 tests |
| MAP-03 (add custom row) | Satisfied | Add Row button → window.prompt → set_field_mapping |
| MAP-04 (per-row auto-save) | Satisfied | MappingRow.test.tsx — 4 MAP-04 tests |
| EDIT-01 (section in Settings) | Satisfied | FieldMappingSection.test.tsx — 3 EDIT-01 tests |
| EDIT-02 (heuristic suggestions) | Satisfied | FieldMappingSection.test.tsx — EDIT-02 test; SuggestionsPanel.test.tsx — 3 EDIT-02 tests |
| EDIT-03 (persistence) | Satisfied | SuggestionsPanel.test.tsx — 4 EDIT-03 tests; MappingRow.test.tsx — MAP-04 tests (set/delete_field_mapping) |

## Test Suite Results

```
Test Files  5 passed (5)
Tests       70 passed (70)

Breakdown:
- heuristics.test.ts       : 8 passed
- MappingRow.test.tsx      : 11 passed
- SuggestionsPanel.test.tsx: 7 passed
- FieldMappingSection.test.tsx: 10 passed
- SettingsPage.test.tsx    : 34 passed
```

## Commits

| Hash | Task | Description |
|------|------|-------------|
| 4442f70 | Task 1 | feat(21-03): implement FieldMappingSection orchestrator + tests |
| b5573bf | Task 2 | feat(21-03): wire FieldMappingSection into SettingsPage + add 29 i18n keys |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MappingRow.test.tsx and SuggestionsPanel.test.tsx used i18n key-fallback strings**

- **Found during:** Task 2 (after adding en.json/sk.json keys)
- **Issue:** Tests written in Plan 02 matched against raw i18n keys (e.g., `settings.fieldMapping.deleteAriaLabel`) as text because translations weren't in en.json yet. After adding translations in Task 2, the rendered text changed to the actual English strings, breaking 11 tests.
- **Fix:** Updated test assertions to match translated strings: `"Remove mapping for labels"`, `"Remove"`, `"Accept severity"`, `"Dismiss severity"`, `"Suggestions (2)"`.
- **Files modified:** `src/features/field-mapping/__tests__/MappingRow.test.tsx`, `src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx`

**2. [Rule 2 - Missing functionality] data-testid on Refresh button**

- **Found during:** Task 1 test implementation
- **Issue:** Tests in `FieldMappingSection.test.tsx` that look for the Refresh button by aria-label would fail because the i18n key `settings.fieldMapping.refreshSchema` is not in en.json at test-write time (Task 2 adds it). Using aria-name `/Refresh schema/i` worked after Task 2, but the test needs the button to be findable robustly.
- **Fix:** Added `data-testid="refresh-schema-btn"` to the Refresh button in `FieldMappingSectionHeader`. Tests use `screen.getByTestId('refresh-schema-btn')`.

### Design Choice (not a deviation)

**window.prompt for Add Row:** The plan explicitly noted using `window.prompt` as a deliberately minimal approach for adding custom field mappings (MAP-03). This is documented here as intentional. A future polish can replace the prompt with a combobox populated from discovered source fields.

## Known Stubs

None — all user-facing data flows are wired:
- `get_field_mapping` → loaded and rendered on mount
- `schemaCacheStore` → source + target schema loaded and cached
- Drift detection → live via useMemo against real cache
- Suggestions → live via useMemo using findNameMatchSuggestion
- Refresh → calls real schemaCacheStore.refresh + loadSchema

The only simplification is `window.prompt` for "Add Row" — a non-stub (it's functional), just minimal UX.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what was documented in the plan's threat model (T-21-08 through T-21-12). All mitigations applied as planned.

## Self-Check: PASSED

**Files verified:**
- `src/features/field-mapping/FieldMappingSection.tsx` — FOUND
- `src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` — FOUND

**Commits verified:**
- `4442f70` — FOUND
- `b5573bf` — FOUND

**Tests:** 70 passed, 0 failed, 0 todo

**i18n parity:** 29 keys in both en.json and sk.json

**TypeScript:** 0 errors in field-mapping or SettingsPage (1 pre-existing unrelated error in connectionStore.probe.test.ts)
