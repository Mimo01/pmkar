---
phase: 27-add-static-value-mapping-to-configurable-field-mapping
plan: "02"
subsystem: rust-backend
tags: [rust, sqlite, pipeline, static-mapping, field-mapping, wave-2]

requires:
  - phase: 27-01
    provides: Wave 0 failing Rust tests (STATIC-DB-01, STATIC-DB-02, STATIC-PIPE-01, STATIC-PIPE-02) that this plan turns green

provides:
  - "FieldMappingRow.static_value: Option<String> with serde(default, skip_serializing_if = Option::is_none)"
  - "migrate_static_value_column() PRAGMA-gated ALTER TABLE migration called from both open() and open_in_memory()"
  - "upsert_mapping_row and get_all_mapping_rows round-trip static_value through SQLite"
  - "apply_mapping static branch with target-schema dispatch: Array<option> → [{id},...]; Array<string> → [...]; Option/OptionWithChild parses pre-serialized JSON; scalar fallback"
  - "6 Rust tests green: STATIC-DB-01, STATIC-DB-02, STATIC-PIPE-01, STATIC-PIPE-02, plus 2 new array-splitting tests"

affects:
  - 27-03 (TypeScript types add staticValue — now has Rust backend to be in sync with)
  - 27-04 (UI can now invoke set_field_mapping with staticValue and have it persisted and dispatched)

tech-stack:
  added: []
  patterns:
    - "PRAGMA table_info idempotent migration guard for new nullable column"
    - "rusqlite params![] parameterized binding for Option<String> (T-27-02-01 SQL-injection mitigation)"
    - "apply_mapping static branch: match on FieldSchemaType before source_issue.pointer() call (Pitfall 1 avoidance)"
    - "comma-split + trim + filter-non-empty for array static values in Rust pipeline"

key-files:
  created: []
  modified:
    - src-tauri/src/field_transform/mod.rs
    - src-tauri/src/field_mapping_db.rs
    - src-tauri/src/field_transform/pipeline.rs
    - src-tauri/src/field_transform/user.rs
    - src-tauri/src/commands.rs

key-decisions:
  - "Static branch placement: inserted as FIRST check in apply_mapping for-loop, before source_issue.pointer() on line 90 — prevents sentinel __static__ ID being used as JSON pointer path"
  - "null_schema_migration_updates_existing_rows test needed migrate_static_value_column call added — test created its own Connection without going through FieldMappingDb::open"
  - "Four new pipeline tests: STATIC-PIPE-01, STATIC-PIPE-02 (activated Wave 0 TODOs), plus STATIC-PIPE-03 (array-of-option) and STATIC-PIPE-04 (array-of-string) added inline"

duration: 7min
completed: 2026-05-20
---

# Phase 27 Plan 02: Rust Backend for Static Value Mapping Summary

**Rust backend for static value mapping complete: FieldMappingRow gains static_value field, SQLite migration adds the column, upsert/get round-trips it, and apply_mapping dispatches on target_schema to produce correct Jira Cloud v3 write-shapes for array and scalar static values.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-20T12:31:11Z
- **Completed:** 2026-05-20T12:38:02Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

### Task 1: Extend FieldMappingRow struct

- Added `pub static_value: Option<String>` with `#[serde(default, skip_serializing_if = "Option::is_none")]` to `FieldMappingRow` in `field_transform/mod.rs`
- Updated transformer_kind doc comment to include `"static"`
- Added `static_value: None` to all existing construction sites: pipeline.rs test helpers `row()` and `row_with_kind()`, `user.rs` test helper, `commands.rs` test helper, and all `field_mapping_db.rs` test literals
- Activated STATIC-DB-02 Wave 0 test (replaced TODO comments with `static_value: Some("hello".into())`)
- `cargo check -p pmkar` exits 0

### Task 2: DB migration + upsert/get round-trip

- Added `migrate_static_value_column()` using PRAGMA table_info guard (same pattern as `migrate_mapping_audit_log_columns`)
- Called from both `FieldMappingDb::open()` and `FieldMappingDb::open_in_memory()` after the audit log migration
- Updated `upsert_mapping_row` INSERT to include `static_value` as column 6 (`?6`) with `ON CONFLICT DO UPDATE SET static_value = excluded.static_value`
- Updated `get_all_mapping_rows` SELECT to include `static_value` as column 5, read with `row.get(5)?`
- STATIC-DB-01 and STATIC-DB-02 both green; all 40 field_mapping_db tests pass

### Task 3: Static branch in apply_mapping

- Inserted static branch as FIRST check inside `for row in mapping {`, before the `source_issue.pointer()` call
- Dispatches on `row.target_schema`:
  - `Array { items: "option" }` → split + trim + filter-non-empty + map to `json!({"id": s})` → `Value::Array`
  - `Array { .. }` (catch-all for string/group/version/component/etc.) → split + trim + filter + `Value::String` → `Value::Array`
  - `Option_ { .. } | OptionWithChild { .. }` → `serde_json::from_str` fallback to `Value::String`
  - `_` → `serde_json::from_str` fallback to `Value::String`
- `static_value: None` → skip silently (pending row)
- Activated STATIC-PIPE-01 and STATIC-PIPE-02 Wave 0 test assertions
- Added STATIC-PIPE-03 (`apply_mapping_static_array_of_option_splits_comma_separated_input`) and STATIC-PIPE-04 (`apply_mapping_static_array_of_string_splits_comma_separated_input`)
- All 22 pipeline tests pass; all 224 lib tests pass; `cargo clippy --lib -D warnings` exits 0

## Task Commits

1. **Task 1: Extend FieldMappingRow struct** - `8b8cfaa` (feat)
2. **Task 2: DB migration + upsert/get round-trip** - `e67968d` (feat)
3. **Task 3: Static branch in apply_mapping** - `bd05bd5` (feat)

## Files Created/Modified

- `src-tauri/src/field_transform/mod.rs` — Added `static_value: Option<String>` to `FieldMappingRow`; updated doc comment
- `src-tauri/src/field_mapping_db.rs` — Added `migrate_static_value_column()`; updated `upsert_mapping_row` and `get_all_mapping_rows`; updated all test construction sites; activated STATIC-DB-02
- `src-tauri/src/field_transform/pipeline.rs` — Added static branch at top of dispatch loop; activated STATIC-PIPE-01/02; added STATIC-PIPE-03/04; updated test helpers
- `src-tauri/src/field_transform/user.rs` — Updated `user_field_row` test helper with `static_value: None`
- `src-tauri/src/commands.rs` — Updated test helper construction site with `static_value: None`

## Decisions Made

- Static branch is the FIRST check in the dispatch loop to prevent the `__static__` sentinel from reaching `source_issue.pointer()` (Pitfall 1)
- `null_schema_migration_updates_existing_rows` test required `migrate_static_value_column` call added because it creates a raw `Connection` without going through `FieldMappingDb::open` — classified as Rule 1 auto-fix (bug: test would fail without the migration)
- Two new tests added (STATIC-PIPE-03, STATIC-PIPE-04) to cover the array-splitting behavior since the Plan 01 Wave 0 tests did not include those cases

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] null_schema_migration_updates_existing_rows test regression**
- **Found during:** Task 2 — first full test suite run after adding the SELECT column
- **Issue:** Test creates a raw `Connection`, runs only `update_null_schema_defaults`, wraps in `FieldMappingDb`, then calls `get_all_mapping_rows`. After Task 2 added `static_value` to the SELECT, this test failed with "no such column: static_value" because the migration was not called for the raw connection
- **Fix:** Added `migrate_static_value_column(&conn).expect("static_value migration");` before `update_null_schema_defaults` in the test body
- **Files modified:** `src-tauri/src/field_mapping_db.rs`
- **Commit:** `e67968d`

**2. [Rule 2 - doc_markdown clippy] Missing backticks in doc comments**
- **Found during:** Task 3 clippy check
- **Issue:** `transformer_kind == "static"` in mod.rs doc comment and `PRAGMA table_info` in field_mapping_db.rs doc comment lacked backticks, triggering `-D warnings` clippy errors
- **Fix:** Added backticks around `transformer_kind` and `table_info`
- **Files modified:** `src-tauri/src/field_transform/mod.rs`, `src-tauri/src/field_mapping_db.rs`
- **Commit:** `bd05bd5`

## Known Stubs

None — all static_value round-trip paths are fully wired end-to-end in the Rust layer.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what was planned in the plan's `<threat_model>`. The SQL injection mitigation (T-27-02-01) is confirmed: `params![row.static_value, ...]` uses rusqlite parameterized binding, not string interpolation.

---
*Phase: 27-add-static-value-mapping-to-configurable-field-mapping*
*Completed: 2026-05-20*
