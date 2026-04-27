# Phase 19: Mapping Persistence + CRUD Commands - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 3 (field_mapping_db.rs, commands.rs, main.rs)
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src-tauri/src/field_mapping_db.rs` | db-module (extend) | CRUD | same file (existing `upsert_schema_row` / `get_cached_schemas` / `clear_cache_for`) | exact |
| `src-tauri/src/commands.rs` | controller (extend) | request-response | `src-tauri/src/commands.rs:1298-1322` (`refresh_field_schema_cache`) | exact |
| `src-tauri/src/main.rs` | config (extend) | — | `src-tauri/src/main.rs:192-243` (invoke_handler registration block) | exact |

---

## Pattern Assignments

### `src-tauri/src/field_mapping_db.rs` — extend with two new tables + seed + three methods

**Analog:** same file (`field_mapping_db.rs`) — all patterns are already present; Phase 19 is additive.

---

#### Imports pattern (lines 7-11)

```rust
use crate::error::AppResult;
use crate::field_discovery::{FieldSchema, FieldSchemaType, FieldSide};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};
```

Phase 19 additions — add after the existing imports:

```rust
use crate::field_transform::FieldMappingRow;
use serde_json; // already transitively available; explicit import for clarity
```

---

#### DDL constants pattern (lines 13-32)

Existing pattern to mirror:

```rust
const CREATE_FIELD_SCHEMA_CACHE: &str = "
    CREATE TABLE IF NOT EXISTS field_schema_cache (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        side                 TEXT NOT NULL CHECK(side IN ('source','target')),
        ...
        UNIQUE(side, project_key, issuetype_id, field_id)
    );
";

const CREATE_INDEX: &str =
    "CREATE INDEX IF NOT EXISTS idx_fsc_key ON field_schema_cache(side, project_key, issuetype_id);";
```

Phase 19 — two new DDL constants to add alongside the existing ones:

```rust
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

---

#### `open()` and `open_in_memory()` migration pattern (lines 38-51)

Existing pattern:

```rust
pub fn open(path: &std::path::Path) -> AppResult<Self> {
    let conn = Connection::open(path)?;
    conn.execute_batch(CREATE_FIELD_SCHEMA_CACHE)?;
    conn.execute_batch(CREATE_INDEX)?;
    Ok(Self { conn })
}

pub fn open_in_memory() -> AppResult<Self> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch(CREATE_FIELD_SCHEMA_CACHE)?;
    conn.execute_batch(CREATE_INDEX)?;
    Ok(Self { conn })
}
```

Phase 19 — both methods get the same three additional lines before `Ok(Self { conn })`. **CRITICAL: both `open` and `open_in_memory` must be updated identically or tests fail with "no such table: field_mapping".**

```rust
pub fn open(path: &std::path::Path) -> AppResult<Self> {
    let conn = Connection::open(path)?;
    conn.execute_batch(CREATE_FIELD_SCHEMA_CACHE)?;
    conn.execute_batch(CREATE_INDEX)?;
    conn.execute_batch(CREATE_FIELD_MAPPING)?;   // Phase 19 add
    conn.execute_batch(CREATE_MAPPING_META)?;    // Phase 19 add
    seed_defaults_if_empty(&conn)?;              // Phase 19 add
    Ok(Self { conn })
}

pub fn open_in_memory() -> AppResult<Self> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch(CREATE_FIELD_SCHEMA_CACHE)?;
    conn.execute_batch(CREATE_INDEX)?;
    conn.execute_batch(CREATE_FIELD_MAPPING)?;   // Phase 19 add
    conn.execute_batch(CREATE_MAPPING_META)?;    // Phase 19 add
    seed_defaults_if_empty(&conn)?;              // Phase 19 add
    Ok(Self { conn })
}
```

---

#### Seed function pattern — new, no prior analog in codebase

The `COUNT(*) = 0` guard + `INSERT OR IGNORE` is novel. The `INSERT OR IGNORE` SQL verb and `params![]` usage mirror `upsert_schema_row`. Place this as a private free function just before `impl FieldMappingDb`:

```rust
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

Key: `INSERT OR IGNORE` (not `INSERT OR REPLACE`) preserves user modifications. `source_schema_json` / `target_schema_json` are `NULL` for seed rows — the row-mapper handles `Option<String>` and falls back to `FieldSchemaType::Other`.

---

#### `upsert_mapping_row` method — core CRUD pattern (lines 54-98 of existing `upsert_schema_row`)

Existing pattern to copy:

```rust
pub fn upsert_schema_row(...) -> AppResult<()> {
    let schema_json = serde_json::to_string(&field.schema)?;
    let now = Utc::now().to_rfc3339();
    self.conn.execute(
        "INSERT INTO field_schema_cache
            (side, ..., cached_at)
         VALUES (?1, ..., ?11)
         ON CONFLICT(side, project_key, issuetype_id, field_id) DO UPDATE SET
             field_name = excluded.field_name,
             ...",
        params![...],
    )?;
    Ok(())
}
```

Phase 19 equivalent:

```rust
pub fn upsert_mapping_row(&self, row: &FieldMappingRow) -> AppResult<()> {
    let source_schema_json = serde_json::to_string(&row.source_schema).ok();
    let target_schema_json = serde_json::to_string(&row.target_schema).ok();
    let now = Utc::now().to_rfc3339();
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
            now,
        ],
    )?;
    Ok(())
}
```

Note `?6` appears twice in VALUES (same timestamp for `created_at` and `updated_at` on insert), but only `updated_at` is overwritten by the `DO UPDATE` clause — preserving the original `created_at`.

---

#### `get_all_mapping_rows` method — SELECT + row-mapper pattern (lines 101-149 of existing `get_cached_schemas`)

Existing pattern to copy:

```rust
pub fn get_cached_schemas(&self, ...) -> AppResult<Vec<FieldSchema>> {
    let mut stmt = self.conn.prepare("SELECT ... FROM field_schema_cache ...")?;
    let rows = stmt.query_map(params![...], |row| {
        let field_id: String = row.get(0)?;
        let schema_json: String = row.get(2)?;
        let allowed_values_json: Option<String> = row.get(4)?;   // <-- Option<String> for nullable
        Ok((field_id, schema_json, allowed_values_json, ...))
    })?;
    let mut out = Vec::new();
    for r in rows {
        let (..., schema_json, allowed_values_json, ...) = r?;
        let schema: FieldSchemaType = serde_json::from_str(&schema_json)
            .map_err(|e| crate::error::AppError::Internal(format!("schema_json parse: {e}")))?;
        let allowed_values = match allowed_values_json {
            Some(s) => Some(serde_json::from_str(&s)...?),
            None => None,
        };
        out.push(FieldSchema { ... });
    }
    Ok(out)
}
```

Phase 19 equivalent — **critical: use `Option<String>` for nullable schema columns; fall back to `FieldSchemaType::Other` when `NULL`**:

```rust
pub fn get_all_mapping_rows(&self) -> AppResult<Vec<FieldMappingRow>> {
    let mut stmt = self.conn.prepare(
        "SELECT source_field_id, target_field_id, transformer_kind,
                source_schema_json, target_schema_json
         FROM field_mapping
         ORDER BY id ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        let source_field_id: String = row.get(0)?;
        let target_field_id: String = row.get(1)?;
        let transformer_kind: String = row.get(2)?;
        let source_schema_json: Option<String> = row.get(3)?;
        let target_schema_json: Option<String> = row.get(4)?;
        Ok((source_field_id, target_field_id, transformer_kind, source_schema_json, target_schema_json))
    })?;
    let mut out = Vec::new();
    for r in rows {
        let (source_field_id, target_field_id, transformer_kind, src_json, tgt_json) = r?;
        let source_schema = match src_json {
            Some(s) => serde_json::from_str(&s)
                .map_err(|e| crate::error::AppError::Internal(format!("source_schema_json parse: {e}")))?,
            None => crate::field_discovery::FieldSchemaType::Other,
        };
        let target_schema = match tgt_json {
            Some(s) => serde_json::from_str(&s)
                .map_err(|e| crate::error::AppError::Internal(format!("target_schema_json parse: {e}")))?,
            None => crate::field_discovery::FieldSchemaType::Other,
        };
        out.push(FieldMappingRow {
            source_field_id,
            target_field_id,
            transformer_kind,
            source_schema,
            target_schema,
        });
    }
    Ok(out)
}
```

---

#### `delete_mapping_row` method — DELETE pattern (lines 177-191 of existing `clear_cache_for`)

Existing pattern to copy:

```rust
pub fn clear_cache_for(&self, ...) -> AppResult<usize> {
    let n = self.conn.execute(
        "DELETE FROM field_schema_cache WHERE side = ?1 AND ...",
        params![...],
    )?;
    Ok(n)
}
```

Phase 19 equivalent — returns `AppResult<()>` (idempotent, no error if row absent per D-05):

```rust
pub fn delete_mapping_row(&self, source_field_id: &str) -> AppResult<()> {
    self.conn.execute(
        "DELETE FROM field_mapping WHERE source_field_id = ?1",
        params![source_field_id],
    )?;
    Ok(())  // idempotent — 0 rows deleted is not an error
}
```

---

#### Test pattern — `#[cfg(test)]` block (lines 202-351 of existing tests)

Existing test structure to mirror exactly:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::field_discovery::{FieldSchema, FieldSchemaType, FieldSide};

    // helper functions at top, then #[test] functions
    #[test]
    fn open_in_memory_creates_table() {
        let db = FieldMappingDb::open_in_memory().expect("open in memory");
        // assert table is accessible via a method call
    }
}
```

Phase 19 — new test functions appended to the existing `mod tests` block. Do NOT create a new test module. New tests follow the same helper + assertion structure. All use `open_in_memory()`, never a file path.

---

### `src-tauri/src/commands.rs` — add 3 new Tauri commands near line 1298

**Analog:** `src-tauri/src/commands.rs:1298-1322` (`refresh_field_schema_cache`) — **exact match**

---

#### Imports already present (lines 1151-1152)

```rust
use crate::field_discovery::{self, FieldSchema, FieldSide, IssueTypeRef, ProbeResult};
use crate::field_mapping_db::FieldMappingDb;
```

Phase 19 addition — add after the above:

```rust
use crate::field_transform::FieldMappingRow;
```

---

#### Synchronous command pattern (lines 1298-1322) — **copy this exactly**

```rust
#[tauri::command]
pub fn refresh_field_schema_cache(
    side: String,
    project_key: Option<String>,
    issuetype_id: Option<String>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<(), AppError> {
    // ...
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.clear_cache_for(...)?;
    Ok(())
}
```

Phase 19 — three new commands follow this shape. All are `fn` (synchronous), **not** `async fn`. All take only `mapping_db` state — no other `State` parameters (avoids lock-ordering deadlock):

```rust
// --- Field mapping CRUD commands (Phase 19) ---

#[tauri::command]
pub fn get_field_mapping(
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<Vec<FieldMappingRow>, AppError> {
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.get_all_mapping_rows()
}

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

Place these immediately after `refresh_field_schema_cache` (after line 1322, before the `// --- Connection meta commands ---` comment).

---

### `src-tauri/src/main.rs` — register 3 new commands in invoke_handler

**Analog:** `src-tauri/src/main.rs:192-243` (invoke_handler block) — **exact match**

---

#### Registration pattern (lines 238-242)

Existing field mapping commands at bottom of handler:

```rust
commands::discover_source_fields,
commands::get_target_field_schema_for_issuetype,
commands::probe_createmeta,
commands::pre_warm_target_issue_types,
commands::refresh_field_schema_cache,
```

Phase 19 — append three new entries after `refresh_field_schema_cache` (line 242):

```rust
commands::get_field_mapping,
commands::set_field_mapping,
commands::delete_field_mapping,
```

---

## Shared Patterns

### Error Handling
**Source:** `src-tauri/src/error.rs` (entire file, 67 lines)
**Apply to:** All three new commands and all new db methods

```rust
// Lock poison pattern — copy verbatim in every command
let guard = mapping_db
    .lock()
    .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
```

`rusqlite::Error` automatically converts to `AppError::Database` via the `From` impl in `error.rs:47-50`. `serde_json::Error` converts to `AppError::Serialization` via `error.rs:60-63`. No manual error wrapping is needed beyond the lock poison case.

### Chrono timestamp pattern
**Source:** `src-tauri/src/field_mapping_db.rs:69`
**Apply to:** `upsert_mapping_row` and `seed_defaults_if_empty`

```rust
let now = Utc::now().to_rfc3339();
```

### `params![]` macro — parameterized SQL
**Source:** `src-tauri/src/field_mapping_db.rs:84-97`
**Apply to:** All SQL statements with bound values

All SQL values are bound via `params![]`, never string-interpolated. This is the established SQL injection prevention pattern throughout the codebase.

### `serde_json` to/from TEXT column
**Source:** `src-tauri/src/field_mapping_db.rs:62-65, 131-137`
**Apply to:** `upsert_mapping_row` (serialise schema to JSON string) and `get_all_mapping_rows` (deserialise JSON string back to `FieldSchemaType`)

```rust
// Serialize (in upsert)
let schema_json = serde_json::to_string(&field.schema)?;

// Deserialize (in get) — note: Option<String> for nullable columns
let schema_json: String = row.get(2)?;
let schema: FieldSchemaType = serde_json::from_str(&schema_json)
    .map_err(|e| crate::error::AppError::Internal(format!("schema_json parse: {e}")))?;
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `seed_defaults_if_empty` (private fn in `field_mapping_db.rs`) | utility | batch | No prior seed-on-first-open function exists in the codebase; pattern is derived from existing `INSERT OR IGNORE` SQL and `COUNT(*)` query primitives but is a new composition |

---

## Key Coordination Point

**`pipeline.rs` has no `"priority"` dispatch arm** (verified at lines 1-74 — the dispatch chain ends at `identity::transform_identity` for everything not matching `is_description_row`, `is_user_field`, `is_array_of(..., "version")`, or `is_array_of(..., "component")`). Phase 19 seeds `transformer_kind = "priority"` which currently falls through to the identity transformer. The planner must decide whether to add a `"priority"` arm to `pipeline.rs` in this phase or defer to Phase 23. The seed row itself is correct per D-08 regardless.

---

## Metadata

**Analog search scope:** `src-tauri/src/` (field_mapping_db.rs, commands.rs, main.rs, snapshot_db.rs, error.rs, field_transform/mod.rs, field_transform/pipeline.rs)
**Files scanned:** 7
**Pattern extraction date:** 2026-04-27
