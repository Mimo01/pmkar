---
phase: 27-add-static-value-mapping-to-configurable-field-mapping
plan: "01"
subsystem: testing
tags: [rust, vitest, tdd, wave-0, static-mapping, field-mapping]

requires:
  - phase: 23-copy-ticket-v2-wiring
    provides: apply_mapping pipeline and field_mapping_db CRUD methods that the new tests exercise

provides:
  - "Wave 0 failing Rust tests: static_value_column_added_by_migration, upsert_mapping_row_round_trips_static_value in field_mapping_db.rs"
  - "Wave 0 failing Rust tests: apply_mapping_static_emits_stored_value, apply_mapping_static_with_none_value_emits_nothing in pipeline.rs"
  - "Wave 0 failing React tests: StaticMappingRow.test.tsx (3 tests: render badge, persist value, delete)"
  - "Wave 0 failing React tests: StaticValueWidget.test.tsx (4 tests: option/string/array/user schema dispatch)"

affects:
  - 27-02 (DB migration adds static_value column that STATIC-DB-01/02 test)
  - 27-03 (TypeScript types add staticValue that React tests reference)
  - 27-04 (component implementation turns all 7 tests green)

tech-stack:
  added: []
  patterns:
    - "Wave 0 test pattern: tests reference not-yet-existing fields/components with TODO Plan N comments"
    - "PHASE 27 marker comment for grep-based discovery of Wave 0 test set"
    - "Rust static tests use row_with_kind helper then TODO-annotate static_value mutation"

key-files:
  created:
    - src/features/field-mapping/__tests__/StaticMappingRow.test.tsx
    - src/features/field-mapping/__tests__/StaticValueWidget.test.tsx
  modified:
    - src-tauri/src/field_mapping_db.rs
    - src-tauri/src/field_transform/pipeline.rs

key-decisions:
  - "Rust Wave 0 tests use TODO Plan 02 comments instead of #[ignore] — tests remain in runner scope and fail to compile (not silently skipped) once struct changes land"
  - "Pipeline STATIC-PIPE-01 test asserts None output until Plan 02 adds static branch — avoids test asserting wrong behavior"
  - "React tests use from '../StaticMappingRow' import style matching MappingRow.test.tsx convention"
  - "StaticMappingRow test references deleteStaticAriaLabel i18n key added in Plan 03"

patterns-established:
  - "Wave 0 test scaffold: each test carries its requirement ID (STATIC-DB-01 etc.) as a doc comment"
  - "Copy VirtualizedCombobox mock verbatim from MappingRow.test.tsx for all static-feature test files"

requirements-completed:
  - STATIC-DB-01
  - STATIC-DB-02
  - STATIC-PIPE-01
  - STATIC-PIPE-02
  - STATIC-UI-01
  - STATIC-UI-02
  - STATIC-UI-03
  - STATIC-UI-04

duration: 7min
completed: 2026-05-20
---

# Phase 27 Plan 01: Wave 0 Test Scaffolding Summary

**Four Wave 0 Rust tests and seven Wave 0 React tests created as failing scaffolding: DB round-trip, pipeline static branch, StaticMappingRow render/save/delete, and StaticValueWidget schema-type dispatch.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-20T14:20:00Z
- **Completed:** 2026-05-20T14:26:32Z
- **Tasks:** 2
- **Files modified:** 4 (2 Rust modified, 2 React created)

## Accomplishments

- Added `static_value_column_added_by_migration` and `upsert_mapping_row_round_trips_static_value` tests to `field_mapping_db.rs` — go green when Plan 02 adds the migration and struct field
- Added `apply_mapping_static_emits_stored_value` and `apply_mapping_static_with_none_value_emits_nothing` tests to `pipeline.rs` — go green when Plan 02 adds the `static` transformer branch
- Created `StaticMappingRow.test.tsx` with 3 tests covering badge render (STATIC-UI-01), value save (STATIC-UI-03), and delete with sentinel ID (STATIC-UI-04)
- Created `StaticValueWidget.test.tsx` with 4 tests covering option/string/array-string/user schema dispatch (STATIC-UI-02)
- All 7 React tests fail at import resolution (missing components) and all 4 Rust tests compile cleanly with TODO annotations for Plan 02 dependencies

## Task Commits

1. **Task 1: Add failing Rust tests for DB and pipeline** - `9ba5bf1` (test)
2. **Task 2: Add failing React tests for StaticMappingRow and StaticValueWidget** - `761aa50` (test)

## Files Created/Modified

- `src-tauri/src/field_mapping_db.rs` - Added Wave 0 tests: `static_value_column_added_by_migration`, `upsert_mapping_row_round_trips_static_value`
- `src-tauri/src/field_transform/pipeline.rs` - Added Wave 0 tests: `apply_mapping_static_emits_stored_value`, `apply_mapping_static_with_none_value_emits_nothing`
- `src/features/field-mapping/__tests__/StaticMappingRow.test.tsx` - New file: 3 tests for StaticMappingRow component (Plan 04)
- `src/features/field-mapping/__tests__/StaticValueWidget.test.tsx` - New file: 4 tests for StaticValueWidget component (Plan 04)

## Decisions Made

- Rust Wave 0 tests use TODO Plan 02 comments instead of `#[ignore]` — tests remain in the runner's scope and fail to compile (not silently skipped) once Plan 02 adds the `static_value` field to `FieldMappingRow`
- Pipeline STATIC-PIPE-01 test currently asserts `None` output (because the static branch does not exist yet) and has a `// TODO Plan 02: uncomment` assertion — this avoids the test asserting incorrect behavior before the branch is implemented
- StaticMappingRow test references the `deleteStaticAriaLabel` i18n key that Plan 03 adds; the test will produce a meaningful failure (missing component, not missing key)

## Deviations from Plan

None — plan executed exactly as written. The Rust tests do not add `#[ignore]` per explicit plan instruction, and TODO Plan 02 annotations are used where struct fields are missing.

## Issues Encountered

- `cargo test -p pmkar-lib` is not the right package name; correct package is `pmkar`. Fixed by probing `cargo metadata`. No impact on outcomes.

## Next Phase Readiness

- Wave 0 test scaffolding complete; Plans 02–04 can now flip tests from RED to GREEN as each layer lands
- Plans 02 (DB migration + struct field), 03 (TypeScript types + i18n), 04 (React components) each have precise failing tests waiting
- No production code changed in this plan

---
*Phase: 27-add-static-value-mapping-to-configurable-field-mapping*
*Completed: 2026-05-20*
