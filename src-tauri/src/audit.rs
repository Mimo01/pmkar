use crate::error::AppResult;
use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use urlencoding;

const MAX_RESPONSE_BODY_BYTES: usize = 102_400; // 100KB

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEntry {
    pub id: Option<i64>,
    pub timestamp: String, // ISO 8601 UTC
    pub method: String,    // GET, POST, etc.
    pub url: String,
    pub headers: String,          // JSON string, Authorization = "[REDACTED]"
    pub status_code: Option<u16>, // None if request never completed
    pub response_body: Option<String>, // Truncated at 100 KB (MAX_RESPONSE_BODY_BYTES)
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
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM audit_log", [], |row| row.get(0))?;
        Ok(count)
    }

    /// Delete entries older than `max_age_days` days. Returns number of rows deleted.
    pub fn prune_old_entries(&self, max_age_days: i64) -> AppResult<u64> {
        let rows = self.conn.execute(
            "DELETE FROM audit_log WHERE created_at < strftime('%s','now') - (?1 * 86400)",
            rusqlite::params![max_age_days],
        )?;
        Ok(rows as u64)
    }

    /// Nullify response bodies older than `max_age_days` days. Returns number of rows updated.
    pub fn prune_response_bodies(&self, max_age_days: i64) -> AppResult<u64> {
        let rows = self.conn.execute(
            "UPDATE audit_log SET response_body = NULL WHERE response_body IS NOT NULL AND created_at < strftime('%s','now') - (?1 * 86400)",
            rusqlite::params![max_age_days],
        )?;
        Ok(rows as u64)
    }

    /// Run VACUUM to reclaim disk space after pruning.
    pub fn vacuum(&self) -> AppResult<()> {
        self.conn.execute_batch("VACUUM")?;
        Ok(())
    }

    /// Return a page of entries ordered by id DESC with LIMIT/OFFSET.
    pub fn get_page(&self, offset: i64, limit: i64) -> AppResult<Vec<AuditEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, timestamp, method, url, headers, status_code, response_body
             FROM audit_log ORDER BY id DESC LIMIT ?1 OFFSET ?2",
        )?;
        let entries = stmt
            .query_map(rusqlite::params![limit, offset], |row| {
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
}

#[cfg(test)]
mod tests {
    use super::*;

    fn new_db() -> AuditDb {
        AuditDb::open_in_memory().expect("failed to create in-memory AuditDb")
    }

    fn make_entry(method: &str, url: &str, status: u16) -> AuditEntry {
        AuditEntry {
            id: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            method: method.to_string(),
            url: url.to_string(),
            headers: r#"{"content-type":"application/json"}"#.to_string(),
            status_code: Some(status),
            response_body: Some("{}".to_string()),
        }
    }

    #[test]
    fn test_new_creates_in_memory_db() {
        // Should not panic — schema creation succeeds
        let _db = new_db();
    }

    #[test]
    fn test_insert_and_get_entries() {
        let db = new_db();
        let entry = make_entry("GET", "https://jira.example.com/rest/api/2/myself", 200);
        db.insert(&entry).expect("insert failed");
        let entries = db.get_all().expect("get_all failed");
        assert_eq!(entries.len(), 1);
        let stored = &entries[0];
        assert_eq!(stored.method, "GET");
        assert_eq!(stored.url, "https://jira.example.com/rest/api/2/myself");
        assert_eq!(stored.status_code, Some(200));
    }

    #[test]
    fn test_get_count() {
        let db = new_db();
        for i in 0..5u16 {
            db.insert(&make_entry("GET", &format!("https://example.com/{i}"), 200))
                .expect("insert failed");
        }
        assert_eq!(db.count().expect("count failed"), 5);
    }

    #[test]
    fn test_entries_ordered_by_id_desc() {
        let db = new_db();
        // Insert entries with distinct URLs so we can check ordering
        db.insert(&make_entry("GET", "https://example.com/first", 200))
            .expect("insert failed");
        db.insert(&make_entry("POST", "https://example.com/second", 201))
            .expect("insert failed");
        db.insert(&make_entry("GET", "https://example.com/third", 200))
            .expect("insert failed");
        let entries = db.get_all().expect("get_all failed");
        assert_eq!(entries.len(), 3);
        // get_all returns ORDER BY id DESC — most-recent first
        assert_eq!(entries[0].url, "https://example.com/third");
        assert_eq!(entries[2].url, "https://example.com/first");
    }

    #[test]
    fn test_prune_old_entries() {
        let db = new_db();
        // Insert a recent entry
        db.insert(&make_entry("GET", "https://example.com/recent", 200))
            .expect("insert failed");
        // Insert and back-date an entry to 31 days ago
        db.insert(&make_entry("GET", "https://example.com/old", 200))
            .expect("insert failed");
        db.conn
            .execute(
                "UPDATE audit_log SET created_at = strftime('%s','now') - (31 * 86400) WHERE url = 'https://example.com/old'",
                [],
            )
            .expect("backdating failed");

        let deleted = db.prune_old_entries(30).expect("prune failed");
        assert_eq!(deleted, 1, "expected 1 old entry deleted");

        let entries = db.get_all().expect("get_all failed");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].url, "https://example.com/recent");
    }

    #[test]
    fn test_prune_response_bodies() {
        let db = new_db();
        // Recent entry — body should be kept
        db.insert(&make_entry("GET", "https://example.com/recent", 200))
            .expect("insert failed");
        // Old entry — body should be nullified
        db.insert(&make_entry("GET", "https://example.com/old", 200))
            .expect("insert failed");
        db.conn
            .execute(
                "UPDATE audit_log SET created_at = strftime('%s','now') - (8 * 86400) WHERE url = 'https://example.com/old'",
                [],
            )
            .expect("backdating failed");

        let updated = db.prune_response_bodies(7).expect("prune_response_bodies failed");
        assert_eq!(updated, 1, "expected 1 response body nullified");

        let entries = db.get_all().expect("get_all failed");
        // Both entries still exist
        assert_eq!(entries.len(), 2);
        // The old one should have no body
        let old = entries.iter().find(|e| e.url == "https://example.com/old").unwrap();
        assert!(old.response_body.is_none(), "old entry's response_body should be None");
        // The recent one should still have a body
        let recent = entries.iter().find(|e| e.url == "https://example.com/recent").unwrap();
        assert!(recent.response_body.is_some(), "recent entry's response_body should still be Some");
    }

    #[test]
    fn test_get_page() {
        let db = new_db();
        for i in 0..10u16 {
            db.insert(&make_entry("GET", &format!("https://example.com/{i}"), 200))
                .expect("insert failed");
        }
        let page1 = db.get_page(0, 5).expect("get_page failed");
        assert_eq!(page1.len(), 5, "first page should have 5 entries");

        let page2 = db.get_page(5, 5).expect("get_page failed");
        assert_eq!(page2.len(), 5, "second page should have 5 entries");

        let all = db.get_page(0, 20).expect("get_page failed");
        assert_eq!(all.len(), 10, "oversized limit should return all 10 entries");

        // Pages should not overlap
        let ids1: Vec<_> = page1.iter().map(|e| e.id).collect();
        let ids2: Vec<_> = page2.iter().map(|e| e.id).collect();
        for id in &ids1 {
            assert!(!ids2.contains(id), "page1 and page2 should not overlap");
        }
    }

    #[test]
    fn test_vacuum_succeeds() {
        let db = new_db();
        db.vacuum().expect("vacuum should succeed on empty db");

        db.insert(&make_entry("GET", "https://example.com/", 200))
            .expect("insert failed");
        db.vacuum().expect("vacuum should succeed on non-empty db");
    }

    #[test]
    fn test_authorization_header_not_stored_plaintext() {
        let db = new_db();
        // Simulate what AuditMiddleware does: redact Authorization before inserting
        let headers_json = r#"{"authorization":"[REDACTED]","content-type":"application/json"}"#;
        let entry = AuditEntry {
            id: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            method: "GET".to_string(),
            url: "https://example.com/api".to_string(),
            headers: headers_json.to_string(),
            status_code: Some(200),
            response_body: None,
        };
        db.insert(&entry).expect("insert failed");
        let entries = db.get_all().expect("get_all failed");
        assert_eq!(entries.len(), 1);
        let stored_headers = &entries[0].headers;
        // The stored headers must contain [REDACTED], never a real token
        assert!(
            stored_headers.contains("[REDACTED]"),
            "stored headers should have [REDACTED] in place of real auth value"
        );
        assert!(
            !stored_headers.to_lowercase().contains("bearer"),
            "stored headers must not contain a real Bearer token"
        );
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
        // Decode percent-encoding so URLs are human-readable in the audit log
        let url = urlencoding::decode(req.url().as_str())
            .map_or_else(|_| req.url().to_string(), std::borrow::Cow::into_owned);
        let timestamp = Utc::now().to_rfc3339();

        // REDACT Authorization header BEFORE any logging
        let headers_redacted = {
            let mut h = req.headers().clone();
            if h.contains_key("authorization") {
                h.insert("authorization", "[REDACTED]".parse().unwrap());
            }
            let map: std::collections::HashMap<String, String> = h
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("[binary]").to_string()))
                .collect();
            serde_json::to_string(&map).unwrap_or_else(|_| format!("{h:?}"))
        };

        let result = next.run(req, extensions).await;

        match result {
            Ok(resp) => {
                let status = resp.status().as_u16();
                // Capture response metadata before consuming the body
                let resp_status = resp.status();
                let resp_version = resp.version();
                let resp_headers = resp.headers().clone();

                // Read the body bytes — this consumes the response, so we must reconstruct it
                let body_bytes = resp.bytes().await.unwrap_or_default();

                // Truncate for the audit log, then store as UTF-8 string
                let truncated = &body_bytes[..body_bytes.len().min(MAX_RESPONSE_BODY_BYTES)];
                let response_body = if truncated.is_empty() {
                    None
                } else {
                    Some(String::from_utf8_lossy(truncated).into_owned())
                };

                let entry = AuditEntry {
                    id: None,
                    timestamp,
                    method,
                    url,
                    headers: headers_redacted,
                    status_code: Some(status),
                    response_body,
                };
                if let Ok(db) = self.db.lock() {
                    let _ = db.insert(&entry); // Audit failure must not break the request
                }

                // Reconstruct a reqwest::Response from the buffered bytes so the
                // rest of the call chain still receives a complete response
                let mut builder = http::Response::builder()
                    .status(resp_status)
                    .version(resp_version);
                if let Some(headers_mut) = builder.headers_mut() {
                    *headers_mut = resp_headers;
                }
                let http_resp = builder
                    .body(body_bytes)
                    .expect("failed to reconstruct http response");
                Ok(reqwest::Response::from(http_resp))
            }
            Err(e) => {
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
                Err(e)
            }
        }
    }
}

pub fn build_audited_client(db: Arc<Mutex<AuditDb>>) -> reqwest_middleware::ClientWithMiddleware {
    reqwest_middleware::ClientBuilder::new(reqwest::Client::new())
        .with(AuditMiddleware { db })
        .build()
}
