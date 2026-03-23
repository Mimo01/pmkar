use crate::error::AppResult;
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

const ALTER_TRIAGE_ADD_COPIED_KEY: &str =
    "ALTER TABLE triage_state ADD COLUMN copied_key TEXT;";

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
        Ok(Self { conn })
    }

    pub fn get_all_triage(&self) -> AppResult<HashMap<String, (String, Option<String>)>> {
        let mut stmt = self.conn.prepare(
            "SELECT ticket_key, state, copied_key FROM triage_state",
        )?;
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
        let watched_json = serde_json::to_string(&config.watched_users)
            .unwrap_or_else(|_| "[]".to_string());
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
        let lang: Option<String> = self.conn.query_row(
            "SELECT language FROM app_config WHERE id = 1",
            [],
            |row| row.get(0),
        ).ok();
        Ok(lang)
    }

    pub fn set_app_language(&self, language: &str) -> AppResult<()> {
        self.conn.execute(
            "UPDATE app_config SET language = ?1 WHERE id = 1",
            [language],
        )?;
        Ok(())
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
