---
phase: quick-260429-nhs
plan: 01
subsystem: field-mapping
tags: [bug-fix, field-mapping, rust, typescript, sqlite, tdd]
dependency_graph:
  requires: []
  provides: [typed-schema-seeds, null-migration, suggestion-persist]
  affects: [field_mapping_db, FieldMappingSection, copy-pipeline]
tech_stack:
  added: []
  patterns: [rusqlite-migration, zustand-async-persist]
key_files:
  created: []
  modified:
    - src-tauri/src/field_mapping_db.rs
    - src/features/field-mapping/FieldMappingSection.tsx
decisions:
  - "update_null_schema_defaults extracted as pub(crate) fn for testability (required by null_schema_migration_updates_existing_rows test)"
  - "Migration runs before seed in both open() and open_in_memory() — ensures repair on first open"
  - "Async conversion of suggestion handlers follows handleSelectNewSource reference pattern exactly"
metrics:
  duration: 12
  completed_date: "2026-04-28T22:38:24Z"
  tasks: 2
  files: 2
---

# Phase quick-260429-nhs Plan 01: Fix Field Mappings Not Applied on Copy Summary

**One-liner:** Fixed two silent copy failures: NULL schema seeds now store typed JSON (description/labels/priority/assignee/reporter route correctly in pipeline), and accepted/dismissed suggestions now persist to DB via invoke before local state update.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix seed_defaults_if_empty with typed schema JSON + NULL migration | 8172a04 | src-tauri/src/field_mapping_db.rs |
| 2 | Fix handleAcceptSuggestion and handleDismissSuggestion to persist via invoke | dde6de4 | src/features/field-mapping/FieldMappingSection.tsx |

## What Was Fixed

### Bug 1 — Rust: NULL schema seeds caused silent field drops

`seed_defaults_if_empty` inserted the 5 system defaults with `source_schema_json = NULL`. When read back, NULL deserialized to `FieldSchemaType::Any`. In `pipeline.rs`, the dispatchers (`is_description_row`, `is_user_field`, etc.) all check for typed variants — `Any` falls through to `transform_identity` which returns `Value::Null`. Result: description, labels, priority, assignee, and reporter were all silently dropped from every copy payload.

Fix: The 5 defaults now insert typed schema JSON strings. A `update_null_schema_defaults` migration runs before seed in both `open()` and `open_in_memory()` to repair any existing production DBs.

### Bug 2 — TypeScript: Suggestions accepted/dismissed in UI but lost on restart

`handleAcceptSuggestion` and `handleDismissSuggestion` called `updateRow()` (Zustand local state) but never `invoke('set_field_mapping')`. On app restart the row disappeared.

Fix: Both handlers converted to `async`, `invoke('set_field_mapping', { row })` called before `updateRow`, wrapped in try/catch with `toast.error` on failure — matching the `handleSelectNewSource` reference pattern exactly.

## Verification

- `cargo test "field_mapping_db"` — 28 tests pass (including 2 new schema tests)
- `npx tsc --noEmit` — no new TypeScript errors (1 pre-existing error in test file)
- All pre-existing field_mapping_db tests continue to pass

## Deviations from Plan

None — plan executed exactly as written. The `update_null_schema_defaults` function was already specified in the plan's action section.

## Known Stubs

None.

## Threat Flags

None — fixes T-NHS-01 and T-NHS-02 as specified in the threat model.

## Self-Check: PASSED

- [x] src-tauri/src/field_mapping_db.rs — modified and committed (8172a04)
- [x] src/features/field-mapping/FieldMappingSection.tsx — modified and committed (dde6de4)
- [x] Commit 8172a04 exists in git log
- [x] Commit dde6de4 exists in git log
- [x] 28 field_mapping_db tests pass
- [x] TypeScript compiles clean (no new errors)
