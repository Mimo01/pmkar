---
plan: 17-02
phase: 17-field-discovery-mock-schema-fidelity
status: complete
duration: ~30 min
self_check: PASSED
---

## Summary

Rust type system and SQLite persistence layer for field schema caching established: `FieldSchemaType` discriminated-union enum, `FieldSchema` / `FieldSide` / `CreatemetaResponse` / `IssueTypeRef` structs in `field_discovery.rs`, `FieldMappingDb` wrapping `mapping.db` in `field_mapping_db.rs`, and app startup wiring in `main.rs`.

## What Was Built

### Task 1 — FieldSchemaType enum + supporting types (field_discovery.rs)
- `FieldSchemaType`: serde-tagged enum (`#[serde(tag = "type", rename_all = "kebab-case")]`) with 11 variants — String, Number, Date, Datetime, User, Array (with `items` field), Option_ (`#[serde(rename = "option")]`), OptionWithChild, Issuetype, Priority, `#[serde(other)] Any`
- Unknown `schema.type` values (e.g. "watches", "timetracking") fall through to `Any` — Pitfall A satisfied
- `FieldSchema`: camelCase serde struct; fields `field_id`, `name`, `required`, `has_default_value`, `schema`, `allowed_values`, `operations`
- `FieldSide`: Source/Target enum serializing as lowercase "source"/"target"; `as_str()` helper for SQLite CHECK constraint
- `CreatemetaResponse`, `IssueTypeRef`, `IssueTypesResponse` structs for createmeta pagination
- 16 inline `#[cfg(test)]` unit tests — all serde round-trips + unknown-type fallthrough + FieldSide serialization
- `pub mod field_discovery;` added to `lib.rs`

### Task 2 — FieldMappingDb (field_mapping_db.rs)
- `field_schema_cache` DDL with `UNIQUE(side, project_key, issuetype_id, field_id)` constraint
- `idx_fsc_key` index on `(side, project_key, issuetype_id)` for cache-hit lookups
- Methods: `open(path)`, `open_in_memory()`, `upsert_schema_row()` (ON CONFLICT DO UPDATE), `get_cached_schemas()`, `get_cached_schema_hash()`, `clear_cache_for()`
- `compute_schema_hash(raw_json_bytes)` — SHA-256 lowercase hex, no canonicalization (D-04)
- 9 inline unit tests proving round-trips, upsert-overwrite, NULL key handling, cache miss, clear isolation, hash format
- `pub mod field_mapping_db;` added to `lib.rs`

### Task 3 — main.rs wiring (orchestrator-completed due to write-block)
- Import updated to include `field_mapping_db::FieldMappingDb`
- `mapping.db` opened immediately after `snapshots.db` in setup closure
- Registered as `Arc<Mutex<FieldMappingDb>>` via `app.manage`

## Key Files

```
key-files:
  created:
    - src-tauri/src/field_discovery.rs
    - src-tauri/src/field_mapping_db.rs
  modified:
    - src-tauri/src/lib.rs
    - src-tauri/src/main.rs
```

## Verification

- `cargo build --manifest-path src-tauri/Cargo.toml` — exit 0
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` — exit 0
- `cargo test --manifest-path src-tauri/Cargo.toml --lib` — 84/84 pass

## Commits

- `be509a8` feat(17-02): define FieldSchemaType enum and FieldSchema types in field_discovery.rs
- `1f45bb1` feat(17-02): create FieldMappingDb with field_schema_cache table and open mapping.db in main

## Notes

Agent write-block after first commit prevented Task 2 and Task 3 from being committed in the worktree. Orchestrator completed the remaining tasks inline after worktree merge, resulting in clean compilation and passing tests.
