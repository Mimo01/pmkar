//! Phase 17: mapping.db `SQLite` persistence for the field schema cache.
//!
//! Mirrors the `snapshot_db.rs` pattern (db-per-concern, `Arc<Mutex<>>`, manual
//! `CREATE TABLE IF NOT EXISTS` migration). Phase 19 will extend this file with
//! `field_mapping` and `mapping_meta` tables; the schema below is stable.

use crate::error::AppResult;
use crate::field_discovery::{FieldSchema, FieldSchemaType, FieldSide};
use crate::field_transform::FieldMappingRow;
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
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

/// Migration pre-step: remove duplicate non-empty `target_field_id` rows from any
/// existing database, keeping the highest-id row for each real target so the
/// partial unique index below can always be created cleanly.
/// The empty-string dismissed sentinel ('') is excluded — multiple dismissed
/// rows must be allowed to coexist.
const DEDUP_TARGETS: &str = "
    DELETE FROM field_mapping
    WHERE target_field_id != ''
      AND id NOT IN (
        SELECT MAX(id) FROM field_mapping
        WHERE target_field_id != ''
        GROUP BY target_field_id
      );
";

/// Migration step A: drop the old unconditional unique index if it exists.
/// Required because `CREATE UNIQUE INDEX IF NOT EXISTS` is a no-op when the
/// index already exists — it will NOT modify a non-partial index into a partial
/// one. We must drop it first so step B can (re)create it with the WHERE clause.
const DROP_OLD_TARGET_INDEX: &str = "
    DROP INDEX IF EXISTS idx_fm_target_unique;
";

/// Migration step B: add a *partial* unique index on non-empty `target_field_id`
/// values only, so no two rows can map different source fields to the same real
/// target. The empty-string dismissed-suggestion sentinel ('') is explicitly
/// excluded from the index — multiple dismissed rows with `targetFieldId=''` must
/// be allowed to coexist.
///
/// `SQLite` will return `UNIQUE constraint failed: field_mapping.target_field_id`
/// (or `idx_fm_target_unique`) if a caller attempts to insert a second non-empty
/// row with the same `target_field_id`.
const ADD_UNIQUE_TARGET: &str = "
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fm_target_unique
        ON field_mapping(target_field_id)
        WHERE target_field_id != '';
";

/// Phase 23 CUTV-03 — per-mapping-decision audit table. Lives in mapping.db
/// (not audit.db) because its structure mirrors mapping data, NOT HTTP calls.
/// Hash columns store SHA-256 hex (64 chars). `gap_kind` is one of NULL,
/// "person", "version", "component" (matches `GapVariant` tag in `field_transform/mod.rs`).
/// Quick task 260430-0tj extends with `transformer_kind`, `outcome`, `failure_reason`.
/// Quick task 260430-26i extends with `source_value_json`, `target_value_json`
/// (redacted, capped at 4096 bytes server-side — T-26i-04 `DoS` mitigation).
/// Hash columns are retained for backward compatibility with rows written before 26i.
const CREATE_MAPPING_AUDIT_LOG: &str = "
    CREATE TABLE IF NOT EXISTS mapping_audit_log (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        copy_id             TEXT NOT NULL,
        field_id            TEXT NOT NULL,
        source_value_hash   TEXT NOT NULL,
        target_value_hash   TEXT NOT NULL,
        was_overridden      INTEGER NOT NULL DEFAULT 0,
        gap_kind            TEXT,
        transformer_kind    TEXT NOT NULL DEFAULT '',
        outcome             TEXT NOT NULL DEFAULT 'ok',
        failure_reason      TEXT,
        timestamp           TEXT NOT NULL,
        source_value_json   TEXT,
        target_value_json   TEXT,
        created_at          INTEGER DEFAULT (strftime('%s','now'))
    );
";

/// Migration: add `transformer_kind`/`outcome`/`failure_reason` columns to existing
/// `mapping_audit_log` tables. `SQLite` `ADD COLUMN` is idempotent only via guard;
/// we use `pragma_table_info` + a per-column conditional. Failure here would
/// brick the app — surface the error rather than silently ignoring it.
fn migrate_mapping_audit_log_columns(conn: &Connection) -> AppResult<()> {
    let existing: Vec<String> = conn
        .prepare("PRAGMA table_info(mapping_audit_log)")?
        .query_map([], |r| r.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;
    let has = |name: &str| existing.iter().any(|c| c == name);
    if !has("transformer_kind") {
        conn.execute_batch(
            "ALTER TABLE mapping_audit_log ADD COLUMN transformer_kind TEXT NOT NULL DEFAULT '';",
        )?;
    }
    if !has("outcome") {
        conn.execute_batch(
            "ALTER TABLE mapping_audit_log ADD COLUMN outcome TEXT NOT NULL DEFAULT 'ok';",
        )?;
    }
    if !has("failure_reason") {
        conn.execute_batch("ALTER TABLE mapping_audit_log ADD COLUMN failure_reason TEXT;")?;
    }
    // Quick task 260430-26i: persist redacted JSON values alongside hashes so
    // operators can see what actually got transformed without rebuilding from
    // the original source. Both columns are nullable — legacy rows from before
    // 26i keep NULL here and the UI falls back to the hash columns.
    if !has("source_value_json") {
        conn.execute_batch("ALTER TABLE mapping_audit_log ADD COLUMN source_value_json TEXT;")?;
    }
    if !has("target_value_json") {
        conn.execute_batch("ALTER TABLE mapping_audit_log ADD COLUMN target_value_json TEXT;")?;
    }
    Ok(())
}

/// DTO for a row from `mapping_audit_log`. Serializes to camelCase for the
/// frontend. Quick task 260430-0tj. Quick task 260430-26i adds the optional
/// `source_value_json` / `target_value_json` fields — legacy rows return None.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MappingAuditEntry {
    pub id: i64,
    pub copy_id: String,
    pub field_id: String,
    pub source_value_hash: String,
    pub target_value_hash: String,
    pub was_overridden: bool,
    pub gap_kind: Option<String>,
    pub transformer_kind: String,
    pub outcome: String,
    pub failure_reason: Option<String>,
    pub timestamp: String,
    pub source_value_json: Option<String>,
    pub target_value_json: Option<String>,
}

/// Migration: repair any existing rows whose `source_schema_json` or `target_schema_json`
/// is NULL for the 5 system default field IDs. Runs before `seed_defaults_if_empty` so
/// pre-fix production databases are repaired on next open. Safe to run on a fresh DB
/// (WHERE clause finds no rows, UPDATE is a no-op).
pub(crate) fn update_null_schema_defaults(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "UPDATE field_mapping
         SET
           source_schema_json = CASE source_field_id
             WHEN 'description' THEN '{\"type\":\"string\",\"system\":\"description\"}'
             WHEN 'labels'       THEN '{\"type\":\"array\",\"items\":\"string\"}'
             WHEN 'priority'     THEN '{\"type\":\"priority\"}'
             WHEN 'assignee'     THEN '{\"type\":\"user\",\"system\":\"assignee\"}'
             WHEN 'reporter'     THEN '{\"type\":\"user\",\"system\":\"reporter\"}'
             ELSE source_schema_json
           END,
           target_schema_json = CASE source_field_id
             WHEN 'description' THEN '{\"type\":\"string\",\"system\":\"description\"}'
             WHEN 'labels'       THEN '{\"type\":\"array\",\"items\":\"string\"}'
             WHEN 'priority'     THEN '{\"type\":\"priority\"}'
             WHEN 'assignee'     THEN '{\"type\":\"user\",\"system\":\"assignee\"}'
             WHEN 'reporter'     THEN '{\"type\":\"user\",\"system\":\"reporter\"}'
             ELSE target_schema_json
           END
         WHERE (source_schema_json IS NULL OR target_schema_json IS NULL)
           AND source_field_id IN ('description','labels','priority','assignee','reporter');",
    )?;
    Ok(())
}

fn seed_defaults_if_empty(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM field_mapping", [], |r| r.get(0))?;
    if count > 0 {
        return Ok(());
    }
    let now = Utc::now().to_rfc3339();
    // (src_id, tgt_id, transformer_kind, src_schema_json, tgt_schema_json)
    let defaults: [(&str, &str, &str, &str, &str); 5] = [
        (
            "description",
            "description",
            "wiki_to_adf",
            r#"{"type":"string","system":"description"}"#,
            r#"{"type":"string","system":"description"}"#,
        ),
        (
            "labels",
            "labels",
            "identity",
            r#"{"type":"array","items":"string"}"#,
            r#"{"type":"array","items":"string"}"#,
        ),
        (
            "priority",
            "priority",
            "priority",
            r#"{"type":"priority"}"#,
            r#"{"type":"priority"}"#,
        ),
        (
            "assignee",
            "assignee",
            "user",
            r#"{"type":"user","system":"assignee"}"#,
            r#"{"type":"user","system":"assignee"}"#,
        ),
        (
            "reporter",
            "reporter",
            "user",
            r#"{"type":"user","system":"reporter"}"#,
            r#"{"type":"user","system":"reporter"}"#,
        ),
    ];
    for (src, tgt, kind, src_schema, tgt_schema) in defaults {
        conn.execute(
            "INSERT OR IGNORE INTO field_mapping
                 (source_field_id, target_field_id, transformer_kind,
                  source_schema_json, target_schema_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![src, tgt, kind, src_schema, tgt_schema, now],
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
        conn.execute_batch(DEDUP_TARGETS)?;
        conn.execute_batch(DROP_OLD_TARGET_INDEX)?;
        conn.execute_batch(ADD_UNIQUE_TARGET)?;
        conn.execute_batch(CREATE_MAPPING_META)?;
        conn.execute_batch(CREATE_MAPPING_AUDIT_LOG)?;
        migrate_mapping_audit_log_columns(&conn)?;
        update_null_schema_defaults(&conn)?;
        seed_defaults_if_empty(&conn)?;
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(CREATE_FIELD_SCHEMA_CACHE)?;
        conn.execute_batch(CREATE_INDEX)?;
        conn.execute_batch(CREATE_FIELD_MAPPING)?;
        conn.execute_batch(DEDUP_TARGETS)?;
        conn.execute_batch(DROP_OLD_TARGET_INDEX)?;
        conn.execute_batch(ADD_UNIQUE_TARGET)?;
        conn.execute_batch(CREATE_MAPPING_META)?;
        conn.execute_batch(CREATE_MAPPING_AUDIT_LOG)?;
        migrate_mapping_audit_log_columns(&conn)?;
        update_null_schema_defaults(&conn)?;
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
            Ok((
                field_id,
                field_name,
                schema_json,
                required,
                allowed_values_json,
                has_default,
            ))
        })?;

        let mut out = Vec::new();
        for r in rows {
            let (field_id, field_name, schema_json, required, allowed_values_json, has_default) =
                r?;
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

    /// Upsert a single mapping row keyed on `source_field_id` (D-04).
    /// On conflict, replaces `target_field_id`, `transformer_kind`, schema JSON
    /// and `updated_at`. `created_at` stays as the original insert time.
    pub fn upsert_mapping_row(&self, row: &FieldMappingRow) -> AppResult<()> {
        let source_schema_json = serde_json::to_string(&row.source_schema)?;
        let target_schema_json = serde_json::to_string(&row.target_schema)?;
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

    /// Return all mapping rows in insertion order (`id ASC`) per D-06.
    /// Row-mapper falls back to `FieldSchemaType::Any` for any `source_schema_json`
    /// or `target_schema_json` that is NULL (Pitfall 3 — columns are nullable for
    /// user-added custom rows before a target is selected).
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
            Ok((
                source_field_id,
                target_field_id,
                transformer_kind,
                source_schema_json,
                target_schema_json,
            ))
        })?;
        let mut out: Vec<FieldMappingRow> = Vec::new();
        for r in rows {
            let (source_field_id, target_field_id, transformer_kind, src_json, tgt_json) = r?;
            let source_schema = match src_json {
                Some(s) => serde_json::from_str(&s).map_err(|e| {
                    crate::error::AppError::Internal(format!(
                        "source_schema_json parse failed for '{source_field_id}': {e}"
                    ))
                })?,
                None => crate::field_discovery::FieldSchemaType::Any,
            };
            let target_schema = match tgt_json {
                Some(s) => serde_json::from_str(&s).map_err(|e| {
                    crate::error::AppError::Internal(format!(
                        "target_schema_json parse failed for '{source_field_id}': {e}"
                    ))
                })?,
                None => crate::field_discovery::FieldSchemaType::Any,
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

    /// Delete a mapping row by `source_field_id` (D-05). Idempotent: returns
    /// `Ok(())` even when the row does not exist.
    pub fn delete_mapping_row(&self, source_field_id: &str) -> AppResult<()> {
        self.conn.execute(
            "DELETE FROM field_mapping WHERE source_field_id = ?1",
            params![source_field_id],
        )?;
        Ok(())
    }

    /// Phase 23 CUTV-03 / quick task 260430-0tj — insert one row into `mapping_audit_log`.
    /// Quick task 260430-26i appends `source_value_json` and `target_value_json`
    /// (already-redacted, capped server-side) so the UI can render real values
    /// for new rows while legacy hash-only rows keep working.
    ///
    /// All non-static values are bound via `rusqlite::params![]` — NEVER
    /// interpolated into the SQL string (T-23-T2 SQL-injection mitigation,
    /// since `field_id` is read from untrusted `FieldMappingRow` rows on disk).
    #[allow(clippy::too_many_arguments)]
    pub fn insert_mapping_audit(
        &self,
        copy_id: &str,
        field_id: &str,
        source_value_hash: &str,
        target_value_hash: &str,
        was_overridden: bool,
        gap_kind: Option<&str>,
        transformer_kind: &str,
        outcome: &str,
        failure_reason: Option<&str>,
        timestamp: &str,
        source_value_json: Option<&str>,
        target_value_json: Option<&str>,
    ) -> AppResult<()> {
        self.conn.execute(
            "INSERT INTO mapping_audit_log
                 (copy_id, field_id, source_value_hash, target_value_hash,
                  was_overridden, gap_kind, transformer_kind, outcome, failure_reason, timestamp,
                  source_value_json, target_value_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![
                copy_id,
                field_id,
                source_value_hash,
                target_value_hash,
                i64::from(was_overridden),
                gap_kind,
                transformer_kind,
                outcome,
                failure_reason,
                timestamp,
                source_value_json,
                target_value_json,
            ],
        )?;
        Ok(())
    }

    /// Returns `mapping_audit_log` entries newest first (ORDER BY id DESC).
    /// Bounded by limit; offset is for pagination by the UI.
    /// Quick task 260430-0tj. Quick task 260430-26i adds the JSON columns —
    /// legacy rows return None for them so the UI can fall back to hashes.
    pub fn get_mapping_audit_log_page(
        &self,
        offset: i64,
        limit: i64,
    ) -> AppResult<Vec<MappingAuditEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, copy_id, field_id, source_value_hash, target_value_hash,
                    was_overridden, gap_kind, transformer_kind, outcome,
                    failure_reason, timestamp, source_value_json, target_value_json
             FROM mapping_audit_log
             ORDER BY id DESC
             LIMIT ?1 OFFSET ?2",
        )?;
        let rows = stmt
            .query_map(params![limit, offset], |r| {
                Ok(MappingAuditEntry {
                    id: r.get(0)?,
                    copy_id: r.get(1)?,
                    field_id: r.get(2)?,
                    source_value_hash: r.get(3)?,
                    target_value_hash: r.get(4)?,
                    was_overridden: r.get::<_, i64>(5)? != 0,
                    gap_kind: r.get(6)?,
                    transformer_kind: r.get(7)?,
                    outcome: r.get(8)?,
                    failure_reason: r.get(9)?,
                    timestamp: r.get(10)?,
                    source_value_json: r.get(11)?,
                    target_value_json: r.get(12)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }
}

/// SHA-256 hex of the raw response bytes. D-04 specifies hashing the raw JSON
/// (no canonicalization) so any byte-level drift is detected.
pub fn compute_schema_hash(raw_json_bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw_json_bytes);
    hex::encode(hasher.finalize())
}

/// Phase 23 D-07 — credential sanitizer using plain `str::contains` (no regex
/// dep — see project convention at `commands.rs:1403` and `field_transform/user.rs:202`).
/// Returns `"[REDACTED]"` if the input contains any known credential marker.
///
/// Patterns: Bearer (OAuth/server PAT), Basic (HTTP Basic auth), `eyJ` (JWT prefix
/// — base64-encoded JSON `{"`), `xoxb-` / `xoxp-` (Slack tokens), AKIA / ASIA (AWS
/// access key prefixes).
pub fn redact_credential_value(s: &str) -> String {
    const CREDENTIAL_MARKERS: &[&str] =
        &["Bearer ", "Basic ", "eyJ", "xoxb-", "xoxp-", "AKIA", "ASIA"];
    for marker in CREDENTIAL_MARKERS {
        if s.contains(marker) {
            return "[REDACTED]".to_string();
        }
    }
    s.to_string()
}

/// Phase 23 CUTV-03 — deterministic SHA-256 hex digest of a JSON value.
/// Mirrors `compute_schema_hash` pattern using `sha2` + `hex`.
pub fn hash_field_value(v: &serde_json::Value) -> String {
    let json_str = serde_json::to_string(v).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(json_str.as_bytes());
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
        db.upsert_schema_row(
            FieldSide::Target,
            Some("MYPROJ"),
            Some("10001"),
            &f,
            "hash-1",
        )
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
        let got = db
            .get_cached_schemas(FieldSide::Source, None, None)
            .unwrap();
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
        assert!(
            h.chars()
                .all(|c| c.is_ascii_hexdigit()
                    && (!c.is_ascii_alphabetic() || c.is_ascii_lowercase()))
        );
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
                (
                    "description".into(),
                    "description".into(),
                    "wiki_to_adf".into()
                ),
                ("labels".into(), "labels".into(), "identity".into()),
                ("priority".into(), "priority".into(), "priority".into()),
                ("assignee".into(), "assignee".into(), "user".into()),
                ("reporter".into(), "reporter".into(), "user".into()),
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

    #[test]
    fn get_returns_rows_in_insertion_order() {
        use crate::field_transform::FieldMappingRow;
        let _ = std::any::type_name::<FieldMappingRow>(); // prove import works
        let db = FieldMappingDb::open_in_memory().expect("open in memory");
        let rows = db.get_all_mapping_rows().expect("get_all_mapping_rows");
        assert_eq!(rows.len(), 5, "5 default rows seeded");
        assert_eq!(
            rows[0].source_field_id, "description",
            "D-06 ORDER BY id ASC: description first"
        );
        assert_eq!(rows[0].transformer_kind, "wiki_to_adf");
        assert_eq!(rows[1].source_field_id, "labels");
        assert_eq!(rows[2].source_field_id, "priority");
        assert_eq!(rows[3].source_field_id, "assignee");
        assert_eq!(rows[4].source_field_id, "reporter");
    }

    #[test]
    fn upsert_mapping_row_replaces_existing() {
        use crate::field_transform::FieldMappingRow;
        let db = FieldMappingDb::open_in_memory().expect("open in memory");
        // Override the seeded `description -> wiki_to_adf` row with `identity`.
        let row = FieldMappingRow {
            source_field_id: "description".into(),
            target_field_id: "description".into(),
            transformer_kind: "identity".into(),
            source_schema: FieldSchemaType::Any,
            target_schema: FieldSchemaType::Any,
        };
        db.upsert_mapping_row(&row).expect("upsert");
        let rows = db.get_all_mapping_rows().expect("get");
        assert_eq!(rows.len(), 5, "upsert must replace, not duplicate");
        let desc = rows
            .iter()
            .find(|r| r.source_field_id == "description")
            .expect("description row exists");
        assert_eq!(
            desc.transformer_kind, "identity",
            "transformer_kind replaced"
        );

        // Inserting a brand new row increases the count.
        let custom = FieldMappingRow {
            source_field_id: "customfield_10001".into(),
            target_field_id: "customfield_99999".into(),
            transformer_kind: "identity".into(),
            source_schema: FieldSchemaType::Any,
            target_schema: FieldSchemaType::Any,
        };
        db.upsert_mapping_row(&custom).expect("upsert custom");
        let rows = db.get_all_mapping_rows().expect("get");
        assert_eq!(rows.len(), 6, "new source_field_id appends a row");
        let cf = rows
            .iter()
            .find(|r| r.source_field_id == "customfield_10001")
            .expect("custom row exists");
        assert_eq!(cf.target_field_id, "customfield_99999");
    }

    #[test]
    fn delete_mapping_row_is_idempotent() {
        let db = FieldMappingDb::open_in_memory().expect("open in memory");
        db.delete_mapping_row("description").expect("first delete");
        db.delete_mapping_row("description")
            .expect("second delete must not error (D-05)");
        let rows = db.get_all_mapping_rows().expect("get");
        assert_eq!(rows.len(), 4, "after delete, 4 rows remain");
        // Deleting a non-existent id is also Ok.
        db.delete_mapping_row("never_existed_field")
            .expect("delete unknown id");
        let rows = db.get_all_mapping_rows().expect("get");
        assert_eq!(rows.len(), 4, "deleting unknown id does not change count");
    }

    #[test]
    fn round_trip_survives_reopen() {
        use crate::field_transform::FieldMappingRow;
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("mapping.db");
        // Open #1: seed runs, add a custom row.
        {
            let db = FieldMappingDb::open(&path).expect("open #1");
            let custom = FieldMappingRow {
                source_field_id: "customfield_10010".into(),
                target_field_id: "customfield_10010".into(),
                transformer_kind: "identity".into(),
                source_schema: FieldSchemaType::Any,
                target_schema: FieldSchemaType::Any,
            };
            db.upsert_mapping_row(&custom).expect("upsert");
            let rows = db.get_all_mapping_rows().expect("get");
            assert_eq!(rows.len(), 6, "5 seeded + 1 custom in same connection");
        } // db drops here, releasing SQLite file handle
          // Open #2: same path, no re-seed (D-02), custom row still present.
        let db2 = FieldMappingDb::open(&path).expect("open #2");
        let rows = db2.get_all_mapping_rows().expect("get after reopen");
        assert_eq!(rows.len(), 6, "round-trip: rows persist across reopen");
        let cf = rows
            .iter()
            .find(|r| r.source_field_id == "customfield_10010")
            .expect("custom row survived reopen");
        assert_eq!(cf.target_field_id, "customfield_10010");
        assert_eq!(cf.transformer_kind, "identity");
    }

    #[test]
    fn mapping_audit_log_table_exists_after_open() {
        let db = FieldMappingDb::open_in_memory().expect("open");
        let count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='mapping_audit_log'",
                [],
                |r| r.get(0),
            )
            .expect("query sqlite_master");
        assert_eq!(count, 1);
    }

    #[test]
    fn insert_mapping_audit_round_trips() {
        let db = FieldMappingDb::open_in_memory().expect("open");
        db.insert_mapping_audit(
            "copy-uuid-1",
            "summary",
            "src-hash-aaa",
            "tgt-hash-bbb",
            false,
            None,
            "identity",
            "ok",
            None,
            "2026-04-28T00:00:00Z",
            None,
            None,
        )
        .expect("insert");
        let (copy_id, field_id, was_ov, gap_kind): (String, String, i64, Option<String>) = db
            .conn
            .query_row(
                "SELECT copy_id, field_id, was_overridden, gap_kind FROM mapping_audit_log WHERE id = 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .expect("select");
        assert_eq!(copy_id, "copy-uuid-1");
        assert_eq!(field_id, "summary");
        assert_eq!(was_ov, 0);
        assert_eq!(gap_kind, None);
    }

    #[test]
    fn insert_mapping_audit_with_gap_kind_and_override() {
        let db = FieldMappingDb::open_in_memory().expect("open");
        db.insert_mapping_audit(
            "copy-uuid-2",
            "assignee",
            "h1",
            "h2",
            true,
            Some("person"),
            "identity",
            "ok",
            None,
            "2026-04-28T00:01:00Z",
            None,
            None,
        )
        .expect("insert");
        let (was_ov, gap_kind): (i64, Option<String>) = db
            .conn
            .query_row(
                "SELECT was_overridden, gap_kind FROM mapping_audit_log WHERE copy_id = 'copy-uuid-2'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .expect("select");
        assert_eq!(was_ov, 1);
        assert_eq!(gap_kind.as_deref(), Some("person"));
    }

    #[test]
    fn insert_mapping_audit_is_sql_injection_safe() {
        // T-23-T2 mitigation regression test: pass a field_id that, if interpolated
        // into SQL, would drop the table. params![] binding stores it as a literal.
        let db = FieldMappingDb::open_in_memory().expect("open");
        let nasty = "x'; DROP TABLE mapping_audit_log; --";
        db.insert_mapping_audit(
            "c1", nasty, "h", "h", false, None, "identity", "ok", None, "ts", None, None,
        )
        .expect("insert with nasty field_id");
        // Table still exists.
        let count: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='mapping_audit_log'",
                [],
                |r| r.get(0),
            )
            .expect("query");
        assert_eq!(count, 1);
        // Literal value stored verbatim.
        let stored: String = db
            .conn
            .query_row(
                "SELECT field_id FROM mapping_audit_log WHERE copy_id = 'c1'",
                [],
                |r| r.get(0),
            )
            .expect("select");
        assert_eq!(stored, nasty);
    }

    #[test]
    fn hash_field_value_is_deterministic() {
        let v = serde_json::json!({ "a": 1, "b": "two" });
        let h1 = super::hash_field_value(&v);
        let h2 = super::hash_field_value(&v);
        assert_eq!(h1, h2);
        assert_eq!(h1.len(), 64); // SHA-256 hex
    }

    #[test]
    fn hash_field_value_distinguishes_inputs() {
        let a = serde_json::json!("alpha");
        let b = serde_json::json!("beta");
        assert_ne!(super::hash_field_value(&a), super::hash_field_value(&b));
    }

    #[test]
    fn redact_credential_value_redacts_known_markers() {
        assert_eq!(
            super::redact_credential_value("Bearer abc.def.ghi"),
            "[REDACTED]"
        );
        assert_eq!(
            super::redact_credential_value("Basic dXNlcjpwYXNz"),
            "[REDACTED]"
        );
        assert_eq!(
            super::redact_credential_value("eyJhbGciOiJIUzI1NiJ9.payload.sig"),
            "[REDACTED]"
        );
        assert_eq!(
            super::redact_credential_value("xoxb-1234-abcd"),
            "[REDACTED]"
        );
        assert_eq!(
            super::redact_credential_value("xoxp-1234-abcd"),
            "[REDACTED]"
        );
        assert_eq!(
            super::redact_credential_value("AKIAIOSFODNN7EXAMPLE"),
            "[REDACTED]"
        );
        assert_eq!(
            super::redact_credential_value("ASIAIOSFODNN7EXAMPLE"),
            "[REDACTED]"
        );
    }

    #[test]
    fn redact_credential_value_passes_safe_strings() {
        assert_eq!(super::redact_credential_value("hello world"), "hello world");
        assert_eq!(super::redact_credential_value(""), "");
        assert_eq!(
            super::redact_credential_value("a normal description with no secrets"),
            "a normal description with no secrets"
        );
        // 'eye' ≠ 'eyJ' — should not be redacted
        assert_eq!(
            super::redact_credential_value("eyes are blue"),
            "eyes are blue"
        );
    }

    #[test]
    fn seed_defaults_have_correct_source_schemas() {
        use crate::field_discovery::FieldSchemaType;
        let db = FieldMappingDb::open_in_memory().expect("open in memory");
        let rows = db.get_all_mapping_rows().expect("get_all_mapping_rows");
        assert_eq!(rows.len(), 5);

        // description → String { system: Some("description") }
        let desc = rows
            .iter()
            .find(|r| r.source_field_id == "description")
            .expect("description row");
        assert!(
            matches!(&desc.source_schema, FieldSchemaType::String { system, .. } if system.as_deref() == Some("description")),
            "description source_schema must be String{{system:description}}, got {:?}",
            desc.source_schema
        );

        // labels → Array { items: "string" }
        let labels = rows
            .iter()
            .find(|r| r.source_field_id == "labels")
            .expect("labels row");
        assert!(
            matches!(&labels.source_schema, FieldSchemaType::Array { items, .. } if items == "string"),
            "labels source_schema must be Array{{items:string}}, got {:?}",
            labels.source_schema
        );

        // priority → Priority
        let priority = rows
            .iter()
            .find(|r| r.source_field_id == "priority")
            .expect("priority row");
        assert!(
            matches!(&priority.source_schema, FieldSchemaType::Priority),
            "priority source_schema must be Priority, got {:?}",
            priority.source_schema
        );

        // assignee → User { system: Some("assignee") }
        let assignee = rows
            .iter()
            .find(|r| r.source_field_id == "assignee")
            .expect("assignee row");
        assert!(
            matches!(&assignee.source_schema, FieldSchemaType::User { system, .. } if system.as_deref() == Some("assignee")),
            "assignee source_schema must be User{{system:assignee}}, got {:?}",
            assignee.source_schema
        );

        // reporter → User { system: Some("reporter") }
        let reporter = rows
            .iter()
            .find(|r| r.source_field_id == "reporter")
            .expect("reporter row");
        assert!(
            matches!(&reporter.source_schema, FieldSchemaType::User { system, .. } if system.as_deref() == Some("reporter")),
            "reporter source_schema must be User{{system:reporter}}, got {:?}",
            reporter.source_schema
        );
    }

    #[test]
    fn null_schema_migration_updates_existing_rows() {
        use crate::field_discovery::FieldSchemaType;
        // Open a fresh in-memory DB (seed hasn't run yet here — we control the table directly)
        let conn = Connection::open_in_memory().expect("open");
        conn.execute_batch(CREATE_FIELD_MAPPING).unwrap();
        conn.execute_batch(DEDUP_TARGETS).unwrap();
        conn.execute_batch(ADD_UNIQUE_TARGET).unwrap();

        // Manually insert a NULL-schema row for 'priority' (simulates pre-fix production DB)
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO field_mapping
                 (source_field_id, target_field_id, transformer_kind,
                  source_schema_json, target_schema_json, created_at, updated_at)
             VALUES ('priority', 'priority', 'priority', NULL, NULL, ?1, ?1)",
            params![now],
        )
        .expect("insert null-schema row");

        // Run the migration
        update_null_schema_defaults(&conn).expect("migration");

        // Wrap in FieldMappingDb for get_all_mapping_rows
        let db = FieldMappingDb { conn };
        let rows = db.get_all_mapping_rows().expect("get");
        let priority = rows
            .iter()
            .find(|r| r.source_field_id == "priority")
            .expect("priority row");
        assert!(
            matches!(&priority.source_schema, FieldSchemaType::Priority),
            "after migration, priority source_schema must be Priority, got {:?}",
            priority.source_schema
        );
        assert!(
            matches!(&priority.target_schema, FieldSchemaType::Priority),
            "after migration, priority target_schema must be Priority, got {:?}",
            priority.target_schema
        );
    }

    #[test]
    fn duplicate_target_field_id_is_rejected() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        // Wipe seed defaults so we control exactly what's in the table.
        db.conn.execute("DELETE FROM field_mapping", []).unwrap();
        let row_a = FieldMappingRow {
            source_field_id: "src_a".into(),
            target_field_id: "tgt_shared".into(),
            transformer_kind: "identity".into(),
            source_schema: serde_json::from_str("{\"type\":\"any\"}").unwrap(),
            target_schema: serde_json::from_str("{\"type\":\"any\"}").unwrap(),
        };
        let row_b = FieldMappingRow {
            source_field_id: "src_b".into(),
            target_field_id: "tgt_shared".into(), // same target — must fail
            transformer_kind: "identity".into(),
            source_schema: serde_json::from_str("{\"type\":\"any\"}").unwrap(),
            target_schema: serde_json::from_str("{\"type\":\"any\"}").unwrap(),
        };
        db.upsert_mapping_row(&row_a).expect("first insert ok");
        let err = db
            .upsert_mapping_row(&row_b)
            .expect_err("second insert must fail — duplicate non-empty target");
        let msg = err.to_string();
        assert!(
            msg.contains("UNIQUE")
                || msg.contains("constraint")
                || msg.contains("idx_fm_target_unique"),
            "error should mention unique constraint, got: {msg}"
        );
    }

    /// Regression test for the copy-mandatory-field-warning bug.
    ///
    /// The partial unique index on `target_field_id` must exclude the empty-string
    /// dismissed-suggestion sentinel so that multiple source fields can be dismissed
    /// (targetFieldId='') without conflicting with each other.
    ///
    /// Before the fix, `idx_fm_target_unique` was unconditional: the second
    /// dismiss would fail with a UNIQUE constraint error, leaving the user unable
    /// to add new mapping rows and the mandatory field stuck in the gap list.
    #[test]
    fn multiple_empty_sentinel_rows_are_allowed() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        // Clear seed defaults to control the table state.
        db.conn.execute("DELETE FROM field_mapping", []).unwrap();
        let make_dismissed = |src: &str| FieldMappingRow {
            source_field_id: src.into(),
            target_field_id: "".into(), // dismissed sentinel
            transformer_kind: "identity".into(),
            source_schema: serde_json::from_str("{\"type\":\"any\"}").unwrap(),
            target_schema: serde_json::from_str("{\"type\":\"any\"}").unwrap(),
        };
        // Three dismissed rows with targetFieldId='' — all must succeed.
        db.upsert_mapping_row(&make_dismissed("src_a"))
            .expect("first dismiss must succeed");
        db.upsert_mapping_row(&make_dismissed("src_b"))
            .expect("second dismiss must succeed (partial index excludes empty string)");
        db.upsert_mapping_row(&make_dismissed("src_c"))
            .expect("third dismiss must succeed");
        let rows = db.get_all_mapping_rows().expect("get rows");
        assert_eq!(rows.len(), 3, "all three dismissed rows must be stored");
        assert!(
            rows.iter().all(|r| r.target_field_id.is_empty()),
            "all rows must have empty targetFieldId sentinel"
        );
    }

    // ── Quick task 260430-0tj: new mapping_audit_log outcome tests ─────────────

    #[test]
    fn mapping_audit_outcome_ok_when_field_resolved() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        db.insert_mapping_audit(
            "copy-1",
            "summary",
            "h1",
            "h2",
            false,
            None,
            "identity",
            "ok",
            None,
            "2026-04-30T00:00:00Z",
            None,
            None,
        )
        .unwrap();
        let row: (String, String, Option<String>) = db
            .conn
            .query_row(
                "SELECT transformer_kind, outcome, failure_reason
                 FROM mapping_audit_log WHERE copy_id = 'copy-1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(row.0, "identity");
        assert_eq!(row.1, "ok");
        assert!(row.2.is_none());
    }

    #[test]
    fn mapping_audit_outcome_failed_when_gap() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        db.insert_mapping_audit(
            "copy-2",
            "assignee",
            "h1",
            "h2",
            false,
            Some("person"),
            "user",
            "failed",
            Some("unresolved person"),
            "2026-04-30T00:00:00Z",
            None,
            None,
        )
        .unwrap();
        let row: (String, Option<String>) = db
            .conn
            .query_row(
                "SELECT outcome, failure_reason
                 FROM mapping_audit_log WHERE copy_id = 'copy-2'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(row.0, "failed");
        assert_eq!(row.1.as_deref(), Some("unresolved person"));
    }

    #[test]
    fn mapping_audit_outcome_skipped_when_no_value() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        db.insert_mapping_audit(
            "copy-3",
            "labels",
            "h1",
            "h2",
            false,
            None,
            "identity",
            "skipped",
            Some("source value missing"),
            "2026-04-30T00:00:00Z",
            None,
            None,
        )
        .unwrap();
        let outcome: String = db
            .conn
            .query_row(
                "SELECT outcome FROM mapping_audit_log WHERE copy_id = 'copy-3'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(outcome, "skipped");
    }

    #[test]
    fn get_mapping_audit_log_page_returns_descending_by_id() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        for i in 0..5 {
            db.insert_mapping_audit(
                &format!("copy-{i}"),
                "f",
                "h1",
                "h2",
                false,
                None,
                "identity",
                "ok",
                None,
                "2026-04-30T00:00:00Z",
                None,
                None,
            )
            .unwrap();
        }
        let page = db.get_mapping_audit_log_page(0, 10).unwrap();
        assert_eq!(page.len(), 5);
        assert_eq!(page[0].copy_id, "copy-4"); // newest first
        assert_eq!(page[4].copy_id, "copy-0");
    }

    #[test]
    fn legacy_db_migration_adds_new_columns() {
        // Simulate a pre-fix DB by creating the table with the OLD schema (no new columns),
        // then opening the FieldMappingDb (which triggers the migration), then inserting
        // a row with the NEW signature. The migration must have added the columns.
        let tmpdir = tempfile::tempdir().unwrap();
        let path = tmpdir.path().join("legacy.db");
        {
            let conn = Connection::open(&path).unwrap();
            conn.execute_batch(
                "CREATE TABLE mapping_audit_log (
                    id                INTEGER PRIMARY KEY AUTOINCREMENT,
                    copy_id           TEXT NOT NULL,
                    field_id          TEXT NOT NULL,
                    source_value_hash TEXT NOT NULL,
                    target_value_hash TEXT NOT NULL,
                    was_overridden    INTEGER NOT NULL DEFAULT 0,
                    gap_kind          TEXT,
                    timestamp         TEXT NOT NULL,
                    created_at        INTEGER DEFAULT (strftime('%s','now'))
                );",
            )
            .unwrap();
        }
        // Open through FieldMappingDb — migration runs.
        let db = FieldMappingDb::open(&path).unwrap();
        db.insert_mapping_audit(
            "copy-legacy",
            "f",
            "h1",
            "h2",
            false,
            None,
            "identity",
            "ok",
            None,
            "2026-04-30T00:00:00Z",
            None,
            None,
        )
        .unwrap();
        let page = db.get_mapping_audit_log_page(0, 10).unwrap();
        assert_eq!(page.len(), 1);
        assert_eq!(page[0].transformer_kind, "identity");
        assert_eq!(page[0].outcome, "ok");
    }

    // ── Quick task 260430-26i: JSON value persistence tests ──────────────────

    #[test]
    fn insert_mapping_audit_persists_json_values() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        db.insert_mapping_audit(
            "copy-26i-1",
            "summary",
            "h1",
            "h2",
            false,
            None,
            "identity",
            "ok",
            None,
            "2026-04-30T00:00:00Z",
            Some("\"hello\""),
            Some("\"world\""),
        )
        .unwrap();
        let page = db.get_mapping_audit_log_page(0, 10).unwrap();
        assert_eq!(page.len(), 1);
        assert_eq!(page[0].source_value_json.as_deref(), Some("\"hello\""));
        assert_eq!(page[0].target_value_json.as_deref(), Some("\"world\""));
    }

    #[test]
    fn legacy_rows_have_null_json_columns() {
        // Existing rows from before quick task 260430-26i must still load and
        // surface NULL on the new JSON columns so the UI can hash-fallback.
        let db = FieldMappingDb::open_in_memory().unwrap();
        db.insert_mapping_audit(
            "copy-26i-2",
            "summary",
            "h-old",
            "h-old",
            false,
            None,
            "identity",
            "ok",
            None,
            "2026-04-30T00:00:00Z",
            None,
            None,
        )
        .unwrap();
        let page = db.get_mapping_audit_log_page(0, 10).unwrap();
        assert_eq!(page.len(), 1);
        assert!(page[0].source_value_json.is_none());
        assert!(page[0].target_value_json.is_none());
        // Hash columns still populated.
        assert_eq!(page[0].source_value_hash, "h-old");
        assert_eq!(page[0].target_value_hash, "h-old");
    }

    #[test]
    fn legacy_db_migration_adds_json_columns() {
        // Simulate a pre-26i DB (post-0tj schema) and verify the JSON columns
        // are added by the migration so new inserts can populate them.
        let tmpdir = tempfile::tempdir().unwrap();
        let path = tmpdir.path().join("legacy26i.db");
        {
            let conn = Connection::open(&path).unwrap();
            conn.execute_batch(
                "CREATE TABLE mapping_audit_log (
                    id                INTEGER PRIMARY KEY AUTOINCREMENT,
                    copy_id           TEXT NOT NULL,
                    field_id          TEXT NOT NULL,
                    source_value_hash TEXT NOT NULL,
                    target_value_hash TEXT NOT NULL,
                    was_overridden    INTEGER NOT NULL DEFAULT 0,
                    gap_kind          TEXT,
                    transformer_kind  TEXT NOT NULL DEFAULT '',
                    outcome           TEXT NOT NULL DEFAULT 'ok',
                    failure_reason    TEXT,
                    timestamp         TEXT NOT NULL,
                    created_at        INTEGER DEFAULT (strftime('%s','now'))
                );",
            )
            .unwrap();
        }
        let db = FieldMappingDb::open(&path).unwrap();
        db.insert_mapping_audit(
            "copy-26i-3",
            "f",
            "h1",
            "h2",
            false,
            None,
            "identity",
            "ok",
            None,
            "2026-04-30T00:00:00Z",
            Some("\"src\""),
            Some("\"tgt\""),
        )
        .unwrap();
        let page = db.get_mapping_audit_log_page(0, 10).unwrap();
        assert_eq!(page.len(), 1);
        assert_eq!(page[0].source_value_json.as_deref(), Some("\"src\""));
        assert_eq!(page[0].target_value_json.as_deref(), Some("\"tgt\""));
    }

    /// After fixing multiple dismissals, a real mapping can still be added for a
    /// mandatory target field that was previously blocked.
    #[test]
    fn real_mapping_can_be_added_after_multiple_dismissals() {
        let db = FieldMappingDb::open_in_memory().unwrap();
        db.conn.execute("DELETE FROM field_mapping", []).unwrap();
        // Dismiss two suggestions.
        let row_dismissed_a = FieldMappingRow {
            source_field_id: "custom_a".into(),
            target_field_id: "".into(),
            transformer_kind: "identity".into(),
            source_schema: serde_json::from_str("{\"type\":\"any\"}").unwrap(),
            target_schema: serde_json::from_str("{\"type\":\"any\"}").unwrap(),
        };
        let row_dismissed_b = FieldMappingRow {
            source_field_id: "custom_b".into(),
            target_field_id: "".into(),
            transformer_kind: "identity".into(),
            source_schema: serde_json::from_str("{\"type\":\"any\"}").unwrap(),
            target_schema: serde_json::from_str("{\"type\":\"any\"}").unwrap(),
        };
        db.upsert_mapping_row(&row_dismissed_a).expect("dismiss a");
        db.upsert_mapping_row(&row_dismissed_b).expect("dismiss b");
        // Now add a REAL mapping for a mandatory target field.
        let row_real = FieldMappingRow {
            source_field_id: "story_points".into(),
            target_field_id: "customfield_10028".into(), // mandatory target
            transformer_kind: "identity".into(),
            source_schema: serde_json::from_str("{\"type\":\"any\"}").unwrap(),
            target_schema: serde_json::from_str("{\"type\":\"any\"}").unwrap(),
        };
        db.upsert_mapping_row(&row_real)
            .expect("real mapping for mandatory field must succeed");
        let rows = db.get_all_mapping_rows().expect("get rows");
        assert_eq!(rows.len(), 3);
        let real = rows
            .iter()
            .find(|r| r.source_field_id == "story_points")
            .expect("story_points row must exist");
        assert_eq!(real.target_field_id, "customfield_10028");
    }
}
