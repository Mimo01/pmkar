//! Phase 17: mapping.db `SQLite` persistence for the field schema cache.
//!
//! Mirrors the `snapshot_db.rs` pattern (db-per-concern, `Arc<Mutex<>>`, manual
//! `CREATE TABLE IF NOT EXISTS` migration). Phase 19 will extend this file with
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

pub struct FieldMappingDb {
    conn: Connection,
}

impl FieldMappingDb {
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

    /// Insert or update one row in `field_schema_cache`.
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
        let required_int = i64::from(field.required);
        let has_default_int = i64::from(field.has_default_value.unwrap_or(false));
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

    /// Retrieve every cached row matching the `(side, project_key, issuetype_id)` tuple,
    /// reconstructed into `FieldSchema`. Returns an empty `Vec` on cache miss.
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

    /// Returns the `schema_hash` for any one row matching the tuple. By D-04 every
    /// row of the same `(side, project_key, issuetype_id)` shares the same hash.
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

    /// Delete all rows for a `(side, project_key, issuetype_id)` tuple. Used by the
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
            schema: FieldSchemaType::String {
                system: Some("summary".into()),
                custom: None,
                custom_id: None,
            },
            allowed_values: None,
            operations: Some(vec!["set".into()]),
        }
    }

    #[test]
    fn open_in_memory_creates_table() {
        let db = FieldMappingDb::open_in_memory().expect("open in memory");
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
        db.upsert_schema_row(FieldSide::Target, Some("MYPROJ"), Some("10001"), &f, "hash-1")
            .unwrap();
        let got = db
            .get_cached_schemas(FieldSide::Target, Some("MYPROJ"), Some("10001"))
            .unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].field_id, "customfield_10001");
        assert!(!got[0].required);
    }

    #[test]
    fn upsert_overwrites_on_conflict() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let mut f = sample_field("priority", false);
        db.upsert_schema_row(FieldSide::Target, Some("MYPROJ"), Some("10001"), &f, "h1")
            .unwrap();
        f.required = true;
        db.upsert_schema_row(FieldSide::Target, Some("MYPROJ"), Some("10001"), &f, "h2")
            .unwrap();
        let got = db
            .get_cached_schemas(FieldSide::Target, Some("MYPROJ"), Some("10001"))
            .unwrap();
        assert_eq!(got.len(), 1);
        assert!(got[0].required);
        assert_eq!(
            db.get_cached_schema_hash(FieldSide::Target, Some("MYPROJ"), Some("10001"))
                .unwrap()
                .as_deref(),
            Some("h2")
        );
    }

    #[test]
    fn null_project_and_issuetype_round_trip_for_source_global() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let f = sample_field("description", false);
        db.upsert_schema_row(FieldSide::Source, None, None, &f, "src-hash")
            .unwrap();
        let got = db.get_cached_schemas(FieldSide::Source, None, None).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].field_id, "description");
    }

    #[test]
    fn cache_miss_returns_empty_vec() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let got = db
            .get_cached_schemas(FieldSide::Target, Some("MYPROJ"), Some("99999"))
            .unwrap();
        assert!(got.is_empty());
        let h = db
            .get_cached_schema_hash(FieldSide::Target, Some("MYPROJ"), Some("99999"))
            .unwrap();
        assert!(h.is_none());
    }

    #[test]
    fn clear_cache_removes_only_target_tuple() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        let f1 = sample_field("a", false);
        let f2 = sample_field("b", false);
        db.upsert_schema_row(FieldSide::Target, Some("P"), Some("1"), &f1, "h")
            .unwrap();
        db.upsert_schema_row(FieldSide::Target, Some("P"), Some("2"), &f2, "h")
            .unwrap();
        let n = db
            .clear_cache_for(FieldSide::Target, Some("P"), Some("1"))
            .unwrap();
        assert_eq!(n, 1);
        assert!(db
            .get_cached_schemas(FieldSide::Target, Some("P"), Some("1"))
            .unwrap()
            .is_empty());
        assert_eq!(
            db.get_cached_schemas(FieldSide::Target, Some("P"), Some("2"))
                .unwrap()
                .len(),
            1
        );
    }

    #[test]
    fn schema_hash_is_lowercase_hex_64() {
        let h = compute_schema_hash(b"some response bytes");
        assert_eq!(h.len(), 64);
        assert!(h
            .chars()
            .all(|c| c.is_ascii_hexdigit() && (!c.is_ascii_alphabetic() || c.is_ascii_lowercase())));
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
        db.upsert_schema_row(FieldSide::Target, Some("MYPROJ"), Some("10001"), &f, "h")
            .unwrap();
        let got = db
            .get_cached_schemas(FieldSide::Target, Some("MYPROJ"), Some("10001"))
            .unwrap();
        assert_eq!(got[0].allowed_values.as_ref().unwrap().len(), 1);
    }

    #[test]
    fn open_in_memory_creates_field_mapping_and_meta_tables() {
        let db = FieldMappingDb::open_in_memory().expect("open in memory");
        // field_mapping must be queryable
        let _: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM field_mapping", [], |r| r.get(0))
            .expect("field_mapping table should exist");
        // mapping_meta must be queryable
        let _: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM mapping_meta", [], |r| r.get(0))
            .expect("mapping_meta table should exist");
    }

    #[test]
    fn seed_inserts_five_defaults_on_empty_table() {
        let db = FieldMappingDb::open_in_memory().expect("open in memory");
        let count: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM field_mapping", [], |r| r.get(0))
            .expect("count");
        assert_eq!(count, 5, "must seed exactly 5 default rows on empty table");
    }

    #[test]
    fn default_transformer_kinds_are_correct() {
        let db = FieldMappingDb::open_in_memory().expect("open in memory");
        let mut stmt = db
            .conn
            .prepare(
                "SELECT source_field_id, target_field_id, transformer_kind
                 FROM field_mapping ORDER BY id ASC",
            )
            .unwrap();
        let rows: Vec<(String, String, String)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert_eq!(
            rows,
            vec![
                ("description".into(), "description".into(), "wiki_to_adf".into()),
                ("labels".into(),      "labels".into(),      "identity".into()),
                ("priority".into(),    "priority".into(),    "priority".into()),
                ("assignee".into(),    "assignee".into(),    "user".into()),
                ("reporter".into(),    "reporter".into(),    "user".into()),
            ],
            "default seed must match D-07/D-08 transformer_kind values exactly"
        );
    }

    #[test]
    fn seed_does_not_run_when_table_has_rows() {
        let db = FieldMappingDb::open_in_memory().expect("open in memory");
        // Initial state: 5 seeded rows.
        // Simulate user deleting the `description` default row.
        db.conn
            .execute(
                "DELETE FROM field_mapping WHERE source_field_id = 'description'",
                [],
            )
            .expect("delete description row");
        let count_after_delete: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM field_mapping", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count_after_delete, 4, "after delete, table has 4 rows");
        // Calling seed again must not re-add the deleted row (D-02).
        super::seed_defaults_if_empty(&db.conn).expect("seed again");
        let count_after_reseed: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM field_mapping", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            count_after_reseed, 4,
            "seed must NOT re-run when table is non-empty (D-02 INSERT OR IGNORE + COUNT guard)"
        );
    }
}
