use crate::error::AppResult;
use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

const MAX_RESPONSE_BODY_BYTES: usize = 10_240; // 10KB

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub id: Option<i64>,
    pub timestamp: String,            // ISO 8601 UTC
    pub method: String,               // GET, POST, etc.
    pub url: String,
    pub headers: String,              // JSON string, Authorization = "[REDACTED]"
    pub status_code: Option<u16>,     // None if request never completed
    pub response_body: Option<String>, // Truncated at 10KB
}

pub struct AuditDb {
    conn: Connection,
}

const CREATE_TABLE_SQL: &str = "CREATE TABLE IF NOT EXISTS audit_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp     TEXT NOT NULL,
    method        TEXT NOT NULL,
    url           TEXT NOT NULL,
    headers       TEXT NOT NULL,
    status_code   INTEGER,
    response_body TEXT,
    created_at    INTEGER DEFAULT (strftime('%s','now'))
);";

impl AuditDb {
    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(CREATE_TABLE_SQL)?;
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(CREATE_TABLE_SQL)?;
        Ok(Self { conn })
    }

    pub fn insert(&self, entry: &AuditEntry) -> AppResult<()> {
        let body = entry.response_body.as_ref().map(|b| {
            if b.len() > MAX_RESPONSE_BODY_BYTES {
                b[..MAX_RESPONSE_BODY_BYTES].to_string()
            } else {
                b.clone()
            }
        });
        self.conn.execute(
            "INSERT INTO audit_log (timestamp, method, url, headers, status_code, response_body)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                entry.timestamp,
                entry.method,
                entry.url,
                entry.headers,
                entry.status_code,
                body,
            ],
        )?;
        Ok(())
    }

    pub fn get_all(&self) -> AppResult<Vec<AuditEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, timestamp, method, url, headers, status_code, response_body
             FROM audit_log ORDER BY id DESC",
        )?;
        let entries = stmt
            .query_map([], |row| {
                Ok(AuditEntry {
                    id: Some(row.get(0)?),
                    timestamp: row.get(1)?,
                    method: row.get(2)?,
                    url: row.get(3)?,
                    headers: row.get(4)?,
                    status_code: row.get(5)?,
                    response_body: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(entries)
    }

    pub fn clear_logs(&self) -> AppResult<()> {
        self.conn.execute("DELETE FROM audit_log", [])?;
        Ok(())
    }

    pub fn count(&self) -> AppResult<i64> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM audit_log",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }
}

pub struct AuditMiddleware {
    pub db: Arc<Mutex<AuditDb>>,
}

#[async_trait::async_trait]
impl reqwest_middleware::Middleware for AuditMiddleware {
    async fn handle(
        &self,
        req: reqwest::Request,
        extensions: &mut http::Extensions,
        next: reqwest_middleware::Next<'_>,
    ) -> reqwest_middleware::Result<reqwest::Response> {
        let method = req.method().to_string();
        let url = req.url().to_string();
        let timestamp = Utc::now().to_rfc3339();

        // REDACT Authorization header BEFORE any logging
        let headers_redacted = {
            let mut h = req.headers().clone();
            if h.contains_key("authorization") {
                h.insert("authorization", "[REDACTED]".parse().unwrap());
            }
            format!("{:?}", h)
        };

        let result = next.run(req, extensions).await;

        match &result {
            Ok(resp) => {
                let status = resp.status().as_u16();
                let entry = AuditEntry {
                    id: None,
                    timestamp,
                    method,
                    url,
                    headers: headers_redacted,
                    status_code: Some(status),
                    response_body: None, // Response body read separately if needed
                };
                if let Ok(db) = self.db.lock() {
                    let _ = db.insert(&entry); // Audit failure must not break the request
                }
            }
            Err(_) => {
                let entry = AuditEntry {
                    id: None,
                    timestamp,
                    method,
                    url,
                    headers: headers_redacted,
                    status_code: None,
                    response_body: None,
                };
                if let Ok(db) = self.db.lock() {
                    let _ = db.insert(&entry);
                }
            }
        }

        result
    }
}

pub fn build_audited_client(db: Arc<Mutex<AuditDb>>) -> reqwest_middleware::ClientWithMiddleware {
    reqwest_middleware::ClientBuilder::new(reqwest::Client::new())
        .with(AuditMiddleware { db })
        .build()
}
