---
phase: 19-mapping-persistence-crud-commands
reviewed: 2026-04-27T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src-tauri/Cargo.toml
  - src-tauri/src/commands.rs
  - src-tauri/src/field_mapping_db.rs
  - src-tauri/src/main.rs
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-04-27
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 19 adds three Tauri CRUD commands (`get_field_mapping`, `set_field_mapping`, `delete_field_mapping`) backed by two new SQLite tables (`field_mapping`, `mapping_meta`) in `FieldMappingDb`, plus a seed function that inserts five default mapping rows on first open.

The three new commands themselves are structurally sound: they follow the established `Arc<Mutex<>>` lock pattern, return correctly-typed `AppError`, and the underlying DB methods use parameterized queries with no injection risk. `Cargo.toml` and `main.rs` changes are minimal and correct.

Four warnings were found. None are in the three new CRUD commands themselves — two are pre-existing issues in `field_discovery.rs` / `commands.rs` that are in scope because those files are listed for review, one is a missing DB-level constraint in the new `field_mapping` table, and one is a transaction-safety gap in the new seed function. Two info items cover dead code and a stale doc comment introduced by this phase.

## Warnings

### WR-01: Audited HTTP client built but discarded — field-discovery commands bypass audit middleware

**File:** `src-tauri/src/commands.rs:1176`, `1197`, `1254`, `1280`

**Issue:** `discover_source_fields`, `get_target_field_schema_for_issuetype`, `probe_createmeta`, and `pre_warm_target_issue_types` each call `build_audited_client(...)` but immediately assign the result to `_audit`, then construct a separate `reqwest::Client::new()` and pass *that* to the field-discovery functions. The `_audit` value is dropped at end-of-scope without being used. The comment on line 1175 says "Arm audit middleware side-effects (request-id seeding) for downstream calls" — this intent is not achieved. All HTTP traffic from these four commands is invisible to the audit log.

```rust
// Current (broken): _audit is dropped, plain client is used
let _audit = build_audited_client(Arc::clone(db.inner()));
let client = reqwest::Client::new();
field_discovery::get_or_fetch_source_global(mapping_db.inner(), &client, ...).await

// Fix: pass the audited client
let client = build_audited_client(Arc::clone(db.inner()));
field_discovery::get_or_fetch_source_global(mapping_db.inner(), &client, ...).await
```

The `field_discovery` function signatures accept `&Client` (from `reqwest`), but `ClientWithMiddleware` (from `reqwest_middleware`) implements `Deref<Target = Client>` — update the function signatures to accept `&ClientWithMiddleware` or change the parameter type to a trait object. Alternatively, pass the `ClientWithMiddleware` directly after updating `get_or_fetch_source_global` / `get_or_fetch_target_schema` / `fetch_all_createmeta_fields` / `fetch_target_issue_types` to take `&ClientWithMiddleware`.

---

### WR-02: No validation of `transformer_kind` in `set_field_mapping` — arbitrary strings accepted

**File:** `src-tauri/src/commands.rs:1344`, `src-tauri/src/field_mapping_db.rs:40`

**Issue:** The `set_field_mapping` command accepts any `FieldMappingRow` from the frontend and persists it without validating `transformer_kind`. The `field_mapping` table schema has no `CHECK` constraint on that column (the `side` column in `field_schema_cache` correctly has one). When `apply_mapping` in a later phase dispatches on `transformer_kind`, an unknown value will silently produce incorrect behavior — no error will be surfaced because the bad value was persisted without complaint.

```rust
// Fix option A: add CHECK at the schema level
const CREATE_FIELD_MAPPING: &str = "
    CREATE TABLE IF NOT EXISTS field_mapping (
        ...
        transformer_kind    TEXT NOT NULL
            CHECK(transformer_kind IN
                  ('identity','user','version','component','wiki_to_adf','priority')),
        ...
    );
";

// Fix option B: validate in set_field_mapping before calling upsert
const VALID_KINDS: &[&str] = &["identity","user","version","component","wiki_to_adf","priority"];
pub fn set_field_mapping(row: FieldMappingRow, ...) -> Result<(), AppError> {
    if !VALID_KINDS.contains(&row.transformer_kind.as_str()) {
        return Err(AppError::Internal(format!(
            "unknown transformer_kind: '{}'", row.transformer_kind
        )));
    }
    ...
}
```

Note: option A only applies to new databases. If the schema is already deployed without the constraint, a migration step is required. Option B is safer as a defense in the command layer.

---

### WR-03: Source schema hash computed from re-serialized structs, not raw HTTP bytes — violates stated contract

**File:** `src-tauri/src/field_discovery.rs:550-554`

**Issue:** `get_or_fetch_source_global` computes the schema hash by re-serializing the already-parsed `Vec<FieldSchema>` back to JSON:

```rust
let raw_hash = compute_schema_hash(
    serde_json::to_string(&fields)
        .unwrap_or_default()   // <-- silently hashes "" on serialization failure
        .as_bytes(),
);
```

The module-level doc comment on `compute_schema_hash` (`field_mapping_db.rs:344-346`) explicitly states: *"hashing the raw JSON (no canonicalization) so any byte-level drift is detected."* The source hash violates this contract in two ways:

1. The hash input is a canonical re-serialization of Rust structs, not the raw server response. Field ordering, whitespace, and extra JSON keys that did not survive parsing are lost. Byte-level drift will not be detected.
2. `unwrap_or_default()` on the serialization means a failure produces `compute_schema_hash(b"")` — a well-known constant. Two different serialization failures from different server responses would produce an identical hash, falsely signalling no change.

Compare with `get_or_fetch_target_schema`, which correctly hashes raw response bytes inside `fetch_all_createmeta_fields`.

```rust
// Fix: capture raw bytes before parsing, consistent with target path
let bytes = resp.bytes().await
    .map_err(|_| AppError::Http("v2 /field: read body failed".into()))?;
let raw_hash = compute_schema_hash(&bytes);
let value: serde_json::Value = serde_json::from_slice(&bytes)
    .map_err(|_| AppError::Http("v2 /field: parse failed".into()))?;
let fields = parse_global_field_list(&value)?;
```

This requires refactoring `discover_v2_fields` to return `(Vec<FieldSchema>, String)` like `fetch_all_createmeta_fields` does.

---

### WR-04: `seed_defaults_if_empty` inserts 5 rows outside a transaction — partial seed cannot be corrected

**File:** `src-tauri/src/field_mapping_db.rs:55-82`

**Issue:** The seed guard (lines 56-63) reads `COUNT(*)` and short-circuits if > 0. The five `INSERT OR IGNORE` statements are then executed one at a time in SQLite autocommit mode. If the process is killed between inserts (e.g., after rows 1-2 are written, before rows 3-5), on next `open()` the `COUNT(*)` check finds 2 rows and skips seeding entirely. The database is left permanently missing the `priority`, `assignee`, and `reporter` defaults.

```rust
// Fix: wrap all seed inserts in a single transaction
fn seed_defaults_if_empty(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM field_mapping", [], |r| r.get(0)
    )?;
    if count > 0 {
        return Ok(());
    }
    let tx = conn.unchecked_transaction()?;
    let now = Utc::now().to_rfc3339();
    let defaults: [(&str, &str, &str); 5] = [ ... ];
    for (src, tgt, kind) in defaults {
        tx.execute(
            "INSERT OR IGNORE INTO field_mapping ... VALUES (?1, ?2, ?3, ?4, ?4)",
            params![src, tgt, kind, now],
        )?;
    }
    tx.commit()?;
    Ok(())
}
```

## Info

### IN-01: `mapping_meta` table created but has no read/write methods — dead code

**File:** `src-tauri/src/field_mapping_db.rs:48-53`, `93-94`, `103-104`

**Issue:** The `mapping_meta` table is created in both `open()` and `open_in_memory()`, but `FieldMappingDb` exposes no methods to read from or write to it. No production code path queries this table. The only non-DDL reference is a test assertion that the table exists (`field_mapping_db.rs:513`). This is a stub that was planned for Phase 19 but left unimplemented.

**Fix:** Either add `get_meta`/`set_meta` methods to `FieldMappingDb` if the table is needed now, or defer the table creation to the phase that will actually use it and remove the DDL from this phase.

---

### IN-02: Module doc comment describes Phase 19 as future work — stale after this phase completes

**File:** `src-tauri/src/field_mapping_db.rs:1-5`

**Issue:** The module-level doc comment reads: *"Phase 19 will extend this file with `field_mapping` and `mapping_meta` tables; the schema below is stable."* Phase 19 is now complete. The forward-looking language is stale and will mislead future readers.

**Fix:**
```rust
//! Phase 17: mapping.db `SQLite` persistence for the field schema cache.
//!
//! Mirrors the `snapshot_db.rs` pattern (db-per-concern, `Arc<Mutex<>>`, manual
//! `CREATE TABLE IF NOT EXISTS` migration). Extended in Phase 19 with
//! `field_mapping` (user-configurable field mappings) and `mapping_meta` tables.
```

---

_Reviewed: 2026-04-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
