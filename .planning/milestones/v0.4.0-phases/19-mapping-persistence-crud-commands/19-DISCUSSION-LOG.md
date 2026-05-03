# Phase 19: Mapping Persistence + CRUD Commands - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 19-mapping-persistence-crud-commands
**Areas discussed:** Default seeding trigger, set_field_mapping scope, Default transformer kinds

---

## Default Seeding Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| At FieldMappingDb::open | Seed unconditionally at app startup using hardcoded standard Jira field IDs; works before discovery runs | ✓ |
| After discovery completes | Seed only once field_schema_cache is populated; requires coupling Phase 17's discovery path to seeding logic | |
| Lazy — first get_field_mapping call | Seed on first call to command when table is empty; defers until frontend asks | |

**User's choice:** At FieldMappingDb::open (hardcoded standard field IDs)

| Follow-up option | Description | Selected |
|--------|-------------|----------|
| Skip if any row exists | INSERT OR IGNORE per default row; once any row exists, no re-seeding; deleted defaults stay gone | ✓ |
| Skip if all 5 defaults present | Count expected rows; re-seed any missing defaults even after user customization | |

**User's choice:** Skip if any row exists (INSERT OR IGNORE approach)

---

## set_field_mapping Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Single-row upsert | set_field_mapping(row: FieldMappingRow) — upsert one row by source_field_id; Phase 21/22 call per changed row | ✓ |
| Full batch replace | set_field_mapping(rows: Vec<FieldMappingRow>) — atomically replace entire mapping; caller must always send all rows | |

**User's choice:** Single-row upsert keyed on source_field_id

| Follow-up (delete key) | Description | Selected |
|--------|-------------|----------|
| By source_field_id | delete_field_mapping(source_field_id: String) — natural key, matches upsert key | ✓ |
| By row ID | delete_field_mapping(id: i64) — Phase 21 would need to track SQLite row IDs | |

**User's choice:** By source_field_id

---

## Default Transformer Kinds

| Option | Description | Selected |
|--------|-------------|----------|
| Own 'priority' kind | transformer_kind = 'priority'; Phase 18 pipeline adds dedicated priority transformer for v2 {name,id} → v3 {id} | ✓ |
| Handle under 'identity' | Keep priority as 'identity'; pipeline handles shape difference internally when it detects priority field schema | |

**User's choice:** Own 'priority' kind — cleaner separation

| Follow-up (default field set) | Description | Selected |
|--------|-------------|----------|
| Those 5 are enough | description, assignee, reporter, labels, priority — covers meaningful mappable fields | ✓ |
| Add components too | Seed components with transformer_kind = 'component' | |
| Add both components + fixVersions | Seed both components and fix versions with respective transformer kinds | |

**User's choice:** 5 fields are enough; components/fixVersions can be added by user in Phase 21

---

## Claude's Discretion

- Exact SQL schema for `field_mapping` table columns
- Whether `mapping_meta` is a dedicated table or `key/value` config table
- Whether `FieldMappingRow` moves to `field_mapping_db.rs` or stays in `field_transform/mod.rs`
- Default `target_field_id` values for seed rows (same as source_field_id for system fields)
- Default `source_schema` / `target_schema` for seed rows (nullable or placeholder)
- Error handling for "row not found" on delete (idempotent Ok(()))

## Deferred Ideas

- **Components + fixVersions as seed defaults** — raised, declined; user confirmed 5 fields sufficient
- **Person resolution SQLite cache with TTL** — deferred, in-session HashMap sufficient (Phase 18 note)
- **Frontend TypeScript types for FieldMappingRow** — Phase 19 is Rust-only; bindings added in Phase 21
