---
phase: 17-field-discovery-mock-schema-fidelity
plan: 02
plan_id: 17-02
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/field_discovery.rs
  - src-tauri/src/field_mapping_db.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/main.rs
autonomous: true
requirements:
  - DISC-01
  - DISC-02
  - DISC-03
tags:
  - rust
  - sqlite
  - serde
  - field-discovery
  - mapping-db

must_haves:
  truths:
    - "FieldSchemaType serde-tagged enum deserializes every variant in PATTERNS.md/RESEARCH.md table (string, number, date, datetime, user, array, option, option-with-child, issuetype, priority, any) round-trip from JSON without loss"
    - "Unrecognized schema.type strings (e.g. 'watches', 'timetracking') deserialize into FieldSchemaType::Any rather than panicking — Pitfall A"
    - "FieldMappingDb opens against a path or in memory and creates the field_schema_cache table + idx_fsc_key index via CREATE TABLE/INDEX IF NOT EXISTS"
    - "FieldMappingDb exposes upsert_schema_row(side, project_key, issuetype_id, field_id, ...) and get_cached_schemas(side, project_key, issuetype_id) -> Vec<FieldSchema>"
    - "FieldMappingDb stores schema_hash as a SHA-256 hex string per (side, project_key, issuetype_id) tuple — same value on every row of that tuple"
    - "main.rs opens mapping.db via FieldMappingDb::open and registers Arc<Mutex<FieldMappingDb>> via app.manage immediately after the snapshot_db block"
    - "lib.rs exports pub mod field_discovery and pub mod field_mapping_db"
    - "All inline #[cfg(test)] unit tests cover serde round-trip per variant + pagination-vec helper + cache write/read; tests pass via cargo test --lib"
  artifacts:
    - path: "src-tauri/src/field_discovery.rs"
      provides: "FieldSchemaType enum, FieldSchema struct, FieldSide enum, CreatemetaResponse struct, IssueTypeRef struct, hash helper, inline #[cfg(test)] mod tests"
      contains: "FieldSchemaType"
    - path: "src-tauri/src/field_mapping_db.rs"
      provides: "FieldMappingDb wrapping rusqlite::Connection, open + open_in_memory + upsert_schema_row + get_cached_schemas + compute_schema_hash"
      contains: "field_schema_cache"
    - path: "src-tauri/src/lib.rs"
      provides: "pub mod field_discovery and pub mod field_mapping_db exports"
      contains: "field_discovery"
    - path: "src-tauri/src/main.rs"
      provides: "FieldMappingDb opened in setup() closure and registered via app.manage"
      contains: "FieldMappingDb"
  key_links:
    - from: "main.rs setup closure"
      to: "FieldMappingDb::open(app_dir.join('mapping.db'))"
      via: "Arc::new(Mutex::new(...)) + app.manage"
      pattern: "FieldMappingDb::open"
    - from: "field_discovery.rs FieldSchemaType variants"
      to: "FieldSchema struct schema field"
      via: "#[serde(tag = \"type\")]"
      pattern: "tag = \"type\""
---

<objective>
Define the Rust type system + SQLite persistence layer that every other Phase 17 plan depends on:
- `FieldSchemaType` discriminated-union enum (mirrors Atlassian schema polymorphism)
- `FieldSchema` row struct + `FieldSide` enum + supporting types (`CreatemetaResponse`, `IssueTypeRef`)
- `FieldMappingDb` (`mapping.db`) with `field_schema_cache` table, schema_hash column for D-04, db-per-concern lifecycle
- Module declarations in `lib.rs` and `mapping.db` opening in `main.rs`

Purpose: Plans 03/04/05 cannot exist without these contracts. This plan ships the contracts plus their unit tests so downstream tasks can implement against types that already compile.

Output: 4 modified files, full inline serde-roundtrip + db-roundtrip test coverage, project compiles with both `mock-server` and default features.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-CONTEXT.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-PATTERNS.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-VALIDATION.md
@.planning/research/ARCHITECTURE.md

<interfaces>
<!-- Existing exports from src-tauri/src/error.rs -->
```rust
// src-tauri/src/error.rs
pub type AppResult<T> = Result<T, AppError>;
pub enum AppError {
    Http(String),
    Internal(String),
    Sqlite(/* rusqlite error */),
    Keychain(String),
    MockServer(String),
    /* ... */
}
// AppError already has From<rusqlite::Error> per existing snapshot_db usage
```

<!-- Existing pattern from src-tauri/src/snapshot_db.rs (the analog) -->
```rust
use crate::error::AppResult;
use chrono::Utc;
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub struct SnapshotDb { conn: Connection }

impl SnapshotDb {
    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(CREATE_SNAPSHOT_TABLE)?;
        // .ok() on ALTER TABLE for additive migrations
        Ok(Self { conn })
    }
    pub fn open_in_memory() -> AppResult<Self> { /* same with Connection::open_in_memory */ }
}

// hash pattern (lines 298-306):
fn compute_hash(json: &str) -> AppResult<String> {
    let mut hasher = Sha256::new();
    hasher.update(json.as_bytes());
    Ok(hex::encode(hasher.finalize()))
}
```

<!-- Existing main.rs setup pattern (lines 130-138 of src-tauri/src/main.rs) -->
```rust
let snapshot_db_path = app_dir.join("snapshots.db");
let snapshot_db = SnapshotDb::open(&snapshot_db_path).expect("Failed to open snapshot database");
app.manage(Arc::new(Mutex::new(snapshot_db)));

// Phase 17 inserts an identical block AFTER this:
let mapping_db_path = app_dir.join("mapping.db");
let mapping_db = FieldMappingDb::open(&mapping_db_path).expect("Failed to open mapping database");
app.manage(Arc::new(Mutex::new(mapping_db)));
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Define FieldSchemaType enum, FieldSchema/CreatemetaResponse/IssueTypeRef structs in field_discovery.rs with full serde round-trip test coverage</name>
  <files>src-tauri/src/field_discovery.rs, src-tauri/src/lib.rs</files>
  <read_first>
    - src-tauri/src/lib.rs (existing pub mod declarations)
    - src-tauri/src/fixtures.rs lines 1-100 (existing serde-tagged-enum pattern: JiraStatus, JiraPriority — note `#[serde(rename = "...")]` per-field)
    - src-tauri/src/jira_client.rs lines 1-30 (module-level imports/conventions)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md §"Pattern 3: Rust FieldSchema serde discriminated union" lines 348-446, §"Pitfall A" lines 870-875
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-PATTERNS.md §"src-tauri/src/field_discovery.rs"
  </read_first>
  <behavior>
    - `serde_json::from_value` of `{"type":"string","system":"summary"}` → FieldSchemaType::String { system: Some("summary"), custom: None, custom_id: None }
    - `serde_json::from_value` of `{"type":"number","custom":"...:float","customId":10001}` → FieldSchemaType::Number { custom: Some("..."), custom_id: Some(10001) }
    - `serde_json::from_value` of `{"type":"array","items":"option","custom":"...:multiselect","customId":10004}` → FieldSchemaType::Array { items: "option", ... }
    - `serde_json::from_value` of `{"type":"option-with-child","custom":"...:cascadingselect","customId":10005}` → FieldSchemaType::OptionWithChild { ... }
    - `serde_json::from_value` of `{"type":"priority","system":"priority"}` → FieldSchemaType::Priority
    - `serde_json::from_value` of `{"type":"watches"}` (unknown) → FieldSchemaType::Any (no panic — Pitfall A)
    - Round-trip: serialize each variant back to JSON and re-deserialize equals original (shallow structural equality on serde_json::Value, modulo `Any` which loses original type tag — that case asserts only that the variant deserializes, not round-trips identically)
    - `CreatemetaResponse { start_at: u64, max_results: u64, total: u64, fields: Vec<FieldSchema> }` deserializes from a real createmeta page JSON
    - `IssueTypeRef { id: String, name: String, description: Option<String>, icon_url: Option<String> }` deserializes from issue-type list entry
    - `FieldSide` enum with variants Source, Target serializes as lowercase strings ("source"/"target")
  </behavior>
  <action>
**Step 1 — Add module to lib.rs:** Insert after existing `pub mod fixtures;` line:

```rust
pub mod field_discovery;
```

(Order alphabetical with existing pub mod lines.)

**Step 2 — Create `src-tauri/src/field_discovery.rs` with the following content (header + types + tests). Phase 17 Plan 04 will append HTTP functions and Tauri commands; this plan ships the types only.**

```rust
//! Phase 17: Field discovery types + (Plan 04) HTTP fetchers + Tauri commands.
//!
//! This module owns:
//!   - `FieldSchemaType` — serde-tagged discriminated union over Atlassian schema.type values
//!   - `FieldSchema` — one row of a /field or /createmeta response
//!   - `CreatemetaResponse` — paginated createmeta wrapper
//!   - `IssueTypeRef` — entry in /createmeta/{key}/issuetypes
//!   - `FieldSide` — 'source' | 'target' discriminant for the cache key
//!
//! Plan 04 will add: discover_v2_fields, discover_v3_fields,
//! fetch_all_createmeta_fields, fetch_createmeta_issuetypes, probe_createmeta,
//! plus the Tauri commands in commands.rs that delegate here.

use serde::{Deserialize, Serialize};

/// Side discriminant for the schema cache key. Mirrors the SQLite CHECK
/// constraint `side IN ('source','target')`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldSide {
    Source,
    Target,
}

impl FieldSide {
    pub fn as_str(&self) -> &'static str {
        match self {
            FieldSide::Source => "source",
            FieldSide::Target => "target",
        }
    }
}

/// Polymorphic Jira `schema` object. The serde tag is `type`; unknown variants
/// fall through to `Any` rather than failing deserialization (Pitfall A).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum FieldSchemaType {
    String {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Number {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Date {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Datetime {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    User {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Array {
        items: String, // "option" | "string" | "user" | "component" | "version" | "group"
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    #[serde(rename = "option")]
    Option_ {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    #[serde(rename = "option-with-child")]
    OptionWithChild {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Issuetype,
    Priority,
    /// Catch-all for any future Atlassian schema.type not yet handled here.
    /// Renderers must treat this as a read-only "Unsupported type" pill.
    #[serde(other)]
    Any,
}

/// One row in a /field or paginated /createmeta response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldSchema {
    pub field_id: String,
    pub name: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_default_value: Option<bool>,
    pub schema: FieldSchemaType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allowed_values: Option<Vec<serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operations: Option<Vec<String>>,
}

/// Paginated wrapper returned by /rest/api/3/issue/createmeta/{key}/issuetypes/{id}.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatemetaResponse {
    pub start_at: u64,
    pub max_results: u64,
    pub total: u64,
    pub fields: Vec<FieldSchema>,
}

/// Issue-type entry in /createmeta/{key}/issuetypes (used by pre-warm + Phase 22 chooser).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTypeRef {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
}

/// Issue-type list page wrapper (mirrors createmeta paginated shape).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTypesResponse {
    pub start_at: u64,
    pub max_results: u64,
    pub total: u64,
    pub issue_types: Vec<IssueTypeRef>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn round_trip(v: serde_json::Value) -> FieldSchemaType {
        let parsed: FieldSchemaType = serde_json::from_value(v.clone())
            .unwrap_or_else(|e| panic!("deserialize failed for {v}: {e}"));
        parsed
    }

    #[test]
    fn serde_round_trip_string() {
        let parsed = round_trip(json!({"type": "string", "system": "summary"}));
        assert!(matches!(parsed, FieldSchemaType::String { ref system, .. } if system.as_deref() == Some("summary")));
    }

    #[test]
    fn serde_round_trip_number_with_custom() {
        let parsed = round_trip(json!({
            "type": "number",
            "custom": "com.atlassian.jira.plugin.system.customfieldtypes:float",
            "customId": 10001
        }));
        match parsed {
            FieldSchemaType::Number { custom, custom_id, .. } => {
                assert_eq!(custom.as_deref(), Some("com.atlassian.jira.plugin.system.customfieldtypes:float"));
                assert_eq!(custom_id, Some(10001));
            }
            _ => panic!("expected Number variant"),
        }
    }

    #[test]
    fn serde_round_trip_date() {
        let parsed = round_trip(json!({"type": "date"}));
        assert!(matches!(parsed, FieldSchemaType::Date { .. }));
    }

    #[test]
    fn serde_round_trip_datetime() {
        let parsed = round_trip(json!({"type": "datetime"}));
        assert!(matches!(parsed, FieldSchemaType::Datetime { .. }));
    }

    #[test]
    fn serde_round_trip_user() {
        let parsed = round_trip(json!({"type": "user", "system": "assignee"}));
        assert!(matches!(parsed, FieldSchemaType::User { ref system, .. } if system.as_deref() == Some("assignee")));
    }

    #[test]
    fn serde_round_trip_multiselect_array() {
        let parsed = round_trip(json!({
            "type": "array",
            "items": "option",
            "custom": "com.atlassian.jira.plugin.system.customfieldtypes:multiselect",
            "customId": 10004
        }));
        match parsed {
            FieldSchemaType::Array { items, custom_id, .. } => {
                assert_eq!(items, "option");
                assert_eq!(custom_id, Some(10004));
            }
            _ => panic!("expected Array variant"),
        }
    }

    #[test]
    fn serde_round_trip_option() {
        let parsed = round_trip(json!({"type": "option", "custom": "...:select"}));
        assert!(matches!(parsed, FieldSchemaType::Option_ { .. }));
    }

    #[test]
    fn serde_round_trip_cascading() {
        let parsed = round_trip(json!({
            "type": "option-with-child",
            "custom": "com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect",
            "customId": 10005
        }));
        assert!(matches!(parsed, FieldSchemaType::OptionWithChild { .. }));
    }

    #[test]
    fn serde_round_trip_issuetype() {
        let parsed = round_trip(json!({"type": "issuetype"}));
        assert!(matches!(parsed, FieldSchemaType::Issuetype));
    }

    #[test]
    fn serde_round_trip_priority() {
        let parsed = round_trip(json!({"type": "priority", "system": "priority"}));
        assert!(matches!(parsed, FieldSchemaType::Priority));
    }

    #[test]
    fn serde_unknown_type_falls_through_to_any() {
        // Pitfall A: never panic on unknown schema.type
        let parsed = round_trip(json!({"type": "watches"}));
        assert!(matches!(parsed, FieldSchemaType::Any));
        let parsed2 = round_trip(json!({"type": "timetracking"}));
        assert!(matches!(parsed2, FieldSchemaType::Any));
    }

    #[test]
    fn field_schema_full_row_parses() {
        let row: FieldSchema = serde_json::from_value(json!({
            "fieldId": "customfield_10001",
            "key": "customfield_10001",
            "name": "Story Points",
            "required": false,
            "hasDefaultValue": false,
            "operations": ["set"],
            "schema": {
                "type": "number",
                "custom": "com.atlassian.jira.plugin.system.customfieldtypes:float",
                "customId": 10001
            }
        })).unwrap();
        assert_eq!(row.field_id, "customfield_10001");
        assert!(matches!(row.schema, FieldSchemaType::Number { .. }));
    }

    #[test]
    fn createmeta_response_parses_paginated_wrapper() {
        let resp: CreatemetaResponse = serde_json::from_value(json!({
            "startAt": 0,
            "maxResults": 5,
            "total": 7,
            "fields": []
        })).unwrap();
        assert_eq!(resp.start_at, 0);
        assert_eq!(resp.max_results, 5);
        assert_eq!(resp.total, 7);
    }

    #[test]
    fn issue_type_ref_parses() {
        let it: IssueTypeRef = serde_json::from_value(json!({
            "id": "10001",
            "name": "Bug",
            "description": "A defect",
            "iconUrl": "https://example.com/bug.png"
        })).unwrap();
        assert_eq!(it.id, "10001");
        assert_eq!(it.name, "Bug");
    }

    #[test]
    fn field_side_serializes_lowercase() {
        assert_eq!(serde_json::to_value(FieldSide::Source).unwrap(), json!("source"));
        assert_eq!(serde_json::to_value(FieldSide::Target).unwrap(), json!("target"));
    }

    #[test]
    fn field_side_as_str() {
        assert_eq!(FieldSide::Source.as_str(), "source");
        assert_eq!(FieldSide::Target.as_str(), "target");
    }
}
```

**Step 3 — Verify compilation and unit tests pass:**

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib field_discovery::tests
```

All 14 tests must pass.
  </action>
  <verify>
    <automated>cargo test --manifest-path src-tauri/Cargo.toml --lib field_discovery::tests 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File `src-tauri/src/field_discovery.rs` exists
    - `grep -c '^pub mod field_discovery;' src-tauri/src/lib.rs` returns 1
    - `grep -c 'pub enum FieldSchemaType' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c '#\[serde(other)\]' src-tauri/src/field_discovery.rs` returns at least 1 (Any variant)
    - `grep -c 'OptionWithChild' src-tauri/src/field_discovery.rs` returns at least 1
    - `grep -c '#\[serde(tag = "type"' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c '#\[serde(rename = "option-with-child")\]' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c 'pub struct CreatemetaResponse' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c 'pub struct IssueTypeRef' src-tauri/src/field_discovery.rs` returns 1
    - `cargo test --manifest-path src-tauri/Cargo.toml --lib field_discovery::tests` exits 0 with at least 14 passing tests
    - `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` exits 0
  </acceptance_criteria>
  <done>FieldSchemaType + FieldSchema + supporting types defined and unit-tested; lib.rs exports the module.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create FieldMappingDb (mapping.db) with field_schema_cache table, schema_hash helper, upsert/get methods, and inline tests</name>
  <files>src-tauri/src/field_mapping_db.rs, src-tauri/src/lib.rs</files>
  <read_first>
    - src-tauri/src/snapshot_db.rs (full file — mirror struct + open + open_in_memory + compute_hash pattern)
    - src-tauri/src/error.rs (AppError + AppResult)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md §"Pattern 1: mapping.db file lifecycle" lines 196-258, §"field_schema_cache DDL" lines 837-864, §"Pitfall D" lines 888-892
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-PATTERNS.md §"src-tauri/src/field_mapping_db.rs"
  </read_first>
  <behavior>
    - `FieldMappingDb::open(path)` creates the file at `path`, ensures the `field_schema_cache` table exists with the exact DDL from RESEARCH.md, ensures `idx_fsc_key` index exists
    - `FieldMappingDb::open_in_memory()` returns an in-memory DB with the same schema (used by all tests)
    - `upsert_schema_row(&self, side: FieldSide, project_key: Option<&str>, issuetype_id: Option<&str>, field: &FieldSchema, schema_hash: &str)` writes one row, ON CONFLICT(side, project_key, issuetype_id, field_id) DO UPDATE
    - `get_cached_schemas(&self, side: FieldSide, project_key: Option<&str>, issuetype_id: Option<&str>) -> AppResult<Vec<FieldSchema>>` returns rows for that tuple in insertion order
    - `get_cached_schema_hash(&self, side: FieldSide, project_key: Option<&str>, issuetype_id: Option<&str>) -> AppResult<Option<String>>` returns the hash from any row matching the tuple (all rows share the same hash by D-04)
    - `clear_cache_for(&self, side: FieldSide, project_key: Option<&str>, issuetype_id: Option<&str>)` deletes rows for that tuple (used by Plan 04 manual-refresh stub)
    - `compute_schema_hash(raw_json_bytes: &[u8]) -> String` returns lowercase hex SHA-256 (no canonicalization — D-04 hashes raw bytes)
    - Inline tests prove: open_in_memory creates table, upsert+get round-trips a FieldSchema row, hash hex format, NULL project_key+issuetype_id (source global) round-trips
  </behavior>
  <action>
**Step 1 — Add module to lib.rs:** Insert after `pub mod field_discovery;`:

```rust
pub mod field_mapping_db;
```

**Step 2 — Create `src-tauri/src/field_mapping_db.rs`:**

```rust
//! Phase 17: `mapping.db` SQLite persistence for the field schema cache.
//!
//! Mirrors the snapshot_db.rs pattern (db-per-concern, Arc<Mutex<>>, manual
//! CREATE TABLE IF NOT EXISTS migration). Phase 19 will extend this file with
//! `field_mapping` and `mapping_meta` tables; the schema below is stable.

use crate::error::AppResult;
use crate::field_discovery::{FieldSchema, FieldSchemaType, FieldSide};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};

const CREATE_FIELD_SCHEMA_CACHE: &str = "
    CREATE TABLE IF NOT EXISTS field_schema_cache (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        side                 TEXT NOT NULL CHECK(side IN ('source','target')),
        project_key          TEXT,
        issuetype_id         TEXT,
        field_id             TEXT NOT NULL,
        field_name           TEXT NOT NULL,
        schema_json          TEXT NOT NULL,
        required             INTEGER NOT NULL DEFAULT 0,
        allowed_values_json  TEXT,
        has_default_value    INTEGER NOT NULL DEFAULT 0,
        schema_hash          TEXT,
        cached_at            TEXT NOT NULL,
        UNIQUE(side, project_key, issuetype_id, field_id)
    );
";

const CREATE_INDEX: &str =
    "CREATE INDEX IF NOT EXISTS idx_fsc_key ON field_schema_cache(side, project_key, issuetype_id);";

pub struct FieldMappingDb {
    conn: Connection,
}

impl FieldMappingDb {
    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(CREATE_FIELD_SCHEMA_CACHE)?;
        conn.execute_batch(CREATE_INDEX)?;
        // Phase 19 will append additional CREATE TABLE IF NOT EXISTS blocks.
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(CREATE_FIELD_SCHEMA_CACHE)?;
        conn.execute_batch(CREATE_INDEX)?;
        Ok(Self { conn })
    }

    /// Insert or update one row in field_schema_cache.
    pub fn upsert_schema_row(
        &self,
        side: FieldSide,
        project_key: Option<&str>,
        issuetype_id: Option<&str>,
        field: &FieldSchema,
        schema_hash: &str,
    ) -> AppResult<()> {
        let schema_json = serde_json::to_string(&field.schema)?;
        let allowed_values_json = match &field.allowed_values {
            Some(av) => Some(serde_json::to_string(av)?),
            None => None,
        };
        let required_int: i64 = if field.required { 1 } else { 0 };
        let has_default_int: i64 = if field.has_default_value.unwrap_or(false) { 1 } else { 0 };
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO field_schema_cache
                (side, project_key, issuetype_id, field_id, field_name,
                 schema_json, required, allowed_values_json, has_default_value,
                 schema_hash, cached_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(side, project_key, issuetype_id, field_id) DO UPDATE SET
                 field_name           = excluded.field_name,
                 schema_json          = excluded.schema_json,
                 required             = excluded.required,
                 allowed_values_json  = excluded.allowed_values_json,
                 has_default_value    = excluded.has_default_value,
                 schema_hash          = excluded.schema_hash,
                 cached_at            = excluded.cached_at",
            params![
                side.as_str(),
                project_key,
                issuetype_id,
                field.field_id,
                field.name,
                schema_json,
                required_int,
                allowed_values_json,
                has_default_int,
                schema_hash,
                now,
            ],
        )?;
        Ok(())
    }

    /// Retrieve every cached row matching the (side, project_key, issuetype_id) tuple,
    /// reconstructed into FieldSchema. Returns an empty Vec on cache miss.
    pub fn get_cached_schemas(
        &self,
        side: FieldSide,
        project_key: Option<&str>,
        issuetype_id: Option<&str>,
    ) -> AppResult<Vec<FieldSchema>> {
        let mut stmt = self.conn.prepare(
            "SELECT field_id, field_name, schema_json, required, allowed_values_json, has_default_value
             FROM field_schema_cache
             WHERE side = ?1
               AND ((project_key IS NULL AND ?2 IS NULL) OR project_key = ?2)
               AND ((issuetype_id IS NULL AND ?3 IS NULL) OR issuetype_id = ?3)
             ORDER BY id ASC",
        )?;

        let rows = stmt.query_map(params![side.as_str(), project_key, issuetype_id], |row| {
            let field_id: String = row.get(0)?;
            let field_name: String = row.get(1)?;
            let schema_json: String = row.get(2)?;
            let required: i64 = row.get(3)?;
            let allowed_values_json: Option<String> = row.get(4)?;
            let has_default: i64 = row.get(5)?;
            Ok((field_id, field_name, schema_json, required, allowed_values_json, has_default))
        })?;

        let mut out = Vec::new();
        for r in rows {
            let (field_id, field_name, schema_json, required, allowed_values_json, has_default) = r?;
            let schema: FieldSchemaType = serde_json::from_str(&schema_json)
                .map_err(|e| crate::error::AppError::Internal(format!("schema_json parse: {e}")))?;
            let allowed_values = match allowed_values_json {
                Some(s) => Some(serde_json::from_str(&s).map_err(|e| {
                    crate::error::AppError::Internal(format!("allowed_values_json parse: {e}"))
                })?),
                None => None,
            };
            out.push(FieldSchema {
                field_id,
                name: field_name,
                required: required != 0,
                has_default_value: Some(has_default != 0),
                schema,
                allowed_values,
                operations: None,
            });
        }
        Ok(out)
    }

    /// Returns the schema_hash for any one row matching the tuple. By D-04 every
    /// row of the same (side, project_key, issuetype_id) shares the same hash.
    pub fn get_cached_schema_hash(
        &self,
        side: FieldSide,
        project_key: Option<&str>,
        issuetype_id: Option<&str>,
    ) -> AppResult<Option<String>> {
        let result = self
            .conn
            .query_row(
                "SELECT schema_hash FROM field_schema_cache
                 WHERE side = ?1
                   AND ((project_key IS NULL AND ?2 IS NULL) OR project_key = ?2)
                   AND ((issuetype_id IS NULL AND ?3 IS NULL) OR issuetype_id = ?3)
                 LIMIT 1",
                params![side.as_str(), project_key, issuetype_id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()?;
        Ok(result.flatten())
    }

    /// Delete all rows for a (side, project_key, issuetype_id) tuple. Used by the
    /// manual-refresh path (Phase 21 — stub here).
    pub fn clear_cache_for(
        &self,
        side: FieldSide,
        project_key: Option<&str>,
        issuetype_id: Option<&str>,
    ) -> AppResult<usize> {
        let n = self.conn.execute(
            "DELETE FROM field_schema_cache
             WHERE side = ?1
               AND ((project_key IS NULL AND ?2 IS NULL) OR project_key = ?2)
               AND ((issuetype_id IS NULL AND ?3 IS NULL) OR issuetype_id = ?3)",
            params![side.as_str(), project_key, issuetype_id],
        )?;
        Ok(n)
    }
}

/// SHA-256 hex of the raw response bytes. D-04 specifies hashing the raw JSON
/// (no canonicalization) so any byte-level drift is detected.
pub fn compute_schema_hash(raw_json_bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw_json_bytes);
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::field_discovery::{FieldSchema, FieldSchemaType, FieldSide};

    fn sample_field(id: &str, required: bool) -> FieldSchema {
        FieldSchema {
            field_id: id.into(),
            name: format!("Field {id}"),
            required,
            has_default_value: Some(false),
            schema: FieldSchemaType::String { system: Some("summary".into()), custom: None, custom_id: None },
            allowed_values: None,
            operations: Some(vec!["set".into()]),
        }
    }

    #[test]
    fn open_in_memory_creates_table() {
        let db = FieldMappingDb::open_in_memory().expect("open in memory");
        // Sanity: writing a row works (table exists).
        db.upsert_schema_row(
            FieldSide::Source,
            None,
            None,
            &sample_field("summary", true),
            "abc123",
        )
        .expect("upsert");
    }

    #[test]
    fn upsert_and_get_round_trips_field_schema() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let f = sample_field("customfield_10001", false);
        db.upsert_schema_row(FieldSide::Target, Some("MYPROJ"), Some("10001"), &f, "hash-1").unwrap();
        let got = db.get_cached_schemas(FieldSide::Target, Some("MYPROJ"), Some("10001")).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].field_id, "customfield_10001");
        assert_eq!(got[0].required, false);
    }

    #[test]
    fn upsert_overwrites_on_conflict() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let mut f = sample_field("priority", false);
        db.upsert_schema_row(FieldSide::Target, Some("MYPROJ"), Some("10001"), &f, "h1").unwrap();
        f.required = true;
        db.upsert_schema_row(FieldSide::Target, Some("MYPROJ"), Some("10001"), &f, "h2").unwrap();
        let got = db.get_cached_schemas(FieldSide::Target, Some("MYPROJ"), Some("10001")).unwrap();
        assert_eq!(got.len(), 1);
        assert!(got[0].required);
        assert_eq!(db.get_cached_schema_hash(FieldSide::Target, Some("MYPROJ"), Some("10001")).unwrap().as_deref(), Some("h2"));
    }

    #[test]
    fn null_project_and_issuetype_round_trip_for_source_global() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let f = sample_field("description", false);
        db.upsert_schema_row(FieldSide::Source, None, None, &f, "src-hash").unwrap();
        let got = db.get_cached_schemas(FieldSide::Source, None, None).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].field_id, "description");
    }

    #[test]
    fn cache_miss_returns_empty_vec() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let got = db.get_cached_schemas(FieldSide::Target, Some("MYPROJ"), Some("99999")).unwrap();
        assert!(got.is_empty());
        let h = db.get_cached_schema_hash(FieldSide::Target, Some("MYPROJ"), Some("99999")).unwrap();
        assert!(h.is_none());
    }

    #[test]
    fn clear_cache_removes_only_target_tuple() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let f1 = sample_field("a", false);
        let f2 = sample_field("b", false);
        db.upsert_schema_row(FieldSide::Target, Some("P"), Some("1"), &f1, "h").unwrap();
        db.upsert_schema_row(FieldSide::Target, Some("P"), Some("2"), &f2, "h").unwrap();
        let n = db.clear_cache_for(FieldSide::Target, Some("P"), Some("1")).unwrap();
        assert_eq!(n, 1);
        assert!(db.get_cached_schemas(FieldSide::Target, Some("P"), Some("1")).unwrap().is_empty());
        assert_eq!(db.get_cached_schemas(FieldSide::Target, Some("P"), Some("2")).unwrap().len(), 1);
    }

    #[test]
    fn schema_hash_is_lowercase_hex_64() {
        let h = compute_schema_hash(b"some response bytes");
        assert_eq!(h.len(), 64);
        assert!(h.chars().all(|c| c.is_ascii_hexdigit() && (!c.is_ascii_alphabetic() || c.is_ascii_lowercase())));
    }

    #[test]
    fn schema_hash_is_deterministic_and_input_sensitive() {
        let h1 = compute_schema_hash(b"abc");
        let h2 = compute_schema_hash(b"abc");
        let h3 = compute_schema_hash(b"abd");
        assert_eq!(h1, h2);
        assert_ne!(h1, h3);
    }

    #[test]
    fn allowed_values_round_trip() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let mut f = sample_field("priority", false);
        f.allowed_values = Some(vec![serde_json::json!({"id":"1","name":"Highest"})]);
        db.upsert_schema_row(FieldSide::Target, Some("MYPROJ"), Some("10001"), &f, "h").unwrap();
        let got = db.get_cached_schemas(FieldSide::Target, Some("MYPROJ"), Some("10001")).unwrap();
        assert!(got[0].allowed_values.as_ref().unwrap().len() == 1);
    }
}
```

**Step 3 — Compile + run tests:**

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib field_mapping_db::tests
```

All 8 tests must pass.
  </action>
  <verify>
    <automated>cargo test --manifest-path src-tauri/Cargo.toml --lib field_mapping_db::tests 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - File `src-tauri/src/field_mapping_db.rs` exists
    - `grep -c '^pub mod field_mapping_db;' src-tauri/src/lib.rs` returns 1
    - `grep -c 'pub struct FieldMappingDb' src-tauri/src/field_mapping_db.rs` returns 1
    - `grep -c 'CREATE TABLE IF NOT EXISTS field_schema_cache' src-tauri/src/field_mapping_db.rs` returns 1
    - `grep -c 'CREATE INDEX IF NOT EXISTS idx_fsc_key' src-tauri/src/field_mapping_db.rs` returns 1
    - `grep -c 'pub fn open_in_memory' src-tauri/src/field_mapping_db.rs` returns 1
    - `grep -c 'pub fn upsert_schema_row' src-tauri/src/field_mapping_db.rs` returns 1
    - `grep -c 'pub fn get_cached_schemas' src-tauri/src/field_mapping_db.rs` returns 1
    - `grep -c 'pub fn compute_schema_hash' src-tauri/src/field_mapping_db.rs` returns 1
    - `cargo test --manifest-path src-tauri/Cargo.toml --lib field_mapping_db::tests` exits 0 with at least 8 passing tests
    - `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` exits 0
  </acceptance_criteria>
  <done>FieldMappingDb implemented with field_schema_cache table, hash helper, and round-trip tests passing.</done>
</task>

<task type="auto">
  <name>Task 3: Open mapping.db in main.rs and register Arc&lt;Mutex&lt;FieldMappingDb&gt;&gt; via app.manage</name>
  <files>src-tauri/src/main.rs</files>
  <read_first>
    - src-tauri/src/main.rs lines 100-185 (existing setup() closure, especially snapshot_db block at 135-138 and poll spawn at 160-171)
    - src-tauri/src/field_mapping_db.rs (after Task 2)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-PATTERNS.md §"src-tauri/src/main.rs"
  </read_first>
  <behavior>
    - main.rs imports FieldMappingDb in the existing `use pmkar_lib::{...}` block
    - In the setup() closure, immediately AFTER the existing `app.manage(Arc::new(Mutex::new(snapshot_db)));` line, a new block opens mapping.db at `app_dir.join("mapping.db")` and registers it as managed state
    - Build still succeeds (`cargo build --manifest-path src-tauri/Cargo.toml`)
    - The new managed state is `Arc<Mutex<FieldMappingDb>>` with the same shape as the snapshot_db registration so Plan 04 can use `State<'_, Arc<Mutex<FieldMappingDb>>>` in Tauri commands
  </behavior>
  <action>
**Step 1 — Update the import block at the top of `src-tauri/src/main.rs`:**

Existing (around line 3-6):
```rust
use pmkar_lib::{
    audit::AuditDb, commands, fixtures::build_fixtures, poll_engine::PollFrequency,
    snapshot_db::SnapshotDb, triage_db::TriageDb,
};
```

Change to:
```rust
use pmkar_lib::{
    audit::AuditDb, commands, field_mapping_db::FieldMappingDb, fixtures::build_fixtures,
    poll_engine::PollFrequency, snapshot_db::SnapshotDb, triage_db::TriageDb,
};
```

**Step 2 — Insert the new mapping.db block in setup() AFTER the snapshot_db registration (after line 138 in current main.rs, BEFORE `app.manage(fixtures.clone());`):**

```rust
let mapping_db_path = app_dir.join("mapping.db");
let mapping_db =
    FieldMappingDb::open(&mapping_db_path).expect("Failed to open mapping database");
app.manage(Arc::new(Mutex::new(mapping_db)));
```

**Step 3 — Verify the project still builds and existing tests still pass:**

```bash
cargo build --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

Note: Do NOT yet add any new entries to the `tauri::generate_handler![...]` invoke list — Plan 04 owns command registration.
  </action>
  <verify>
    <automated>cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -3 && cargo test --manifest-path src-tauri/Cargo.toml --lib field_mapping_db 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'field_mapping_db::FieldMappingDb' src-tauri/src/main.rs` returns 1
    - `grep -c 'mapping_db_path = app_dir.join."mapping.db".' src-tauri/src/main.rs` returns 1
    - `grep -c 'FieldMappingDb::open(&mapping_db_path)' src-tauri/src/main.rs` returns 1
    - `grep -c 'app.manage(Arc::new(Mutex::new(mapping_db)));' src-tauri/src/main.rs` returns 1
    - The mapping_db block appears AFTER the snapshot_db block: `awk '/snapshot_db/{s=NR} /mapping_db_path/{m=NR} END{exit !(m>s)}' src-tauri/src/main.rs && echo ok` prints `ok`
    - `cargo build --manifest-path src-tauri/Cargo.toml` exits 0
    - `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` exits 0
  </acceptance_criteria>
  <done>mapping.db is opened on app launch and FieldMappingDb is available as managed state for Plan 04's Tauri commands.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| API response → serde deserialization | Untrusted JSON crosses here; serde-tagged enum is the parse boundary |
| FieldSchema → SQLite write | Pre-validated by serde; no SQL string interpolation (parameterized queries) |
| `mapping.db` file path → filesystem | Path constructed from `app_dir.join("mapping.db")` only — no user input |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-01 | Tampering | `FieldSchemaType` deserialization | mitigate | `#[serde(tag = "type")]` enum with `#[serde(other)] Any` catch-all (Pitfall A) — unknown discriminator values fall through to Any rather than executing arbitrary code or panicking. No use of serde features that allow arbitrary trait/method invocation. |
| T-17-05 | Tampering / Injection | SQLite `upsert_schema_row` | mitigate | All values bound via `rusqlite::params![...]` — no string-interpolated SQL. Field IDs/names are stored as TEXT, never executed. |
| T-17-06 | Information Disclosure | `compute_schema_hash` input | accept | Hashes only response BODY bytes, never request headers (no Authorization header in input). Bytes come from `resp.bytes()` in Plan 04 — auth never touches the hash input. |
| T-17-07 | DoS | `field_schema_cache` unbounded growth | accept | Bounded by Atlassian field count per (project, issuetype) which is small (typically <100). UNIQUE constraint prevents duplicate rows. clear_cache_for available for manual refresh. |
| T-17-08 | Tampering | Unique constraint on (side, project_key, issuetype_id, field_id) | mitigate | DDL declares `UNIQUE(...)` and ON CONFLICT clause overwrites — no possibility of stale duplicates accumulating |
| T-17-09 | Spoofing of side enum | `FieldSide::as_str` and CHECK constraint | mitigate | Enum variants Source/Target serialize via `as_str` to "source"/"target"; SQLite CHECK constraint rejects any other value at write time |
</threat_model>

<verification>
- `cargo build --manifest-path src-tauri/Cargo.toml` passes
- `cargo test --manifest-path src-tauri/Cargo.toml --lib field_discovery::tests` passes (≥14 tests)
- `cargo test --manifest-path src-tauri/Cargo.toml --lib field_mapping_db::tests` passes (≥8 tests)
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` passes
- All existing tests still pass: `cargo test --manifest-path src-tauri/Cargo.toml --lib`
- Phase 17 Plan 04 can use `FieldSchema`, `FieldSchemaType`, `FieldSide`, `CreatemetaResponse`, `IssueTypeRef`, and `Arc<Mutex<FieldMappingDb>>` without further type definitions
</verification>

<success_criteria>
- FieldSchemaType discriminated-union covers all 11 Atlassian schema variants and falls through to Any on unknown
- FieldMappingDb opens against a path or in memory, exposes upsert/get/clear/hash methods, all unit-tested
- mapping.db is opened on app launch alongside snapshot.db (db-per-concern)
- DISC-01 / DISC-02 type contracts are in place; DISC-03 cache key shape is in place
- No regressions in existing test suite
</success_criteria>

<output>
After completion, create `.planning/phases/17-field-discovery-mock-schema-fidelity/17-02-SUMMARY.md`
</output>
