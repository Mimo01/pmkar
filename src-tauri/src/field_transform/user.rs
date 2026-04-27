//! Phase 18 — user.rs: batch user resolution (TRAN-01, TRAN-06, D-06).
//! TRAN-06 invariant: ONE HTTP `/user/search` per unique email domain in the
//! whole source issue, regardless of how many person fields reference users.
//!
//! Pre-scan (D-06) covers BOTH:
//!   - raw wiki `[~username]` mentions  (fields.description)
//!   - rendered HTML profile links     (renderedFields.description href=…name=jdoe)
//! Per Pitfall C, server v2 may deliver either shape; we union both into the
//! username set before issuing any HTTP call.

use crate::field_discovery::FieldSchemaType;
use crate::field_transform::FieldMappingRow;
use std::collections::{HashMap, HashSet};

/// Hard upper bound on description bytes scanned for mention patterns. Real-world
/// descriptions are <10 KB; this guards against pathological input (DoS).
const MAX_DESCRIPTION_SCAN_BYTES: usize = 500 * 1024;

pub struct UserResolver {
    pub client: reqwest::Client,
    pub cloud_auth: String,
    pub cloud_base_url: String,
}

impl UserResolver {
    pub fn new(client: reqwest::Client, cloud_auth: String, cloud_base_url: String) -> Self {
        Self { client, cloud_auth, cloud_base_url }
    }

    /// Pre-scans the source issue for ALL unique user identifiers (person fields
    /// + description mentions), groups by domain, issues ONE HTTP search per
    /// unique domain, returns map of `source_username` → `Option<accountId>`.
    /// `None` value means "couldn't resolve" — caller emits `UnresolvedPerson`.
    /// Task 2 fills this body.
    pub async fn resolve_batch(
        &self,
        _source_issue: &serde_json::Value,
        _mapping: &[FieldMappingRow],
    ) -> HashMap<String, Option<String>> {
        // Implemented in Task 2.
        HashMap::new()
    }
}

// ─── Helpers (Task 1) ────────────────────────────────────────────────────────

/// True for `FieldSchemaType::User` and `FieldSchemaType::Array { items: "user", .. }`.
pub(crate) fn is_user_field(s: &FieldSchemaType) -> bool {
    matches!(s, FieldSchemaType::User { .. })
        || matches!(s, FieldSchemaType::Array { items, .. } if items == "user")
}

/// Reads a single source field's value and returns every username/key/email
/// found. Handles single-user object and array-of-user shapes.
/// Order: name → key → emailAddress (callers prioritise `name` for display).
pub(crate) fn extract_usernames_from_field(value: &serde_json::Value) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let push_one = |obj: &serde_json::Value, out: &mut Vec<String>| {
        // Prefer `name` (Server v2). Fall back to `key`. Fall back to email local part.
        if let Some(n) = obj.get("name").and_then(|x| x.as_str()) {
            if !n.is_empty() {
                out.push(n.to_string());
                return;
            }
        }
        if let Some(k) = obj.get("key").and_then(|x| x.as_str()) {
            if !k.is_empty() {
                out.push(k.to_string());
                return;
            }
        }
        if let Some(e) = obj.get("emailAddress").and_then(|x| x.as_str()) {
            if !e.is_empty() {
                out.push(e.to_string());
            }
        }
    };
    if value.is_object() {
        push_one(value, &mut out);
    } else if let Some(arr) = value.as_array() {
        for entry in arr {
            push_one(entry, &mut out);
        }
    }
    out
}

/// Hand-written `[~username]` scanner. Pattern: `[~` + (alphanumeric | . | - | _)+ + `]`.
/// No regex dep. Bounded to first `MAX_DESCRIPTION_SCAN_BYTES` of `text` (DoS guard).
pub(crate) fn scan_mention_patterns(text: &str) -> HashSet<String> {
    let mut out = HashSet::new();
    let bytes = text.as_bytes();
    let limit = bytes.len().min(MAX_DESCRIPTION_SCAN_BYTES);
    let mut i = 0;
    while i + 2 < limit {
        // Look for "[~"
        if bytes[i] == b'[' && bytes[i + 1] == b'~' {
            let start = i + 2;
            let mut j = start;
            while j < limit {
                let c = bytes[j];
                let ok = c.is_ascii_alphanumeric() || c == b'.' || c == b'-' || c == b'_';
                if ok {
                    j += 1;
                } else {
                    break;
                }
            }
            if j < limit && bytes[j] == b']' && j > start {
                if let Ok(name) = std::str::from_utf8(&bytes[start..j]) {
                    out.insert(name.to_string());
                }
                i = j + 1;
                continue;
            }
        }
        i += 1;
    }
    out
}

/// Hand-written scanner for rendered-HTML profile links: matches the substring
/// `name=USERNAME` inside `href="..."` (Pitfall C). This is a cheap second-pass
/// over rendered descriptions; it tolerates surrounding HTML attributes.
/// Bounded to first `MAX_DESCRIPTION_SCAN_BYTES`.
pub(crate) fn scan_html_profile_links(text: &str) -> HashSet<String> {
    let mut out = HashSet::new();
    let bytes = text.as_bytes();
    let limit = bytes.len().min(MAX_DESCRIPTION_SCAN_BYTES);
    let needle = b"name=";
    let mut i = 0;
    while i + needle.len() < limit {
        if &bytes[i..i + needle.len()] == needle {
            // Only accept if preceded by '?' or '&' (a URL query param) — guards
            // against matching e.g. `<input name="…">` legitimate HTML attributes.
            let preceding_ok = i == 0 || bytes[i - 1] == b'?' || bytes[i - 1] == b'&';
            if preceding_ok {
                let start = i + needle.len();
                let mut j = start;
                while j < limit {
                    let c = bytes[j];
                    let ok = c.is_ascii_alphanumeric() || c == b'.' || c == b'-' || c == b'_';
                    if ok {
                        j += 1;
                    } else {
                        break;
                    }
                }
                if j > start {
                    if let Ok(name) = std::str::from_utf8(&bytes[start..j]) {
                        out.insert(name.to_string());
                    }
                }
                i = j;
                continue;
            }
        }
        i += 1;
    }
    out
}

/// Pulls the description (raw + rendered) from the source issue and runs both
/// scanners. Returns the union of usernames found.
pub(crate) fn collect_description_mentions(source_issue: &serde_json::Value) -> HashSet<String> {
    let mut out = HashSet::new();
    if let Some(raw) = source_issue
        .pointer("/fields/description")
        .and_then(|v| v.as_str())
    {
        out.extend(scan_mention_patterns(raw));
    }
    if let Some(rendered) = source_issue
        .pointer("/renderedFields/description")
        .and_then(|v| v.as_str())
    {
        out.extend(scan_mention_patterns(rendered));
        out.extend(scan_html_profile_links(rendered));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // ── helper-layer tests (Task 1) ─────────────────────────────────────────

    #[test]
    fn scan_mention_extracts_simple_pattern() {
        let got = scan_mention_patterns("hello [~jdoe] world");
        assert!(got.contains("jdoe"));
        assert_eq!(got.len(), 1);
    }

    #[test]
    fn scan_mention_extracts_multiple() {
        let got = scan_mention_patterns("[~alice] and [~bob] and [~alice]");
        assert!(got.contains("alice"));
        assert!(got.contains("bob"));
        assert_eq!(got.len(), 2);
    }

    #[test]
    fn scan_mention_handles_dotted_username() {
        let got = scan_mention_patterns("[~john.doe-ext_1]");
        assert!(got.contains("john.doe-ext_1"));
    }

    #[test]
    fn scan_mention_ignores_unclosed() {
        assert!(scan_mention_patterns("[~alice").is_empty());
        assert!(scan_mention_patterns("[~]").is_empty());
        assert!(scan_mention_patterns("[~ alice]").is_empty());
    }

    #[test]
    fn scan_mention_bounded_to_500kb() {
        // 600 KB of filler then a mention — the mention must NOT be found.
        let mut huge = String::with_capacity(600 * 1024);
        huge.push_str(&"x".repeat(600 * 1024));
        huge.push_str("[~latemention]");
        assert!(!scan_mention_patterns(&huge).contains("latemention"));
        // But mentions within the first 500 KB ARE found.
        let mut safe = String::with_capacity(600 * 1024);
        safe.push_str("[~earlymention]");
        safe.push_str(&"x".repeat(600 * 1024));
        assert!(scan_mention_patterns(&safe).contains("earlymention"));
    }

    #[test]
    fn scan_html_profile_link_extracts_name_param() {
        let html =
            r#"<p>Hello <a href="/secure/ViewProfile.jspa?name=jdoe">@jdoe</a> here</p>"#;
        let got = scan_html_profile_links(html);
        assert!(got.contains("jdoe"));
    }

    #[test]
    fn scan_html_profile_link_ignores_html_attribute_named_name() {
        // <input name="something"> should NOT be picked up — only ?name= or &name= URL params.
        let got = scan_html_profile_links(r#"<input name="foo" />"#);
        assert!(!got.contains("foo"));
    }

    #[test]
    fn is_user_field_recognises_single_user() {
        let s = FieldSchemaType::User { system: None, custom: None, custom_id: None };
        assert!(is_user_field(&s));
    }

    #[test]
    fn is_user_field_recognises_array_of_user() {
        let s = FieldSchemaType::Array {
            items: "user".into(),
            system: None,
            custom: None,
            custom_id: None,
        };
        assert!(is_user_field(&s));
        let s2 = FieldSchemaType::Array {
            items: "option".into(),
            system: None,
            custom: None,
            custom_id: None,
        };
        assert!(!is_user_field(&s2));
    }

    #[test]
    fn extract_usernames_from_field_handles_single_user_object() {
        let v = json!({"name":"jdoe","emailAddress":"jdoe@example.com","key":"JIRAUSER123"});
        let got = extract_usernames_from_field(&v);
        assert_eq!(got, vec!["jdoe"]);
    }

    #[test]
    fn extract_usernames_from_field_handles_array_of_users() {
        let v = json!([
            {"name":"alice"},
            {"name":"bob"},
            {"name":"carol"}
        ]);
        let got = extract_usernames_from_field(&v);
        assert_eq!(got, vec!["alice", "bob", "carol"]);
    }

    #[test]
    fn collect_description_mentions_unions_raw_and_rendered() {
        let issue = json!({
            "fields": { "description": "Hi [~rawuser] from raw" },
            "renderedFields": { "description": r#"<a href="/secure/ViewProfile.jspa?name=htmluser">@htmluser</a>"# }
        });
        let got = collect_description_mentions(&issue);
        assert!(got.contains("rawuser"));
        assert!(got.contains("htmluser"));
    }
}
