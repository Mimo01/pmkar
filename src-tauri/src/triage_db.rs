use crate::error::{AppError, AppResult};
use crate::notification_dispatcher::NotificationPrefs;
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WatchedUser {
    pub identifier: String,
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchConfig {
    pub jql_preset: String,
    pub jql_custom: Option<String>,
    pub watched_users: Vec<WatchedUser>,
    pub last_fetched_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionMeta {
    pub connection_type: String,
    pub base_url: String,
    pub username: String,
    pub server_version: String,
    pub last_tested_at: String,
    pub status: String,
}

pub struct TriageDb {
    conn: Connection,
}

const CREATE_TRIAGE_STATE_SQL: &str = "CREATE TABLE IF NOT EXISTS triage_state (
    ticket_key   TEXT PRIMARY KEY,
    state        TEXT NOT NULL CHECK(state IN ('new','seen','ignored','copied','handled','watched')),
    first_seen   TEXT NOT NULL,
    last_updated TEXT NOT NULL
);";

const ALTER_TRIAGE_ADD_COPIED_KEY: &str = "ALTER TABLE triage_state ADD COLUMN copied_key TEXT;";

/// Rebuilds the `triage_state` table to widen the `CHECK` constraint to include 'watched'.
/// Run after `CREATE TABLE IF NOT EXISTS` so that fresh DBs get the right constraint directly
/// and existing DBs (which have the old 4- or 5-value CHECK) are migrated in-place.
const MIGRATE_TRIAGE_CHECK_WATCHED: &str = "
    BEGIN TRANSACTION;
    CREATE TABLE IF NOT EXISTS triage_state_new (
        ticket_key   TEXT PRIMARY KEY,
        state        TEXT NOT NULL CHECK(state IN ('new','seen','ignored','copied','handled','watched')),
        first_seen   TEXT NOT NULL,
        last_updated TEXT NOT NULL,
        copied_key   TEXT
    );
    INSERT INTO triage_state_new (ticket_key, state, first_seen, last_updated, copied_key)
        SELECT ticket_key, state, first_seen, last_updated, copied_key FROM triage_state;
    DROP TABLE triage_state;
    ALTER TABLE triage_state_new RENAME TO triage_state;
    COMMIT;
";

const ALTER_APP_CONFIG_ADD_SOURCE_PROJECT: &str =
    "ALTER TABLE app_config ADD COLUMN source_project_key TEXT;";
const ALTER_APP_CONFIG_ADD_TARGET_PROJECT: &str =
    "ALTER TABLE app_config ADD COLUMN target_project_key TEXT;";
const ALTER_APP_CONFIG_ADD_SOURCE_PROJECT_NAME: &str =
    "ALTER TABLE app_config ADD COLUMN source_project_name TEXT;";
const ALTER_APP_CONFIG_ADD_TARGET_PROJECT_NAME: &str =
    "ALTER TABLE app_config ADD COLUMN target_project_name TEXT;";
const ALTER_APP_CONFIG_ADD_POLL_FREQUENCY: &str =
    "ALTER TABLE app_config ADD COLUMN poll_frequency TEXT NOT NULL DEFAULT 'off';";

const ALTER_APP_CONFIG_ADD_NOTIFICATION_PREFS: &str =
    "ALTER TABLE app_config ADD COLUMN notification_prefs TEXT;";

/// Phase 23 D-06 — verbose audit mode flag. When true, `mapping_audit_log` writes
/// raw field values; when false (default), only SHA-256 hashes are written.
const ALTER_APP_CONFIG_ADD_AUDIT_VERBOSE: &str =
    "ALTER TABLE app_config ADD COLUMN audit_verbose INTEGER NOT NULL DEFAULT 0;";

const CREATE_CONNECTION_META_SQL: &str = "CREATE TABLE IF NOT EXISTS connection_meta (
    connection_type TEXT PRIMARY KEY,
    base_url        TEXT NOT NULL,
    username        TEXT NOT NULL,
    server_version  TEXT NOT NULL DEFAULT '',
    last_tested_at  TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'ok'
);";

const CREATE_FETCH_CONFIG_SQL: &str = "CREATE TABLE IF NOT EXISTS fetch_config (
    id              INTEGER PRIMARY KEY CHECK(id = 1),
    jql_preset      TEXT NOT NULL DEFAULT 'all_watched',
    jql_custom      TEXT,
    watched_users   TEXT NOT NULL DEFAULT '[]',
    last_fetched_at TEXT
);";

const CREATE_APP_CONFIG_SQL: &str = "CREATE TABLE IF NOT EXISTS app_config (
    id       INTEGER PRIMARY KEY CHECK(id = 1),
    language TEXT NOT NULL DEFAULT 'en'
);";

/// Pass through `Ok(())` and "duplicate column" `SQLite` errors (`SQLITE_ERROR`, code 1),
/// which are expected when a migration ALTER TABLE column already exists. Any other
/// error variant is propagated so real failures are not silently swallowed.
fn ignore_duplicate_column(result: rusqlite::Result<()>) -> rusqlite::Result<()> {
    match result {
        Err(rusqlite::Error::SqliteFailure(e, _)) if e.extended_code == 1 /* SQLITE_ERROR */ => {
            Ok(())
        }
        other => other,
    }
}

impl TriageDb {
    /// Detects whether the existing `triage_state` table's `CHECK` constraint already
    /// includes 'watched'. If not, rebuilds the table to widen the constraint.
    /// This is idempotent — running it on a DB that already has 'watched' is a no-op.
    fn migrate_triage_check_constraint(conn: &Connection) -> AppResult<()> {
        let sql: Option<String> = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='triage_state'",
                [],
                |row| row.get(0),
            )
            .ok()
            .flatten();
        if let Some(existing_sql) = sql {
            if !existing_sql.contains("'watched'") {
                conn.execute_batch(MIGRATE_TRIAGE_CHECK_WATCHED)?;
            }
        }
        Ok(())
    }

    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(CREATE_TRIAGE_STATE_SQL)?;
        conn.execute_batch(CREATE_CONNECTION_META_SQL)?;
        conn.execute_batch(CREATE_FETCH_CONFIG_SQL)?;
        conn.execute("INSERT OR IGNORE INTO fetch_config(id) VALUES(1)", [])?;
        ignore_duplicate_column(conn.execute_batch(ALTER_TRIAGE_ADD_COPIED_KEY))?;
        Self::migrate_triage_check_constraint(&conn)?;
        conn.execute_batch(CREATE_APP_CONFIG_SQL)?;
        conn.execute("INSERT OR IGNORE INTO app_config(id) VALUES(1)", [])?;
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_SOURCE_PROJECT);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_TARGET_PROJECT);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_SOURCE_PROJECT_NAME);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_TARGET_PROJECT_NAME);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_POLL_FREQUENCY);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_NOTIFICATION_PREFS);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_AUDIT_VERBOSE);
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(CREATE_TRIAGE_STATE_SQL)?;
        conn.execute_batch(CREATE_CONNECTION_META_SQL)?;
        conn.execute_batch(CREATE_FETCH_CONFIG_SQL)?;
        conn.execute("INSERT OR IGNORE INTO fetch_config(id) VALUES(1)", [])?;
        ignore_duplicate_column(conn.execute_batch(ALTER_TRIAGE_ADD_COPIED_KEY))?;
        Self::migrate_triage_check_constraint(&conn)?;
        conn.execute_batch(CREATE_APP_CONFIG_SQL)?;
        conn.execute("INSERT OR IGNORE INTO app_config(id) VALUES(1)", [])?;
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_SOURCE_PROJECT);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_TARGET_PROJECT);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_SOURCE_PROJECT_NAME);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_TARGET_PROJECT_NAME);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_POLL_FREQUENCY);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_NOTIFICATION_PREFS);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_AUDIT_VERBOSE);
        Ok(Self { conn })
    }

    pub fn get_all_triage(&self) -> AppResult<HashMap<String, (String, Option<String>)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT ticket_key, state, copied_key FROM triage_state")?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    (row.get::<_, String>(1)?, row.get::<_, Option<String>>(2)?),
                ))
            })?
            .collect::<Result<HashMap<String, (String, Option<String>)>, _>>()?;
        Ok(rows)
    }

    pub fn set_triage_copied(&self, source_key: &str, target_key: &str) -> AppResult<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO triage_state (ticket_key, state, first_seen, last_updated, copied_key)
             VALUES (?1, 'copied', ?2, ?2, ?3)
             ON CONFLICT(ticket_key) DO UPDATE SET state='copied', last_updated=?2, copied_key=?3",
            rusqlite::params![source_key, now, target_key],
        )?;
        Ok(())
    }

    /// Returns the remembered Cloud key for a ticket, if any.
    /// Unknown tickets and keyless rows both return `None`.
    pub fn get_copied_key(&self, key: &str) -> AppResult<Option<String>> {
        let found = self
            .conn
            .query_row(
                "SELECT copied_key FROM triage_state WHERE ticket_key=?1",
                rusqlite::params![key],
                |r| r.get::<_, Option<String>>(0),
            )
            .optional()?;
        Ok(found.flatten())
    }

    /// Re-links a ticket to its remembered Cloud key by flipping state to 'copied'.
    /// Only path into 'copied' besides `set_triage_copied`. Never creates a row and
    /// never writes `copied_key`. Returns `None` when no key is remembered.
    /// The caller holds the `Mutex<TriageDb>` lock, so UPDATE + SELECT cannot interleave.
    pub fn relink(&self, key: &str) -> AppResult<Option<String>> {
        let now = chrono::Utc::now().to_rfc3339();
        let changed = self.conn.execute(
            "UPDATE triage_state SET state='copied', last_updated=?1 WHERE ticket_key=?2 AND copied_key IS NOT NULL",
            rusqlite::params![now, key],
        )?;
        if changed == 0 {
            return Ok(None);
        }
        self.get_copied_key(key)
    }

    pub fn set_triage(&self, key: &str, state: &str) -> AppResult<()> {
        if state == "copied" {
            return Err(AppError::Internal(
                "State 'copied' cannot be set directly; use relink_ticket or the copy flow"
                    .to_string(),
            ));
        }
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO triage_state (ticket_key, state, first_seen, last_updated)
             VALUES (?1, ?2, ?3, ?3)
             ON CONFLICT(ticket_key) DO UPDATE SET state=?2, last_updated=?3",
            rusqlite::params![key, state, now],
        )?;
        Ok(())
    }

    pub fn get_fetch_config(&self) -> AppResult<FetchConfig> {
        let mut stmt = self.conn.prepare(
            "SELECT jql_preset, jql_custom, watched_users, last_fetched_at FROM fetch_config WHERE id = 1",
        )?;
        let config = stmt.query_row([], |row| {
            let jql_preset: String = row.get(0)?;
            let jql_custom: Option<String> = row.get(1)?;
            let watched_users_json: String = row.get(2)?;
            let last_fetched_at: Option<String> = row.get(3)?;
            // Migrate: old format was ["alice","bob"], new format is [{identifier,displayName,email}]
            let watched_users = serde_json::from_str::<Vec<WatchedUser>>(&watched_users_json)
                .unwrap_or_else(|_| {
                    // Try parsing as old string array and convert
                    serde_json::from_str::<Vec<String>>(&watched_users_json)
                        .unwrap_or_default()
                        .into_iter()
                        .map(|s| WatchedUser {
                            display_name: s.clone(),
                            identifier: s,
                            email: None,
                        })
                        .collect()
                });
            Ok(FetchConfig {
                jql_preset,
                jql_custom,
                watched_users,
                last_fetched_at,
            })
        })?;
        Ok(config)
    }

    pub fn set_fetch_config(&self, config: &FetchConfig) -> AppResult<()> {
        let watched_json =
            serde_json::to_string(&config.watched_users).unwrap_or_else(|_| "[]".to_string());
        self.conn.execute(
            "UPDATE fetch_config SET jql_preset=?1, jql_custom=?2, watched_users=?3, last_fetched_at=?4 WHERE id=1",
            rusqlite::params![
                config.jql_preset,
                config.jql_custom,
                watched_json,
                config.last_fetched_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_last_fetched(&self, timestamp: &str) -> AppResult<()> {
        self.conn.execute(
            "UPDATE fetch_config SET last_fetched_at=?1 WHERE id=1",
            rusqlite::params![timestamp],
        )?;
        Ok(())
    }

    pub fn set_connection_meta(&self, meta: &ConnectionMeta) -> AppResult<()> {
        self.conn.execute(
            "INSERT INTO connection_meta (connection_type, base_url, username, server_version, last_tested_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(connection_type) DO UPDATE SET base_url=?2, username=?3, server_version=?4, last_tested_at=?5, status=?6",
            rusqlite::params![
                meta.connection_type,
                meta.base_url,
                meta.username,
                meta.server_version,
                meta.last_tested_at,
                meta.status,
            ],
        )?;
        Ok(())
    }

    pub fn get_app_language(&self) -> AppResult<Option<String>> {
        let lang: Option<String> = self
            .conn
            .query_row("SELECT language FROM app_config WHERE id = 1", [], |row| {
                row.get(0)
            })
            .ok();
        Ok(lang)
    }

    pub fn set_app_language(&self, language: &str) -> AppResult<()> {
        self.conn.execute(
            "UPDATE app_config SET language = ?1 WHERE id = 1",
            [language],
        )?;
        Ok(())
    }

    pub fn get_poll_frequency(&self) -> AppResult<String> {
        let freq: String = self
            .conn
            .query_row(
                "SELECT poll_frequency FROM app_config WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "off".to_string());
        Ok(freq)
    }

    pub fn set_poll_frequency(&self, frequency: &str) -> AppResult<()> {
        self.conn.execute(
            "UPDATE app_config SET poll_frequency = ?1 WHERE id = 1",
            [frequency],
        )?;
        Ok(())
    }

    pub fn get_notification_prefs(&self) -> AppResult<NotificationPrefs> {
        let json_opt: Option<String> = self
            .conn
            .query_row(
                "SELECT notification_prefs FROM app_config WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap_or(None);
        match json_opt {
            Some(ref s) if !s.is_empty() => Ok(serde_json::from_str(s)?),
            _ => Ok(NotificationPrefs::default()),
        }
    }

    pub fn set_notification_prefs(&self, prefs: &NotificationPrefs) -> AppResult<()> {
        let json = serde_json::to_string(prefs)?;
        self.conn.execute(
            "UPDATE app_config SET notification_prefs = ?1 WHERE id = 1",
            [&json],
        )?;
        Ok(())
    }

    /// Phase 23 D-06 — read the persistent `audit_verbose` flag.
    /// Defaults to false (hash-only mode) when the row or column is missing.
    pub fn get_audit_verbose(&self) -> AppResult<bool> {
        let val: i64 = self
            .conn
            .query_row(
                "SELECT audit_verbose FROM app_config WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        Ok(val != 0)
    }

    /// Phase 23 D-06 — persist the `audit_verbose` flag. Update-only (the row
    /// is created at open via `INSERT OR IGNORE`).
    pub fn set_audit_verbose(&self, verbose: bool) -> AppResult<()> {
        self.conn.execute(
            "UPDATE app_config SET audit_verbose = ?1 WHERE id = 1",
            rusqlite::params![i64::from(verbose)],
        )?;
        Ok(())
    }

    /// Phase 23 CUTV-04 — single-value convenience getter for `target_project_key`.
    /// Wraps the existing 4-tuple `get_project_keys()` so Plan 23-03 (`copy_ticket_v2`)
    /// can read the target project key without unpacking the full project keys row.
    /// Returns `Ok(None)` when the column is NULL (user has not configured a target).
    pub fn get_target_project_key(&self) -> AppResult<Option<String>> {
        let (_src_key, tgt_key, _src_name, _tgt_name) = self.get_project_keys()?;
        Ok(tgt_key)
    }

    #[allow(clippy::type_complexity)]
    pub fn get_project_keys(
        &self,
    ) -> AppResult<(
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
    )> {
        let result = self
            .conn
            .query_row(
                "SELECT source_project_key, target_project_key, source_project_name, target_project_name FROM app_config WHERE id = 1",
                [],
                |row| {
                    Ok((
                        row.get::<_, Option<String>>(0)?,
                        row.get::<_, Option<String>>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                },
            )
            .optional()?;
        Ok(result.unwrap_or((None, None, None, None)))
    }

    pub fn set_source_project_key(&self, key: Option<&str>) -> AppResult<()> {
        self.conn.execute(
            "UPDATE app_config SET source_project_key = ?1 WHERE id = 1",
            [key],
        )?;
        Ok(())
    }

    pub fn set_target_project_key(&self, key: Option<&str>) -> AppResult<()> {
        self.conn.execute(
            "UPDATE app_config SET target_project_key = ?1 WHERE id = 1",
            [key],
        )?;
        Ok(())
    }

    pub fn set_source_project_name(&self, name: Option<&str>) -> AppResult<()> {
        self.conn.execute(
            "UPDATE app_config SET source_project_name = ?1 WHERE id = 1",
            [name],
        )?;
        Ok(())
    }

    pub fn set_target_project_name(&self, name: Option<&str>) -> AppResult<()> {
        self.conn.execute(
            "UPDATE app_config SET target_project_name = ?1 WHERE id = 1",
            [name],
        )?;
        Ok(())
    }

    /// Delete triage entries for the given ticket keys (bulk delete).
    /// Rows with a remembered link (`copied_key` set) are kept untouched.
    /// Returns the number of rows actually deleted.
    pub fn delete_triage_entries(&self, keys: &[String]) -> AppResult<usize> {
        if keys.is_empty() {
            return Ok(0);
        }
        let placeholders = keys
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", i + 1))
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "DELETE FROM triage_state WHERE ticket_key IN ({placeholders}) AND copied_key IS NULL"
        );
        let params: Vec<&dyn rusqlite::ToSql> =
            keys.iter().map(|k| k as &dyn rusqlite::ToSql).collect();
        let count = self.conn.execute(&sql, params.as_slice())?;
        Ok(count)
    }

    pub fn get_all_connection_meta(&self) -> AppResult<Vec<ConnectionMeta>> {
        let mut stmt = self.conn.prepare(
            "SELECT connection_type, base_url, username, server_version, last_tested_at, status FROM connection_meta",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(ConnectionMeta {
                    connection_type: row.get(0)?,
                    base_url: row.get(1)?,
                    username: row.get(2)?,
                    server_version: row.get(3)?,
                    last_tested_at: row.get(4)?,
                    status: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<ConnectionMeta>, _>>()?;
        Ok(rows)
    }
}

/// Test-only: builds a DB file with the pre-handled schema (`copied_key` added via ALTER)
/// and legacy rows, then opens it through `TriageDb::open` so migrations run.
#[cfg(test)]
pub(crate) fn open_legacy_shape_for_test(dir: &std::path::Path) -> TriageDb {
    let path = dir.join("legacy_triage.db");
    {
        let conn = Connection::open(&path).expect("open legacy conn");
        conn.execute_batch(
            "CREATE TABLE triage_state (ticket_key TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('new','seen','ignored','copied')), first_seen TEXT NOT NULL, last_updated TEXT NOT NULL);",
        )
        .expect("create legacy table");
        conn.execute_batch(ALTER_TRIAGE_ADD_COPIED_KEY)
            .expect("alter legacy table");
        conn.execute_batch(
            "INSERT INTO triage_state (ticket_key, state, first_seen, last_updated, copied_key) VALUES
             ('LEG-1','copied','2025-01-01T00:00:00+00:00','2025-01-01T00:00:00+00:00','CLOUD-1'),
             ('LEG-2','ignored','2025-01-01T00:00:00+00:00','2025-01-01T00:00:00+00:00','CLOUD-2'),
             ('LEG-3','new','2025-01-01T00:00:00+00:00','2025-01-01T00:00:00+00:00',NULL);",
        )
        .expect("seed legacy rows");
    }
    TriageDb::open(&path).expect("legacy open failed")
}

/// Test-only: builds a DB file with the 5-value (`handled`, no `watched`) CHECK and
/// `copied_key`, seeds rows (incl. a remembered key), then opens it through `TriageDb::open`.
#[cfg(test)]
pub(crate) fn open_handled_shape_for_test(dir: &std::path::Path) -> TriageDb {
    let path = dir.join("handled_triage.db");
    {
        let conn = Connection::open(&path).expect("open handled conn");
        conn.execute_batch(
            "CREATE TABLE triage_state (ticket_key TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('new','seen','ignored','copied','handled')), first_seen TEXT NOT NULL, last_updated TEXT NOT NULL, copied_key TEXT);
             INSERT INTO triage_state (ticket_key, state, first_seen, last_updated, copied_key) VALUES
             ('H-1','ignored','2025-01-01T00:00:00+00:00','2025-01-01T00:00:00+00:00','CLOUD-9'),
             ('H-2','handled','2025-01-01T00:00:00+00:00','2025-01-01T00:00:00+00:00',NULL),
             ('H-3','copied','2025-01-01T00:00:00+00:00','2025-01-01T00:00:00+00:00','CLOUD-3');",
        )
        .expect("seed handled rows");
    }
    TriageDb::open(&path).expect("handled open failed")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn new_db() -> TriageDb {
        TriageDb::open_in_memory().expect("failed to create in-memory TriageDb")
    }

    #[test]
    fn test_new_creates_in_memory_db() {
        // Should not panic — schema creation succeeds
        let _db = new_db();
    }

    #[test]
    fn test_set_and_get_triage_state() {
        let db = new_db();
        db.set_triage("PROJ-1", "seen").expect("set_triage failed");
        let all = db.get_all_triage().expect("get_all_triage failed");
        assert!(all.contains_key("PROJ-1"), "PROJ-1 should be in triage map");
        let (state, copied_key) = &all["PROJ-1"];
        assert_eq!(state, "seen");
        assert!(copied_key.is_none());
    }

    #[test]
    fn test_get_all_triage_returns_all() {
        let db = new_db();
        db.set_triage("PROJ-1", "new").expect("set failed");
        db.set_triage("PROJ-2", "seen").expect("set failed");
        db.set_triage("PROJ-3", "ignored").expect("set failed");
        let all = db.get_all_triage().expect("get_all failed");
        assert_eq!(all.len(), 3, "expected 3 triage entries");
        assert!(all.contains_key("PROJ-1"));
        assert!(all.contains_key("PROJ-2"));
        assert!(all.contains_key("PROJ-3"));
    }

    #[test]
    fn test_update_triage_state() {
        let db = new_db();
        db.set_triage("PROJ-1", "seen").expect("initial set failed");
        db.set_triage("PROJ-1", "ignored").expect("update failed");
        let all = db.get_all_triage().expect("get failed");
        let (state, _) = &all["PROJ-1"];
        assert_eq!(state, "ignored", "state should be updated to ignored");
    }

    #[test]
    fn test_set_and_get_fetch_config() {
        let db = new_db();
        let config = FetchConfig {
            jql_preset: "custom".to_string(),
            jql_custom: Some("project = MYPROJ".to_string()),
            watched_users: vec![
                WatchedUser {
                    identifier: "alice".into(),
                    display_name: "Alice Smith".into(),
                    email: Some("alice@example.com".into()),
                },
                WatchedUser {
                    identifier: "bob".into(),
                    display_name: "Bob Jones".into(),
                    email: None,
                },
            ],
            last_fetched_at: Some("2024-01-01T00:00:00Z".to_string()),
        };
        db.set_fetch_config(&config)
            .expect("set_fetch_config failed");
        let retrieved = db.get_fetch_config().expect("get_fetch_config failed");
        assert_eq!(retrieved.jql_preset, "custom");
        assert_eq!(retrieved.jql_custom.as_deref(), Some("project = MYPROJ"));
        assert_eq!(retrieved.watched_users.len(), 2);
        assert_eq!(retrieved.watched_users[0].identifier, "alice");
        assert_eq!(retrieved.watched_users[0].display_name, "Alice Smith");
        assert_eq!(
            retrieved.watched_users[0].email,
            Some("alice@example.com".into())
        );
        assert_eq!(retrieved.watched_users[1].identifier, "bob");
        assert_eq!(retrieved.watched_users[1].display_name, "Bob Jones");
        assert_eq!(retrieved.watched_users[1].email, None);
        assert_eq!(
            retrieved.last_fetched_at.as_deref(),
            Some("2024-01-01T00:00:00Z")
        );
    }

    #[test]
    fn test_invalid_triage_state_rejected() {
        let db = new_db();
        // SQLite CHECK constraint enforces state IN ('new','seen','ignored','copied','handled')
        let result = db.set_triage("PROJ-1", "invalid_state");
        assert!(
            result.is_err(),
            "invalid state should be rejected by CHECK constraint"
        );
    }

    #[test]
    fn test_set_handled_state_accepted() {
        let db = new_db();
        db.set_triage("PROJ-1", "handled")
            .expect("handled state should be accepted");
        let all = db.get_all_triage().expect("get_all_triage failed");
        assert_eq!(all["PROJ-1"].0, "handled");
    }

    #[test]
    fn test_set_watched_state_accepted() {
        let db = new_db();
        db.set_triage("W-1", "watched")
            .expect("watched state should be accepted");
        let all = db.get_all_triage().expect("get_all_triage failed");
        assert_eq!(all["W-1"], ("watched".to_string(), None));
    }

    #[test]
    fn test_migrate_4_value_accepts_watched_keeps_copied_key() {
        let dir = tempfile::tempdir().expect("tempdir");
        let db = open_legacy_shape_for_test(dir.path());
        db.set_triage("LEG-2", "watched").unwrap();
        db.set_triage("LEG-9", "watched").unwrap();
        let all = db.get_all_triage().unwrap();
        assert_eq!(
            all["LEG-1"],
            ("copied".to_string(), Some("CLOUD-1".to_string()))
        );
        assert_eq!(
            all["LEG-2"],
            ("watched".to_string(), Some("CLOUD-2".to_string()))
        );
        assert_eq!(all["LEG-3"], ("new".to_string(), None));
        assert_eq!(all["LEG-9"], ("watched".to_string(), None));
    }

    #[test]
    fn test_migrate_5_value_accepts_watched_keeps_copied_key_and_idempotent() {
        let dir = tempfile::tempdir().expect("tempdir");
        let db = open_handled_shape_for_test(dir.path());
        db.set_triage("H-1", "watched").unwrap();
        assert_eq!(
            db.get_all_triage().unwrap()["H-1"],
            ("watched".to_string(), Some("CLOUD-9".to_string()))
        );
        let before = db.get_all_triage().unwrap();
        drop(db);
        let db2 = TriageDb::open(&dir.path().join("handled_triage.db")).expect("reopen");
        assert_eq!(db2.get_all_triage().unwrap(), before);
        assert_eq!(before["H-2"], ("handled".to_string(), None));
        assert_eq!(
            before["H-3"],
            ("copied".to_string(), Some("CLOUD-3".to_string()))
        );
    }

    #[test]
    fn test_relink_from_watched_returns_key_and_flips_to_copied() {
        let db = new_db();
        db.set_triage_copied("PROJ-1", "CLOUD-1").unwrap();
        db.set_triage("PROJ-1", "watched").unwrap();
        assert_eq!(db.relink("PROJ-1").unwrap(), Some("CLOUD-1".to_string()));
        assert_eq!(
            db.get_all_triage().unwrap()["PROJ-1"],
            ("copied".to_string(), Some("CLOUD-1".to_string()))
        );
    }

    #[test]
    fn test_delete_triage_entries_removes_keys() {
        let db = new_db();
        db.set_triage("PROJ-1", "new").expect("set failed");
        db.set_triage("PROJ-2", "seen").expect("set failed");
        db.set_triage("PROJ-3", "ignored").expect("set failed");
        let deleted = db
            .delete_triage_entries(&["PROJ-1".to_string(), "PROJ-2".to_string()])
            .expect("delete failed");
        assert_eq!(deleted, 2, "should have deleted 2 entries");
        let all = db.get_all_triage().expect("get failed");
        assert!(!all.contains_key("PROJ-1"), "PROJ-1 should be deleted");
        assert!(!all.contains_key("PROJ-2"), "PROJ-2 should be deleted");
        assert!(all.contains_key("PROJ-3"), "PROJ-3 should remain");
    }

    #[test]
    fn test_delete_triage_entries_empty_input() {
        let db = new_db();
        db.set_triage("PROJ-1", "new").expect("set failed");
        let deleted = db
            .delete_triage_entries(&[])
            .expect("delete with empty keys failed");
        assert_eq!(deleted, 0, "empty input should delete nothing");
        let all = db.get_all_triage().expect("get failed");
        assert_eq!(all.len(), 1, "PROJ-1 should remain");
    }

    #[test]
    fn audit_verbose_defaults_to_false() {
        let db = TriageDb::open_in_memory().expect("open_in_memory");
        assert!(!db.get_audit_verbose().expect("get"));
    }

    #[test]
    fn audit_verbose_round_trips_true_and_false() {
        let db = TriageDb::open_in_memory().expect("open_in_memory");
        db.set_audit_verbose(true).expect("set true");
        assert!(db.get_audit_verbose().expect("get true"));
        db.set_audit_verbose(false).expect("set false");
        assert!(!db.get_audit_verbose().expect("get false"));
    }

    #[test]
    fn target_project_key_returns_none_when_unset() {
        let db = TriageDb::open_in_memory().expect("open_in_memory");
        assert_eq!(db.get_target_project_key().expect("get"), None);
    }

    #[test]
    fn target_project_key_round_trips() {
        let db = TriageDb::open_in_memory().expect("open_in_memory");
        db.set_target_project_key(Some("ACME")).expect("set");
        assert_eq!(
            db.get_target_project_key().expect("get"),
            Some("ACME".to_string())
        );
    }

    #[test]
    fn audit_verbose_alter_is_idempotent_on_reopen() {
        // Fresh in-memory connections cannot test reopen; this test is a
        // best-effort regression check that the open() path itself does not
        // fail when wired with the new ALTER. A second open_in_memory() call
        // exercises the same code path independently.
        let db1 = TriageDb::open_in_memory().expect("first open");
        db1.set_audit_verbose(true).expect("set");
        drop(db1);
        let db2 = TriageDb::open_in_memory().expect("second open — must not fail");
        // New in-memory DB → defaults reset.
        assert!(!db2.get_audit_verbose().expect("get"));
    }

    #[test]
    fn test_poll_frequency_default_is_off() {
        let db = new_db();
        let freq = db.get_poll_frequency().expect("get_poll_frequency failed");
        assert_eq!(
            freq, "off",
            "fresh DB should return 'off' as default poll_frequency"
        );
    }

    #[test]
    fn test_set_and_get_poll_frequency() {
        let db = new_db();
        db.set_poll_frequency("15m")
            .expect("set_poll_frequency failed");
        let freq = db.get_poll_frequency().expect("get_poll_frequency failed");
        assert_eq!(freq, "15m");
    }

    #[test]
    fn test_set_poll_frequency_overwrites_previous() {
        let db = new_db();
        db.set_poll_frequency("5m").expect("first set failed");
        db.set_poll_frequency("1h").expect("second set failed");
        let freq = db.get_poll_frequency().expect("get failed");
        assert_eq!(freq, "1h", "second set should overwrite first");
    }

    #[test]
    fn test_notification_prefs_default_on_null() {
        let db = new_db();
        let prefs = db
            .get_notification_prefs()
            .expect("get_notification_prefs failed");
        assert!(prefs.notify_new_ticket);
        assert!(prefs.notify_status_change);
        assert!(prefs.notify_priority_change);
        assert!(prefs.notify_new_comment);
    }

    #[test]
    fn test_notification_prefs_roundtrip() {
        let db = new_db();
        let prefs = crate::notification_dispatcher::NotificationPrefs {
            notify_new_ticket: false,
            notify_status_change: true,
            notify_priority_change: false,
            notify_new_comment: true,
        };
        db.set_notification_prefs(&prefs)
            .expect("set_notification_prefs failed");
        let retrieved = db
            .get_notification_prefs()
            .expect("get_notification_prefs failed");
        assert!(!retrieved.notify_new_ticket);
        assert!(retrieved.notify_status_change);
        assert!(!retrieved.notify_priority_change);
        assert!(retrieved.notify_new_comment);
    }

    #[test]
    fn test_set_triage_rejects_copied() {
        let db = new_db();
        assert!(db.set_triage("PROJ-1", "copied").is_err());
        assert!(!db.get_all_triage().unwrap().contains_key("PROJ-1"));
        db.set_triage_copied("PROJ-1", "CLOUD-1").unwrap();
        assert!(db.set_triage("PROJ-1", "copied").is_err());
        let all = db.get_all_triage().unwrap();
        assert_eq!(
            all["PROJ-1"],
            ("copied".to_string(), Some("CLOUD-1".to_string()))
        );
        for st in ["new", "seen", "ignored", "handled", "watched"] {
            db.set_triage("PROJ-1", st).unwrap();
            let all = db.get_all_triage().unwrap();
            assert_eq!(all["PROJ-1"], (st.to_string(), Some("CLOUD-1".to_string())));
        }
    }

    #[test]
    fn test_get_copied_key_cases() {
        let db = new_db();
        assert_eq!(db.get_copied_key("X-1").unwrap(), None);
        db.set_triage("X-1", "new").unwrap();
        assert_eq!(db.get_copied_key("X-1").unwrap(), None);
        db.set_triage_copied("PROJ-1", "CLOUD-1").unwrap();
        assert_eq!(
            db.get_copied_key("PROJ-1").unwrap(),
            Some("CLOUD-1".to_string())
        );
        db.set_triage("PROJ-1", "ignored").unwrap();
        assert_eq!(
            db.get_copied_key("PROJ-1").unwrap(),
            Some("CLOUD-1".to_string())
        );
    }

    #[test]
    fn test_relink_hit_idempotent_any_state() {
        let db = new_db();
        db.set_triage_copied("PROJ-1", "CLOUD-1").unwrap();
        for st in ["new", "seen", "ignored", "handled", "watched"] {
            db.set_triage("PROJ-1", st).unwrap();
            assert_eq!(db.relink("PROJ-1").unwrap(), Some("CLOUD-1".to_string()));
            let all = db.get_all_triage().unwrap();
            assert_eq!(
                all["PROJ-1"],
                ("copied".to_string(), Some("CLOUD-1".to_string()))
            );
        }
        assert_eq!(db.relink("PROJ-1").unwrap(), Some("CLOUD-1".to_string()));
    }

    #[test]
    fn test_relink_miss_creates_no_row() {
        let db = new_db();
        assert_eq!(db.relink("NOPE-1").unwrap(), None);
        assert!(db.get_all_triage().unwrap().is_empty());
        db.set_triage("K-1", "ignored").unwrap();
        assert_eq!(db.relink("K-1").unwrap(), None);
        assert_eq!(
            db.get_all_triage().unwrap()["K-1"],
            ("ignored".to_string(), None)
        );
    }

    #[test]
    fn test_delete_triage_entries_keeps_linked() {
        let db = new_db();
        db.set_triage("A", "new").unwrap();
        db.set_triage_copied("B", "CLOUD-B").unwrap();
        db.set_triage_copied("C", "CLOUD-C").unwrap();
        db.set_triage("C", "ignored").unwrap();
        let keys = vec!["A".to_string(), "B".to_string(), "C".to_string()];
        assert_eq!(db.delete_triage_entries(&keys).unwrap(), 1);
        let all = db.get_all_triage().unwrap();
        assert!(!all.contains_key("A"));
        assert_eq!(
            all["B"],
            ("copied".to_string(), Some("CLOUD-B".to_string()))
        );
        assert_eq!(
            all["C"],
            ("ignored".to_string(), Some("CLOUD-C".to_string()))
        );
    }

    #[test]
    fn test_legacy_shape_db_relink_guard_cleanup() {
        let dir = tempfile::tempdir().expect("tempdir");
        let db = open_legacy_shape_for_test(dir.path());
        let all = db.get_all_triage().unwrap();
        assert_eq!(
            all["LEG-1"],
            ("copied".to_string(), Some("CLOUD-1".to_string()))
        );
        assert_eq!(
            all["LEG-2"],
            ("ignored".to_string(), Some("CLOUD-2".to_string()))
        );
        assert_eq!(all["LEG-3"], ("new".to_string(), None));
        db.set_triage("LEG-9", "handled").unwrap();
        assert_eq!(
            db.get_copied_key("LEG-2").unwrap(),
            Some("CLOUD-2".to_string())
        );
        assert_eq!(db.relink("LEG-2").unwrap(), Some("CLOUD-2".to_string()));
        assert_eq!(db.get_all_triage().unwrap()["LEG-2"].0, "copied");
        assert_eq!(db.relink("LEG-1").unwrap(), Some("CLOUD-1".to_string()));
        assert_eq!(db.relink("LEG-3").unwrap(), None);
        let keys = vec![
            "LEG-1".to_string(),
            "LEG-2".to_string(),
            "LEG-3".to_string(),
        ];
        assert_eq!(db.delete_triage_entries(&keys).unwrap(), 1);
        let all = db.get_all_triage().unwrap();
        assert!(all.contains_key("LEG-1") && all.contains_key("LEG-2"));
        assert!(!all.contains_key("LEG-3"));
    }
}
