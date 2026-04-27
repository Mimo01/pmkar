---
phase: 19-mapping-persistence-crud-commands
plan: 02
subsystem: database
tags: [rust, rusqlite, sqlite, field-mapping, tauri-commands, tdd]

# Dependency graph
requires:
  - phase: 19-mapping-persistence-crud-commands
    plan: 01
    provides: field_mapping SQLite table with 5 seeded default rows, FieldMappingDb open()/open_in_memory()
  - phase: 18-v2-v3-translation-layer
    provides: FieldMappingRow struct in field_transform/mod.rs
provides:
  - FieldMappingDb::upsert_mapping_row (ON CONFLICT upsert keyed by source_field_id)
  - FieldMappingDb::get_all_mapping_rows (SELECT ORDER BY id ASC, nullable schema fallback to Any)
  - FieldMappingDb::delete_mapping_row (idempotent DELETE, Ok(()) on missing row)
  - Tauri command get_field_mapping -> Vec<FieldMappingRow>
  - Tauri command set_field_mapping (row: FieldMappingRow) -> ()
  - Tauri command delete_field_mapping (source_field_id: String) -> ()
  - invoke_handler registration for all three new commands
  - tempfile dev-dependency for round-trip test
affects: [phase-21-mapping-editor, phase-22-per-copy-override, phase-23-copy-pipeline-cutover]

# Tech tracking
tech-stack:
  added: [tempfile = "3" (dev-dependency for round-trip persistence test)]
  patterns:
    - ON CONFLICT(source_field_id) DO UPDATE: upsert pattern preserving created_at via ?6 reuse
    - Option<String> nullable schema columns with FieldSchemaType::Any fallback
    - Synchronous Tauri command pattern (fn not async fn) matching refresh_field_schema_cache analog
    - TDD RED/GREEN cycle: failing tests committed before implementation

key-files:
  created: []
  modified:
    - src-tauri/src/field_mapping_db.rs
    - src-tauri/src/commands.rs
    - src-tauri/src/main.rs
    - src-tauri/Cargo.toml

key-decisions:
  - "All three methods are pub fn (synchronous) — SQLite has no await points; async fn fails clippy::unused_async under -D warnings"
  - "All three Tauri commands take only mapping_db: State<Arc<Mutex<FieldMappingDb>>> — no other state to avoid lock-ordering deadlock (Pitfall 4)"
  - "FieldMappingRow remains in field_transform/mod.rs (not moved) — Phase 18 pipeline imports it from there; relocating would break Phase 18 compile"
  - "upsert uses ?6 for both created_at and updated_at in VALUES, but DO UPDATE only sets updated_at = excluded.updated_at — preserving original created_at"
  - "Pre-existing clippy doc_markdown errors in unrelated files (field_transform/version.rs etc.) are out of scope per Scope Boundary rule"

patterns-established:
  - "FieldMappingDb CRUD pattern: upsert with ON CONFLICT, paginated get returning Vec<T>, idempotent delete"
  - "Tauri command wrapping DB methods: lock guard + map_err for poisoned lock, delegate to DB method"

requirements-completed: [MAP-01]

# Metrics
duration: 10min
completed: 2026-04-27
---

# Phase 19 Plan 02: CRUD Methods + Tauri Commands Summary

**Three CRUD methods added to FieldMappingDb (upsert/get/delete mapping rows) and exposed as synchronous Tauri commands registered in main.rs, completing MAP-01 with full frontend-reachable persistence**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-27T20:00:00Z
- **Completed:** 2026-04-27T20:12:00Z
- **Tasks:** 2 (Task 1 TDD: 2 commits RED+GREEN; Task 2: 1 commit)
- **Files modified:** 4

## Accomplishments

- Three new methods on `FieldMappingDb`: `upsert_mapping_row`, `get_all_mapping_rows`, `delete_mapping_row`
- Three new synchronous Tauri commands: `get_field_mapping`, `set_field_mapping`, `delete_field_mapping`
- All three commands registered in `main.rs`'s `invoke_handler!` block
- Added `tempfile = "3"` dev-dependency for round-trip disk persistence test
- 17 tests in `field_mapping_db` module (9 pre-existing + 4 Plan 01 + 4 Plan 02)
- 165 total lib tests pass; no new clippy errors introduced

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for upsert/get/delete mapping row methods** - `8c89746` (test)
2. **Task 1 GREEN: Add upsert_mapping_row, get_all_mapping_rows, delete_mapping_row** - `e8d2df6` (feat)
3. **Task 2: Add Tauri commands and main.rs registration** - `5954742` (feat)

## Files Created/Modified

- `src-tauri/src/field_mapping_db.rs` — Added `FieldMappingRow` import, three new methods, 4 new tests, fixed doc_markdown clippy warnings in method doc comments
- `src-tauri/src/commands.rs` — Added `FieldMappingRow` import, three new synchronous Tauri command functions with `// --- Field mapping CRUD commands (Phase 19) ---` section header
- `src-tauri/src/main.rs` — Added three entries to `invoke_handler!` block after `commands::refresh_field_schema_cache`
- `src-tauri/Cargo.toml` — Added `[dev-dependencies]` section with `tempfile = "3"`

## Final Method Signatures

```rust
/// Upsert a single mapping row keyed on `source_field_id` (D-04).
pub fn upsert_mapping_row(&self, row: &FieldMappingRow) -> AppResult<()>

/// Return all mapping rows in insertion order (`id ASC`) per D-06.
pub fn get_all_mapping_rows(&self) -> AppResult<Vec<FieldMappingRow>>

/// Delete a mapping row by `source_field_id` (D-05). Idempotent: returns `Ok(())` even when the row does not exist.
pub fn delete_mapping_row(&self, source_field_id: &str) -> AppResult<()>
```

## Exact SQL of the Upsert (showing ?6 reuse)

```sql
INSERT INTO field_mapping
     (source_field_id, target_field_id, transformer_kind,
      source_schema_json, target_schema_json, created_at, updated_at)
 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
 ON CONFLICT(source_field_id) DO UPDATE SET
     target_field_id     = excluded.target_field_id,
     transformer_kind    = excluded.transformer_kind,
     source_schema_json  = excluded.source_schema_json,
     target_schema_json  = excluded.target_schema_json,
     updated_at          = excluded.updated_at
```

`?6` (the `now` timestamp) appears as both `created_at` and `updated_at` in the VALUES clause on initial insert. The `DO UPDATE SET` clause only updates `updated_at`, leaving `created_at` unchanged on subsequent upserts.

## 3 Tauri Command Bodies (full text)

```rust
// --- Field mapping CRUD commands (Phase 19) ---

/// Return all mapping rows ordered by `id ASC` (D-06). Returns the seeded defaults
/// from Plan 01 plus any user-added rows. Phase 21 (editor) and Phase 23 (cutover)
/// consume this.
#[tauri::command]
pub fn get_field_mapping(
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<Vec<FieldMappingRow>, AppError> {
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.get_all_mapping_rows()
}

/// Upsert a single mapping row by `source_field_id` (D-04). On conflict, replaces
/// `target_field_id`, `transformer_kind`, and schema JSON; `created_at` is preserved.
/// Phase 21 calls once per changed row.
#[tauri::command]
pub fn set_field_mapping(
    row: FieldMappingRow,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<(), AppError> {
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.upsert_mapping_row(&row)
}

/// Delete a mapping row by `source_field_id` (D-05). Idempotent: returns `Ok(())`
/// even when the row does not exist. Phase 21's "remove row" button calls this.
#[tauri::command]
pub fn delete_field_mapping(
    source_field_id: String,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<(), AppError> {
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.delete_mapping_row(&source_field_id)
}
```

## 3 New Lines Added to main.rs invoke_handler!

```rust
            commands::get_field_mapping,
            commands::set_field_mapping,
            commands::delete_field_mapping,
```

Added after `commands::refresh_field_schema_cache,` and before the closing `])`.

## Test Outcomes

**Pre-existing field_mapping_db tests (9):** `open_in_memory_creates_table`, `upsert_and_get_round_trips_field_schema`, `upsert_overwrites_on_conflict`, `null_project_and_issuetype_round_trip_for_source_global`, `cache_miss_returns_empty_vec`, `clear_cache_removes_only_target_tuple`, `schema_hash_is_lowercase_hex_64`, `schema_hash_is_deterministic_and_input_sensitive`, `allowed_values_round_trip`

**Plan 01 tests (4):** `open_in_memory_creates_field_mapping_and_meta_tables`, `seed_inserts_five_defaults_on_empty_table`, `default_transformer_kinds_are_correct`, `seed_does_not_run_when_table_has_rows`

**Plan 02 Task 1 tests (4):**
1. `get_returns_rows_in_insertion_order` — 5 seeded rows ORDER BY id ASC, description first with wiki_to_adf
2. `upsert_mapping_row_replaces_existing` — replaces existing row (no duplication), new id increases count to 6
3. `delete_mapping_row_is_idempotent` — double-delete and delete-unknown-id all return Ok(())
4. `round_trip_survives_reopen` — disk persistence: rows survive db close and reopen via tempfile::tempdir()

**Total: 17 tests in field_mapping_db module; 165 total lib tests**

## Cargo Build/Test/Clippy Summary

- `cargo test --lib field_mapping_db` — 17 tests, 0 failures
- `cargo test --lib` — 165 tests, 0 failures
- `cargo build --lib` — clean, no warnings introduced by Plan 02 changes
- `cargo clippy --lib --all-targets -- -D warnings` — pre-existing 28 errors in unrelated files (audit.rs, field_discovery.rs, field_transform/identity.rs, field_transform/pipeline.rs, field_transform/version.rs); ZERO new errors introduced by Plan 02 changes (verified by stash comparison)

## Notes

- Phase 19 ships zero TypeScript bindings. Phase 21 (mapping editor) will add `invoke('get_field_mapping')`, `invoke('set_field_mapping', { row })`, and `invoke('delete_field_mapping', { sourceFieldId })` bindings.
- `transformer_kind = "priority"` is descriptive metadata only. Phase 18's pipeline routes by `FieldSchemaType::Priority` shape, not by string-comparing kind. Phase 21 editor will surface kind to user; Phase 23 is free to add an explicit dispatch arm if a future transformer needs it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed doc_markdown clippy warnings in new method doc comments**
- **Found during:** Task 2 verification
- **Issue:** New doc comments used unquoted identifiers (`source_field_id`, `target_field_id`, `transformer_kind`, `created_at`, `id ASC`, `schema_json`) which clippy `doc_markdown` lint flags under `-D warnings`
- **Fix:** Wrapped all bare identifiers in backticks in doc comments across `field_mapping_db.rs` and `commands.rs`
- **Files modified:** `src-tauri/src/field_mapping_db.rs`, `src-tauri/src/commands.rs`
- **Commit:** `5954742`

## Known Stubs

None — all three methods fully implemented with real SQL, all three Tauri commands delegate to the real DB methods, no hardcoded returns or placeholder data.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced beyond those in the plan's threat model. All SQL uses `params![]` macro (T-19-06, T-19-07 mitigated). Lock poison handlers emit fixed strings only (T-19-11 mitigated).

## Self-Check: PASSED

- `src-tauri/src/field_mapping_db.rs` modified with 3 new methods and 4 new tests
- `src-tauri/src/commands.rs` modified with 3 new Tauri commands
- `src-tauri/src/main.rs` modified with 3 new invoke_handler entries
- Commits `8c89746` (RED), `e8d2df6` (GREEN), `5954742` (Task 2) exist in git log
- 17 tests pass in field_mapping_db module; 165 total lib tests pass
- No new clippy errors introduced (verified by stash comparison)

---
*Phase: 19-mapping-persistence-crud-commands*
*Completed: 2026-04-27*
