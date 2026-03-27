use crate::audit::{build_audited_client, AuditDb};
use crate::error::{AppError, AppResult};
use std::sync::{Arc, Mutex};

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

/// Search Jira Server tickets using JQL. Returns the `issues` array from the search response.
/// Used by the poll engine background loop.
///
/// Makes an unauthenticated `reqwest` call — callers must pass a PAT for auth.
pub async fn search_tickets(
    base_url: &str,
    jql: &str,
    pat: &str,
) -> AppResult<Vec<serde_json::Value>> {
    let trimmed_url = base_url.trim_end_matches('/');
    let encoded_jql = urlencoding::encode(jql);
    let url = format!(
        "{trimmed_url}/rest/api/2/search?jql={encoded_jql}&fields=summary,status,priority,assignee,created,updated,labels,components,fixVersions&maxResults=50"
    );

    let client = reqwest::Client::new();
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

    Ok(body["issues"].as_array().cloned().unwrap_or_default())
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
