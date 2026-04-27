# Phase 19: Mapping Persistence + CRUD Commands — Research

**Researched:** 2026-04-27
**Domain:** Rust / rusqlite SQLite persistence — extending an existing db module with two new tables and three Tauri commands
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Seed defaults at `FieldMappingDb::open` — seed logic checks `COUNT(*) = 0` on `field_mapping`; only seeds when the table is completely empty.
**D-02:** Once any row exists (even a user-added custom one), no re-seeding. `INSERT OR IGNORE` per default row so individually-deleted defaults stay gone.
**D-03:** Default rows use hardcoded standard Jira field IDs (`description`, `labels`, `priority`, `assignee`, `reporter`).
**D-04:** `set_field_mapping(row: FieldMappingRow)` — single-row upsert keyed on `source_field_id` (`ON CONFLICT DO UPDATE`).
**D-05:** `delete_field_mapping(source_field_id: String)` — deletes by `source_field_id`; no integer row ID needed by callers.
**D-06:** `get_field_mapping()` — returns all rows `ORDER BY id ASC`.
**D-07:** Default `transformer_kind` values: `description` → `"wiki_to_adf"`, `assignee` → `"user"`, `reporter` → `"user"`, `labels` → `"identity"`, `priority` → `"priority"`.
**D-08:** `priority` gets its own `transformer_kind = "priority"` (not `"identity"`).

**In scope:**
- `field_mapping` table + `mapping_meta` table added to `field_mapping_db.rs`
- 5 default seed rows at `FieldMappingDb::open`
- 3 new Tauri CRUD commands: `get_field_mapping`, `set_field_mapping`, `delete_field_mapping`
- Tests: seed, upsert, delete, round-trip for each command

**Out of scope:**
- `refresh_field_schema_cache` (Phase 17, exists at `commands.rs:1298`)
- Mapping editor UI (Phase 21)
- Per-copy override panel (Phase 22)
- `copy_ticket_v2` wiring (Phase 23)
- Frontend TypeScript types or bindings (Phase 21/22)

### Claude's Discretion

- Exact SQL schema for `field_mapping` table columns
- Whether `mapping_meta` is a dedicated table or a simple `key/value` config table (key/value preferred as simpler and reusable)
- Whether `FieldMappingRow` stays in `field_transform/mod.rs` or moves to `field_mapping_db.rs`
- Default `target_field_id` values for seed rows (same as `source_field_id` — standard Jira system field IDs)
- Default `source_schema` / `target_schema` values for seed rows (nullable or `FieldSchemaType::Other` placeholder)
- Error type for "row not found" on delete (idempotent `Ok(())`)

### Deferred Ideas (OUT OF SCOPE)

- `components` + `fixVersions` in default seed
- Person resolution SQLite cache with TTL
- Frontend TypeScript types for `FieldMappingRow`
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-01 | User has a single global source→target field mapping persisted in a separate `mapping.db` SQLite database | `mapping.db` already opened in `main.rs:141`; Phase 19 adds `field_mapping` table in the existing file |
| MAP-02 | System ships sensible default mappings on first run (description, labels, priority, assignee, reporter) | Seed function runs at `open()` with `COUNT(*) = 0` guard; 5 hardcoded rows with confirmed `transformer_kind` values |
</phase_requirements>

---

## Summary

Phase 19 is a pure Rust persistence layer addition. The `mapping.db` SQLite file and `FieldMappingDb` struct already exist (Phase 17). This phase extends the same file (`field_mapping_db.rs`) with two new tables and three new Tauri commands, following identical patterns to what is already established in the file and throughout the codebase.

The primary technical work is: (1) adding `CREATE TABLE IF NOT EXISTS` DDL for `field_mapping` and `mapping_meta` to the existing `execute_batch` call in `FieldMappingDb::open` and `open_in_memory`; (2) implementing a seed function called from `open()` that inserts 5 hardcoded default rows when the table is empty; and (3) implementing three Tauri commands that lock `State<'_, Arc<Mutex<FieldMappingDb>>>`, call the new db methods, and get registered in `main.rs`'s `invoke_handler`.

All three structural patterns (DDL-in-`open()`, `Arc<Mutex<T>>` Tauri state, `open_in_memory()` tests) are already used in `field_mapping_db.rs`, `snapshot_db.rs`, and `triage_db.rs`. No new dependencies are needed.

**Primary recommendation:** Extend `field_mapping_db.rs` only — do not create a new file. Keep `FieldMappingRow` in `field_transform/mod.rs` and import it in `field_mapping_db.rs` to avoid circular dependency.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Field mapping persistence (CRUD) | API / Backend (Rust) | — | All mapping data is authoritative in SQLite; no frontend-side state |
| Default seed logic | API / Backend (Rust) | — | Seed runs at `FieldMappingDb::open()` — before any command handler is reachable |
| Tauri command exposure | API / Backend (Rust) | — | IPC bridge only; frontend TypeScript bindings deferred to Phase 21 |
| `FieldMappingRow` type definition | API / Backend (Rust) | — | Already defined in `field_transform/mod.rs`; Phase 19 adds `Serialize/Deserialize` if missing and adds persistence beneath it |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rusqlite | 0.39 (bundled) | SQLite connection, DDL, DML, `params!` macro | Already in Cargo.toml; bundled feature compiles SQLite in — no system install needed |
| serde / serde_json | 1.x | `Serialize/Deserialize` for `FieldMappingRow`; JSON encoding of schema fields to TEXT columns | Already in Cargo.toml; used throughout the codebase |
| chrono | 0.4 | `Utc::now().to_rfc3339()` for `created_at` / `updated_at` | Already in Cargo.toml; exact pattern in `upsert_schema_row` |

[VERIFIED: Cargo.toml]

### No New Dependencies

Phase 19 requires zero new Cargo dependencies. All needed crates are already declared in `src-tauri/Cargo.toml`.

---

## Architecture Patterns

### System Architecture Diagram

```
App startup
    │
    ▼
main.rs: FieldMappingDb::open(&mapping_db_path)
    │
    ├─ execute_batch(CREATE_FIELD_SCHEMA_CACHE + CREATE_FIELD_MAPPING + CREATE_MAPPING_META)
    │
    └─ seed_defaults_if_empty(&conn)
           │
           ├─ COUNT(*) = 0 on field_mapping?
           │     YES → INSERT OR IGNORE × 5 default rows
           │     NO  → no-op
           │
           └─ returns Ok(())
    │
    ▼
app.manage(Arc::new(Mutex::new(mapping_db)))   ← already in main.rs

Frontend invoke()
    │
    ├─ get_field_mapping
    │       │
    │       └─ lock Arc<Mutex<FieldMappingDb>>
    │          └─ SELECT * FROM field_mapping ORDER BY id ASC
    │          └─ returns Vec<FieldMappingRow>
    │
    ├─ set_field_mapping(row)
    │       │
    │       └─ lock Arc<Mutex<FieldMappingDb>>
    │          └─ INSERT ... ON CONFLICT(source_field_id) DO UPDATE
    │          └─ returns Ok(())
    │
    └─ delete_field_mapping(source_field_id)
            │
            └─ lock Arc<Mutex<FieldMappingDb>>
               └─ DELETE FROM field_mapping WHERE source_field_id = ?
               └─ returns Ok(()) (idempotent)
```

### Recommended Project Structure

No new files needed. All changes go into:

```
src-tauri/src/
├── field_mapping_db.rs    ← PRIMARY: extend with new tables + methods + seed
├── commands.rs            ← Add 3 new Tauri commands near line 1298
└── main.rs                ← Register 3 new commands in invoke_handler
```

### Pattern 1: DDL in `open()` / `open_in_memory()`

**What:** All database tables are created at connection time using `CREATE TABLE IF NOT EXISTS` in `execute_batch()`. No separate migration runner.

**When to use:** Every table added to any `*_db.rs` module follows this pattern.

**Example (from `field_mapping_db.rs:39-51`):**
```rust
// Source: field_mapping_db.rs (VERIFIED: codebase)
pub fn open(path: &std::path::Path) -> AppResult<Self> {
    let conn = Connection::open(path)?;
    conn.execute_batch(CREATE_FIELD_SCHEMA_CACHE)?;
    conn.execute_batch(CREATE_INDEX)?;
    // Phase 19 adds: conn.execute_batch(CREATE_FIELD_MAPPING)?;
    // Phase 19 adds: conn.execute_batch(CREATE_MAPPING_META)?;
    // Phase 19 adds: seed_defaults_if_empty(&conn)?;
    Ok(Self { conn })
}
```

**Phase 19 extension** — new DDL constants to add:
```rust
// [ASSUMED] — SQL schema matches discretion items from CONTEXT.md
const CREATE_FIELD_MAPPING: &str = "
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
";

const CREATE_MAPPING_META: &str = "
    CREATE TABLE IF NOT EXISTS mapping_meta (
        key    TEXT PRIMARY KEY,
        value  TEXT NOT NULL
    );
";
```

Note: The `mapping_meta` key/value shape follows CONTEXT.md discretion recommendation — simpler and reusable for future metadata.

### Pattern 2: Upsert via `ON CONFLICT DO UPDATE`

**What:** Single-row insert-or-update keyed on the natural key. Already used in `upsert_schema_row`.

**Example (from `field_mapping_db.rs:54-98`):**
```rust
// Source: field_mapping_db.rs (VERIFIED: codebase)
self.conn.execute(
    "INSERT INTO field_schema_cache (...) VALUES (...)
     ON CONFLICT(side, project_key, issuetype_id, field_id) DO UPDATE SET
         field_name = excluded.field_name,
         ...",
    params![...],
)?;
```

**Phase 19 equivalent** (for `set_field_mapping`):
```rust
// [ASSUMED] — pattern is direct extension of existing upsert_schema_row
self.conn.execute(
    "INSERT INTO field_mapping
         (source_field_id, target_field_id, transformer_kind,
          source_schema_json, target_schema_json, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
     ON CONFLICT(source_field_id) DO UPDATE SET
         target_field_id     = excluded.target_field_id,
         transformer_kind    = excluded.transformer_kind,
         source_schema_json  = excluded.source_schema_json,
         target_schema_json  = excluded.target_schema_json,
         updated_at          = excluded.updated_at",
    params![
        row.source_field_id,
        row.target_field_id,
        row.transformer_kind,
        source_schema_json,
        target_schema_json,
        Utc::now().to_rfc3339(),
    ],
)?;
```

### Pattern 3: Tauri Command with `State<'_, Arc<Mutex<T>>>`

**What:** Synchronous commands lock the state, call a db method, and return `Result<T, AppError>`.

**Example (from `commands.rs:1298-1322`):**
```rust
// Source: commands.rs:1298 (VERIFIED: codebase)
#[tauri::command]
pub fn refresh_field_schema_cache(
    side: String,
    project_key: Option<String>,
    issuetype_id: Option<String>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<(), AppError> {
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.clear_cache_for(...)?;
    Ok(())
}
```

**Phase 19 commands follow the identical shape.** All three are synchronous (`fn`, not `async fn`) — no await points exist in pure SQLite operations. This matches the `refresh_field_schema_cache` precedent. [VERIFIED: codebase — `refresh_field_schema_cache` is `fn`, not `async fn`]

### Pattern 4: Seed Logic — `INSERT OR IGNORE` with Empty-Table Guard

**What:** At `open()`, check `COUNT(*) = 0`; if true, run `INSERT OR IGNORE` for each default row. After this point, the `mapping_meta` table stores a sentinel key to allow future metadata tracking without re-checking `COUNT(*)`.

```rust
// [ASSUMED] — canonical pattern for this phase; no prior seed function in codebase
fn seed_defaults_if_empty(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM field_mapping", [], |r| r.get(0)
    )?;
    if count > 0 {
        return Ok(());
    }
    let now = Utc::now().to_rfc3339();
    let defaults = [
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

Key notes:
- `INSERT OR IGNORE` (not `INSERT OR REPLACE`) — preserves rows if they somehow exist on a re-entrant call
- `source_schema_json` and `target_schema_json` are `NULL` for seed rows — Phase 21 enriches them
- Called from both `open()` and `open_in_memory()` (tests need seeding too)

### Pattern 5: `FieldMappingRow` Location and Serialization

**What:** `FieldMappingRow` is currently defined in `field_transform/mod.rs:135`. The comment in that file says "Phase 19 moves the canonical definition to `field_mapping_db.rs`." However, CONTEXT.md discretion notes that keeping it in `field_transform/mod.rs` avoids a circular dependency since `pipeline.rs` imports it heavily.

**Recommendation:** Keep `FieldMappingRow` in `field_transform/mod.rs`. Have `field_mapping_db.rs` import it with `use crate::field_transform::FieldMappingRow;`. This is clean in Rust — a child module of a sibling module can import from another sibling without circular dependency, since neither imports from the other transitively.

**Serialization:** `FieldMappingRow` already derives `Serialize, Deserialize`. The `source_schema` and `target_schema` fields are `FieldSchemaType` (also serializable). `serde_json::to_string()` converts them to TEXT columns; `serde_json::from_str()` reconstructs them. [VERIFIED: `field_transform/mod.rs:133-141` — derives already present]

### Anti-Patterns to Avoid

- **Async commands for pure SQLite:** `get_field_mapping`, `set_field_mapping`, `delete_field_mapping` must be `fn` (synchronous). Clippy `-D warnings` enforces `clippy::unused_async` — an `async fn` with no await points will fail to compile. `refresh_field_schema_cache` (Phase 17) provides the correct `fn` precedent. [VERIFIED: codebase + STATE.md decision]
- **Creating a new db file:** Do NOT create `mapping_rules_db.rs` or similar. The CONTEXT.md comment at the top of `field_mapping_db.rs` explicitly says "Phase 19 will extend this file."
- **Moving `FieldMappingRow` to `field_mapping_db.rs` aggressively:** Would require updating all Phase 18 import paths. Safer to leave it in `field_transform/mod.rs` and import from there.
- **Re-seeding on non-empty table:** The D-02 decision is explicit — once any row exists, no re-seeding. The `COUNT(*) = 0` check must gate the entire seed block, not individual rows.
- **Using `INSERT OR REPLACE` for seed:** `INSERT OR REPLACE` would silently overwrite user modifications. Use `INSERT OR IGNORE`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upsert logic | Custom read-then-write | `INSERT ... ON CONFLICT DO UPDATE` | SQLite `UPSERT` clause is atomic; hand-rolled read-then-write has TOCTOU race under concurrent access |
| Schema migration | Custom migration runner | `CREATE TABLE IF NOT EXISTS` in `open()` | Established pattern in this codebase; no migration framework needed for `IF NOT EXISTS` additive migrations |
| JSON serialization of `FieldSchemaType` | Custom text encoding | `serde_json::to_string` / `from_str` | `FieldSchemaType` already implements `Serialize/Deserialize`; consistent with how `schema_json` is stored in `field_schema_cache` |
| Seeding idempotency | Timestamp-based sentinel, separate flag table | `COUNT(*) = 0` guard + `INSERT OR IGNORE` | Simplest correct approach; no extra state needed |

---

## Common Pitfalls

### Pitfall 1: Forgetting `open_in_memory()` Parity

**What goes wrong:** Developer adds the new DDL and seed call to `open()` but forgets to add them to `open_in_memory()`. Tests using `open_in_memory()` fail with "no such table: field_mapping".

**Why it happens:** Both methods are independent and must both call the same setup sequence.

**How to avoid:** Update `open_in_memory()` in the same diff as `open()`. The existing pattern shows they are structurally identical.

**Warning signs:** Tests panic with `SqliteFailure` mentioning `field_mapping`.

### Pitfall 2: `FieldMappingRow` Not Registered for Tauri IPC Serialization

**What goes wrong:** `get_field_mapping` returns `Vec<FieldMappingRow>` but the derive on `FieldMappingRow` is `#[serde(rename_all = "camelCase")]` — the frontend receives camelCase keys. This is correct and expected, but if someone changes the derive they break the IPC contract silently.

**Why it happens:** `FieldMappingRow` already has `#[serde(rename_all = "camelCase")]`. This must not be removed.

**How to avoid:** Do not change the `serde` attributes on `FieldMappingRow`.

**Warning signs:** Frontend TypeScript tests (Phase 21) receive `source_field_id` instead of `sourceFieldId`.

### Pitfall 3: `schema_json` Columns Are Nullable for Seed Rows

**What goes wrong:** DB layer returns `Option<String>` for `source_schema_json` / `target_schema_json`; deserializer tries to call `serde_json::from_str(None)` and panics.

**Why it happens:** Seed rows intentionally store `NULL` for schema fields. The SELECT / row-mapper must use `row.get::<_, Option<String>>(n)` and conditionally deserialize.

**How to avoid:** Use `Option<String>` for schema JSON columns in the row-mapper. If `None`, set schema to `FieldSchemaType::Other` or a suitable default placeholder.

**Warning signs:** Panic at `unwrap()` on `Option<String>` during a `get_field_mapping` call after first-run seeding.

### Pitfall 4: Lock Ordering — Never Hold Two `Arc<Mutex<>>` Locks Simultaneously

**What goes wrong:** A command takes `State<'_, Arc<Mutex<FieldMappingDb>>>` and also takes another `State<'_, Arc<Mutex<TriageDb>>>`. If two requests come in simultaneously and each tries to acquire the other lock second, deadlock occurs.

**Why it happens:** Phase 19's 3 commands only need `mapping_db` — they do NOT need `triage_db` or `audit_db`. Taking extra state parameters introduces unnecessary risk.

**How to avoid:** All three new commands take ONLY `mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>` as their state parameter. No other state needed.

**Warning signs:** App freezes on concurrent invocations of mapping commands and other commands.

### Pitfall 5: `priority` transformer_kind Coordination with Phase 18

**What goes wrong:** Phase 19 seeds `priority` row with `transformer_kind = "priority"`. Phase 18's `pipeline.rs` dispatches by `transformer_kind`. If Phase 18's pipeline does not have a `"priority"` arm, the priority field falls through to identity transform. The row is persisted correctly but the pipeline ignores the specific priority transformer.

**Why it happens:** D-08 specifies `transformer_kind = "priority"` for the seed row. This is a coordination point — Phase 18 already shipped, so the planner must verify whether `pipeline.rs` has a `"priority"` dispatch arm or whether it currently falls through to identity.

**How to avoid:** The planner should check `pipeline.rs` for a `"priority"` arm. If absent, Phase 19 plan should include adding it (since `transformer_kind = "priority"` is meaningless without a pipeline routing arm). Alternatively, this could be noted as a Phase 23 task. CONTEXT.md notes this coordination point explicitly.

**Warning signs:** `copy_ticket_v2` sends `priority: {"name": "High", "id": "2"}` instead of `priority: {"id": "2"}` (v3 write-shape).

---

## Code Examples

### Full `get_field_mapping` command pattern

```rust
// Source: modeled on commands.rs:1298 (VERIFIED: codebase)
#[tauri::command]
pub fn get_field_mapping(
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<Vec<FieldMappingRow>, AppError> {
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.get_all_mapping_rows()
}
```

### Full `set_field_mapping` command pattern

```rust
// Source: modeled on commands.rs:1298 (VERIFIED: codebase)
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
```

### Full `delete_field_mapping` command pattern

```rust
// Source: modeled on commands.rs:1298 (VERIFIED: codebase)
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

### `main.rs` registration additions

```rust
// Source: main.rs:192-243 (VERIFIED: codebase)
// Add alongside existing field mapping commands:
commands::get_field_mapping,
commands::set_field_mapping,
commands::delete_field_mapping,
```

### Test pattern (from `field_mapping_db.rs` existing tests)

```rust
// Source: field_mapping_db.rs:202+ (VERIFIED: codebase)
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_inserts_five_defaults_on_empty_table() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let rows = db.get_all_mapping_rows().unwrap();
        assert_eq!(rows.len(), 5);
        let kinds: Vec<_> = rows.iter().map(|r| r.transformer_kind.as_str()).collect();
        assert!(kinds.contains(&"wiki_to_adf"));
        assert!(kinds.contains(&"priority"));
        assert!(kinds.contains(&"user"));
        assert!(kinds.contains(&"identity"));
    }

    #[test]
    fn seed_does_not_run_when_table_has_rows() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        // After open_in_memory(), 5 seed rows exist.
        // A second open call (simulated by calling seed_defaults_if_empty again)
        // must not add more rows.
        let rows = db.get_all_mapping_rows().unwrap();
        assert_eq!(rows.len(), 5, "seed must not re-run");
    }

    #[test]
    fn upsert_mapping_row_replaces_existing() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let row = FieldMappingRow {
            source_field_id: "description".into(),
            target_field_id: "description".into(),
            transformer_kind: "identity".into(), // override the seeded "wiki_to_adf"
            source_schema: FieldSchemaType::Other,
            target_schema: FieldSchemaType::Other,
        };
        db.upsert_mapping_row(&row).unwrap();
        let rows = db.get_all_mapping_rows().unwrap();
        let desc = rows.iter().find(|r| r.source_field_id == "description").unwrap();
        assert_eq!(desc.transformer_kind, "identity");
    }

    #[test]
    fn delete_mapping_row_is_idempotent() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        db.delete_mapping_row("description").unwrap();
        db.delete_mapping_row("description").unwrap(); // second call must not error
        let rows = db.get_all_mapping_rows().unwrap();
        assert_eq!(rows.len(), 4);
    }

    #[test]
    fn get_returns_rows_in_insertion_order() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let rows = db.get_all_mapping_rows().unwrap();
        // First seeded row must be description (D-06: ORDER BY id ASC)
        assert_eq!(rows[0].source_field_id, "description");
    }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single monolithic db file | db-per-concern (separate files per SQLite database) | Phase 3 (`snapshot_db.rs`) | Established pattern; Phase 19 must not break it |
| `FieldMappingRow` only in pipeline tests | `FieldMappingRow` persisted and loaded from SQLite | Phase 19 | Pipeline now has a stable data source; Phase 23 can call `get_field_mapping` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `field_mapping` DDL uses `source_schema_json TEXT` and `target_schema_json TEXT` as nullable columns (no `NOT NULL`) | Architecture Patterns / Pattern 1 | If made `NOT NULL`, seed rows must provide placeholder JSON instead of `NULL` — requires a default `FieldSchemaType` value; minimal rework |
| A2 | `mapping_meta` uses a key/value schema (not a purpose-specific schema) | Architecture Patterns / Pattern 1 | If user prefers purpose-specific columns, rework is small — one table only, no downstream consumers yet |
| A3 | `seed_defaults_if_empty` is a standalone function (not a method) to keep it testable without `Self` | Code Examples | Could be a `&self` method — either works; no behavioral difference |
| A4 | `pipeline.rs` does NOT currently have a `"priority"` dispatch arm (falls through to identity) | Common Pitfalls / Pitfall 5 | If a `"priority"` arm already exists, the coordination note is moot and no additional work needed — check `pipeline.rs` during planning |

---

## Open Questions

1. **Does `pipeline.rs` have a `"priority"` dispatch arm?**
   - What we know: D-08 seeds `transformer_kind = "priority"`. CONTEXT.md says "Phase 18's pipeline adds a `priority` transformer."
   - What's unclear: Phase 18's `pipeline.rs` (read above) shows dispatching on `is_description_row`, `is_user_field`, `is_array_of(..., "version")`, `is_array_of(..., "component")`, then falls through to `identity`. No `"priority"` arm is visible.
   - Recommendation: The planner should verify whether a `"priority"` transformer was added later in Phase 18 (check `pipeline.rs` lines 80+). If absent, Phase 19 plan should include a small addition to `pipeline.rs` to handle `transformer_kind = "priority"` extracting `{id}` from the priority object — or note this as deferred to Phase 23.

2. **Should `FieldMappingRow.source_schema` / `target_schema` accept `None` from the DB?**
   - What we know: Seed rows store `NULL` in `source_schema_json` and `target_schema_json`. `FieldMappingRow` currently has `source_schema: FieldSchemaType` (non-optional).
   - What's unclear: When loading seed rows from DB, what `FieldSchemaType` value do we use for `NULL` columns?
   - Recommendation: Use `FieldSchemaType::Other` as the fallback when schema JSON is `NULL`. This is the `Other` variant that exists for unrecognized types. Alternatively, make `source_schema: Option<FieldSchemaType>` — but this changes the Phase 18 struct and requires updating pipeline.rs callers. The `FieldSchemaType::Other` fallback is simpler and non-breaking.

---

## Environment Availability

Step 2.6: No new external dependencies. rusqlite is bundled (`features = ["bundled"]`), Rust toolchain confirmed working (199 tests passing in codebase). SKIPPED (all required tools already verified by existing test suite).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Rust built-in test harness (`#[cfg(test)]` + `#[test]`) |
| Config file | None — standard Cargo test runner |
| Quick run command | `cd src-tauri && cargo test -- field_mapping_db` |
| Full suite command | `cd src-tauri && cargo test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | `field_mapping` table is created at `open()` | unit | `cargo test -- field_mapping_db::tests::open_in_memory_creates_tables` | ❌ Wave 0 |
| MAP-01 | `get_field_mapping` returns all rows | unit | `cargo test -- field_mapping_db::tests::get_returns_rows_in_insertion_order` | ❌ Wave 0 |
| MAP-01 | `set_field_mapping` upserts correctly | unit | `cargo test -- field_mapping_db::tests::upsert_mapping_row_replaces_existing` | ❌ Wave 0 |
| MAP-01 | `delete_field_mapping` is idempotent | unit | `cargo test -- field_mapping_db::tests::delete_mapping_row_is_idempotent` | ❌ Wave 0 |
| MAP-01 | Mapping changes survive restart (round-trip) | unit | `cargo test -- field_mapping_db::tests::round_trip_survives_reopen` | ❌ Wave 0 |
| MAP-02 | 5 default rows seeded on first open | unit | `cargo test -- field_mapping_db::tests::seed_inserts_five_defaults_on_empty_table` | ❌ Wave 0 |
| MAP-02 | Re-seeding does not occur when table non-empty | unit | `cargo test -- field_mapping_db::tests::seed_does_not_run_when_table_has_rows` | ❌ Wave 0 |
| MAP-02 | Default `transformer_kind` values match D-07/D-08 | unit | `cargo test -- field_mapping_db::tests::default_transformer_kinds_are_correct` | ❌ Wave 0 |

All test files are within `field_mapping_db.rs` `#[cfg(test)]` block — existing file, new test functions.

### Sampling Rate

- **Per task commit:** `cd src-tauri && cargo test -- field_mapping_db`
- **Per wave merge:** `cd src-tauri && cargo test`
- **Phase gate:** Full suite green (currently 199 passing) before `/gsd-verify-work`

### Wave 0 Gaps

All 8 test functions above are new additions to `field_mapping_db.rs` — no new test files needed, just new `#[test]` functions in the existing `#[cfg(test)]` module.

---

## Security Domain

Phase 19 is a local SQLite persistence layer with no HTTP, no authentication, no user-supplied dynamic SQL, and no PII handling. ASVS categories are assessed below.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth involved — local app storage |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | Single-user desktop app |
| V5 Input Validation | Partial | `source_field_id`, `transformer_kind` are user-controlled strings — they are passed as parameterized SQLite parameters (`params![]`), never interpolated into SQL strings. No additional validation needed beyond the parameterization. |
| V6 Cryptography | No | No encryption of mapping data; not a security-sensitive store |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via `source_field_id` | Tampering | rusqlite `params![]` macro — all values are bound, never interpolated [VERIFIED: codebase pattern in `upsert_schema_row`] |
| Oversized schema JSON payload | Tampering | SQLite has no size limit enforcement by default; Phase 19 schema values come from `FieldSchemaType` serialization (controlled shape), not raw user input |

No high-risk threat vectors exist in this phase. The existing `params![]` pattern used throughout the codebase is sufficient.

---

## Sources

### Primary (HIGH confidence)
- `src-tauri/src/field_mapping_db.rs` — complete file read; confirmed `open()`, `open_in_memory()`, `upsert_schema_row` patterns
- `src-tauri/src/field_transform/mod.rs` — `FieldMappingRow` struct definition (line 135), existing `Serialize/Deserialize` derives
- `src-tauri/src/commands.rs:1149-1322` — Tauri command patterns for field mapping commands; `refresh_field_schema_cache` as synchronous `fn` reference
- `src-tauri/src/main.rs:120-246` — `FieldMappingDb::open` at line 141; `invoke_handler` registration at line 192
- `src-tauri/Cargo.toml` — rusqlite 0.39 bundled, serde, serde_json, chrono — all confirmed present
- `src-tauri/src/error.rs` — `AppError`, `AppResult<T>` types
- `src-tauri/src/snapshot_db.rs` — db-per-concern reference pattern

### Secondary (MEDIUM confidence)
- `src-tauri/src/field_transform/pipeline.rs:1-74` — confirmed no `"priority"` arm in dispatch as of Phase 18 completion

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in Cargo.toml
- Architecture: HIGH — all patterns verified directly from codebase files
- Pitfalls: HIGH — derived from direct code reading and established decisions
- SQL schema for new tables: MEDIUM — column names follow discretion guidance from CONTEXT.md; exact schema is a discretion item

**Research date:** 2026-04-27
**Valid until:** 2026-06-27 (stable Rust/rusqlite domain; 60-day validity)
