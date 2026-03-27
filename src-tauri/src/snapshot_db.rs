use crate::error::AppResult;
use chrono::Utc;
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const CREATE_SNAPSHOT_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS snapshot_store (
        ticket_key      TEXT PRIMARY KEY,
        response_json   TEXT NOT NULL,
        content_hash    TEXT NOT NULL,
        last_checked_at TEXT NOT NULL
    );
";

/// Fields to compare for change detection. Each tuple is (`field_name`, `json_pointer`).
const WATCHED_FIELDS: &[(&str, &str)] = &[
    ("status", "/fields/status/name"),
    ("priority", "/fields/priority/name"),
    ("assignee", "/fields/assignee/displayName"),
    ("summary", "/fields/summary"),
    ("description", "/fields/description"),
    ("labels", "/fields/labels"),
    ("components", "/fields/components"),
    ("fix_versions", "/fields/fixVersions"),
];

#[derive(Debug, Clone)]
pub struct StoredSnapshot {
    pub response_json: String,
    pub content_hash: String,
    pub last_checked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldChange {
    pub field: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
}

pub struct SnapshotDb {
    conn: Connection,
}

impl SnapshotDb {
    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(CREATE_SNAPSHOT_TABLE)?;
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(CREATE_SNAPSHOT_TABLE)?;
        Ok(Self { conn })
    }

    /// Store a snapshot for a ticket, computing and storing the content hash.
    /// Returns the computed hash string.
    pub fn store_snapshot(&self, ticket_key: &str, response_json: &str) -> AppResult<String> {
        let hash = compute_hash(response_json)?;
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO snapshot_store (ticket_key, response_json, content_hash, last_checked_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(ticket_key) DO UPDATE SET
               response_json   = excluded.response_json,
               content_hash    = excluded.content_hash,
               last_checked_at = excluded.last_checked_at",
            rusqlite::params![ticket_key, response_json, hash, now],
        )?;
        Ok(hash)
    }

    /// Retrieve a stored snapshot by ticket key. Returns None if not found.
    pub fn get_snapshot(&self, ticket_key: &str) -> AppResult<Option<StoredSnapshot>> {
        let result = self
            .conn
            .query_row(
                "SELECT response_json, content_hash, last_checked_at
                 FROM snapshot_store WHERE ticket_key = ?1",
                rusqlite::params![ticket_key],
                |row| {
                    Ok(StoredSnapshot {
                        response_json: row.get(0)?,
                        content_hash: row.get(1)?,
                        last_checked_at: row.get(2)?,
                    })
                },
            )
            .optional()?;
        Ok(result)
    }

    /// Return the minimum `last_checked_at` timestamp across all stored snapshots.
    /// Returns None when the table is empty.
    pub fn get_watermark(&self) -> AppResult<Option<String>> {
        let result = self
            .conn
            .query_row(
                "SELECT MIN(last_checked_at) FROM snapshot_store",
                [],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()?
            .flatten();
        Ok(result)
    }
}

/// Compare a new response JSON against the stored snapshot for a ticket.
///
/// - If no snapshot exists (first time), stores it and returns an empty vec.
/// - If the hash matches the stored hash, updates `last_checked_at` and returns empty vec.
/// - If the hash differs, runs field-level diff, stores the new snapshot, and returns changes.
pub fn check_for_changes(
    snap_db: &SnapshotDb,
    ticket_key: &str,
    new_json: &str,
) -> AppResult<Vec<FieldChange>> {
    let new_hash = compute_hash(new_json)?;
    match snap_db.get_snapshot(ticket_key)? {
        None => {
            // First time — store and return no changes
            snap_db.store_snapshot(ticket_key, new_json)?;
            Ok(vec![])
        }
        Some(stored) if stored.content_hash == new_hash => {
            // No content change — update watermark timestamp
            snap_db.store_snapshot(ticket_key, new_json)?;
            Ok(vec![])
        }
        Some(stored) => {
            // Content changed — diff and store
            let changes = detect_changes(&stored.response_json, new_json)?;
            snap_db.store_snapshot(ticket_key, new_json)?;
            Ok(changes)
        }
    }
}

/// Compare two JSON blobs (old and new) and return a list of detected field changes.
pub fn detect_changes(old_json: &str, new_json: &str) -> AppResult<Vec<FieldChange>> {
    let old_val: serde_json::Value = serde_json::from_str(old_json)?;
    let new_val: serde_json::Value = serde_json::from_str(new_json)?;

    let mut changes = Vec::new();

    // Compare watched scalar/object fields
    for &(field_name, pointer) in WATCHED_FIELDS {
        let old_str = extract_string(&old_val, pointer);
        let new_str = extract_string(&new_val, pointer);
        if old_str != new_str {
            changes.push(FieldChange {
                field: field_name.to_string(),
                old_value: old_str,
                new_value: new_str,
            });
        }
    }

    // Check comment count delta
    let old_comments = count_array(&old_val, "/fields/comment/comments");
    let new_comments = count_array(&new_val, "/fields/comment/comments");
    if old_comments != new_comments {
        changes.push(FieldChange {
            field: "comment_count".to_string(),
            old_value: Some(old_comments.to_string()),
            new_value: Some(new_comments.to_string()),
        });
    }

    // Check attachment count delta
    let old_attachments = count_array(&old_val, "/fields/attachment");
    let new_attachments = count_array(&new_val, "/fields/attachment");
    if old_attachments != new_attachments {
        changes.push(FieldChange {
            field: "attachment_count".to_string(),
            old_value: Some(old_attachments.to_string()),
            new_value: Some(new_attachments.to_string()),
        });
    }

    // Check worklog count delta
    let old_worklogs = count_array(&old_val, "/fields/worklog/worklogs");
    let new_worklogs = count_array(&new_val, "/fields/worklog/worklogs");
    if old_worklogs != new_worklogs {
        changes.push(FieldChange {
            field: "worklog_count".to_string(),
            old_value: Some(old_worklogs.to_string()),
            new_value: Some(new_worklogs.to_string()),
        });
    }

    Ok(changes)
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/// Compute a stable SHA-256 hash of the JSON blob after stripping volatile fields.
fn compute_hash(response_json: &str) -> AppResult<String> {
    let value: serde_json::Value = serde_json::from_str(response_json)?;
    let stripped = strip_volatile_fields(value);
    let canonical = serde_json::to_string(&stripped)?;
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let result = hasher.finalize();
    Ok(hex::encode(result))
}

/// Remove volatile fields that change frequently without meaningful content change.
fn strip_volatile_fields(v: serde_json::Value) -> serde_json::Value {
    let volatile_keys: &[&str] = &[
        "self",
        "expand",
        "avatarUrls",
        "iconUrl",
        "48x48",
        "32x32",
        "24x24",
        "16x16",
    ];
    let mut v = v;
    strip_recursive(&mut v, volatile_keys);
    v
}

fn strip_recursive(v: &mut serde_json::Value, keys: &[&str]) {
    match v {
        serde_json::Value::Object(map) => {
            for key in keys {
                map.remove(*key);
            }
            for val in map.values_mut() {
                strip_recursive(val, keys);
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr.iter_mut() {
                strip_recursive(item, keys);
            }
        }
        _ => {}
    }
}

/// Extract a value at a JSON pointer path as a string representation.
fn extract_string(value: &serde_json::Value, pointer: &str) -> Option<String> {
    let v = value.pointer(pointer)?;
    match v {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Null => None,
        other => serde_json::to_string(other).ok(),
    }
}

/// Count the number of items in an array at a JSON pointer path.
fn count_array(value: &serde_json::Value, pointer: &str) -> usize {
    value
        .pointer(pointer)
        .and_then(|v| v.as_array())
        .map_or(0, Vec::len)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn new_db() -> SnapshotDb {
        SnapshotDb::open_in_memory().expect("failed to create in-memory SnapshotDb")
    }

    /// Minimal Jira-like JSON blob for a ticket
    fn ticket_json(status: &str, priority: &str, comment_count: usize, attachment_count: usize) -> String {
        let comments: Vec<serde_json::Value> = (0..comment_count)
            .map(|i| serde_json::json!({"id": i, "body": "comment"}))
            .collect();
        let attachments: Vec<serde_json::Value> = (0..attachment_count)
            .map(|i| serde_json::json!({"id": i, "filename": format!("file{i}.txt")}))
            .collect();
        serde_json::json!({
            "id": "10001",
            "key": "PROJ-1",
            "fields": {
                "status": {"name": status},
                "priority": {"name": priority},
                "assignee": {"displayName": "Alice"},
                "summary": "Test ticket",
                "description": "Some description",
                "labels": ["backend"],
                "components": [{"name": "API"}],
                "fixVersions": [],
                "comment": {
                    "comments": comments
                },
                "attachment": attachments,
                "worklog": {
                    "worklogs": []
                }
            }
        })
        .to_string()
    }

    #[test]
    fn test_store_and_get_snapshot() {
        let db = new_db();
        let json = ticket_json("Open", "Medium", 0, 0);
        let hash = db.store_snapshot("PROJ-1", &json).expect("store failed");

        let snap = db
            .get_snapshot("PROJ-1")
            .expect("get failed")
            .expect("snapshot should exist");

        assert_eq!(snap.response_json, json, "stored JSON should match");
        assert!(!snap.content_hash.is_empty(), "hash should be non-empty");
        assert_eq!(snap.content_hash, hash, "stored hash should match returned hash");
        assert!(!snap.last_checked_at.is_empty(), "last_checked_at should be non-empty");
    }

    #[test]
    fn test_no_changes_on_identical_response() {
        let db = new_db();
        let json = ticket_json("Open", "Medium", 1, 0);
        db.store_snapshot("PROJ-1", &json).expect("store failed");

        let changes = check_for_changes(&db, "PROJ-1", &json).expect("check failed");
        assert!(changes.is_empty(), "identical JSON should produce no changes");
    }

    #[test]
    fn test_field_change_detected() {
        let db = new_db();
        let old_json = ticket_json("Open", "Medium", 0, 0);
        db.store_snapshot("PROJ-1", &old_json).expect("store failed");

        // Build new JSON with changed status
        let new_json = ticket_json("In Progress", "Medium", 0, 0);
        let changes = check_for_changes(&db, "PROJ-1", &new_json).expect("check failed");

        let status_change = changes
            .iter()
            .find(|c| c.field == "status")
            .expect("status change should be detected");
        assert_eq!(status_change.old_value.as_deref(), Some("Open"));
        assert_eq!(status_change.new_value.as_deref(), Some("In Progress"));
    }

    #[test]
    fn test_comment_count_change_detected() {
        let db = new_db();
        let old_json = ticket_json("Open", "Medium", 2, 0);
        db.store_snapshot("PROJ-1", &old_json).expect("store failed");

        let new_json = ticket_json("Open", "Medium", 3, 0);
        let changes = check_for_changes(&db, "PROJ-1", &new_json).expect("check failed");

        let comment_change = changes
            .iter()
            .find(|c| c.field == "comment_count")
            .expect("comment_count change should be detected");
        assert_eq!(comment_change.old_value.as_deref(), Some("2"));
        assert_eq!(comment_change.new_value.as_deref(), Some("3"));
    }

    #[test]
    fn test_attachment_count_change_detected() {
        let db = new_db();
        let old_json = ticket_json("Open", "Medium", 0, 1);
        db.store_snapshot("PROJ-1", &old_json).expect("store failed");

        let new_json = ticket_json("Open", "Medium", 0, 2);
        let changes = check_for_changes(&db, "PROJ-1", &new_json).expect("check failed");

        let attach_change = changes
            .iter()
            .find(|c| c.field == "attachment_count")
            .expect("attachment_count change should be detected");
        assert_eq!(attach_change.old_value.as_deref(), Some("1"));
        assert_eq!(attach_change.new_value.as_deref(), Some("2"));
    }

    #[test]
    fn test_volatile_fields_stripped_for_hash() {
        // Two blobs identical except for "self" URL values — hashes should match
        let json1 = serde_json::json!({
            "id": "10001",
            "self": "https://jira.example.com/rest/api/2/issue/10001",
            "fields": {
                "status": {
                    "name": "Open",
                    "self": "https://jira.example.com/rest/api/2/status/1",
                    "iconUrl": "https://jira.example.com/images/icons/status_open.gif"
                },
                "assignee": {
                    "displayName": "Alice",
                    "avatarUrls": {
                        "48x48": "https://jira.example.com/avatar/alice?s=48",
                        "32x32": "https://jira.example.com/avatar/alice?s=32",
                        "24x24": "https://jira.example.com/avatar/alice?s=24",
                        "16x16": "https://jira.example.com/avatar/alice?s=16"
                    }
                }
            }
        })
        .to_string();

        let json2 = serde_json::json!({
            "id": "10001",
            "self": "https://different-url.example.com/rest/api/2/issue/10001",
            "fields": {
                "status": {
                    "name": "Open",
                    "self": "https://different-url.example.com/rest/api/2/status/1",
                    "iconUrl": "https://different-url.example.com/images/icons/status_open.gif"
                },
                "assignee": {
                    "displayName": "Alice",
                    "avatarUrls": {
                        "48x48": "https://different-url.example.com/avatar/alice?s=48",
                        "32x32": "https://different-url.example.com/avatar/alice?s=32",
                        "24x24": "https://different-url.example.com/avatar/alice?s=24",
                        "16x16": "https://different-url.example.com/avatar/alice?s=16"
                    }
                }
            }
        })
        .to_string();

        let hash1 = compute_hash(&json1).expect("hash1 failed");
        let hash2 = compute_hash(&json2).expect("hash2 failed");
        assert_eq!(
            hash1, hash2,
            "blobs differing only in volatile fields should produce identical hashes"
        );
    }

    #[test]
    fn test_watermark_is_minimum() {
        let db = new_db();
        // Insert 3 tickets with explicit timestamps using direct SQL
        db.conn
            .execute(
                "INSERT INTO snapshot_store (ticket_key, response_json, content_hash, last_checked_at)
                 VALUES ('PROJ-1', '{}', 'hash1', '2026-01-01T10:00:00Z')",
                [],
            )
            .expect("insert PROJ-1 failed");
        db.conn
            .execute(
                "INSERT INTO snapshot_store (ticket_key, response_json, content_hash, last_checked_at)
                 VALUES ('PROJ-2', '{}', 'hash2', '2026-01-02T10:00:00Z')",
                [],
            )
            .expect("insert PROJ-2 failed");
        db.conn
            .execute(
                "INSERT INTO snapshot_store (ticket_key, response_json, content_hash, last_checked_at)
                 VALUES ('PROJ-3', '{}', 'hash3', '2026-01-03T10:00:00Z')",
                [],
            )
            .expect("insert PROJ-3 failed");

        let watermark = db.get_watermark().expect("watermark failed").expect("should have watermark");
        assert_eq!(
            watermark, "2026-01-01T10:00:00Z",
            "watermark should be the minimum (earliest) timestamp"
        );
    }

    #[test]
    fn test_watermark_not_advanced_on_no_store() {
        let db = new_db();
        // Store ticket A with a known timestamp
        db.conn
            .execute(
                "INSERT INTO snapshot_store (ticket_key, response_json, content_hash, last_checked_at)
                 VALUES ('PROJ-A', '{}', 'hashA', '2026-01-01T10:00:00Z')",
                [],
            )
            .expect("insert PROJ-A failed");

        // Do NOT store PROJ-B (simulating a failed API call)
        // Watermark should only reflect PROJ-A
        let watermark = db.get_watermark().expect("watermark failed").expect("should have watermark");
        assert_eq!(
            watermark, "2026-01-01T10:00:00Z",
            "watermark should equal PROJ-A's timestamp since PROJ-B was never stored"
        );
    }

    #[test]
    fn test_first_time_ticket_returns_no_changes() {
        let db = new_db();
        let json = ticket_json("Open", "Medium", 0, 0);

        // First call — ticket not in DB yet
        let changes = check_for_changes(&db, "PROJ-NEW", &json).expect("check failed");
        assert!(changes.is_empty(), "first-time ticket should return no changes");

        // Snapshot should now exist
        let snap = db.get_snapshot("PROJ-NEW").expect("get failed");
        assert!(snap.is_some(), "snapshot should exist after first check");
    }

    #[test]
    fn test_get_snapshot_returns_none_for_unknown() {
        let db = new_db();
        let snap = db
            .get_snapshot("PROJ-DOES-NOT-EXIST")
            .expect("get failed");
        assert!(snap.is_none(), "unknown ticket key should return None");
    }
}
