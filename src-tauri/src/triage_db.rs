use crate::error::AppResult;
use crate::notification_dispatcher::NotificationPrefs;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchConfig {
    pub jql_preset: String,
    pub jql_custom: Option<String>,
    pub watched_users: Vec<String>,
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
    state        TEXT NOT NULL CHECK(state IN ('new','seen','ignored','copied')),
    first_seen   TEXT NOT NULL,
    last_updated TEXT NOT NULL
);";

const ALTER_TRIAGE_ADD_COPIED_KEY: &str = "ALTER TABLE triage_state ADD COLUMN copied_key TEXT;";

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
    jql_preset      TEXT NOT NULL DEFAULT 'assigned',
    jql_custom      TEXT,
    watched_users   TEXT NOT NULL DEFAULT '[]',
    last_fetched_at TEXT
);";

const CREATE_APP_CONFIG_SQL: &str = "CREATE TABLE IF NOT EXISTS app_config (
    id       INTEGER PRIMARY KEY CHECK(id = 1),
    language TEXT NOT NULL DEFAULT 'en'
);";

impl TriageDb {
    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(CREATE_TRIAGE_STATE_SQL)?;
        conn.execute_batch(CREATE_CONNECTION_META_SQL)?;
        conn.execute_batch(CREATE_FETCH_CONFIG_SQL)?;
        conn.execute("INSERT OR IGNORE INTO fetch_config(id) VALUES(1)", [])?;
        let _ = conn.execute_batch(ALTER_TRIAGE_ADD_COPIED_KEY);
        conn.execute_batch(CREATE_APP_CONFIG_SQL)?;
        conn.execute("INSERT OR IGNORE INTO app_config(id) VALUES(1)", [])?;
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_SOURCE_PROJECT);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_TARGET_PROJECT);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_SOURCE_PROJECT_NAME);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_TARGET_PROJECT_NAME);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_POLL_FREQUENCY);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_NOTIFICATION_PREFS);
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(CREATE_TRIAGE_STATE_SQL)?;
        conn.execute_batch(CREATE_CONNECTION_META_SQL)?;
        conn.execute_batch(CREATE_FETCH_CONFIG_SQL)?;
        conn.execute("INSERT OR IGNORE INTO fetch_config(id) VALUES(1)", [])?;
        let _ = conn.execute_batch(ALTER_TRIAGE_ADD_COPIED_KEY);
        conn.execute_batch(CREATE_APP_CONFIG_SQL)?;
        conn.execute("INSERT OR IGNORE INTO app_config(id) VALUES(1)", [])?;
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_SOURCE_PROJECT);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_TARGET_PROJECT);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_SOURCE_PROJECT_NAME);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_TARGET_PROJECT_NAME);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_POLL_FREQUENCY);
        let _ = conn.execute_batch(ALTER_APP_CONFIG_ADD_NOTIFICATION_PREFS);
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

    pub fn set_triage(&self, key: &str, state: &str) -> AppResult<()> {
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
            Ok(FetchConfig {
                jql_preset,
                jql_custom,
                watched_users: serde_json::from_str(&watched_users_json).unwrap_or_default(),
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
            .ok()
            .unwrap_or((None, None, None, None));
        Ok(result)
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
    /// Returns the number of rows deleted.
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
        let sql = format!("DELETE FROM triage_state WHERE ticket_key IN ({placeholders})");
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
            watched_users: vec!["alice".to_string(), "bob".to_string()],
            last_fetched_at: Some("2024-01-01T00:00:00Z".to_string()),
        };
        db.set_fetch_config(&config)
            .expect("set_fetch_config failed");
        let retrieved = db.get_fetch_config().expect("get_fetch_config failed");
        assert_eq!(retrieved.jql_preset, "custom");
        assert_eq!(retrieved.jql_custom.as_deref(), Some("project = MYPROJ"));
        assert_eq!(retrieved.watched_users, vec!["alice", "bob"]);
        assert_eq!(
            retrieved.last_fetched_at.as_deref(),
            Some("2024-01-01T00:00:00Z")
        );
    }

    #[test]
    fn test_invalid_triage_state_rejected() {
        let db = new_db();
        // SQLite CHECK constraint enforces state IN ('new','seen','ignored','copied')
        let result = db.set_triage("PROJ-1", "invalid_state");
        assert!(
            result.is_err(),
            "invalid state should be rejected by CHECK constraint"
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
        assert!(prefs.notify_new_ticket, "notify_new_ticket should default to true");
        assert!(prefs.notify_status_change, "notify_status_change should default to true");
        assert!(prefs.notify_priority_change, "notify_priority_change should default to true");
        assert!(prefs.notify_new_comment, "notify_new_comment should default to true");
        assert!(!prefs.quiet_hours_enabled, "quiet_hours_enabled should default to false");
        assert_eq!(
            prefs.quiet_days,
            vec!["Mon", "Tue", "Wed", "Thu", "Fri"],
            "default quiet_days should be Mon-Fri"
        );
    }

    #[test]
    fn test_notification_prefs_roundtrip() {
        let db = new_db();
        let prefs = crate::notification_dispatcher::NotificationPrefs {
            notify_new_ticket: false,
            notify_status_change: true,
            notify_priority_change: false,
            notify_new_comment: true,
            quiet_hours_enabled: true,
            quiet_start: Some("20:00".to_string()),
            quiet_end: Some("07:00".to_string()),
            quiet_days: vec!["Mon".to_string(), "Wed".to_string(), "Fri".to_string()],
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
        assert!(retrieved.quiet_hours_enabled);
        assert_eq!(retrieved.quiet_start.as_deref(), Some("20:00"));
        assert_eq!(retrieved.quiet_end.as_deref(), Some("07:00"));
        assert_eq!(retrieved.quiet_days, vec!["Mon", "Wed", "Fri"]);
    }
}
