# Phase 19: Mapping Persistence + CRUD Commands - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure Rust persistence layer — extend `field_mapping_db.rs` with two new tables (`field_mapping` + `mapping_meta`) in the existing `mapping.db`, seed 5 hardcoded default mapping rows at first open, and expose 3 new Tauri CRUD commands: `get_field_mapping`, `set_field_mapping`, `delete_field_mapping`.

**In scope:**
- `field_mapping` SQLite table in `field_mapping_db.rs` (alongside existing `field_schema_cache`)
- `mapping_meta` table for tracking first-run / seeding state
- 5 default rows seeded at `FieldMappingDb::open` when table is empty
- `get_field_mapping` — returns `Vec<FieldMappingRow>`
- `set_field_mapping` — single-row upsert by `source_field_id`
- `delete_field_mapping` — deletes by `source_field_id`
- Tests covering seed, upsert, delete, and round-trip for each command

**Out of scope:**
- `refresh_field_schema_cache` — already exists (Phase 17, `commands.rs:1298`)
- Mapping editor UI (Phase 21)
- Per-copy override panel (Phase 22)
- `copy_ticket_v2` wiring (Phase 23)
- Frontend TypeScript types or bindings (Phase 21/22 will add these)

</domain>

<decisions>
## Implementation Decisions

### Default Seeding Trigger
- **D-01:** Seed defaults at `FieldMappingDb::open` — runs unconditionally at app startup (already called in `main.rs`). Seed logic checks `COUNT(*) = 0` on `field_mapping`; only seeds when the table is completely empty.
- **D-02:** Once any row exists (even a user-added custom one), no re-seeding. Uses `INSERT OR IGNORE` per default row so individual deletions by the user are permanent — the deleted default stays gone.
- **D-03:** Default rows use hardcoded standard Jira field IDs. These are stable Jira system fields that never vary across instances: `description`, `labels`, `priority`, `assignee`, `reporter`.

### CRUD Command Design
- **D-04:** `set_field_mapping(row: FieldMappingRow)` — single-row upsert keyed on `source_field_id`. `ON CONFLICT(source_field_id) DO UPDATE` replaces the row. Phase 21 (editor) and Phase 22 (override panel) each call once per changed row.
- **D-05:** `delete_field_mapping(source_field_id: String)` — deletes by `source_field_id` (natural key). Phase 21 passes the source field ID directly; no need for the caller to track SQLite row IDs.
- **D-06:** `get_field_mapping()` — returns all rows ordered by `id ASC` (insertion order preserves default-first presentation in Phase 21's editor).

### Default Transformer Kinds
- **D-07:** Default mapping rows use these `transformer_kind` values (must match Phase 18's pipeline routing):
  - `description` → `"wiki_to_adf"` (wiki markup to ADF via `htmltoadf`)
  - `assignee` → `"user"` (name/key → accountId lookup)
  - `reporter` → `"user"` (name/key → accountId lookup)
  - `labels` → `"identity"` (plain pass-through; label values are strings on both sides)
  - `priority` → `"priority"` (dedicated transformer: extracts `{id}` from v2's `{name, id}` object)
- **D-08:** `priority` gets its own `transformer_kind = "priority"` (not `"identity"`). Phase 18's pipeline adds a `priority` transformer that handles the v2 `{name, id}` → v3 `{id}` shape difference. Phase 19 seeds the row with this kind so the pipeline routes correctly.

### Claude's Discretion
- Exact SQL schema for `field_mapping` table columns (suggest: `id`, `source_field_id UNIQUE`, `target_field_id`, `transformer_kind`, `source_schema_json`, `target_schema_json`, `created_at`, `updated_at`)
- Whether `mapping_meta` is a dedicated table or a simple `key/value` config table (a `key/value` table is simpler and reusable for future metadata)
- Whether `FieldMappingRow` stays in `field_transform/mod.rs` or moves to `field_mapping_db.rs` — given Phase 18's transform pipeline imports it heavily, keeping it in `field_transform/mod.rs` and having `field_mapping_db.rs` import from there avoids a circular dependency
- Default `target_field_id` values for the 5 seed rows — same as `source_field_id` (Jira system field IDs are the same on both sides for these 5 fields)
- Default `source_schema` / `target_schema` values for seed rows — either store them as placeholder `FieldSchemaType::Other` until Phase 21 enriches them, or leave schema fields nullable for seed rows
- Error type for "row not found" on delete (return `AppResult<()>` with `Ok(())` if already deleted is idempotent)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context (always)
- `.planning/PROJECT.md` — Project vision, constraints. Key decisions: "db-per-concern pattern", "separate mapping.db SQLite file"
- `.planning/REQUIREMENTS.md` — v0.4.0 acceptance criteria. Phase 19 covers MAP-01, MAP-02.
- `.planning/ROADMAP.md` §"Phase 19: Mapping Persistence + CRUD Commands" — Goal, dependencies, success criteria, phase boundary

### Existing mapping.db infrastructure (Phase 17)
- `src-tauri/src/field_mapping_db.rs` — **Primary file to extend.** Contains `FieldMappingDb` struct, `field_schema_cache` table, `open()` / `open_in_memory()` methods, and a code comment at the top: "Phase 19 will extend this file with `field_mapping` and `mapping_meta` tables." Add new tables here, do NOT create a new file.
- `src-tauri/src/main.rs:140-143` — `mapping.db` already opened and managed: `FieldMappingDb::open(&mapping_db_path)` + `app.manage(Arc::new(Mutex::new(mapping_db)))`. The new commands receive `State<'_, Arc<Mutex<FieldMappingDb>>>`.
- `.planning/phases/17-field-discovery-mock-schema-fidelity/17-CONTEXT.md` — Phase 17 decisions for `FieldMappingDb` lifecycle, `field_schema_cache` schema, db-per-concern pattern

### FieldMappingRow struct (Phase 18)
- `src-tauri/src/field_transform/mod.rs:135` — `FieldMappingRow` struct defined here (Phase 18). Has fields: `source_field_id`, `target_field_id`, `transformer_kind`, `source_schema: FieldSchemaType`, `target_schema: FieldSchemaType`. Phase 19 persists and loads this struct to/from `field_mapping` table.
- `.planning/phases/18-v2-v3-translation-layer/18-CONTEXT.md` — Confirms Phase 18 defines `FieldMappingRow`; Phase 19 adds persistence layer beneath it

### Phase 17 command pattern (to mirror)
- `src-tauri/src/commands.rs:1152-1177` — `get_source_fields` and `get_target_fields` commands. Phase 19's 3 new commands follow the same `State<'_, Arc<Mutex<FieldMappingDb>>>` pattern.
- `src-tauri/src/commands.rs:1298` — `refresh_field_schema_cache` already exists (Phase 17). Phase 19 does NOT re-implement this; adds 3 new mapping CRUD commands alongside it.

### Established patterns
- `src-tauri/src/snapshot_db.rs` — db-per-concern reference: `Arc<Mutex<>>` pattern, `CREATE TABLE IF NOT EXISTS` migrations in `open()`, `open_in_memory()` for tests
- `src-tauri/src/triage_db.rs` — Another db-per-concern example; Phase 19 follows the same structural conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`FieldMappingDb::open` / `open_in_memory`** (`field_mapping_db.rs:39-52`): Already establishes the connection and runs `CREATE TABLE IF NOT EXISTS` migrations via `conn.execute_batch()`. Phase 19 adds new `CREATE TABLE IF NOT EXISTS` statements for `field_mapping` and `mapping_meta` in the same `execute_batch` call, then calls the seed function.
- **`FieldMappingRow`** (`field_transform/mod.rs:135`): Already defined and used by the Phase 18 pipeline. Phase 19 adds `serde::Serialize/Deserialize` derives if not present, for JSON-serialising schema fields to SQLite TEXT columns.
- **`upsert_schema_row` pattern** (`field_mapping_db.rs:54-101`): `INSERT ... ON CONFLICT(...) DO UPDATE SET ...` pattern for upsert. Phase 19's `set_field_mapping` uses the identical approach keyed on `source_field_id`.

### Established Patterns
- **db-per-concern + `CREATE TABLE IF NOT EXISTS`**: Every db module runs migrations at `open()` — no separate migration runner. Phase 19 adds two new DDL statements to `FieldMappingDb::open`.
- **`Arc<Mutex<T>>` Tauri state**: `app.manage(Arc::new(Mutex::new(db)))` then `State<'_, Arc<Mutex<T>>>` in commands. All 3 new commands follow this pattern exactly.
- **`#[cfg(test)]` in-memory tests**: All db modules use `open_in_memory()` for unit tests. Phase 19 adds tests for seed logic, upsert, delete, and get.

### Integration Points
- **`FieldMappingDb::open` in `main.rs:141`**: Seeding logic runs here automatically — no new startup code needed elsewhere.
- **`commands.rs` near line 1298**: The 3 new CRUD commands are added alongside `refresh_field_schema_cache` in the commands module. Register them in `tauri::Builder::invoke_handler` (same location as other field mapping commands).
- **Phase 18 pipeline (`field_transform/pipeline.rs`)**: `apply_mapping` receives `mapping: &[FieldMappingRow]`. Phase 23 will call `get_field_mapping` to load rows from SQLite and pass them here. Phase 19 makes this load possible.

</code_context>

<specifics>
## Specific Ideas

- **`INSERT OR IGNORE` per default row**: The seed check is `COUNT(*) = 0` on `field_mapping`. If empty, run `INSERT OR IGNORE` for each of the 5 defaults. This is idempotent and safe to call on every `open()` — if somehow called twice, the second call is a no-op.
- **`priority` transformer kind**: Phase 18's pipeline must add a `priority` arm to its transformer routing (alongside `user`, `wiki_to_adf`, `identity`). Phase 19's seed row stores `transformer_kind = "priority"` — the planner should note this as a coordination point with Phase 18's already-shipped code.
- **Default `target_field_id` = same as source**: For the 5 standard system fields, source and target field IDs are identical (`"description"`, `"labels"`, etc.). Seed rows can set `target_field_id = source_field_id`.

</specifics>

<deferred>
## Deferred Ideas

- **Components + fixVersions in default seed**: Raised during discussion, deferred. User confirmed 5 fields are enough for the default seed; components and fix versions can be added by the user in Phase 21's mapping editor.
- **Person resolution SQLite cache**: A persistent cache for resolved `accountId`s with TTL. Deferred to Phase 22+ (in-session HashMap is sufficient for Phase 18/19).
- **Frontend TypeScript types for FieldMappingRow**: Phase 19 is Rust-only; TypeScript bindings are added in Phase 21 when the mapping editor UI is built.

</deferred>

---

*Phase: 19-mapping-persistence-crud-commands*
*Context gathered: 2026-04-27*
