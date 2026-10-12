//! Durable custom-groups data layer (`groups.db`).
//!
//! Rules (scope, names, palette) live at the top; storage follows.

use crate::error::{AppError, AppResult};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;
use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

/// Palette token names stored in the `color` column (D-05, D-06).
pub const GROUP_COLORS: [&str; 8] = [
    "blue", "teal", "green", "amber", "orange", "purple", "pink", "slate",
];

/// Maximum group name length in chars, counted after NFC (D-14).
pub const MAX_GROUP_NAME_CHARS: usize = 40;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GroupErrorCode {
    Empty,
    TooLong,
    Duplicate,
    Reserved,
    NoScope,
    NotFound,
    InvalidColor,
    InvalidIssueKey,
    InvalidTicket,
    Internal,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct GroupError {
    pub code: GroupErrorCode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl GroupError {
    pub fn new(code: GroupErrorCode) -> Self {
        Self {
            code,
            message: None,
        }
    }

    fn internal(msg: String) -> Self {
        Self {
            code: GroupErrorCode::Internal,
            message: Some(msg),
        }
    }
}

impl std::fmt::Display for GroupError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match &self.message {
            Some(m) => write!(f, "{:?}: {m}", self.code),
            None => write!(f, "{:?}", self.code),
        }
    }
}

impl std::error::Error for GroupError {}

impl From<GroupErrorCode> for GroupError {
    fn from(code: GroupErrorCode) -> Self {
        Self::new(code)
    }
}

impl From<AppError> for GroupError {
    fn from(e: AppError) -> Self {
        Self::internal(e.to_string())
    }
}

impl From<rusqlite::Error> for GroupError {
    fn from(e: rusqlite::Error) -> Self {
        Self::internal(e.to_string())
    }
}

impl From<serde_json::Error> for GroupError {
    fn from(e: serde_json::Error) -> Self {
        Self::internal(e.to_string())
    }
}

pub type GroupResult<T> = Result<T, GroupError>;

/// Normalise a source base URL into a scope key (D-02).
///
/// Lower-cases scheme/host, drops default port, userinfo, query, fragment and
/// trailing slash; keeps a non-root context path. Empty input yields `None`.
pub fn normalize_scope(base_url: &str) -> Option<String> {
    let trimmed = base_url.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(url) = url::Url::parse(trimmed) {
        if let Some(host) = url.host_str() {
            let mut out = format!("{}://{}", url.scheme(), host);
            if let Some(port) = url.port() {
                out = format!("{out}:{port}");
            }
            out.push_str(url.path().trim_end_matches('/'));
            return Some(out.to_lowercase());
        }
    }
    let fallback = trimmed.to_lowercase();
    let fallback = fallback.trim_end_matches('/');
    if fallback.is_empty() {
        None
    } else {
        Some(fallback.to_string())
    }
}

/// Trim and NFC-normalise a raw group name (D-14).
///
/// Trim set is Unicode `White_Space` plus U+FEFF, identical to the TS mirror.
pub fn normalize_group_name(raw: &str) -> String {
    raw.trim_matches(|c: char| c.is_whitespace() || c == '\u{FEFF}')
        .nfc()
        .collect()
}

/// Format characters ignored in the comparison key (identical list in TS).
fn is_ignored_format_char(c: char) -> bool {
    matches!(
        c,
        '\u{200B}'..='\u{200F}' | '\u{2060}'..='\u{2064}' | '\u{00AD}' | '\u{FEFF}'
    )
}

/// Comparison key: NFD, strip combining marks and format characters, NFC,
/// lower-case (D-17).
///
/// Letters without a decomposition (e.g. `ł`, `ß`) are only lower-cased.
pub fn group_name_key(display: &str) -> String {
    let stripped: String = display
        .nfd()
        .filter(|c| !is_combining_mark(*c) && !is_ignored_format_char(*c))
        .collect();
    stripped.nfc().collect::<String>().to_lowercase()
}

/// Core-tab labels that may not be used as group names (D-18), read from the
/// real locale files so they never drift.
fn reserved_name_keys() -> &'static [String] {
    static KEYS: OnceLock<Vec<String>> = OnceLock::new();
    KEYS.get_or_init(|| {
        let sources = [
            include_str!("../../src/i18n/locales/en.json"),
            include_str!("../../src/i18n/locales/sk.json"),
        ];
        let mut keys = Vec::new();
        for src in sources {
            let map: HashMap<String, serde_json::Value> =
                serde_json::from_str(src).expect("locale file must be valid JSON");
            for k in ["nav.new", "nav.notMine", "nav.linked"] {
                let label = map
                    .get(k)
                    .and_then(|v| v.as_str())
                    .unwrap_or_else(|| panic!("locale key {k} missing"));
                keys.push(group_name_key(&normalize_group_name(label)));
            }
        }
        keys
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidGroupName {
    pub display: String,
    pub key: String,
}

/// Authoritative name validation. Precedence: empty, too long, reserved, duplicate.
pub fn validate_group_name<'a>(
    raw: &str,
    existing_keys: impl IntoIterator<Item = &'a str>,
) -> Result<ValidGroupName, GroupErrorCode> {
    let display = normalize_group_name(raw);
    if display.is_empty() {
        return Err(GroupErrorCode::Empty);
    }
    if display.chars().count() > MAX_GROUP_NAME_CHARS {
        return Err(GroupErrorCode::TooLong);
    }
    let key = group_name_key(&display);
    if key.is_empty() {
        return Err(GroupErrorCode::Empty);
    }
    if reserved_name_keys().contains(&key) {
        return Err(GroupErrorCode::Reserved);
    }
    if existing_keys.into_iter().any(|k| k == key) {
        return Err(GroupErrorCode::Duplicate);
    }
    Ok(ValidGroupName { display, key })
}

pub fn is_group_color(value: &str) -> bool {
    GROUP_COLORS.contains(&value)
}

/// Least-used palette token, ties broken by palette order (D-08).
pub fn pick_default_color<'a>(used: impl IntoIterator<Item = &'a str>) -> &'static str {
    let mut counts = [0usize; GROUP_COLORS.len()];
    for u in used {
        if let Some(i) = GROUP_COLORS.iter().position(|c| *c == u) {
            counts[i] += 1;
        }
    }
    let mut best = 0;
    for (i, c) in counts.iter().enumerate() {
        if *c < counts[best] {
            best = i;
        }
    }
    GROUP_COLORS[best]
}

const CREATE_GROUPS_SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS custom_group (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        scope      TEXT NOT NULL,
        name       TEXT NOT NULL,
        name_key   TEXT NOT NULL,
        color      TEXT NOT NULL,
        position   INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(scope, name_key)
    );
    CREATE INDEX IF NOT EXISTS idx_custom_group_scope_pos ON custom_group(scope, position);
    CREATE TABLE IF NOT EXISTS issue_snapshot (
        scope       TEXT NOT NULL,
        issue_key   TEXT NOT NULL,
        ticket_json TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        PRIMARY KEY(scope, issue_key)
    );
    CREATE TABLE IF NOT EXISTS group_member (
        group_id  INTEGER NOT NULL REFERENCES custom_group(id) ON DELETE CASCADE,
        scope     TEXT NOT NULL,
        issue_key TEXT NOT NULL,
        added_at  TEXT NOT NULL,
        PRIMARY KEY(group_id, issue_key),
        FOREIGN KEY(scope, issue_key) REFERENCES issue_snapshot(scope, issue_key)
    );
    CREATE INDEX IF NOT EXISTS idx_group_member_issue ON group_member(scope, issue_key);
";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub position: i64,
    pub created_at: String,
    pub member_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GroupMembership {
    pub group_id: i64,
    pub issue_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GroupMember {
    pub issue_key: String,
    pub ticket_json: String,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NewMember {
    pub issue_key: String,
    pub ticket_json: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MoveDirection {
    Left,
    Right,
}

/// Shape check for a Jira issue key: `<letter><alnum/_>*-<digits>`.
fn is_valid_issue_key(key: &str) -> bool {
    if key.is_empty() || key.len() > 255 {
        return false;
    }
    let Some((project, num)) = key.rsplit_once('-') else {
        return false;
    };
    let mut chars = project.chars();
    let first_ok = chars.next().is_some_and(|c| c.is_ascii_alphabetic());
    first_ok
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
        && !num.is_empty()
        && num.chars().all(|c| c.is_ascii_digit())
}

fn row_to_group(row: &rusqlite::Row<'_>) -> rusqlite::Result<Group> {
    Ok(Group {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        position: row.get(3)?,
        created_at: row.get(4)?,
        member_count: row.get(5)?,
    })
}

const SELECT_GROUP: &str = "SELECT g.id, g.name, g.color, g.position, g.created_at,
        (SELECT COUNT(*) FROM group_member m WHERE m.group_id = g.id)
    FROM custom_group g";

pub struct GroupsDb {
    conn: Connection,
}

impl GroupsDb {
    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        conn.execute_batch(CREATE_GROUPS_SCHEMA)?;
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        conn.execute_batch(CREATE_GROUPS_SCHEMA)?;
        Ok(Self { conn })
    }

    pub fn list_groups(&self, scope: &str) -> GroupResult<Vec<Group>> {
        let mut stmt = self.conn.prepare(&format!(
            "{SELECT_GROUP} WHERE g.scope = ?1 ORDER BY g.position, g.id"
        ))?;
        let rows = stmt.query_map(params![scope], row_to_group)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn list_memberships(&self, scope: &str) -> GroupResult<Vec<GroupMembership>> {
        let mut stmt = self.conn.prepare(
            "SELECT group_id, issue_key FROM group_member WHERE scope = ?1
             ORDER BY group_id, issue_key",
        )?;
        let rows = stmt.query_map(params![scope], |r| {
            Ok(GroupMembership {
                group_id: r.get(0)?,
                issue_key: r.get(1)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn get_group_members(&self, scope: &str, group_id: i64) -> GroupResult<Vec<GroupMember>> {
        self.ensure_group_in_scope(scope, group_id)?;
        let mut stmt = self.conn.prepare(
            "SELECT m.issue_key, s.ticket_json, m.added_at
             FROM group_member m
             JOIN issue_snapshot s ON s.scope = m.scope AND s.issue_key = m.issue_key
             WHERE m.scope = ?1 AND m.group_id = ?2
             ORDER BY m.added_at, m.issue_key",
        )?;
        let rows = stmt.query_map(params![scope, group_id], |r| {
            Ok(GroupMember {
                issue_key: r.get(0)?,
                ticket_json: r.get(1)?,
                added_at: r.get(2)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    fn group_keys(&self, scope: &str, exclude_id: Option<i64>) -> GroupResult<Vec<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT name_key FROM custom_group WHERE scope = ?1 AND id != ?2")?;
        let rows = stmt.query_map(params![scope, exclude_id.unwrap_or(-1)], |r| r.get(0))?;
        Ok(rows.collect::<Result<Vec<String>, _>>()?)
    }

    fn get_group(&self, scope: &str, group_id: i64) -> GroupResult<Group> {
        self.conn
            .query_row(
                &format!("{SELECT_GROUP} WHERE g.scope = ?1 AND g.id = ?2"),
                params![scope, group_id],
                row_to_group,
            )
            .optional()?
            .ok_or_else(|| GroupError::new(GroupErrorCode::NotFound))
    }

    fn ensure_group_in_scope(&self, scope: &str, group_id: i64) -> GroupResult<()> {
        let found: Option<i64> = self
            .conn
            .query_row(
                "SELECT id FROM custom_group WHERE scope = ?1 AND id = ?2",
                params![scope, group_id],
                |r| r.get(0),
            )
            .optional()?;
        found
            .map(|_| ())
            .ok_or_else(|| GroupError::new(GroupErrorCode::NotFound))
    }

    fn map_write_error(e: rusqlite::Error) -> GroupError {
        if matches!(&e, rusqlite::Error::SqliteFailure(f, _)
            if f.code == rusqlite::ErrorCode::ConstraintViolation)
        {
            GroupError::new(GroupErrorCode::Duplicate)
        } else {
            e.into()
        }
    }

    pub fn create_group(
        &self,
        scope: &str,
        raw_name: &str,
        color: Option<&str>,
    ) -> GroupResult<Group> {
        let keys = self.group_keys(scope, None)?;
        let valid = validate_group_name(raw_name, keys.iter().map(String::as_str))
            .map_err(GroupError::new)?;
        let color: String = if let Some(c) = color {
            if !is_group_color(c) {
                return Err(GroupError::new(GroupErrorCode::InvalidColor));
            }
            c.to_string()
        } else {
            let mut stmt = self
                .conn
                .prepare("SELECT color FROM custom_group WHERE scope = ?1")?;
            let used = stmt
                .query_map(params![scope], |r| r.get::<_, String>(0))?
                .collect::<Result<Vec<_>, _>>()?;
            pick_default_color(used.iter().map(String::as_str)).to_string()
        };
        let position: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM custom_group WHERE scope = ?1",
            params![scope],
            |r| r.get(0),
        )?;
        let now = chrono::Utc::now().to_rfc3339();
        self.conn
            .execute(
                "INSERT INTO custom_group (scope, name, name_key, color, position, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![scope, valid.display, valid.key, color, position, now],
            )
            .map_err(Self::map_write_error)?;
        self.get_group(scope, self.conn.last_insert_rowid())
    }

    pub fn rename_group(&self, scope: &str, group_id: i64, raw_name: &str) -> GroupResult<Group> {
        self.ensure_group_in_scope(scope, group_id)?;
        let keys = self.group_keys(scope, Some(group_id))?;
        let valid = validate_group_name(raw_name, keys.iter().map(String::as_str))
            .map_err(GroupError::new)?;
        self.conn
            .execute(
                "UPDATE custom_group SET name = ?1, name_key = ?2 WHERE scope = ?3 AND id = ?4",
                params![valid.display, valid.key, scope, group_id],
            )
            .map_err(Self::map_write_error)?;
        self.get_group(scope, group_id)
    }

    pub fn set_group_color(&self, scope: &str, group_id: i64, color: &str) -> GroupResult<Group> {
        if !is_group_color(color) {
            return Err(GroupError::new(GroupErrorCode::InvalidColor));
        }
        self.ensure_group_in_scope(scope, group_id)?;
        self.conn.execute(
            "UPDATE custom_group SET color = ?1 WHERE scope = ?2 AND id = ?3",
            params![color, scope, group_id],
        )?;
        self.get_group(scope, group_id)
    }

    pub fn move_group(
        &self,
        scope: &str,
        group_id: i64,
        direction: MoveDirection,
    ) -> GroupResult<Vec<Group>> {
        self.ensure_group_in_scope(scope, group_id)?;
        let tx = self.conn.unchecked_transaction()?;
        let ids: Vec<i64> = {
            let mut stmt =
                tx.prepare("SELECT id FROM custom_group WHERE scope = ?1 ORDER BY position, id")?;
            let rows = stmt.query_map(params![scope], |r| r.get(0))?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        let idx = ids
            .iter()
            .position(|id| *id == group_id)
            .ok_or_else(|| GroupError::new(GroupErrorCode::NotFound))?;
        let neighbour = match direction {
            MoveDirection::Left => idx.checked_sub(1),
            MoveDirection::Right => Some(idx + 1).filter(|n| *n < ids.len()),
        };
        if let Some(n) = neighbour {
            // Renumber densely with the two entries swapped; robust to position gaps.
            let mut order = ids;
            order.swap(idx, n);
            for (pos, id) in order.iter().enumerate() {
                tx.execute(
                    "UPDATE custom_group SET position = ?1 WHERE scope = ?2 AND id = ?3",
                    params![i64::try_from(pos).unwrap_or(i64::MAX), scope, id],
                )?;
            }
        }
        tx.commit()?;
        self.list_groups(scope)
    }

    pub fn delete_group(&self, scope: &str, group_id: i64) -> GroupResult<()> {
        self.ensure_group_in_scope(scope, group_id)?;
        let tx = self.conn.unchecked_transaction()?;
        tx.execute(
            "DELETE FROM custom_group WHERE scope = ?1 AND id = ?2",
            params![scope, group_id],
        )?;
        Self::gc_snapshots(&tx, scope)?;
        tx.commit()?;
        Ok(())
    }

    /// Atomic bulk add (D-21): all items are validated first, then written in
    /// one transaction. Returns the number of newly created memberships.
    pub fn add_members(
        &self,
        scope: &str,
        group_id: i64,
        items: &[NewMember],
    ) -> GroupResult<usize> {
        self.ensure_group_in_scope(scope, group_id)?;
        for item in items {
            if !is_valid_issue_key(&item.issue_key) {
                return Err(GroupError::new(GroupErrorCode::InvalidIssueKey));
            }
            match serde_json::from_str::<serde_json::Value>(&item.ticket_json) {
                Ok(serde_json::Value::Object(_)) => {}
                _ => return Err(GroupError::new(GroupErrorCode::InvalidTicket)),
            }
        }
        let now = chrono::Utc::now().to_rfc3339();
        let tx = self.conn.unchecked_transaction()?;
        let mut added = 0usize;
        for item in items {
            tx.execute(
                "INSERT INTO issue_snapshot (scope, issue_key, ticket_json, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(scope, issue_key) DO UPDATE SET
                   ticket_json = excluded.ticket_json, updated_at = excluded.updated_at",
                params![scope, item.issue_key, item.ticket_json, now],
            )?;
            added += tx.execute(
                "INSERT OR IGNORE INTO group_member (group_id, scope, issue_key, added_at)
                 VALUES (?1, ?2, ?3, ?4)",
                params![group_id, scope, item.issue_key, now],
            )?;
        }
        tx.commit()?;
        Ok(added)
    }

    pub fn remove_members(
        &self,
        scope: &str,
        group_id: i64,
        issue_keys: &[String],
    ) -> GroupResult<usize> {
        self.ensure_group_in_scope(scope, group_id)?;
        let tx = self.conn.unchecked_transaction()?;
        let mut removed = 0usize;
        for key in issue_keys {
            removed += tx.execute(
                "DELETE FROM group_member WHERE scope = ?1 AND group_id = ?2 AND issue_key = ?3",
                params![scope, group_id, key],
            )?;
        }
        Self::gc_snapshots(&tx, scope)?;
        tx.commit()?;
        Ok(removed)
    }

    /// Remove snapshots no membership references (D-20).
    fn gc_snapshots(tx: &rusqlite::Transaction<'_>, scope: &str) -> GroupResult<()> {
        tx.execute(
            "DELETE FROM issue_snapshot WHERE scope = ?1 AND NOT EXISTS (
                 SELECT 1 FROM group_member m
                 WHERE m.scope = issue_snapshot.scope AND m.issue_key = issue_snapshot.issue_key)",
            params![scope],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(raw: &str, existing: &[&str]) -> Result<ValidGroupName, GroupErrorCode> {
        let keys: Vec<String> = existing
            .iter()
            .map(|e| group_name_key(&normalize_group_name(e)))
            .collect();
        validate_group_name(raw, keys.iter().map(String::as_str))
    }

    #[test]
    fn scope_rules() {
        assert_eq!(
            normalize_scope("HTTPS://Jira.Example.com/").as_deref(),
            Some("https://jira.example.com")
        );
        assert_eq!(
            normalize_scope("https://j.com:443/jira/").as_deref(),
            Some("https://j.com/jira")
        );
        assert_eq!(
            normalize_scope("https://j.com:8443/").as_deref(),
            Some("https://j.com:8443")
        );
        assert_eq!(
            normalize_scope("https://user@j.com/jira/?x=1#y").as_deref(),
            Some("https://j.com/jira")
        );
        assert_ne!(
            normalize_scope("https://j.com/a"),
            normalize_scope("https://j.com/b")
        );
        assert_eq!(normalize_scope(""), None);
        assert_eq!(normalize_scope("   "), None);
        assert_eq!(normalize_scope("not a url/").as_deref(), Some("not a url"));
    }

    #[test]
    fn name_rules() {
        let ok = v("  Úlohy  ", &[]).unwrap();
        assert_eq!(ok.display, "Úlohy");
        assert_eq!(ok.key, "ulohy");
        assert_eq!(v("U\u{301}lohy", &[]).unwrap().display, "Úlohy");
        assert_eq!(v("", &[]), Err(GroupErrorCode::Empty));
        assert_eq!(v("   ", &[]), Err(GroupErrorCode::Empty));
        assert!(v(&"a".repeat(40), &[]).is_ok());
        assert_eq!(v(&"a".repeat(41), &[]), Err(GroupErrorCode::TooLong));
        assert!(v(&"U\u{301}".repeat(40), &[]).is_ok());
        assert_eq!(v("ULOHY", &["Úlohy"]), Err(GroupErrorCode::Duplicate));
        assert_eq!(v("ulohy", &["Úlohy"]), Err(GroupErrorCode::Duplicate));
        for r in [
            "new",
            "NOVÉ",
            "nove",
            "dismissed",
            "zamietnute",
            "already linked",
            "Uz prelinkovane",
        ] {
            assert_eq!(v(r, &[]), Err(GroupErrorCode::Reserved), "{r}");
        }
        assert!(v("Newsletter", &[]).is_ok());
        assert_eq!(v(&"a".repeat(41), &["a"]), Err(GroupErrorCode::TooLong));
    }

    #[test]
    fn color_rules() {
        assert_eq!(pick_default_color([]), "blue");
        assert_eq!(pick_default_color(["blue"]), "teal");
        assert_eq!(pick_default_color(["bogus"]), "blue");
        assert!(is_group_color("slate"));
        assert!(!is_group_color("#ff0000"));
    }

    #[test]
    fn reserved_keys_cover_both_languages() {
        let keys = reserved_name_keys();
        assert_eq!(keys.len(), 6);
        let mut d = keys.to_vec();
        d.sort();
        d.dedup();
        assert_eq!(d.len(), 6);
        assert!(keys.iter().any(|k| k == "new"));
        assert!(keys.iter().any(|k| k == "nove"));
    }

    #[test]
    fn shared_vectors_match() {
        let vec: serde_json::Value =
            serde_json::from_str(include_str!("../../src/test-fixtures/group-vectors.json"))
                .unwrap();
        let palette: Vec<&str> = vec["palette"]
            .as_array()
            .unwrap()
            .iter()
            .map(|x| x.as_str().unwrap())
            .collect();
        assert_eq!(palette, GROUP_COLORS.to_vec());
        for row in vec["names"].as_array().unwrap() {
            let input = row["input"].as_str().unwrap();
            let existing: Vec<&str> = row["existing"]
                .as_array()
                .unwrap()
                .iter()
                .map(|x| x.as_str().unwrap())
                .collect();
            let res = v(input, &existing);
            match row["error"].as_str() {
                None => {
                    let ok = res.unwrap_or_else(|e| panic!("{input:?}: {e:?}"));
                    assert_eq!(Some(ok.display.as_str()), row["display"].as_str());
                    assert_eq!(Some(ok.key.as_str()), row["key"].as_str());
                }
                Some(code) => {
                    let got = serde_json::to_value(res.unwrap_err()).unwrap();
                    assert_eq!(got.as_str().unwrap(), code, "{input:?}");
                }
            }
        }
        for row in vec["scope"].as_array().unwrap() {
            assert_eq!(
                normalize_scope(row["input"].as_str().unwrap()).as_deref(),
                row["scope"].as_str()
            );
        }
        for row in vec["defaultColor"].as_array().unwrap() {
            let used: Vec<&str> = row["used"]
                .as_array()
                .unwrap()
                .iter()
                .map(|x| x.as_str().unwrap())
                .collect();
            assert_eq!(pick_default_color(used), row["expected"].as_str().unwrap());
        }
    }

    // ---- storage tests ----

    fn new_db() -> GroupsDb {
        GroupsDb::open_in_memory().expect("in-memory db")
    }

    const S: &str = "https://a.example.com";

    fn member(key: &str) -> NewMember {
        NewMember {
            issue_key: key.to_string(),
            ticket_json: format!("{{\"key\":\"{key}\"}}"),
        }
    }

    fn fk_pragma(db: &GroupsDb) -> i64 {
        db.conn
            .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
            .unwrap()
    }

    fn snapshot_count(db: &GroupsDb) -> i64 {
        db.conn
            .query_row("SELECT COUNT(*) FROM issue_snapshot", [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn foreign_keys_on() {
        assert_eq!(fk_pragma(&new_db()), 1);
        let dir = tempfile::tempdir().unwrap();
        let db = GroupsDb::open(&dir.path().join("groups.db")).unwrap();
        assert_eq!(fk_pragma(&db), 1);
    }

    #[test]
    fn groups_survive_reopen() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("groups.db");
        let before;
        let memberships_before;
        let members_before;
        let a_id;
        {
            let db = GroupsDb::open(&path).unwrap();
            let a = db.create_group(S, "Úlohy", Some("pink")).unwrap();
            let b = db.create_group(S, "Beta", None).unwrap();
            db.create_group(S, "Gamma", Some("slate")).unwrap();
            db.move_group(S, a.id, MoveDirection::Right).unwrap();
            db.add_members(S, a.id, &[member("AB-1"), member("AB-2")])
                .unwrap();
            db.add_members(S, b.id, &[member("AB-2")]).unwrap();
            a_id = a.id;
            before = db.list_groups(S).unwrap();
            memberships_before = db.list_memberships(S).unwrap();
            members_before = db.get_group_members(S, a.id).unwrap();
        }
        let db = GroupsDb::open(&path).unwrap();
        assert_eq!(db.list_groups(S).unwrap(), before);
        assert_eq!(before[1].name, "Úlohy");
        assert_eq!(before[1].color, "pink");
        assert_eq!(db.list_memberships(S).unwrap(), memberships_before);
        assert_eq!(db.get_group_members(S, a_id).unwrap(), members_before);
        assert_eq!(members_before[0].ticket_json, "{\"key\":\"AB-1\"}");
    }

    #[test]
    fn scope_isolation() {
        let db = new_db();
        let other = "https://b.example.com";
        let x = db.create_group(S, "X", None).unwrap();
        db.add_members(S, x.id, &[member("AB-1")]).unwrap();
        assert!(db.list_groups(other).unwrap().is_empty());
        assert!(db.list_memberships(other).unwrap().is_empty());
        let x2 = db.create_group(other, "X", None).unwrap();
        assert_ne!(x.id, x2.id);
        assert_eq!(
            db.rename_group(other, x.id, "Y").unwrap_err().code,
            GroupErrorCode::NotFound
        );
        assert_eq!(
            db.delete_group(other, x.id).unwrap_err().code,
            GroupErrorCode::NotFound
        );
        assert_eq!(
            db.add_members(other, x.id, &[member("AB-9")])
                .unwrap_err()
                .code,
            GroupErrorCode::NotFound
        );
        let listed = db.list_groups(S).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "X");
        assert_eq!(listed[0].member_count, 1);
    }

    #[test]
    fn fk_cascade() {
        let db = new_db();
        let a = db.create_group(S, "A", None).unwrap();
        let b = db.create_group(S, "B", None).unwrap();
        db.add_members(S, a.id, &[member("AB-1"), member("AB-2")])
            .unwrap();
        db.add_members(S, b.id, &[member("AB-2")]).unwrap();
        assert_eq!(snapshot_count(&db), 2);
        db.delete_group(S, a.id).unwrap();
        let rows: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM group_member WHERE group_id = ?1",
                params![a.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(rows, 0);
        // AB-1 orphaned and collected; AB-2 still referenced by B
        assert_eq!(snapshot_count(&db), 1);
        assert_eq!(db.get_group_members(S, b.id).unwrap().len(), 1);
    }

    #[test]
    fn autoincrement_ids_not_reused() {
        let db = new_db();
        let a = db.create_group(S, "A", None).unwrap();
        let b = db.create_group(S, "B", None).unwrap();
        db.delete_group(S, b.id).unwrap();
        let c = db.create_group(S, "C", None).unwrap();
        assert!(c.id > b.id && b.id > a.id);
    }

    #[test]
    fn create_rename_color_rules() {
        let db = new_db();
        let a = db.create_group(S, "A", None).unwrap();
        assert_eq!(a.color, "blue");
        let b = db.create_group(S, "B", None).unwrap();
        assert_eq!(b.color, "teal");
        assert_eq!(
            db.create_group(S, "C", Some("#fff")).unwrap_err().code,
            GroupErrorCode::InvalidColor
        );
        assert_eq!(
            db.create_group(S, "a", None).unwrap_err().code,
            GroupErrorCode::Duplicate
        );
        assert_eq!(
            db.create_group(S, "New", None).unwrap_err().code,
            GroupErrorCode::Reserved
        );
        assert_eq!(
            db.create_group(S, " ", None).unwrap_err().code,
            GroupErrorCode::Empty
        );
        assert_eq!(db.rename_group(S, a.id, "a").unwrap().name, "a");
        assert_eq!(
            db.rename_group(S, a.id, "B").unwrap_err().code,
            GroupErrorCode::Duplicate
        );
        assert_eq!(db.set_group_color(S, a.id, "slate").unwrap().color, "slate");
        assert_eq!(
            db.set_group_color(S, a.id, "nope").unwrap_err().code,
            GroupErrorCode::InvalidColor
        );
    }

    #[test]
    fn no_group_cap() {
        let db = new_db();
        for i in 0..60 {
            db.create_group(S, &format!("G{i}"), None).unwrap();
        }
        assert_eq!(db.list_groups(S).unwrap().len(), 60);
    }

    #[test]
    fn move_group_swaps_and_edges() {
        let db = new_db();
        let a = db.create_group(S, "A", None).unwrap();
        db.create_group(S, "B", None).unwrap();
        let c = db.create_group(S, "C", None).unwrap();
        let names = |g: &[Group]| g.iter().map(|x| x.name.clone()).collect::<Vec<_>>();
        assert_eq!(
            names(&db.move_group(S, a.id, MoveDirection::Left).unwrap()),
            ["A", "B", "C"]
        );
        assert_eq!(
            names(&db.move_group(S, c.id, MoveDirection::Right).unwrap()),
            ["A", "B", "C"]
        );
        assert_eq!(
            names(&db.move_group(S, a.id, MoveDirection::Right).unwrap()),
            ["B", "A", "C"]
        );
        assert_eq!(
            names(&db.move_group(S, a.id, MoveDirection::Left).unwrap()),
            ["A", "B", "C"]
        );
        assert_eq!(
            db.move_group(S, 9999, MoveDirection::Left)
                .unwrap_err()
                .code,
            GroupErrorCode::NotFound
        );
    }

    #[test]
    fn add_members_atomic_and_idempotent() {
        let db = new_db();
        let a = db.create_group(S, "A", None).unwrap();
        let bad_key = [member("AB-1"), member("bad key")];
        assert_eq!(
            db.add_members(S, a.id, &bad_key).unwrap_err().code,
            GroupErrorCode::InvalidIssueKey
        );
        let bad_json = [
            member("AB-1"),
            NewMember {
                issue_key: "AB-2".into(),
                ticket_json: "not json".into(),
            },
        ];
        assert_eq!(
            db.add_members(S, a.id, &bad_json).unwrap_err().code,
            GroupErrorCode::InvalidTicket
        );
        assert!(db.list_memberships(S).unwrap().is_empty());
        assert_eq!(snapshot_count(&db), 0);

        assert_eq!(db.add_members(S, a.id, &[member("AB-1")]).unwrap(), 1);
        let refreshed = NewMember {
            issue_key: "AB-1".into(),
            ticket_json: "{\"v\":2}".into(),
        };
        assert_eq!(db.add_members(S, a.id, &[refreshed]).unwrap(), 0);
        let members = db.get_group_members(S, a.id).unwrap();
        assert_eq!(members.len(), 1);
        assert_eq!(members[0].ticket_json, "{\"v\":2}");
    }

    #[test]
    fn remove_members_gcs_snapshots() {
        let db = new_db();
        let a = db.create_group(S, "A", None).unwrap();
        db.add_members(S, a.id, &[member("AB-1"), member("AB-2")])
            .unwrap();
        let n = db.remove_members(S, a.id, &["AB-1".to_string()]).unwrap();
        assert_eq!(n, 1);
        assert_eq!(snapshot_count(&db), 1);
        assert_eq!(db.list_groups(S).unwrap()[0].member_count, 1);
    }

    #[test]
    fn issue_key_shape() {
        assert!(is_valid_issue_key("AB-1"));
        assert!(is_valid_issue_key("A1_B-123"));
        assert!(!is_valid_issue_key("1A-1"));
        assert!(!is_valid_issue_key("AB-"));
        assert!(!is_valid_issue_key("AB1"));
        assert!(!is_valid_issue_key(""));
    }
}
