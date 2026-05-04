//! Phase 18 — user.rs: batch user resolution (TRAN-01, TRAN-06, D-06).
//!
//! TRAN-06 invariant: ONE HTTP `/user/search` per unique email domain in the
//! whole source issue, regardless of how many person fields reference users.
//! NOTE: TRAN-06 applies only to the domain-based path (step 4). Usernames
//! without an associated email address (description-only mentions, step 5)
//! each incur a separate HTTP `/user/search` call because no domain key is
//! available to group them. This is uncommon in practice but can occur when
//! a description contains several bare `[~username]` patterns for users who
//! have no email visible to the source instance.
//!
//! Pre-scan (D-06) covers BOTH:
//!
//! - raw wiki `[~username]` mentions  (`fields.description`)
//! - rendered HTML profile links     (`renderedFields.description` `href=…name=jdoe`)
//!
//! Per Pitfall C, server v2 may deliver either shape; we union both into the
//! username set before issuing any HTTP call.

use crate::field_discovery::FieldSchemaType;
use crate::field_transform::FieldMappingRow;
use std::collections::{HashMap, HashSet};

/// Hard upper bound on description bytes scanned for mention patterns. Real-world
/// descriptions are <10 KB; this guards against pathological input (`DoS`).
const MAX_DESCRIPTION_SCAN_BYTES: usize = 500 * 1024;

pub struct UserResolver {
    pub(crate) client: reqwest::Client,
    pub(crate) cloud_auth: String,
    pub(crate) cloud_base_url: String,
}

impl UserResolver {
    pub fn new(client: reqwest::Client, cloud_auth: String, cloud_base_url: String) -> Self {
        Self {
            client,
            cloud_auth,
            cloud_base_url,
        }
    }

    /// Pre-scans the source issue for ALL unique user identifiers (person fields +
    /// description mentions), groups by domain, issues ONE HTTP search per unique
    /// domain, returns map of `source_username` → `Option<accountId>`.
    ///
    /// `None` means "couldn't resolve" — caller emits `UnresolvedPerson`.
    /// TRAN-06: exactly one HTTP call per unique email domain.
    pub async fn resolve_batch(
        &self,
        source_issue: &serde_json::Value,
        mapping: &[FieldMappingRow],
    ) -> HashMap<String, Option<String>> {
        // 1. Collect unique identifiers from person-typed mapping rows.
        let mut identifiers: HashMap<String, Option<String>> = HashMap::new(); // username → email
        for row in mapping {
            if !is_user_field(&row.source_schema) {
                continue;
            }
            let path = format!("/fields/{}", row.source_field_id);
            let Some(field_val) = source_issue.pointer(&path) else {
                continue;
            };
            for username in extract_usernames_from_field(field_val) {
                let email = extract_email_for_username(field_val, &username);
                identifiers.entry(username).or_insert(email);
            }
        }
        // 2. Add description mentions (D-06). Mentions have no email — username only.
        for username in collect_description_mentions(source_issue) {
            identifiers.entry(username).or_insert(None);
        }

        // 3. Group by domain.
        let mut by_domain: HashMap<String, Vec<String>> = HashMap::new();
        let mut no_domain: Vec<String> = Vec::new();
        for (username, email) in &identifiers {
            if let Some(e) = email {
                if let Some(domain) = e.split('@').nth(1) {
                    if !domain.is_empty() {
                        by_domain
                            .entry(domain.to_string())
                            .or_default()
                            .push(username.clone());
                        continue;
                    }
                }
            }
            no_domain.push(username.clone());
        }

        // 4. Fetch per-domain (one HTTP per unique domain — TRAN-06 invariant).
        let mut out: HashMap<String, Option<String>> = HashMap::new();
        for (domain, usernames_in_domain) in by_domain {
            let users = self
                .fetch_users_by_domain(&domain)
                .await
                .unwrap_or_default();
            for username in usernames_in_domain {
                let email_for_user = identifiers
                    .get(&username)
                    .and_then(std::clone::Clone::clone);
                let acct = match_user_in_results(&users, email_for_user.as_deref(), &username);
                out.insert(username, acct);
            }
        }
        // 5. Fallback for no-domain identifiers (rare; description-only mentions).
        for username in no_domain {
            let users = self
                .fetch_users_by_query(&username)
                .await
                .unwrap_or_default();
            let acct = match_user_in_results(&users, None, &username);
            out.insert(username, acct);
        }
        out
    }

    /// Paginated GET /rest/api/3/user/search?query=@\<domain\>. Mirrors
    /// `commands.rs`:1096-1147 verbatim, sans the `AuditDb` wiring (test traffic).
    async fn fetch_users_by_domain(&self, domain: &str) -> Result<Vec<serde_json::Value>, ()> {
        const PAGE_SIZE: usize = 50;
        let trimmed = self.cloud_base_url.trim_end_matches('/');
        let clean_domain = domain.trim_start_matches('@');
        let query = format!("@{clean_domain}");
        let encoded_query = urlencoding::encode(&query);
        let mut all: Vec<serde_json::Value> = Vec::new();
        let mut start_at: usize = 0;
        for _ in 0..50_usize {
            let url = format!(
                "{trimmed}/rest/api/3/user/search?query={encoded_query}&maxResults={PAGE_SIZE}&startAt={start_at}"
            );
            let resp = self
                .client
                .get(&url)
                .header("Authorization", self.cloud_auth.clone())
                .send()
                .await
                .map_err(|_| ())?;
            if !resp.status().is_success() {
                return Err(());
            }
            let page: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
            let page_len = page.len();
            all.extend(page);
            if page_len < PAGE_SIZE {
                break;
            }
            start_at += PAGE_SIZE;
        }
        Ok(all)
    }

    /// Single-page query (no pagination expected for username-only fallback).
    async fn fetch_users_by_query(&self, query: &str) -> Result<Vec<serde_json::Value>, ()> {
        let trimmed = self.cloud_base_url.trim_end_matches('/');
        let encoded_query = urlencoding::encode(query);
        let url = format!(
            "{trimmed}/rest/api/3/user/search?query={encoded_query}&maxResults=50&startAt=0"
        );
        let resp = self
            .client
            .get(&url)
            .header("Authorization", self.cloud_auth.clone())
            .send()
            .await
            .map_err(|_| ())?;
        if !resp.status().is_success() {
            return Err(());
        }
        Ok(resp.json().await.unwrap_or_default())
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
/// No regex dep. Bounded to first `MAX_DESCRIPTION_SCAN_BYTES` of `text` (`DoS` guard).
pub(crate) fn scan_mention_patterns(text: &str) -> HashSet<String> {
    let mut out = HashSet::new();
    let bytes = text.as_bytes();
    let limit = bytes.len().min(MAX_DESCRIPTION_SCAN_BYTES);
    let mut i = 0;
    while i + 1 < limit {
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
            // i == 0 is NOT a valid query-param context: a string starting with
            // `name=` has no preceding delimiter, so it must be rejected.
            let preceding_ok = i > 0 && (bytes[i - 1] == b'?' || bytes[i - 1] == b'&');
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

/// Pulls `emailAddress` from a single source-field user object (or array element)
/// matching `username` by `name` field. Returns None if not findable.
fn extract_email_for_username(field_val: &serde_json::Value, username: &str) -> Option<String> {
    let single = |obj: &serde_json::Value| -> Option<String> {
        let n = obj.get("name").and_then(|x| x.as_str())?;
        if n == username {
            obj.get("emailAddress")
                .and_then(|x| x.as_str())
                .map(str::to_string)
        } else {
            None
        }
    };
    if field_val.is_object() {
        return single(field_val);
    }
    if let Some(arr) = field_val.as_array() {
        for entry in arr {
            if let Some(e) = single(entry) {
                return Some(e);
            }
        }
    }
    None
}

/// Privacy-mode-aware matching (Pitfall 2):
///   1. If `email` is Some and exactly one user in `results` has `emailAddress == email` → that's the match.
///   2. If `email` is Some and ZERO users have `emailAddress` (privacy mode) AND there's exactly ONE result → high-confidence implicit match.
///   3. Else if exactly one result and the username matches `displayName` (case-insensitive) → match.
///   4. Else None.
fn match_user_in_results(
    results: &[serde_json::Value],
    email: Option<&str>,
    username: &str,
) -> Option<String> {
    let read_account_id = |u: &serde_json::Value| {
        u.get("accountId")
            .and_then(|x| x.as_str())
            .map(str::to_string)
    };

    if let Some(em) = email {
        // 1. Exact email match.
        let exact: Vec<&serde_json::Value> = results
            .iter()
            .filter(|u| u.get("emailAddress").and_then(|x| x.as_str()) == Some(em))
            .collect();
        if exact.len() == 1 {
            return read_account_id(exact[0]);
        }
        // 2. Privacy-mode: zero users have emailAddress AND exactly one result.
        let any_email_present = results
            .iter()
            .any(|u| u.get("emailAddress").and_then(|x| x.as_str()).is_some());
        if !any_email_present && results.len() == 1 {
            return read_account_id(&results[0]);
        }
    }
    // 3. Single-result + displayName match (case-insensitive).
    if results.len() == 1 {
        let display = results[0]
            .get("displayName")
            .and_then(|x| x.as_str())
            .unwrap_or("");
        if display.eq_ignore_ascii_case(username) {
            return read_account_id(&results[0]);
        }
    }
    None
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
        let html = r#"<p>Hello <a href="/secure/ViewProfile.jspa?name=jdoe">@jdoe</a> here</p>"#;
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
        let s = FieldSchemaType::User {
            system: None,
            custom: None,
            custom_id: None,
        };
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

    // ── network-layer tests (Task 2) ────────────────────────────────────────

    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    /// Mock returns a fixed users list, counts `/user/search` hits per query string.
    /// Maps query→users. Default: returns empty array.
    async fn spawn_user_search_mock(
        responses: HashMap<String, (Vec<serde_json::Value>, u16)>,
    ) -> (String, Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
        use axum::extract::Query;
        use axum::response::IntoResponse;
        use axum::{routing::get, Json, Router};
        use std::collections::BTreeMap;
        use std::net::SocketAddr;
        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = Arc::clone(&counter);
        let responses_arc = Arc::new(responses);
        let app: Router = Router::new().route(
            "/rest/api/3/user/search",
            get(move |Query(q): Query<BTreeMap<String, String>>| {
                let c = Arc::clone(&counter_clone);
                let r = Arc::clone(&responses_arc);
                async move {
                    c.fetch_add(1, Ordering::SeqCst);
                    let query = q.get("query").cloned().unwrap_or_default();
                    if let Some((body, status)) = r.get(&query) {
                        if *status == 200 {
                            return (axum::http::StatusCode::OK, Json(body.clone()))
                                .into_response();
                        }
                        return axum::http::StatusCode::from_u16(*status)
                            .unwrap()
                            .into_response();
                    }
                    (
                        axum::http::StatusCode::OK,
                        Json(Vec::<serde_json::Value>::new()),
                    )
                        .into_response()
                }
            }),
        );
        let listener = tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
            .await
            .unwrap();
        let addr = listener.local_addr().unwrap();
        let handle = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        (format!("http://{addr}"), counter, handle)
    }

    fn user_field_row(source_field_id: &str) -> FieldMappingRow {
        FieldMappingRow {
            source_field_id: source_field_id.into(),
            target_field_id: source_field_id.into(),
            transformer_kind: "user".into(),
            source_schema: FieldSchemaType::User {
                system: None,
                custom: None,
                custom_id: None,
            },
            target_schema: FieldSchemaType::User {
                system: None,
                custom: None,
                custom_id: None,
            },
        }
    }

    #[tokio::test]
    async fn resolve_batch_one_http_per_domain() {
        let mut responses = HashMap::new();
        responses.insert(
            "@acme.com".into(),
            (
                vec![
                    json!({"accountId":"AID-A","displayName":"Alice","emailAddress":"alice@acme.com"}),
                    json!({"accountId":"AID-B","displayName":"Bob","emailAddress":"bob@acme.com"}),
                    json!({"accountId":"AID-C","displayName":"Carol","emailAddress":"carol@acme.com"}),
                ],
                200,
            ),
        );
        let (base, counter, h) = spawn_user_search_mock(responses).await;
        let r = UserResolver::new(reqwest::Client::new(), "Basic Zm9vOmJhcg==".into(), base);

        let issue = json!({
            "fields": {
                "assignee": {"name":"alice","emailAddress":"alice@acme.com"},
                "reporter": {"name":"bob","emailAddress":"bob@acme.com"},
                "customfield_10003": {"name":"carol","emailAddress":"carol@acme.com"}
            }
        });
        let mapping = vec![
            user_field_row("assignee"),
            user_field_row("reporter"),
            user_field_row("customfield_10003"),
        ];
        let map = r.resolve_batch(&issue, &mapping).await;
        assert_eq!(
            counter.load(Ordering::SeqCst),
            1,
            "exactly ONE HTTP call per domain"
        );
        assert_eq!(
            map.get("alice").cloned().flatten().as_deref(),
            Some("AID-A")
        );
        assert_eq!(map.get("bob").cloned().flatten().as_deref(), Some("AID-B"));
        assert_eq!(
            map.get("carol").cloned().flatten().as_deref(),
            Some("AID-C")
        );
        h.abort();
    }

    #[tokio::test]
    async fn resolve_batch_two_domains_two_http() {
        let mut responses = HashMap::new();
        responses.insert(
            "@acme.com".into(),
            (
                vec![json!({"accountId":"AID-A","displayName":"Alice","emailAddress":"alice@acme.com"})],
                200,
            ),
        );
        responses.insert(
            "@beta.io".into(),
            (
                vec![json!({"accountId":"AID-E","displayName":"Eve","emailAddress":"eve@beta.io"})],
                200,
            ),
        );
        let (base, counter, h) = spawn_user_search_mock(responses).await;
        let r = UserResolver::new(reqwest::Client::new(), "Basic Zm9vOmJhcg==".into(), base);
        let issue = json!({
            "fields": {
                "assignee": {"name":"alice","emailAddress":"alice@acme.com"},
                "reporter": {"name":"eve","emailAddress":"eve@beta.io"}
            }
        });
        let mapping = vec![user_field_row("assignee"), user_field_row("reporter")];
        let _ = r.resolve_batch(&issue, &mapping).await;
        assert_eq!(counter.load(Ordering::SeqCst), 2);
        h.abort();
    }

    #[tokio::test]
    async fn resolve_batch_includes_description_mentions_in_count() {
        let (base, _c, h) = spawn_user_search_mock(HashMap::new()).await;
        let r = UserResolver::new(reqwest::Client::new(), "Basic Zm9vOmJhcg==".into(), base);
        let issue = json!({
            "fields": {
                "assignee": {"name":"alice","emailAddress":"alice@acme.com"},
                "description": "ping [~bob] please"
            }
        });
        let mapping = vec![user_field_row("assignee")];
        let map = r.resolve_batch(&issue, &mapping).await;
        assert!(map.contains_key("bob")); // description mention picked up (D-06)
        assert!(map.contains_key("alice")); // person field picked up
        h.abort();
    }

    #[tokio::test]
    async fn resolve_batch_empty_email_returns_unresolved() {
        let (base, _c, h) = spawn_user_search_mock(HashMap::new()).await;
        let r = UserResolver::new(reqwest::Client::new(), "Basic Zm9vOmJhcg==".into(), base);
        let issue = json!({"fields": {"assignee": {"name":"ghost"}}});
        let mapping = vec![user_field_row("assignee")];
        let map = r.resolve_batch(&issue, &mapping).await;
        assert_eq!(map.get("ghost").cloned().flatten(), None);
        h.abort();
    }

    #[tokio::test]
    async fn resolve_batch_privacy_mode_single_match_treated_high_confidence() {
        let mut responses = HashMap::new();
        // Privacy mode: emailAddress omitted, but exactly ONE result returned.
        responses.insert(
            "@acme.com".into(),
            (
                vec![json!({"accountId":"AID-A","displayName":"Alice"})],
                200,
            ),
        );
        let (base, _c, h) = spawn_user_search_mock(responses).await;
        let r = UserResolver::new(reqwest::Client::new(), "Basic Zm9vOmJhcg==".into(), base);
        let issue = json!({"fields":{"assignee":{"name":"alice","emailAddress":"alice@acme.com"}}});
        let mapping = vec![user_field_row("assignee")];
        let map = r.resolve_batch(&issue, &mapping).await;
        // Pitfall 2: single result without emailAddress on a domain query treated as match.
        assert_eq!(
            map.get("alice").cloned().flatten().as_deref(),
            Some("AID-A")
        );
        h.abort();
    }

    #[tokio::test]
    async fn resolve_batch_http_500_returns_none_for_that_domain() {
        let mut responses = HashMap::new();
        responses.insert("@acme.com".into(), (vec![], 500));
        let (base, _c, h) = spawn_user_search_mock(responses).await;
        let r = UserResolver::new(reqwest::Client::new(), "Basic Zm9vOmJhcg==".into(), base);
        let issue = json!({"fields":{"assignee":{"name":"alice","emailAddress":"alice@acme.com"}}});
        let mapping = vec![user_field_row("assignee")];
        let map = r.resolve_batch(&issue, &mapping).await;
        assert_eq!(map.get("alice").cloned().flatten(), None);
        h.abort();
    }

    #[tokio::test]
    async fn resolve_batch_paginates_when_page_full() {
        // Build 50 users for page 0 + 1 user for page 1 = 51 total.
        // Mock checks startAt — returns 50 users when startAt=0, 1 when startAt=50.
        use axum::extract::Query;
        use axum::response::IntoResponse;
        use axum::{routing::get, Json, Router};
        use std::collections::BTreeMap;
        use std::net::SocketAddr;
        let app: Router = Router::new().route(
            "/rest/api/3/user/search",
            get(|Query(q): Query<BTreeMap<String, String>>| async move {
                let start_at: usize =
                    q.get("startAt").and_then(|s| s.parse().ok()).unwrap_or(0);
                let page: Vec<serde_json::Value> = if start_at == 0 {
                    (0..50)
                        .map(|i| {
                            json!({"accountId":format!("AID-{i}"),"displayName":"X","emailAddress":format!("u{i}@acme.com")})
                        })
                        .collect()
                } else if start_at == 50 {
                    vec![json!({"accountId":"AID-50","displayName":"Alice","emailAddress":"alice@acme.com"})]
                } else {
                    vec![]
                };
                (axum::http::StatusCode::OK, Json(page)).into_response()
            }),
        );
        let listener = tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
            .await
            .unwrap();
        let addr = listener.local_addr().unwrap();
        let h = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        let r = UserResolver::new(
            reqwest::Client::new(),
            "Basic Zm9vOmJhcg==".into(),
            format!("http://{addr}"),
        );
        let issue = json!({"fields":{"assignee":{"name":"alice","emailAddress":"alice@acme.com"}}});
        let mapping = vec![user_field_row("assignee")];
        let map = r.resolve_batch(&issue, &mapping).await;
        // Alice is on page 1 — the resolver MUST paginate.
        assert_eq!(
            map.get("alice").cloned().flatten().as_deref(),
            Some("AID-50")
        );
        h.abort();
    }

    #[tokio::test]
    async fn resolve_batch_dedupes_repeated_usernames() {
        let mut responses = HashMap::new();
        responses.insert(
            "@acme.com".into(),
            (
                vec![json!({"accountId":"AID-A","displayName":"Alice","emailAddress":"alice@acme.com"})],
                200,
            ),
        );
        let (base, counter, h) = spawn_user_search_mock(responses).await;
        let r = UserResolver::new(reqwest::Client::new(), "Basic Zm9vOmJhcg==".into(), base);
        let issue = json!({
            "fields": {
                "assignee": {"name":"alice","emailAddress":"alice@acme.com"},
                "reporter": {"name":"alice","emailAddress":"alice@acme.com"}
            }
        });
        let mapping = vec![user_field_row("assignee"), user_field_row("reporter")];
        let map = r.resolve_batch(&issue, &mapping).await;
        assert_eq!(counter.load(Ordering::SeqCst), 1);
        assert_eq!(map.len(), 1, "alice deduped to one entry");
        assert_eq!(
            map.get("alice").cloned().flatten().as_deref(),
            Some("AID-A")
        );
        h.abort();
    }
}
