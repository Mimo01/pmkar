//! Durable custom-groups data layer (`groups.db`).
//!
//! Rules (scope, names, palette) live at the top; storage follows.

use crate::error::AppError;
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
pub fn normalize_group_name(raw: &str) -> String {
    raw.trim().nfc().collect()
}

/// Comparison key: NFD, strip combining marks, NFC, lower-case (D-17).
///
/// Letters without a decomposition (e.g. `ł`, `ß`) are only lower-cased.
pub fn group_name_key(display: &str) -> String {
    let stripped: String = display.nfd().filter(|c| !is_combining_mark(*c)).collect();
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
}
