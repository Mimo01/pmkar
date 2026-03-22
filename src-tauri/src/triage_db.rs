use crate::error::AppResult;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchConfig {
    pub jql_preset: String,
    pub jql_custom: Option<String>,
    pub watched_users: Vec<String>,
    pub last_fetched_at: Option<String>,
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

const CREATE_FETCH_CONFIG_SQL: &str = "CREATE TABLE IF NOT EXISTS fetch_config (
    id              INTEGER PRIMARY KEY CHECK(id = 1),
    jql_preset      TEXT NOT NULL DEFAULT 'assigned',
    jql_custom      TEXT,
    watched_users   TEXT NOT NULL DEFAULT '[]',
    last_fetched_at TEXT
);";

impl TriageDb {
    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(CREATE_TRIAGE_STATE_SQL)?;
        conn.execute_batch(CREATE_FETCH_CONFIG_SQL)?;
        conn.execute("INSERT OR IGNORE INTO fetch_config(id) VALUES(1)", [])?;
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(CREATE_TRIAGE_STATE_SQL)?;
        conn.execute_batch(CREATE_FETCH_CONFIG_SQL)?;
        conn.execute("INSERT OR IGNORE INTO fetch_config(id) VALUES(1)", [])?;
        Ok(Self { conn })
    }

    pub fn get_all_triage(&self) -> AppResult<HashMap<String, String>> {
        let mut stmt = self.conn.prepare(
            "SELECT ticket_key, state FROM triage_state",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<Result<HashMap<String, String>, _>>()?;
        Ok(rows)
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
}
