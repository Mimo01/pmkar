---
phase: 21
plan: 02
status: complete
completed: "2026-04-28"
self_check: PASSED
---

# Plan 21-02 Summary: MappingRow, SuggestionsPanel, DriftWarning Leaf Components

## What Was Built

Three leaf components for the Mapping Editor, all using per-row auto-save via Tauri invoke with inline "Saved" feedback and sonner toast on errors.

### Components Created

**`src/features/field-mapping/DriftWarning.tsx`** (36 lines)
- Amber alert pill rendered when a row's targetFieldId is missing from the target schema cache
- Renders with `role="alert"` for WCAG AA compliance
- Shows the drifted target field ID with a Remove button
- Calls `delete_field_mapping` on remove to clean up the stale row

**`src/features/field-mapping/MappingRow.tsx`** (139 lines)
- Single source → target → transformer row with per-row auto-save (D-09)
- Target combobox uses `VirtualizedCombobox` (mocked in tests with a simple select)
- Transformer combobox filtered by `getTransformerOptions(targetSchema)`
- On target/transformer change: calls `invoke('set_field_mapping', {...})` immediately
- On delete: calls `invoke('delete_field_mapping', {sourceFieldId})`
- When `isDrifted=true`: replaces target combobox with `DriftWarning` component
- Inline "Saved" checkmark shown for ~1500ms after successful auto-save
- `toast.error(t('settings.fieldMapping.saveError'))` on any invoke failure

**`src/features/field-mapping/SuggestionsPanel.tsx`** (114 lines)
- Collapsible panel listing unmapped source fields with heuristic-matched target suggestions
- Returns null when suggestions array is empty (panel fully hidden per EDIT-02)
- Accept: calls `invoke('set_field_mapping', ...)` with suggested target + triggers `onAccept` callback
- Dismiss: calls `invoke('set_field_mapping', {targetFieldId: ''})` — empty string sentinel (D-07)
- On error: `toast.error(t('settings.fieldMapping.saveError'))`

### Test Suites Updated

**`MappingRow.test.tsx`** — replaced all 8 `it.todo` stubs with 11 passing assertions:
- Auto-save on target combobox change (MAP-04)
- Auto-save on transformer combobox change (MAP-04)
- Delete button triggers `delete_field_mapping` (MAP-04)
- Inline "Saved" indicator after successful save (MAP-04)
- `toast.error` on invoke failure (MAP-04)
- `DriftWarning` rendered when `isDrifted=true` (MAP-05)
- Transformer options filtered by target schema (MAP-04)

**`SuggestionsPanel.test.tsx`** — replaced all 7 `it.todo` stubs with 7 passing assertions:
- Renders one row per suggestion (EDIT-02)
- Header text with count (EDIT-02)
- Returns null when empty (EDIT-02)
- Accept calls `set_field_mapping` with target fieldId (EDIT-03)
- Dismiss calls `set_field_mapping` with empty string sentinel (EDIT-03)
- `toast.error` on failure (EDIT-03)
- Accepted suggestion removed from panel (EDIT-03)

## Test Results

```
Test Files  2 passed (2)
Tests       18 passed (18)
```

18 tests passing — all MAP-03, MAP-04, MAP-05, EDIT-02, EDIT-03 requirements covered.

## Key Decisions Made

- VirtualizedCombobox mocked with a simple `<select>` in tests — ResizeObserver/@tanstack/react-virtual are unavailable in jsdom; behavioral contract (onChange called with selected item) is preserved
- `toast.error` called with i18n key `t('settings.fieldMapping.saveError')` — Plan 03 adds the key to en.json/sk.json; until then, tests use key fallback strings
- `DriftWarning` calls `delete_field_mapping` on remove rather than `set_field_mapping` — stale rows should be fully removed, not saved with a bad targetFieldId
- `SuggestionsPanel` accepts `onAccept`/`onDismiss` callbacks rather than owning state — allows `FieldMappingSection` (Plan 03) to update its row list after accept/dismiss without re-fetch

## Self-Check

- [x] All tasks executed (DriftWarning, MappingRow, SuggestionsPanel created; tests pass)
- [x] Each task committed individually (2 commits: DriftWarning+MappingRow, SuggestionsPanel)
- [x] 18 passing tests (11 MappingRow + 7 SuggestionsPanel)
- [x] Must-haves all satisfied: auto-save, delete, drift warning, suggestions accept/dismiss, toast errors, inline "Saved" indicator
- [x] No STATE.md or ROADMAP.md modifications

## Files Modified

| File | Action | Lines |
|------|--------|-------|
| `src/features/field-mapping/DriftWarning.tsx` | Created | 36 |
| `src/features/field-mapping/MappingRow.tsx` | Created | 139 |
| `src/features/field-mapping/SuggestionsPanel.tsx` | Created | 114 |
| `src/features/field-mapping/__tests__/MappingRow.test.tsx` | Replaced stubs | ~150 |
| `src/features/field-mapping/__tests__/SuggestionsPanel.test.tsx` | Replaced stubs | ~120 |
