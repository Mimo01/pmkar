use crate::audit::{build_audited_client, AuditDb};
use crate::error::{AppError, AppResult};
use std::sync::{Arc, Mutex};

/// Page size used for `/rest/api/2/search` calls. Jira's hard ceiling is 100;
/// we use 50 to match historical behaviour and to keep individual responses small.
pub const SEARCH_PAGE_SIZE: u64 = 50;

/// Hard upper bound on the number of issues we will paginate through in a single
/// `search`. Prevents a runaway loop on a hostile or buggy response. If the
/// matching set exceeds this, the caller is informed via a `truncated` flag and
/// only the first `MAX_PAGINATION_ITEMS` issues are returned.
pub const MAX_PAGINATION_ITEMS: u64 = 1000;

/// The Jira HTTP client. Wraps reqwest with `AuditMiddleware`.
/// All outbound requests are logged to `SQLite` with Authorization redacted.
pub struct JiraClient {
    pub client: reqwest_middleware::ClientWithMiddleware,
}

impl JiraClient {
    pub fn new(audit_db: Arc<Mutex<AuditDb>>) -> Self {
        Self {
            client: build_audited_client(audit_db),
        }
    }
}

/// Search Jira Server tickets using JQL. Paginates through all matching issues
/// using `startAt`, up to `MAX_PAGINATION_ITEMS`. Used by the poll engine.
///
/// Returns `(issues, truncated)`:
/// - `issues`: all issues fetched across pages
/// - `truncated`: true if the matching set exceeded `MAX_PAGINATION_ITEMS` and
///   the result is capped. Callers should surface this to the user.
///
/// On any HTTP/parse error during pagination the function returns `Err` so
/// callers (e.g. the poll engine) treat the fetch as failed and do **not** advance
/// any state derived from a partial result.
///
/// Makes plain `reqwest` calls — callers must pass a PAT for auth.
pub async fn search_tickets(
    base_url: &str,
    jql: &str,
    pat: &str,
) -> AppResult<(Vec<serde_json::Value>, bool)> {
    let trimmed_url = base_url.trim_end_matches('/');
    let encoded_jql = urlencoding::encode(jql);
    let client = reqwest::Client::new();

    let mut all_issues: Vec<serde_json::Value> = Vec::new();
    let mut start_at: u64 = 0;
    let mut truncated = false;

    loop {
        let url = format!(
            "{trimmed_url}/rest/api/2/search?jql={encoded_jql}&fields=summary,status,priority,assignee,created,updated,labels,components,fixVersions&maxResults={SEARCH_PAGE_SIZE}&startAt={start_at}"
        );

        let resp = client
            .get(&url)
            .header("Authorization", format!("Bearer {pat}"))
            .send()
            .await
            .map_err(|_| AppError::Http("Poll: failed to fetch tickets".into()))?;

        if !resp.status().is_success() {
            return Err(AppError::Http(format!(
                "Poll: Jira search returned status {}",
                resp.status().as_u16()
            )));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|_| AppError::Http("Poll: failed to parse search response".into()))?;

        let page_issues = body["issues"].as_array().cloned().unwrap_or_default();
        let total = body["total"].as_u64().unwrap_or(0);
        let page_len = page_issues.len() as u64;

        all_issues.extend(page_issues);

        // Stop if we've drained the matching set, or the server returned an empty page
        // (defensive guard against servers that report `total` larger than what they
        // actually serve, which would otherwise spin forever).
        if page_len == 0 || all_issues.len() as u64 >= total {
            break;
        }

        // Hard upper bound — surface to caller and bail out.
        if all_issues.len() as u64 >= MAX_PAGINATION_ITEMS {
            truncated = true;
            // MAX_PAGINATION_ITEMS = 1000 fits in usize on every supported target.
            all_issues.truncate(usize::try_from(MAX_PAGINATION_ITEMS).unwrap_or(usize::MAX));
            break;
        }

        start_at += SEARCH_PAGE_SIZE;
    }

    Ok((all_issues, truncated))
}

/// Fetch full ticket detail from Jira Server. Used by the poll engine background loop.
///
/// Makes a plain `reqwest` call — callers must pass a PAT for auth.
pub async fn fetch_ticket_detail_raw(
    base_url: &str,
    issue_key: &str,
    pat: &str,
) -> AppResult<serde_json::Value> {
    let trimmed_url = base_url.trim_end_matches('/');
    let url = format!(
        "{trimmed_url}/rest/api/2/issue/{issue_key}?expand=renderedFields,changelog&fields=*all"
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {pat}"))
        .send()
        .await
        .map_err(|_| AppError::Http(format!("Poll: failed to fetch detail for {issue_key}")))?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Poll: Jira issue detail returned status {} for {issue_key}",
            resp.status().as_u16()
        )));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| AppError::Http(format!("Poll: failed to parse detail for {issue_key}")))?;

    Ok(body)
}
