---
phase: 19-mapping-persistence-crud-commands
plan: 01
subsystem: database
tags: [rust, rusqlite, sqlite, field-mapping, seeding, ddl]

# Dependency graph
requires:
  - phase: 17-field-discovery-mock-schema-fidelity
    provides: FieldMappingDb struct, open()/open_in_memory() with CREATE TABLE IF NOT EXISTS pattern, mapping.db lifecycle in main.rs
  - phase: 18-v2-v3-translation-layer
    provides: FieldMappingRow struct in field_transform/mod.rs with source_field_id, target_field_id, transformer_kind, source_schema, target_schema
provides:
  - field_mapping SQLite table (id, source_field_id UNIQUE, target_field_id, transformer_kind, source_schema_json, target_schema_json, created_at, updated_at)
  - mapping_meta SQLite table (key TEXT PRIMARY KEY, value TEXT NOT NULL)
  - seed_defaults_if_empty private function with COUNT=0 guard and INSERT OR IGNORE for 5 default rows
  - Both open() and open_in_memory() extended to run new DDL and call seeder
  - 4 new tests covering: table creation, 5-row seed count, exact transformer_kind values, no-reseed guard
affects: [phase-19-plan-02, phase-21-mapping-editor, phase-22-per-copy-override, phase-23-copy-pipeline-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - COUNT=0 guard + INSERT OR IGNORE for idempotent first-run seeding
    - TDD RED/GREEN cycle: failing tests committed before implementation

key-files:
  created: []
  modified:
    - src-tauri/src/field_mapping_db.rs

key-decisions:
  - "INSERT OR IGNORE (not INSERT OR REPLACE) preserves user modifications — deleted defaults stay deleted (D-02)"
  - "seed_defaults_if_empty placed as private free fn before impl block — not a method, because called before Self is constructed"
  - "source_schema_json / target_schema_json left NULL in seed rows — Phase 21 will enrich them; schema columns are nullable per A1"
  - "No CHECK constraint on transformer_kind — forward compatible with future kinds like version, component (D-08 note)"
  - "5 default rows in exact order: description/wiki_to_adf, labels/identity, priority/priority, assignee/user, reporter/user (D-07/D-08)"

patterns-established:
  - "COUNT=0 guard + INSERT OR IGNORE: idempotent seeding pattern for first-run defaults without migration state"
  - "TDD cycle in Rust: cargo test confirming RED before GREEN implementation commit"

requirements-completed: [MAP-02]

# Metrics
duration: 2min
completed: 2026-04-27
---

# Phase 19 Plan 01: Mapping Persistence DDL + Default Seed Summary

**field_mapping and mapping_meta SQLite tables added to FieldMappingDb with COUNT=0-guarded INSERT OR IGNORE seeding of 5 default Jira field mappings (description/wiki_to_adf, labels/identity, priority/priority, assignee/user, reporter/user)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-27T19:59:58Z
- **Completed:** 2026-04-27T20:02:32Z
- **Tasks:** 1 (TDD — 2 commits: test + feat)
- **Files modified:** 1

## Accomplishments
- Two new SQLite tables (`field_mapping` and `mapping_meta`) created idempotently at every `FieldMappingDb::open()` and `open_in_memory()` via `execute_batch(CREATE_TABLE IF NOT EXISTS)`
- Private `seed_defaults_if_empty` function with `COUNT(*) = 0` guard seeds 5 default rows using `INSERT OR IGNORE` on first open of an empty table; subsequent opens or calls on a non-empty table are no-ops
- Both `open()` and `open_in_memory()` extended identically — no test/production parity gap
- 4 new tests added (13 total in module): table existence, 5-row count, exact transformer_kind values (D-07/D-08), no-reseed guard
- All 161 lib tests pass; clippy clean under `-D warnings`

## Task Commits

Each task was committed atomically (TDD two-commit pattern):

1. **Task 1 RED: Failing tests for field_mapping + mapping_meta DDL and seed** - `b22138f` (test)
2. **Task 1 GREEN: Add field_mapping + mapping_meta DDL and seed_defaults_if_empty** - `d9a0ee4` (feat)

## Files Created/Modified
- `src-tauri/src/field_mapping_db.rs` - Added `CREATE_FIELD_MAPPING` DDL constant, `CREATE_MAPPING_META` DDL constant, `seed_defaults_if_empty` private function, extended `open()` and `open_in_memory()` with 3 new lines each, 4 new tests appended to existing `mod tests` block

## Exact SQL of New DDL Constants

```sql
-- CREATE_FIELD_MAPPING
CREATE TABLE IF NOT EXISTS field_mapping (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    source_field_id     TEXT NOT NULL UNIQUE,
    target_field_id     TEXT NOT NULL,
    transformer_kind    TEXT NOT NULL,
    source_schema_json  TEXT,
    target_schema_json  TEXT,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

-- CREATE_MAPPING_META
CREATE TABLE IF NOT EXISTS mapping_meta (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
);
```

## Final open() and open_in_memory() Bodies

```rust
pub fn open(path: &std::path::Path) -> AppResult<Self> {
    let conn = Connection::open(path)?;
    conn.execute_batch(CREATE_FIELD_SCHEMA_CACHE)?;
    conn.execute_batch(CREATE_INDEX)?;
    conn.execute_batch(CREATE_FIELD_MAPPING)?;
    conn.execute_batch(CREATE_MAPPING_META)?;
    seed_defaults_if_empty(&conn)?;
    Ok(Self { conn })
}

pub fn open_in_memory() -> AppResult<Self> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch(CREATE_FIELD_SCHEMA_CACHE)?;
    conn.execute_batch(CREATE_INDEX)?;
    conn.execute_batch(CREATE_FIELD_MAPPING)?;
    conn.execute_batch(CREATE_MAPPING_META)?;
    seed_defaults_if_empty(&conn)?;
    Ok(Self { conn })
}
```

## seed_defaults_if_empty Function Body

```rust
fn seed_defaults_if_empty(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM field_mapping",
        [],
        |r| r.get(0),
    )?;
    if count > 0 {
        return Ok(());
    }
    let now = Utc::now().to_rfc3339();
    let defaults: [(&str, &str, &str); 5] = [
        ("description", "description", "wiki_to_adf"),
        ("labels",      "labels",      "identity"),
        ("priority",    "priority",    "priority"),
        ("assignee",    "assignee",    "user"),
        ("reporter",    "reporter",    "user"),
    ];
    for (src, tgt, kind) in defaults {
        conn.execute(
            "INSERT OR IGNORE INTO field_mapping
                 (source_field_id, target_field_id, transformer_kind,
                  source_schema_json, target_schema_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, NULL, NULL, ?4, ?4)",
            params![src, tgt, kind, now],
        )?;
    }
    Ok(())
}
```

## New Test Names and Counts

**Pre-existing tests (9):** `open_in_memory_creates_table`, `upsert_and_get_round_trips_field_schema`, `upsert_overwrites_on_conflict`, `null_project_and_issuetype_round_trip_for_source_global`, `cache_miss_returns_empty_vec`, `clear_cache_removes_only_target_tuple`, `schema_hash_is_lowercase_hex_64`, `schema_hash_is_deterministic_and_input_sensitive`, `allowed_values_round_trip`

**New tests (4):**
1. `open_in_memory_creates_field_mapping_and_meta_tables` — verifies both tables accessible via COUNT(*) queries
2. `seed_inserts_five_defaults_on_empty_table` — asserts COUNT(*) = 5 after fresh open_in_memory()
3. `default_transformer_kinds_are_correct` — asserts exact 5-tuple (source_field_id, target_field_id, transformer_kind) ordered by id ASC matches D-07/D-08
4. `seed_does_not_run_when_table_has_rows` — deletes description row (4 remain), calls seed again, asserts still 4 (D-02 no-reseed guarantee)

**Total: 13 tests in field_mapping_db::tests module**

## Decisions Made

- `INSERT OR IGNORE` (not `INSERT OR REPLACE`): preserves user-deleted rows permanently. A user who removes the `description` default row will not see it re-appear on next launch. Required by D-02.
- Schema columns nullable for seed rows: `source_schema_json = NULL`, `target_schema_json = NULL`. Seed rows have no schema data yet; Phase 21 will optionally enrich them. Nullability allows `Option<String>` row-mapper in Plan 02.
- No `CHECK(transformer_kind IN (...))` constraint: forward-compatible with future kinds (`version`, `component`) Phase 21 may introduce. Constraint would break database migrations without DDL changes.
- `target_field_id = source_field_id` for all 5 default rows: Jira system field IDs are identical on both Server v2 and Cloud v3 sides for these 5 fields.
- `seed_defaults_if_empty` is a private free function (not a method): called before `Self { conn }` is constructed, so cannot use `&self`.

## Cargo Build/Test Summary

- `cargo test --lib field_mapping_db` — 13 tests, 0 failures, finished in 0.01s
- `cargo test --lib` — 161 tests, 0 failures, finished in 0.04s
- `cargo clippy --lib -- -D warnings` — no warnings, finished in ~32s

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `field_mapping` and `mapping_meta` tables exist in `mapping.db` at every `FieldMappingDb::open()` call
- 5 default rows seeded on first run with exact transformer_kind values per D-07/D-08
- Plan 02 can now add `upsert_mapping_row`, `get_all_mapping_rows`, `delete_mapping_row` methods and the 3 Tauri CRUD commands (`get_field_mapping`, `set_field_mapping`, `delete_field_mapping`)
- Phase 21 (mapping editor UI) can call `get_field_mapping` to display rows and `set_field_mapping`/`delete_field_mapping` to persist user changes

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. SQL uses `params![]` macro throughout (no string interpolation). DDL constants are `&'static str` literals. Covered by T-19-01 and T-19-02 mitigations in plan threat model.

## Self-Check: PASSED

- `src-tauri/src/field_mapping_db.rs` exists and is modified
- Commits `b22138f` (RED) and `d9a0ee4` (GREEN) exist in git log
- 13 tests pass in field_mapping_db module (9 existing + 4 new)
- No new clippy warnings

---
*Phase: 19-mapping-persistence-crud-commands*
*Completed: 2026-04-27*
