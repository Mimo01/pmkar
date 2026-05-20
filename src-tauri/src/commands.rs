// Tauri command functions receive owned types by design — the framework serializes arguments
// from the frontend and passes them as owned values. Using references is not possible here.
#![allow(clippy::needless_pass_by_value)]

use crate::audit::{build_audited_client, AuditDb, AuditEntry};
use crate::error::AppError;
use crate::fixtures::SharedFixtures;
use crate::keychain;
use crate::mock_server;
use crate::notification_dispatcher::NotificationPrefs;
use crate::poll_engine::PollFrequency;
use crate::snapshot_db::{FieldChange, SnapshotDb};
use crate::triage_db::{ConnectionMeta, FetchConfig, TriageDb};
use base64::Engine as _;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::State;

#[tauri::command]
pub fn get_os_locale() -> Option<String> {
    sys_locale::get_locale()
}

#[tauri::command]
pub fn get_app_language(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Option<String>, AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Lock poisoned".into()))?;
    db.get_app_language()
}

#[tauri::command]
pub fn set_app_language(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    language: String,
) -> Result<(), AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Lock poisoned".into()))?;
    db.set_app_language(&language)
}

/// Retrieve the Jira Server PAT from the OS keychain using the
/// `connection_meta` table to look up the stored username.
pub(crate) fn get_server_pat(triage_db: &Arc<Mutex<TriageDb>>) -> Result<String, AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    let metas = db.get_all_connection_meta()?;
    let server_meta = metas.iter().find(|m| m.connection_type == "server");
    if let Some(meta) = server_meta {
        return keychain::get_credential("jira-server", &meta.username);
    }
    Err(AppError::Keychain(
        "No server credential found. Please re-run the setup wizard.".into(),
    ))
}

/// Retrieve Cloud credentials (`base_url`, email, `api_token`) from `connection_meta` and keychain.
pub(crate) fn get_cloud_credentials(
    triage_db: &Arc<Mutex<TriageDb>>,
) -> Result<(String, String, String), AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    let metas = db.get_all_connection_meta()?;
    let cloud_meta = metas.iter().find(|m| m.connection_type == "cloud");
    if let Some(meta) = cloud_meta {
        let base_url = meta.base_url.trim_end_matches('/').to_string();
        let email = meta.username.clone();
        let api_token = keychain::get_credential("jira-cloud", &email)?;
        return Ok((base_url, email, api_token));
    }
    Err(AppError::Keychain(
        "No cloud credential found. Please re-run the setup wizard.".into(),
    ))
}

// --- Cloud meta structs ---

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CloudMeta {
    pub available_statuses: Vec<StatusOption>,
    pub available_priorities: Vec<PriorityOption>,
    pub current_account_id: String,
    pub cloud_base_url: String,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct StatusOption {
    pub id: String,
    pub name: String,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct PriorityOption {
    pub id: String,
    pub name: String,
}

// --- Project selection structs ---

#[derive(serde::Serialize, Clone, Debug)]
pub struct JiraProject {
    pub key: String,
    pub name: String,
}

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectConfig {
    pub source_project_key: Option<String>,
    pub target_project_key: Option<String>,
    pub source_project_name: Option<String>,
    pub target_project_name: Option<String>,
}

// --- Copy ticket structs ---

/// Phase 23 D-02 — single-struct args for `copy_ticket_v2` (fixes
/// `clippy::too_many_arguments` without `#[allow]`).
/// All field values flow via `override_values` (D-03); no named field params.
#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CopyTicketV2Args {
    pub source_key: String,
    pub source_base_url: String,
    pub target_base_url: String,
    pub target_issue_type_id: String,
    pub override_values: serde_json::Map<String, serde_json::Value>,
    /// Phase 24 — frontend-generated UUID shared with `log_preview_transformations`
    /// so preview-time and copy-time audit rows appear in the same group in the UI.
    /// `Option` so callers that omit the field (older frontend, tests) still compile.
    pub copy_id: Option<String>,
}

/// Phase 25 — input shape for `resolve_users_preview`.
/// One entry per source user field (assignee, reporter, custom user fields).
#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PreviewUserEntry {
    /// Source Jira username/key (Server v2 `name` field).
    pub username: String,
    /// Email address for domain-based Cloud lookup. None if not available.
    pub email: Option<String>,
}

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CopyStepResult {
    pub step: String,
    pub success: bool,
    pub detail: Option<String>,
}

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CopyTicketResult {
    pub target_key: Option<String>,
    pub target_url: Option<String>,
    pub steps: Vec<CopyStepResult>,
}

// --- Cloud meta command ---

#[tauri::command]
pub async fn fetch_cloud_meta(
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<CloudMeta, AppError> {
    let (base_url, email, api_token) = get_cloud_credentials(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);

    let auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{email}:{api_token}"))
    );

    // Fetch current user accountId
    let myself_resp = client
        .get(format!("{base_url}/rest/api/3/myself"))
        .header("Authorization", &auth)
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to fetch /myself from Cloud Jira".into()))?;
    if !myself_resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Cloud /myself returned status {}",
            myself_resp.status().as_u16()
        )));
    }
    let myself_body: serde_json::Value = myself_resp
        .json()
        .await
        .map_err(|_| AppError::Http("Failed to parse /myself response".into()))?;
    let account_id = myself_body["accountId"].as_str().unwrap_or("").to_string();

    // Fetch priorities
    let prio_resp = client
        .get(format!("{base_url}/rest/api/3/priority"))
        .header("Authorization", &auth)
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to fetch /priority from Cloud Jira".into()))?;
    if !prio_resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Cloud /priority returned status {}",
            prio_resp.status().as_u16()
        )));
    }
    let prio_body: serde_json::Value = prio_resp
        .json()
        .await
        .map_err(|_| AppError::Http("Failed to parse /priority response".into()))?;
    // Jira Cloud /rest/api/3/priority returns either a flat array (older) or a
    // paginated SearchResult object { values: [...], isLast: bool } (newer).
    // Handle both formats defensively.
    let prio_items: &Vec<serde_json::Value> = &match prio_body.as_array() {
        Some(arr) => arr.clone(),
        None => prio_body["values"].as_array().cloned().unwrap_or_default(),
    };
    let priorities: Vec<PriorityOption> = prio_items
        .iter()
        .filter_map(|p| {
            Some(PriorityOption {
                id: p["id"].as_str()?.to_string(),
                name: p["name"].as_str()?.to_string(),
            })
        })
        .collect();

    // Fetch all statuses via the global endpoint — no project key required.
    // /rest/api/3/status returns a flat array of status objects.
    let status_resp = client
        .get(format!("{base_url}/rest/api/3/status"))
        .header("Authorization", &auth)
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to fetch statuses from Cloud Jira".into()))?;
    if !status_resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Cloud /status returned status {}",
            status_resp.status().as_u16()
        )));
    }
    let status_body: serde_json::Value = status_resp
        .json()
        .await
        .map_err(|_| AppError::Http("Failed to parse statuses response".into()))?;
    let statuses: Vec<StatusOption> = status_body
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|s| {
            Some(StatusOption {
                id: s["id"].as_str()?.to_string(),
                name: s["name"].as_str()?.to_string(),
            })
        })
        .collect();

    Ok(CloudMeta {
        available_statuses: statuses,
        available_priorities: priorities,
        current_account_id: account_id,
        cloud_base_url: base_url,
    })
}

// --- Credential commands ---

#[tauri::command]
pub fn store_credential(
    connection_type: String,
    username: String,
    secret: String,
) -> Result<(), AppError> {
    keychain::store_credential(&connection_type, &username, &secret)
}

#[tauri::command]
pub fn get_credential(connection_type: String, username: String) -> Result<String, AppError> {
    keychain::get_credential(&connection_type, &username)
}

#[tauri::command]
pub fn delete_credential(connection_type: String, username: String) -> Result<(), AppError> {
    keychain::delete_credential(&connection_type, &username)
}

// --- Project selection commands ---

#[tauri::command]
pub async fn fetch_server_projects(
    base_url: String,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
    db: State<'_, Arc<Mutex<AuditDb>>>,
) -> Result<Vec<JiraProject>, AppError> {
    let pat = get_server_pat(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    let trimmed_url = base_url.trim_end_matches('/');

    let resp = client
        .get(format!("{trimmed_url}/rest/api/2/project"))
        .header("Authorization", format!("Bearer {pat}"))
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to fetch projects from Server Jira".into()))?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Server /project returned status {}",
            resp.status().as_u16()
        )));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| AppError::Http("Failed to parse /project response".into()))?;

    let projects: Vec<JiraProject> = body
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|p| {
            Some(JiraProject {
                key: p["key"].as_str()?.to_string(),
                name: p["name"].as_str()?.to_string(),
            })
        })
        .collect();

    Ok(projects)
}

#[tauri::command]
pub async fn fetch_cloud_projects(
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
    db: State<'_, Arc<Mutex<AuditDb>>>,
) -> Result<Vec<JiraProject>, AppError> {
    let (base_url, email, api_token) = get_cloud_credentials(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);

    let auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{email}:{api_token}"))
    );

    let resp = client
        .get(format!("{base_url}/rest/api/3/project"))
        .header("Authorization", &auth)
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to fetch projects from Cloud Jira".into()))?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Cloud /project returned status {}",
            resp.status().as_u16()
        )));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| AppError::Http("Failed to parse /project response".into()))?;

    // Jira Cloud /rest/api/3/project returns either a flat array (older) or a
    // paginated object { values: [...] } (newer). Handle both defensively.
    let items: Vec<serde_json::Value> = match body.as_array() {
        Some(arr) => arr.clone(),
        None => body["values"].as_array().cloned().unwrap_or_default(),
    };
    let projects: Vec<JiraProject> = items
        .iter()
        .filter_map(|p| {
            Some(JiraProject {
                key: p["key"].as_str()?.to_string(),
                name: p["name"].as_str()?.to_string(),
            })
        })
        .collect();

    Ok(projects)
}

#[tauri::command]
pub fn get_project_config(
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<ProjectConfig, AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Lock poisoned".into()))?;
    let (source, target, source_name, target_name) = db.get_project_keys()?;
    Ok(ProjectConfig {
        source_project_key: source,
        target_project_key: target,
        source_project_name: source_name,
        target_project_name: target_name,
    })
}

#[tauri::command]
pub fn set_project_config(
    source_project_key: Option<String>,
    target_project_key: Option<String>,
    source_project_name: Option<String>,
    target_project_name: Option<String>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<(), AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Lock poisoned".into()))?;
    db.set_source_project_key(source_project_key.as_deref())?;
    db.set_target_project_key(target_project_key.as_deref())?;
    db.set_source_project_name(source_project_name.as_deref())?;
    db.set_target_project_name(target_project_name.as_deref())?;
    Ok(())
}

// --- Audit commands ---

#[tauri::command]
pub fn get_audit_logs(db: State<'_, Arc<Mutex<AuditDb>>>) -> Result<Vec<AuditEntry>, AppError> {
    let db = db
        .lock()
        .map_err(|_| AppError::Internal("Database lock poisoned".into()))?;
    db.get_all()
}

#[tauri::command]
pub fn clear_audit_logs(db: State<'_, Arc<Mutex<AuditDb>>>) -> Result<(), AppError> {
    let db = db
        .lock()
        .map_err(|_| AppError::Internal("Database lock poisoned".into()))?;
    db.clear_logs()
}

#[tauri::command]
pub fn get_audit_logs_page(
    db: State<'_, Arc<Mutex<AuditDb>>>,
    offset: i64,
    limit: i64,
) -> Result<Vec<AuditEntry>, AppError> {
    let db = db
        .lock()
        .map_err(|_| AppError::Internal("Database lock poisoned".into()))?;
    db.get_page(offset, limit)
}

// --- Mock server commands ---

#[tauri::command]
pub async fn start_mock_servers_cmd(fixtures: State<'_, SharedFixtures>) -> Result<(), AppError> {
    mock_server::start_mock_servers(fixtures.inner().clone()).await
}

// --- Health check / ping commands (for DevStatusPanel) ---

#[tauri::command]
pub async fn ping_mock_servers() -> Result<serde_json::Value, AppError> {
    let client = reqwest::Client::new();
    let v2_ok = client
        .get("http://127.0.0.1:8080/rest/api/2/search")
        .header("authorization", "Bearer ping")
        .send()
        .await
        .is_ok();
    let v3_ok = client
        .post("http://127.0.0.1:8081/rest/api/3/search/jql")
        .header("authorization", "Bearer ping")
        .header("content-type", "application/json")
        .body(r#"{"jql":"order by created"}"#)
        .send()
        .await
        .is_ok();
    Ok(serde_json::json!({
        "server_v2": v2_ok,
        "cloud_v3": v3_ok
    }))
}

// --- Connection test commands ---

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestResult {
    pub success: bool,
    pub username: Option<String>,
    pub server_version: Option<String>,
    pub error_kind: Option<String>,
    pub retry_after_secs: Option<u64>,
}

fn map_error_status(status: u16, resp: &reqwest::Response) -> ConnectionTestResult {
    let error_kind = match status {
        401 => "auth",
        403 => "forbidden",
        429 => "rate_limit",
        s if s >= 500 => "server_error",
        _ => "server_error",
    };
    let retry_after = if status == 429 {
        resp.headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
    } else {
        None
    };
    ConnectionTestResult {
        success: false,
        username: None,
        server_version: None,
        error_kind: Some(error_kind.into()),
        retry_after_secs: retry_after,
    }
}

async fn fetch_server_version(
    client: &reqwest_middleware::ClientWithMiddleware,
    base_url: &str,
    auth_header: &str,
    api_version: u8,
) -> Option<String> {
    let url = format!("{base_url}/rest/api/{api_version}/serverInfo");
    let resp = client
        .get(&url)
        .header("Authorization", auth_header)
        .send()
        .await
        .ok()?;
    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.ok()?;
        body["version"]
            .as_str()
            .map(std::string::ToString::to_string)
    } else {
        None
    }
}

#[tauri::command]
pub async fn test_jira_server_connection(
    base_url: String,
    pat: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
) -> Result<ConnectionTestResult, AppError> {
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    let trimmed_url = base_url.trim_end_matches('/');

    let myself_resp = client
        .get(format!("{trimmed_url}/rest/api/2/myself"))
        .header("Authorization", format!("Bearer {pat}"))
        .send()
        .await;

    let Ok(myself_resp) = myself_resp else {
        return Ok(ConnectionTestResult {
            success: false,
            username: None,
            server_version: None,
            error_kind: Some("network".into()),
            retry_after_secs: None,
        });
    };

    let status = myself_resp.status().as_u16();
    if status != 200 {
        return Ok(map_error_status(status, &myself_resp));
    }

    let myself_body: serde_json::Value = myself_resp
        .json()
        .await
        .map_err(|_| AppError::Http("Failed to parse /myself response".into()))?;
    let username = myself_body["name"]
        .as_str()
        .or_else(|| myself_body["displayName"].as_str())
        .unwrap_or("unknown")
        .to_string();

    let server_version =
        fetch_server_version(&client, trimmed_url, &format!("Bearer {pat}"), 2).await;

    Ok(ConnectionTestResult {
        success: true,
        username: Some(username),
        server_version,
        error_kind: None,
        retry_after_secs: None,
    })
}

#[tauri::command]
pub async fn test_jira_cloud_connection(
    base_url: String,
    email: String,
    api_token: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
) -> Result<ConnectionTestResult, AppError> {
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    let trimmed_url = base_url.trim_end_matches('/');

    let credentials =
        base64::engine::general_purpose::STANDARD.encode(format!("{email}:{api_token}"));
    let auth_header = format!("Basic {credentials}");

    let myself_resp = client
        .get(format!("{trimmed_url}/rest/api/3/myself"))
        .header("Authorization", auth_header.clone())
        .send()
        .await;

    let Ok(myself_resp) = myself_resp else {
        return Ok(ConnectionTestResult {
            success: false,
            username: None,
            server_version: None,
            error_kind: Some("network".into()),
            retry_after_secs: None,
        });
    };

    let status = myself_resp.status().as_u16();
    if status != 200 {
        return Ok(map_error_status(status, &myself_resp));
    }

    let myself_body: serde_json::Value = myself_resp
        .json()
        .await
        .map_err(|_| AppError::Http("Failed to parse /myself response".into()))?;
    let username = myself_body["displayName"]
        .as_str()
        .unwrap_or("unknown")
        .to_string();

    let server_version = fetch_server_version(&client, trimmed_url, &auth_header, 3).await;

    Ok(ConnectionTestResult {
        success: true,
        username: Some(username),
        server_version,
        error_kind: None,
        retry_after_secs: None,
    })
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), AppError> {
    // Only allow http/https URLs
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err(AppError::Internal("Only http/https URLs allowed".into()));
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| AppError::Internal(format!("Failed to open URL: {e}")))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .spawn()
            .map_err(|e| AppError::Internal(format!("Failed to open URL: {e}")))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| AppError::Internal(format!("Failed to open URL: {e}")))?;
    }
    Ok(())
}

#[tauri::command]
pub fn ping_keychain() -> Result<bool, AppError> {
    // Try to store and immediately delete a test value
    let test_type = "pmkar-health-check";
    let test_user = "ping";
    match keychain::store_credential(test_type, test_user, "ping") {
        Ok(()) => {
            let _ = keychain::delete_credential(test_type, test_user);
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}

// --- Ticket fetch commands ---

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FetchTicketsResult {
    pub issues: Vec<serde_json::Value>,
    pub total: u64,
    pub triage_map: HashMap<String, TriageEntryResponse>,
    /// True when the matching set exceeded `MAX_PAGINATION_ITEMS` and the result
    /// was capped. The frontend should display a warning so users know to tighten
    /// their JQL.
    pub truncated: bool,
}

#[tauri::command]
pub async fn fetch_tickets(
    base_url: String,
    jql: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<FetchTicketsResult, AppError> {
    use crate::jira_client::{MAX_PAGINATION_ITEMS, SEARCH_PAGE_SIZE};

    let pat = get_server_pat(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    let trimmed_url = base_url.trim_end_matches('/');

    let encoded_jql = urlencoding::encode(&jql);

    // Paginate `/rest/api/2/search` using `startAt`. We iterate until either the
    // matching set is fully drained (`all_issues.len() >= total`) or we hit the
    // `MAX_PAGINATION_ITEMS` upper bound, in which case we set `truncated=true`
    // so the frontend can warn the user. On any HTTP/parse error we return Err
    // so the caller does not act on a partial result.
    //
    // See debug session: jira-fetch-pagination-50-cap.
    let mut all_issues: Vec<serde_json::Value> = Vec::new();
    // `total` is assigned inside the loop on each page. The initial 0 is the
    // sentinel for "no pages fetched yet"; in practice the loop always runs at
    // least once so the value is overwritten before use.
    #[allow(unused_assignments)]
    let mut total: u64 = 0;
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
            .map_err(|_| AppError::Http("Failed to fetch tickets".into()))?;

        if !resp.status().is_success() {
            return Err(AppError::Http(format!(
                "Jira search returned status {}",
                resp.status().as_u16()
            )));
        }

        let body: serde_json::Value = resp
            .json()
            .await
            .map_err(|_| AppError::Http("Failed to parse search response".into()))?;

        let page_issues = body["issues"].as_array().cloned().unwrap_or_default();
        // The server's reported `total` from the most recent page is authoritative.
        total = body["total"].as_u64().unwrap_or(0);
        let page_len = page_issues.len() as u64;

        all_issues.extend(page_issues);

        // Stop when we've drained the matching set, or the server returned an
        // empty page (defensive against servers that report `total` larger than
        // what they actually serve, which would otherwise spin forever).
        if page_len == 0 || all_issues.len() as u64 >= total {
            break;
        }

        if all_issues.len() as u64 >= MAX_PAGINATION_ITEMS {
            truncated = true;
            // MAX_PAGINATION_ITEMS = 1000 fits in usize on every supported target.
            all_issues.truncate(usize::try_from(MAX_PAGINATION_ITEMS).unwrap_or(usize::MAX));
            break;
        }

        start_at += SEARCH_PAGE_SIZE;
    }

    // Update triage state for new tickets; remove done tickets.
    // IMPORTANT: this must iterate over ALL fetched issues across pages so the
    // triage_map stays in sync with the full result set.
    {
        let tdb = triage_db
            .lock()
            .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
        let existing = tdb.get_all_triage()?;
        let mut done_keys: Vec<String> = Vec::new();
        for issue in &all_issues {
            if let Some(key) = issue["key"].as_str() {
                let status_category = issue["fields"]["status"]["statusCategory"]["key"]
                    .as_str()
                    .unwrap_or("");
                if status_category == "done" {
                    done_keys.push(key.to_string());
                } else if !existing.contains_key(key) {
                    tdb.set_triage(key, "new")?;
                }
            }
        }
        if !done_keys.is_empty() {
            tdb.delete_triage_entries(&done_keys)?;
        }
        // Update last_fetched_at
        let now = chrono::Utc::now().to_rfc3339();
        tdb.update_last_fetched(&now)?;
    }

    // Get full triage map after updates
    let triage_map = {
        let tdb = triage_db
            .lock()
            .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
        let raw = tdb.get_all_triage()?;
        raw.into_iter()
            .map(|(key, (state, copied_key))| (key, TriageEntryResponse { state, copied_key }))
            .collect()
    };

    Ok(FetchTicketsResult {
        issues: all_issues,
        total,
        triage_map,
        truncated,
    })
}

#[tauri::command]
pub async fn fetch_ticket_detail(
    base_url: String,
    issue_key: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<serde_json::Value, AppError> {
    let pat = get_server_pat(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    let trimmed_url = base_url.trim_end_matches('/');

    let url = format!(
        "{trimmed_url}/rest/api/2/issue/{issue_key}?expand=renderedFields,changelog,names&fields=*all"
    );

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {pat}"))
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to fetch ticket detail".into()))?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Jira issue detail returned status {}",
            resp.status().as_u16()
        )));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| AppError::Http("Failed to parse issue detail response".into()))?;

    Ok(body)
}

#[tauri::command]
pub async fn fetch_worklog(
    base_url: String,
    issue_key: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<serde_json::Value, AppError> {
    let pat = get_server_pat(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    let trimmed_url = base_url.trim_end_matches('/');

    let url = format!("{trimmed_url}/rest/api/2/issue/{issue_key}/worklog");

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {pat}"))
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to fetch worklog".into()))?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Jira worklog returned status {}",
            resp.status().as_u16()
        )));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| AppError::Http("Failed to parse worklog response".into()))?;

    Ok(body)
}

#[tauri::command]
pub async fn fetch_changelog(
    base_url: String,
    issue_key: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<serde_json::Value, AppError> {
    let pat = get_server_pat(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    let trimmed_url = base_url.trim_end_matches('/');

    let url = format!("{trimmed_url}/rest/api/2/issue/{issue_key}?expand=changelog");

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {pat}"))
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to fetch changelog".into()))?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Jira changelog returned status {}",
            resp.status().as_u16()
        )));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| AppError::Http("Failed to parse changelog response".into()))?;

    // Extract just the changelog portion
    let changelog = body
        .get("changelog")
        .cloned()
        .unwrap_or(serde_json::json!({"histories": []}));
    Ok(changelog)
}

#[tauri::command]
pub async fn fetch_jira_image(
    image_url: String,
    base_url: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<String, AppError> {
    // Security: prevent SSRF by comparing scheme + host + port exactly.
    // starts_with() is vulnerable to prefix spoofing (e.g. jira.example.com.evil.com).
    let base_parsed =
        url::Url::parse(&base_url).map_err(|_| AppError::Internal("Invalid base URL".into()))?;
    let img_parsed =
        url::Url::parse(&image_url).map_err(|_| AppError::Internal("Invalid image URL".into()))?;
    if img_parsed.scheme() != base_parsed.scheme()
        || img_parsed.host() != base_parsed.host()
        || img_parsed.port() != base_parsed.port()
    {
        return Err(AppError::Internal(
            "URL not from configured Jira instance".into(),
        ));
    }

    let pat = get_server_pat(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);

    let resp = client
        .get(&image_url)
        .header("Authorization", format!("Bearer {pat}"))
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to fetch image".into()))?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "Image fetch returned status {}",
            resp.status().as_u16()
        )));
    }

    let mime = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/png")
        .to_string();

    let bytes = resp
        .bytes()
        .await
        .map_err(|_| AppError::Http("Failed to read image bytes".into()))?;

    let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}

// --- Triage state commands ---

#[derive(serde::Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TriageEntryResponse {
    pub state: String,
    pub copied_key: Option<String>,
}

#[tauri::command]
pub fn get_triage_state(
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<HashMap<String, TriageEntryResponse>, AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    let raw = db.get_all_triage()?;
    let result = raw
        .into_iter()
        .map(|(key, (state, copied_key))| (key, TriageEntryResponse { state, copied_key }))
        .collect();
    Ok(result)
}

#[tauri::command]
pub fn set_triage_state(
    ticket_key: String,
    state: String,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<(), AppError> {
    // Validate state value
    match state.as_str() {
        "new" | "seen" | "ignored" | "copied" | "handled" => {}
        _ => {
            return Err(AppError::Internal(format!(
                "Invalid triage state: '{state}'. Must be one of: new, seen, ignored, copied, handled"
            )));
        }
    }
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    db.set_triage(&ticket_key, &state)
}

#[tauri::command]
pub fn delete_done_triage(
    ticket_keys: Vec<String>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<usize, AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    db.delete_triage_entries(&ticket_keys)
}

// --- Fetch config commands ---

#[tauri::command]
pub fn get_fetch_config(
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<FetchConfig, AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    db.get_fetch_config()
}

#[tauri::command]
pub fn set_fetch_config(
    config: FetchConfig,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<(), AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    db.set_fetch_config(&config)
}

// --- User search command ---

#[tauri::command]
pub async fn search_jira_users(
    base_url: String,
    query: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let pat = get_server_pat(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    let trimmed_url = base_url.trim_end_matches('/');

    let encoded_query = urlencoding::encode(&query);
    let url = format!("{trimmed_url}/rest/api/2/user/search?username={encoded_query}");

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {pat}"))
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to search users".into()))?;

    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "User search returned status {}",
            resp.status().as_u16()
        )));
    }

    let users: Vec<serde_json::Value> = resp
        .json()
        .await
        .map_err(|e| AppError::Http(format!("Failed to parse user search response: {e}")))?;

    Ok(users)
}

// --- Target user domain search command ---

#[tauri::command]
pub async fn search_jira_users_by_domain(
    base_url: String,
    domain: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<serde_json::Value>, AppError> {
    const PAGE_SIZE: usize = 50;

    // Search the Jira Server (source) using the Server PAT and Jira v2 REST API.
    // Querying "@domain" on the username field matches users whose email address
    // contains that domain — the same pattern used by search_jira_users.
    let pat = get_server_pat(triage_db.inner())?;
    let trimmed_url = base_url.trim_end_matches('/').to_string();

    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);

    let clean_domain = domain.trim_start_matches('@');
    let query = format!("@{clean_domain}");
    let encoded_query = urlencoding::encode(&query);

    let mut all_users: Vec<serde_json::Value> = Vec::new();
    let mut start_at: usize = 0;

    loop {
        let url = format!(
            "{trimmed_url}/rest/api/2/user/search?username={encoded_query}&maxResults={PAGE_SIZE}&startAt={start_at}"
        );

        let resp = client
            .get(&url)
            .header("Authorization", format!("Bearer {pat}"))
            .send()
            .await
            .map_err(|_| AppError::Http("Failed to search users by domain".into()))?;

        if !resp.status().is_success() {
            return Err(AppError::Http(format!(
                "User domain search returned status {} at startAt={start_at}",
                resp.status().as_u16()
            )));
        }

        let page: Vec<serde_json::Value> = resp
            .json()
            .await
            .map_err(|e| AppError::Http(format!("Failed to parse user search page: {e}")))?;
        let page_len = page.len();
        all_users.extend(page);

        if page_len < PAGE_SIZE {
            break;
        }
        start_at += PAGE_SIZE;
    }

    Ok(all_users)
}

#[tauri::command]
pub async fn search_cloud_users_by_query(
    query: String,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let (stored_base_url, cloud_email, cloud_api_token) = get_cloud_credentials(triage_db.inner())?;
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD
            .encode(format!("{cloud_email}:{cloud_api_token}"))
    );
    let trimmed_base = stored_base_url.trim_end_matches('/').to_string();
    let client = reqwest::Client::new();
    let resolver = crate::field_transform::user::UserResolver::new(client, cloud_auth, trimmed_base);
    Ok(resolver.fetch_users_by_query(&query).await.unwrap_or_default())
}

// --- Phase 25: Preview-time resolution commands ---

/// Phase 25 — converts source issue description HTML to ADF at preview-open time.
///
/// Takes `renderedFields.description` (already fetched by `fetch_ticket_detail`)
/// and calls `wiki_to_adf::convert_and_postprocess` with an empty user map.
/// User mention nodes degrade to plain `@username` text at preview time — this is
/// acceptable because the description is displayed read-only in the preview modal
/// and the full resolution (with mention rewriting) happens at copy commit time
/// via `copy_ticket_v2`.
#[tauri::command]
#[allow(clippy::unused_async)] // Tauri requires async fn for commands even when no await is needed
pub async fn resolve_description_to_adf(html: String) -> Result<serde_json::Value, AppError> {
    let adf = crate::field_transform::wiki_to_adf::convert_and_postprocess(
        &html,
        &HashMap::<String, Option<String>>::new(),
    );
    Ok(adf)
}

/// Phase 25 — resolves source user identifiers to Cloud user objects at preview-open time.
///
/// Accepts a list of `{ username, email }` pairs extracted from source ticket user fields.
/// Groups by email domain (TRAN-06: one HTTP call per unique domain) and issues Cloud
/// `/rest/api/3/user/search` calls. Returns a parallel `Vec` where index N corresponds
/// to `users[N]`: resolved users get their full Cloud object; unresolvable users get `null`.
///
/// Uses a plain `reqwest::Client` (not the audited client) — preview resolution must not
/// pollute the HTTP audit log.
#[tauri::command]
pub async fn resolve_users_preview(
    users: Vec<PreviewUserEntry>,
    cloud_base_url: String,
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<serde_json::Value>, AppError> {
    if users.is_empty() {
        return Ok(vec![]);
    }

    // Retrieve Cloud credentials from OS keychain.
    // Use the stored base URL from credentials rather than the frontend-supplied
    // cloud_base_url argument to prevent origin confusion / SSRF.
    let (stored_base_url, cloud_email, cloud_api_token) = get_cloud_credentials(triage_db.inner())?;
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD
            .encode(format!("{cloud_email}:{cloud_api_token}"))
    );
    let trimmed_base = stored_base_url.trim_end_matches('/').to_string();
    let _ = cloud_base_url; // parameter retained in signature for API compat; not used

    let client = reqwest::Client::new();
    let resolver = crate::field_transform::user::UserResolver::new(
        client,
        cloud_auth,
        trimmed_base,
    );

    // Group by email domain — mirrors resolve_batch domain-batching (TRAN-06).
    // by_domain: domain → Vec<(index, username)>
    // no_domain: Vec<(index, username)>
    let mut by_domain: std::collections::HashMap<String, Vec<(usize, String)>> =
        std::collections::HashMap::new();
    let mut no_domain: Vec<(usize, String)> = Vec::new();

    for (i, entry) in users.iter().enumerate() {
        if let Some(email) = &entry.email {
            if let Some(domain) = email.split('@').nth(1) {
                if !domain.is_empty() {
                    by_domain
                        .entry(domain.to_string())
                        .or_default()
                        .push((i, entry.username.clone()));
                    continue;
                }
            }
        }
        no_domain.push((i, entry.username.clone()));
    }

    // Allocate result slots (null = unresolved).
    let mut results: Vec<serde_json::Value> = vec![serde_json::Value::Null; users.len()];

    // Domain-batched lookups.
    for (domain, entries_in_domain) in &by_domain {
        let cloud_users = resolver
            .fetch_users_by_domain(domain)
            .await
            .unwrap_or_default();
        for (idx, username) in entries_in_domain {
            let email = users[*idx].email.as_deref();
            if let Some(matched) = find_best_match(&cloud_users, email, username) {
                results[*idx] = matched;
            }
        }
    }

    // No-domain fallback: username query per entry.
    for (idx, username) in &no_domain {
        let cloud_users = resolver
            .fetch_users_by_query(username)
            .await
            .unwrap_or_default();
        if let Some(matched) = find_best_match(&cloud_users, None, username) {
            results[*idx] = matched;
        }
    }

    Ok(results)
}

/// Returns the best-matching Cloud user object from `results` for the given `email` / `username`.
/// Mirrors the privacy-mode-aware logic in `user.rs::match_user_in_results` but returns the
/// full user JSON object instead of just the `accountId` string.
///
/// 1. Exact email match → return that user object.
/// 2. Privacy mode (no `emailAddress` in any result) + exactly one result → return it.
/// 3. Single result whose `displayName` matches username (case-insensitive) → return it.
/// 4. None.
fn find_best_match(
    results: &[serde_json::Value],
    email: Option<&str>,
    username: &str,
) -> Option<serde_json::Value> {
    if results.is_empty() {
        return None;
    }
    if let Some(em) = email {
        let exact: Vec<&serde_json::Value> = results
            .iter()
            .filter(|u| u.get("emailAddress").and_then(|x| x.as_str()) == Some(em))
            .collect();
        if exact.len() == 1 {
            return Some(exact[0].clone());
        }
        let any_email = results
            .iter()
            .any(|u| u.get("emailAddress").and_then(|x| x.as_str()).is_some());
        if !any_email && results.len() == 1 {
            return Some(results[0].clone());
        }
    }
    if results.len() == 1 {
        let display = results[0]
            .get("displayName")
            .and_then(|x| x.as_str())
            .unwrap_or("");
        if display.eq_ignore_ascii_case(username) {
            return Some(results[0].clone());
        }
    }
    None
}

// --- Field discovery commands (Phase 17) ---

use crate::field_discovery::{self, FieldSchema, FieldSide, IssueTypeRef, ProbeResult};
use crate::field_mapping_db::{hash_field_value, redact_credential_value, FieldMappingDb};
use crate::field_transform::component::ComponentResolver;
use crate::field_transform::user::UserResolver;
use crate::field_transform::version::VersionResolver;
use crate::field_transform::{apply_mapping, FieldMappingRow, TransformContext};

/// Source v2 global field list. Cache-first via `get_or_fetch_source_global`
/// (`side='source'`, `project_key=NULL`, `issuetype_id=NULL` — D-14).
///
/// # Audit note
/// This command uses a bare `reqwest::Client` and therefore does not log HTTP
/// calls to the audit trail. `AuditDb` state is not threaded into this command.
/// TODO: thread `AuditDb` state to enable audit logging for field discovery
/// (same pattern as `fetch_tickets` which uses `build_audited_client`).
#[tauri::command]
pub async fn discover_source_fields(
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<Vec<FieldSchema>, AppError> {
    let pat = get_server_pat(triage_db.inner())?;
    let base_url = {
        let db_guard = triage_db
            .lock()
            .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
        let metas = db_guard.get_all_connection_meta()?;
        metas
            .iter()
            .find(|m| m.connection_type == "server")
            .map(|m| m.base_url.trim_end_matches('/').to_string())
            .ok_or_else(|| AppError::Keychain("No server connection configured".into()))?
    };
    let client = reqwest::Client::new();
    field_discovery::get_or_fetch_source_global(mapping_db.inner(), &client, &base_url, &pat).await
}

/// Target v3 paginated createmeta for a specific issue type. Cache-first via
/// `get_or_fetch_target_schema`; subsequent calls hit the cache (D-15).
///
/// # Audit note
/// This command uses a bare `reqwest::Client` and therefore does not log HTTP
/// calls to the audit trail. `AuditDb` state is not threaded into this command.
/// TODO: thread `AuditDb` state to enable audit logging for field discovery
/// (same pattern as `fetch_tickets` which uses `build_audited_client`).
#[tauri::command]
pub async fn get_target_field_schema_for_issuetype(
    project_key: String,
    issuetype_id: String,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<Vec<FieldSchema>, AppError> {
    let (base_url, cloud_email, api_token) = get_cloud_credentials(triage_db.inner())?;
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{cloud_email}:{api_token}"))
    );
    let client = reqwest::Client::new();
    field_discovery::get_or_fetch_target_schema(
        mapping_db.inner(),
        &client,
        &base_url,
        &cloud_auth,
        &project_key,
        &issuetype_id,
    )
    .await
}

/// Connection-time probe (D-05/D-07/D-08). Returns a structured `ProbeResult`
/// so the frontend can render a banner deterministically. Never returns `Err`
/// for HTTP/network/auth failures — always returns `ProbeResult` so the banner
/// renders correctly. Returns `Err` only for fatal local errors (lock poison).
///
/// Pitfall C: short-circuits gracefully when target project key is not yet
/// configured (first-run users must not see a failure banner).
#[tauri::command]
pub async fn probe_createmeta(
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<ProbeResult, AppError> {
    // Pitfall C: skip probe when target project key is absent
    let target_project_key: Option<String> = {
        let db_guard = triage_db
            .lock()
            .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
        let (_, target, _, _) = db_guard.get_project_keys()?;
        target
    };
    let project_key = match target_project_key {
        Some(k) if !k.is_empty() => k,
        _ => {
            return Ok(ProbeResult {
                ok: false,
                endpoint_url: String::new(),
                status_code: None,
                hint: Some("No target project key configured. Probe skipped.".into()),
            });
        }
    };
    let Ok((base_url, cloud_email, api_token)) = get_cloud_credentials(triage_db.inner()) else {
        return Ok(ProbeResult {
            ok: false,
            endpoint_url: String::new(),
            status_code: None,
            hint: Some("No cloud credential configured. Probe skipped.".into()),
        });
    };
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{cloud_email}:{api_token}"))
    );
    let client = reqwest::Client::new();
    field_discovery::probe_paginated_createmeta(&client, &base_url, &cloud_auth, &project_key).await
}

/// Pre-warm the issue-type list for the given target project (D-01 + D-15
/// reconciliation). Best-effort: returns an empty `Vec` on failure rather than
/// `Err` so the frontend pre-warm does not block the UI.
///
/// Note: pre-warm fires from the frontend AFTER probe success (Pitfall E —
/// all managed states are ready before spawn).
#[tauri::command]
pub async fn pre_warm_target_issue_types(
    project_key: String,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<IssueTypeRef>, AppError> {
    let Ok((base_url, cloud_email, api_token)) = get_cloud_credentials(triage_db.inner()) else {
        return Ok(vec![]);
    };
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{cloud_email}:{api_token}"))
    );
    let client = reqwest::Client::new();
    match field_discovery::fetch_target_issue_types(&client, &base_url, &cloud_auth, &project_key)
        .await
    {
        Ok(list) => Ok(list),
        Err(_) => Ok(vec![]),
    }
}

/// Manual cache refresh (Phase 21 wires the UI button). Accepts `side` =
/// "source"|"target" and optional `project_key` + `issuetype_id`.
/// Passing both as `null` clears the source global cache (D-14).
#[tauri::command]
pub fn refresh_field_schema_cache(
    side: String,
    project_key: Option<String>,
    issuetype_id: Option<String>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<(), AppError> {
    let side_enum = match side.as_str() {
        "source" => FieldSide::Source,
        "target" => FieldSide::Target,
        _ => {
            return Err(AppError::Internal(format!(
                "refresh_field_schema_cache: invalid side '{side}'"
            )));
        }
    };
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.clear_cache_for(side_enum, project_key.as_deref(), issuetype_id.as_deref())?;
    Ok(())
}

// --- Field mapping CRUD commands (Phase 19) ---

/// Return all mapping rows ordered by `id ASC` (D-06). Returns the seeded defaults
/// from Plan 01 plus any user-added rows. Phase 21 (editor) and Phase 23 (cutover)
/// consume this.
#[tauri::command]
pub fn get_field_mapping(
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<Vec<FieldMappingRow>, AppError> {
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.get_all_mapping_rows()
}

/// Upsert a single mapping row by `source_field_id` (D-04). On conflict, replaces
/// `target_field_id`, `transformer_kind`, and schema JSON; `created_at` is preserved.
/// Phase 21 calls once per changed row.
#[tauri::command]
pub fn set_field_mapping(
    row: FieldMappingRow,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<(), AppError> {
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.upsert_mapping_row(&row)
}

/// Delete a mapping row by `source_field_id` (D-05). Idempotent: returns `Ok(())`
/// even when the row does not exist. Phase 21's "remove row" button calls this.
#[tauri::command]
pub fn delete_field_mapping(
    source_field_id: String,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<(), AppError> {
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.delete_mapping_row(&source_field_id)
}

// --- Connection meta commands ---

#[tauri::command]
pub fn set_connection_meta(
    meta: ConnectionMeta,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<(), AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    db.set_connection_meta(&meta)
}

#[tauri::command]
pub fn get_all_connection_meta(
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<ConnectionMeta>, AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
    db.get_all_connection_meta()
}

// --- Copy ticket v2 command ---

/// Phase 23 CUTV-01 — replacement for `copy_ticket`. Drives the mapping engine
/// end-to-end (`apply_mapping` → override merge → create issue → helpers).
/// Reads `target_project_key` from connection settings — no hardcoded project
/// key literal (CUTV-04). Per-row audit logging happens at preview-open via
/// `log_preview_transformations` (quick task 260430-0tj), not here.
#[allow(clippy::too_many_lines)]
#[tauri::command]
pub async fn copy_ticket_v2(
    args: CopyTicketV2Args,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<CopyTicketResult, AppError> {
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    let mut steps: Vec<CopyStepResult> = Vec::new();

    let trimmed_source = args.source_base_url.trim_end_matches('/').to_string();
    let trimmed_target = args.target_base_url.trim_end_matches('/').to_string();

    // ── Phase 1 — Load credentials and target project key ────────────────────
    let (_, cloud_email, cloud_api_token) = get_cloud_credentials(triage_db.inner())?;
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD
            .encode(format!("{cloud_email}:{cloud_api_token}"))
    );
    let server_pat = get_server_pat(triage_db.inner())?;

    // CUTV-04: target_project_key from connection settings — never hardcoded.
    let target_project_key = {
        let g = triage_db
            .lock()
            .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
        g.get_target_project_key()?.ok_or_else(|| {
            AppError::Internal(
                "No target_project_key configured. Open Settings to choose a target project."
                    .into(),
            )
        })?
    };

    // D-04: Load saved mapping rows from mapping.db inside the command.
    let mapping_rows: Vec<FieldMappingRow> = {
        let g = mapping_db
            .lock()
            .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
        g.get_all_mapping_rows()?
    };

    // ── Phase 2 — Fetch source issue with renderedFields ─────────────────────
    let source_url = format!(
        "{trimmed_source}/rest/api/2/issue/{}?expand=renderedFields&fields=*all",
        args.source_key
    );
    let source_resp = client
        .get(&source_url)
        .header("Authorization", format!("Bearer {server_pat}"))
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to fetch source issue".into()))?;

    if !source_resp.status().is_success() {
        return Ok(CopyTicketResult {
            target_key: None,
            target_url: None,
            steps: vec![CopyStepResult {
                step: "fetch_source".to_string(),
                success: false,
                detail: Some(format!(
                    "Source issue fetch returned status {}",
                    source_resp.status().as_u16()
                )),
            }],
        });
    }

    let source_body: serde_json::Value = source_resp
        .json()
        .await
        .map_err(|_| AppError::Http("Failed to parse source issue response".into()))?;

    steps.push(CopyStepResult {
        step: "fetch_source".to_string(),
        success: true,
        detail: None,
    });

    let source_summary = source_body["fields"]["summary"]
        .as_str()
        .unwrap_or(&args.source_key)
        .to_string();

    // ── Phase 3 — Run apply_mapping (Phase 18 two-phase pipeline) ────────────
    let plain_client = reqwest::Client::new();
    let user_resolver = UserResolver::new(
        plain_client.clone(),
        cloud_auth.clone(),
        trimmed_target.clone(),
    );
    let version_resolver = VersionResolver::new(
        plain_client.clone(),
        cloud_auth.clone(),
        trimmed_target.clone(),
    );
    let component_resolver = ComponentResolver::new(
        plain_client.clone(),
        cloud_auth.clone(),
        trimmed_target.clone(),
    );

    // Phase 1 — batch user resolution (TRAN-06 one-HTTP-per-domain).
    let user_map = user_resolver
        .resolve_batch(&source_body, &mapping_rows)
        .await;

    // Phase 2 — apply mapping.
    let ctx_transform = TransformContext {
        client: &plain_client,
        cloud_auth: &cloud_auth,
        cloud_base_url: &trimmed_target,
        target_project_key: &target_project_key,
        user_resolver: &user_resolver,
        version_resolver: &version_resolver,
        component_resolver: &component_resolver,
        user_map: &user_map,
    };
    let mut resolved = apply_mapping(&source_body, &mapping_rows, &ctx_transform)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // ── Phase 5 — Merge override_values on top of resolved.fields ────────────
    for (k, v) in &args.override_values {
        resolved.fields.insert(k.clone(), v.clone());
    }

    // Phase 24 — Copy-time audit entries written AFTER override merge so
    // resolved.fields contains the final values actually sent to Jira Cloud.
    // Best-effort: transaction and per-row errors are swallowed so an audit
    // hiccup never blocks the copy operation.
    {
        let copy_id = args.copy_id.clone().unwrap_or_else(|| {
            uuid::Uuid::new_v4().to_string()
        });
        let mdb = mapping_db
            .lock()
            .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
        write_copy_time_audit(&mdb, &copy_id, &mapping_rows, &source_body, &resolved, &args.override_values);
    }

    // ── Phase 6 — Create issue in Cloud ──────────────────────────────────────
    // Per CUTV-04 + D-04: project key from settings, issue type from args.
    // The summary/priority/assignee/etc come entirely from resolved.fields +
    // overrides (D-03 — no named field params).
    let mut create_fields = resolved.fields.clone();
    create_fields.insert(
        "project".to_string(),
        serde_json::json!({ "key": target_project_key }),
    );
    create_fields.insert(
        "issuetype".to_string(),
        serde_json::json!({ "id": args.target_issue_type_id }),
    );
    let create_body = serde_json::json!({ "fields": create_fields });

    let create_resp = client
        .post(format!("{trimmed_target}/rest/api/3/issue"))
        .header("Authorization", &cloud_auth)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&create_body).map_err(|e| {
            AppError::Serialization(format!("Failed to serialize create body: {e}"))
        })?)
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to create issue in Cloud Jira".into()))?;

    let create_status = create_resp.status().as_u16();
    // Read the body once — for both success and failure paths so we can
    // surface Jira's actual error response in CopyStepResult.detail when the
    // create fails (debug session: copy-400-and-logs-crash). This is the
    // user's primary diagnostic; without it they must dig into the audit log.
    let create_text = create_resp.text().await.unwrap_or_default();
    if !(200..300).contains(&create_status) {
        steps.push(CopyStepResult {
            step: "create_issue".to_string(),
            success: false,
            detail: Some(format_create_failure_detail(create_status, &create_text)),
        });
        return Ok(CopyTicketResult {
            target_key: None,
            target_url: None,
            steps,
        });
    }

    let create_json: serde_json::Value =
        serde_json::from_str(&create_text).unwrap_or(serde_json::json!({}));
    let target_key = create_json["key"].as_str().unwrap_or("").to_string();
    if target_key.is_empty() {
        steps.push(CopyStepResult {
            step: "create_issue".to_string(),
            success: false,
            detail: Some("Issue creation response missing 'key' field".into()),
        });
        return Ok(CopyTicketResult {
            target_key: None,
            target_url: None,
            steps,
        });
    }
    steps.push(CopyStepResult {
        step: "create_issue".to_string(),
        success: true,
        detail: Some(target_key.clone()),
    });

    // ── Phase 7 — Construct CopyContext and delegate to shared helpers ────────
    let ctx = crate::copy_pipeline::CopyContext {
        client: client.clone(),
        cloud_auth: cloud_auth.clone(),
        server_pat: server_pat.clone(),
        source_base_url: trimmed_source.clone(),
        target_base_url: trimmed_target.clone(),
        source_key: args.source_key.clone(),
        target_key: target_key.clone(),
        target_project_key: target_project_key.clone(),
    };
    steps.push(crate::copy_pipeline::add_remote_link(&ctx, &source_summary).await);
    steps.extend(crate::copy_pipeline::copy_attachments(&ctx, &source_body).await);
    steps.extend(crate::copy_pipeline::copy_comments(&ctx, &source_body).await);
    steps.extend(crate::copy_pipeline::copy_worklogs(&ctx).await);
    let subtasks_arr = source_body["fields"]["subtasks"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    steps.extend(crate::copy_pipeline::copy_subtasks(&ctx, &subtasks_arr).await);

    // ── Phase 8 — Update triage state ────────────────────────────────────────
    {
        let g = triage_db
            .lock()
            .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
        g.set_triage_copied(&args.source_key, &target_key)?;
    }
    steps.push(CopyStepResult {
        step: "update_triage".to_string(),
        success: true,
        detail: Some(target_key.clone()),
    });

    Ok(CopyTicketResult {
        target_key: Some(target_key.clone()),
        target_url: Some(format!("{trimmed_target}/browse/{target_key}")),
        steps,
    })
}

/// Format a user-facing detail for a failed `create_issue` response. Embeds
/// Jira's response body (parsed + compacted, or truncated raw text) so the
/// user can see the actual error inline in `CopyResultPage` without opening
/// the audit log (debug session: copy-400-and-logs-crash).
///
/// Returns a string like:
///   `"Issue creation returned status 400: {\"errorMessages\":[],\"errors\":{\"project\":\"valid project is required\"}}"`
///
/// Truncates raw bodies to 1024 chars so a runaway HTML error page does not
/// blow out the result modal layout.
fn format_create_failure_detail(status: u16, body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return format!("Issue creation returned status {status}");
    }
    // If the body is JSON, compact it (single-line) so the failure detail stays
    // on a tractable footprint. Otherwise embed the raw text truncated.
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if let Ok(compact) = serde_json::to_string(&parsed) {
            // JSON compact path: walk back to a valid UTF-8 char boundary before
            // slicing so we never split a multi-byte sequence.
            let mut end = 1024_usize.min(compact.len());
            while end > 0 && !compact.is_char_boundary(end) {
                end -= 1;
            }
            let truncated = if compact.len() > 1024 {
                format!("{}…", &compact[..end])
            } else {
                compact
            };
            return format!("Issue creation returned status {status}: {truncated}");
        }
    }
    // Raw text path: must respect char boundaries.
    let mut end = 1024_usize.min(trimmed.len());
    while end > 0 && !trimmed.is_char_boundary(end) {
        end -= 1;
    }
    let truncated = if trimmed.len() > 1024 {
        format!("{}…", &trimmed[..end])
    } else {
        trimmed.to_string()
    };
    format!("Issue creation returned status {status}: {truncated}")
}

/// Phase 24 — Write per-field copy-time audit rows to `mapping_audit_log` after
/// `apply_mapping` resolves values and after `override_values` are merged.
/// Extracted as a free function so unit tests can call it directly with an
/// in-memory `FieldMappingDb` without going through the full Tauri command layer.
///
/// Best-effort: the entire write is wrapped in a single `SQLite` transaction;
/// per-row and transaction errors are swallowed so an audit hiccup never blocks
/// the copy operation.
fn write_copy_time_audit(
    mdb: &crate::field_mapping_db::FieldMappingDb,
    copy_id: &str,
    mapping_rows: &[crate::field_transform::FieldMappingRow],
    source_body: &serde_json::Value,
    resolved: &crate::field_transform::ResolvedFields,
    override_keys: &serde_json::Map<String, serde_json::Value>,
) {
    let timestamp = chrono::Utc::now().to_rfc3339();
    let _ = mdb.begin_transaction();
    for row in mapping_rows {
        if row.target_field_id.is_empty() {
            continue;
        }
        let src_path = format!("/fields/{}", row.source_field_id);
        let src_val = source_body
            .pointer(&src_path)
            .cloned()
            .unwrap_or(serde_json::Value::Null);
        let tgt_val = resolved
            .fields
            .get(&row.target_field_id)
            .cloned()
            .unwrap_or(serde_json::Value::Null);

        let (outcome, gap_kind, failure_reason): (&str, Option<&str>, Option<&str>) =
            if !tgt_val.is_null() {
                ("copied", None, None)
            } else if src_val.is_null() {
                ("skipped", None, Some("source value missing"))
            } else {
                let gap = resolved.gaps.iter().find(|g| match g {
                    crate::field_transform::GapVariant::Person(p) => {
                        p.target_field_id == row.target_field_id
                    }
                    crate::field_transform::GapVariant::Version(v) => {
                        v.target_field_id == row.target_field_id
                    }
                    crate::field_transform::GapVariant::Component(c) => {
                        c.target_field_id == row.target_field_id
                    }
                });
                match gap {
                    Some(crate::field_transform::GapVariant::Person(_)) => {
                        ("failed", Some("person"), Some("user not resolved"))
                    }
                    Some(crate::field_transform::GapVariant::Version(_)) => {
                        ("failed", Some("version"), Some("version not resolved"))
                    }
                    Some(crate::field_transform::GapVariant::Component(_)) => {
                        ("failed", Some("component"), Some("component not resolved"))
                    }
                    None => ("skipped", None, Some("transformer produced no value")),
                }
            };

        let was_overridden = override_keys.contains_key(&row.target_field_id);
        let src_red = redact_string_in_value(&src_val);
        let tgt_red = redact_string_in_value(&tgt_val);
        let src_hash = hash_field_value(&src_red);
        let tgt_hash = hash_field_value(&tgt_red);
        let src_json = serde_json::to_string(&src_red).ok().map(cap_audit_json);
        let tgt_json = serde_json::to_string(&tgt_red).ok().map(cap_audit_json);
        let _ = mdb.insert_mapping_audit(
            copy_id,
            &row.target_field_id,
            &src_hash,
            &tgt_hash,
            was_overridden,
            gap_kind,
            &row.transformer_kind,
            outcome,
            failure_reason,
            &timestamp,
            src_json.as_deref(),
            tgt_json.as_deref(),
        );
    }
    let _ = mdb.commit_transaction();
}

/// Phase 23 D-07 — apply credential redaction to any string values inside a
/// JSON value tree, returning a new tree. Non-string values pass through
/// unchanged. Used inside `copy_ticket_v2` audit logging path.
fn redact_string_in_value(v: &serde_json::Value) -> serde_json::Value {
    match v {
        serde_json::Value::String(s) => serde_json::Value::String(redact_credential_value(s)),
        serde_json::Value::Array(arr) => {
            serde_json::Value::Array(arr.iter().map(redact_string_in_value).collect())
        }
        serde_json::Value::Object(obj) => {
            let mut out = serde_json::Map::new();
            for (k, val) in obj {
                out.insert(k.clone(), redact_string_in_value(val));
            }
            serde_json::Value::Object(out)
        }
        _ => v.clone(),
    }
}

/// Returns a page of `mapping_audit_log` entries (newest first). Frontend uses
/// this on the Audit Log page's "Field Transformations" tab.
/// Quick task 260430-0tj. Limit is clamped server-side (T-0tj-03 denial-of-service mitigation).
#[tauri::command]
pub fn get_mapping_audit_log_page(
    offset: i64,
    limit: i64,
    mapping_db: tauri::State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<Vec<crate::field_mapping_db::MappingAuditEntry>, AppError> {
    let limit = limit.clamp(1, 500);
    let offset = offset.max(0);
    let g = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    g.get_mapping_audit_log_page(offset, limit)
}

/// Quick task 260430-0tj — one preview-time audit entry. The frontend builds a
/// batch of these in `CopyPreviewPage` after running its pre-fill pass, then
/// invokes `log_preview_transformations` once. Source/target values are raw
/// JSON the frontend already holds; the backend always redacts and hashes them
/// before persisting, and (quick task 260430-26i) ALSO persists the redacted
/// JSON value alongside the hash so the audit UI can render real values.
#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PreviewTransformationLog {
    pub target_field_id: String,
    pub source_field_id: String,
    pub transformer_kind: String,
    pub outcome: String,
    pub failure_reason: Option<String>,
    pub was_overridden: bool,
    pub gap_kind: Option<String>,
    pub source_value: serde_json::Value,
    pub target_value: serde_json::Value,
}

/// Maximum bytes of redacted JSON value we persist per audit row. The previous
/// `audit_verbose` path used the same cap; quick task 260430-26i applies it
/// uniformly to mitigate T-26i-04 (unbounded JSON values blowing up `SQLite`).
const MAX_AUDIT_JSON_BYTES: usize = 4096;

/// Truncate a JSON-encoded string at `MAX_AUDIT_JSON_BYTES` on a UTF-8 char
/// boundary so we never split a multi-byte glyph mid-sequence.
fn cap_audit_json(s: String) -> String {
    if s.len() <= MAX_AUDIT_JSON_BYTES {
        return s;
    }
    let mut end = MAX_AUDIT_JSON_BYTES;
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    s[..end].to_string()
}

/// Quick task 260430-0tj — write a batch of preview-time transformation audit
/// entries. Called by the copy preview page once after pre-fill so the user can
/// later inspect "what got pre-filled and why" in the Audit Log page.
///
/// Best-effort: per-row insert errors are swallowed so a transient `SQLite` hiccup
/// cannot block the user's preview/copy flow (mirrors `AuditDb::insert`).
///
/// Quick task 260430-26i: always persist redacted JSON values alongside hashes;
/// the previous `audit_verbose` branch is removed and the function no longer
/// needs `triage_db` state.
#[tauri::command]
pub fn log_preview_transformations(
    copy_id: String,
    entries: Vec<PreviewTransformationLog>,
    mapping_db: tauri::State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<(), AppError> {
    if entries.is_empty() {
        return Ok(());
    }
    // Cap batch size — defensive against an FE bug looping on every keystroke.
    let entries: Vec<_> = entries.into_iter().take(500).collect();

    let timestamp = chrono::Utc::now().to_rfc3339();
    let mdb = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;

    // Wrap the batch in an explicit transaction for atomicity and reduced I/O.
    // Best-effort: if begin or commit fails the rows are simply not persisted;
    // the preview/copy flow is unaffected (mirrors AuditDb::insert semantics).
    let _ = mdb.begin_transaction();
    for e in &entries {
        // Quick task 260430-26i: always persist redacted JSON values alongside
        // hashes; previous audit_verbose branch removed.
        let src_red = redact_string_in_value(&e.source_value);
        let tgt_red = redact_string_in_value(&e.target_value);
        let src_hash = hash_field_value(&src_red);
        let tgt_hash = hash_field_value(&tgt_red);
        let src_json = serde_json::to_string(&src_red).ok().map(cap_audit_json);
        let tgt_json = serde_json::to_string(&tgt_red).ok().map(cap_audit_json);
        let _ = mdb.insert_mapping_audit(
            &copy_id,
            &e.target_field_id,
            &src_hash,
            &tgt_hash,
            e.was_overridden,
            e.gap_kind.as_deref(),
            &e.transformer_kind,
            &e.outcome,
            e.failure_reason.as_deref(),
            &timestamp,
            src_json.as_deref(),
            tgt_json.as_deref(),
        );
    }
    let _ = mdb.commit_transaction();
    Ok(())
}

/// Store a ticket snapshot and return any detected field changes.
///
/// POLL-06: This command is ONLY called by the frontend after a successful
/// `fetch_ticket_detail` response. If the HTTP call failed, this command is
/// never invoked, so `last_checked_at` is never advanced for failed fetches.
/// The watermark-only-on-success guarantee is enforced by call-site structure.
#[tauri::command]
pub fn check_ticket_changes(
    snapshot_db: tauri::State<'_, Arc<Mutex<SnapshotDb>>>,
    ticket_key: String,
    response_json: String,
) -> Result<Vec<FieldChange>, AppError> {
    let db = snapshot_db
        .lock()
        .map_err(|_| AppError::Internal("Snapshot DB lock poisoned".into()))?;
    let changes = crate::snapshot_db::check_for_changes(&db, &ticket_key, &response_json)?;

    // Persist unseen state so frontend can show change indicators (Phase 15)
    if !changes.is_empty() {
        let cumulative_changes = if let Ok(Some(seen_json)) = db.get_seen_snapshot(&ticket_key) {
            crate::snapshot_db::detect_changes(&seen_json, &response_json)
                .unwrap_or_else(|_| changes.clone())
        } else {
            changes.clone()
        };
        let _ = db.set_unseen_changes(&ticket_key, &cumulative_changes);
    }

    Ok(changes)
}

/// Return the poll watermark: `MIN(last_checked_at)` across all stored snapshots.
///
/// Returns `None` when no snapshots exist yet. Used by the polling engine (Phase 13)
/// to build a JQL `updated >= watermark` filter that limits API calls to recently
/// changed tickets.
#[tauri::command]
pub fn get_poll_watermark(
    snapshot_db: tauri::State<'_, Arc<Mutex<SnapshotDb>>>,
) -> Result<Option<String>, AppError> {
    let db = snapshot_db
        .lock()
        .map_err(|_| AppError::Internal("Snapshot DB lock poisoned".into()))?;
    db.get_watermark()
}

#[tauri::command]
pub fn get_poll_frequency(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<String, AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("TriageDb lock poisoned".into()))?;
    db.get_poll_frequency()
}

#[tauri::command]
pub fn set_poll_frequency(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    poll_tx: tauri::State<'_, Arc<Mutex<tokio::sync::watch::Sender<PollFrequency>>>>,
    frequency: String,
) -> Result<(), AppError> {
    // Persist to SQLite
    {
        let db = triage_db
            .lock()
            .map_err(|_| AppError::Internal("TriageDb lock poisoned".into()))?;
        db.set_poll_frequency(&frequency)?;
    }
    // Signal running loop — takes effect immediately
    let freq = PollFrequency::from_str(&frequency);
    let tx = poll_tx
        .lock()
        .map_err(|_| AppError::Internal("Poll tx lock poisoned".into()))?;
    let _ = tx.send(freq);
    Ok(())
}

#[tauri::command]
pub fn get_notification_prefs(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<NotificationPrefs, AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("TriageDb lock poisoned".into()))?;
    db.get_notification_prefs()
}

#[tauri::command]
pub fn set_notification_prefs(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    prefs: NotificationPrefs,
) -> Result<(), AppError> {
    let db = triage_db
        .lock()
        .map_err(|_| AppError::Internal("TriageDb lock poisoned".into()))?;
    db.set_notification_prefs(&prefs)
}

/// Return all ticket keys that have unseen changes (for frontend hydration on startup).
#[tauri::command]
pub fn get_unseen_change_keys(
    snapshot_db: tauri::State<'_, Arc<Mutex<SnapshotDb>>>,
) -> Result<Vec<String>, AppError> {
    let db = snapshot_db
        .lock()
        .map_err(|_| AppError::Internal("Snapshot DB lock poisoned".into()))?;
    db.get_unseen_keys()
}

/// Return the pending field changes for a specific ticket.
/// Used by `ChangesTab` to render the diff table.
#[tauri::command]
pub fn get_ticket_changes(
    snapshot_db: tauri::State<'_, Arc<Mutex<SnapshotDb>>>,
    ticket_key: String,
) -> Result<Vec<FieldChange>, AppError> {
    let db = snapshot_db
        .lock()
        .map_err(|_| AppError::Internal("Snapshot DB lock poisoned".into()))?;
    db.get_pending_changes(&ticket_key)
}

/// Mark a ticket's changes as seen. Clears the unseen flag, sets `seen_response_json`
/// to current `response_json` (new baseline for D-12), and clears `pending_changes_json`.
#[tauri::command]
pub fn mark_changes_seen(
    snapshot_db: tauri::State<'_, Arc<Mutex<SnapshotDb>>>,
    ticket_key: String,
) -> Result<(), AppError> {
    let db = snapshot_db
        .lock()
        .map_err(|_| AppError::Internal("Snapshot DB lock poisoned".into()))?;
    db.mark_changes_seen(&ticket_key)
}

/// Manual poll trigger. Sends current frequency to watch channel, waking the loop.
#[tauri::command]
pub fn trigger_manual_poll(
    triage_db: tauri::State<'_, Arc<Mutex<TriageDb>>>,
    poll_tx: tauri::State<'_, Arc<Mutex<tokio::sync::watch::Sender<PollFrequency>>>>,
    _app_handle: tauri::AppHandle,
    _snapshot_db: tauri::State<'_, Arc<Mutex<SnapshotDb>>>,
) -> Result<(), AppError> {
    // Read current frequency
    let freq_str = {
        let db = triage_db
            .lock()
            .map_err(|_| AppError::Internal("TriageDb lock poisoned".into()))?;
        db.get_poll_frequency()?
    };

    // Send current value to reset the background timer
    let freq = PollFrequency::from_str(&freq_str);
    if let PollFrequency::Secs(_) = &freq {
        let tx = poll_tx
            .lock()
            .map_err(|_| AppError::Internal("Poll tx lock poisoned".into()))?;
        let _ = tx.send(freq);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Debug session: copy-400-and-logs-crash — these tests pin the format of
    // the user-facing detail so the actual Jira error response is always
    // surfaced in `CopyStepResult.detail` (the only diagnostic the user sees
    // before the audit log).

    #[test]
    fn format_create_failure_includes_jira_error_body() {
        let body = r#"{"errorMessages":[],"errors":{"project":"valid project is required"}}"#;
        let out = format_create_failure_detail(400, body);
        assert!(out.contains("400"), "status code present: {out}");
        assert!(
            out.contains("valid project is required"),
            "body content present: {out}"
        );
        assert!(out.contains("project"), "field name present: {out}");
    }

    #[test]
    fn format_create_failure_handles_empty_body() {
        let out = format_create_failure_detail(500, "");
        assert_eq!(out, "Issue creation returned status 500");
    }

    #[test]
    fn format_create_failure_handles_whitespace_body() {
        let out = format_create_failure_detail(
            503, "   
  ",
        );
        assert_eq!(out, "Issue creation returned status 503");
    }

    #[test]
    fn format_create_failure_compacts_pretty_json() {
        let body = "{\n  \"errors\": {\n    \"summary\": \"required\"\n  }\n}";
        let out = format_create_failure_detail(400, body);
        // Must include status, must include compacted (single-line) JSON.
        assert!(out.contains("400"), "{out}");
        assert!(
            out.contains("\"summary\":\"required\""),
            "compacted JSON: {out}"
        );
        assert!(
            !out.contains('\n'),
            "no newlines in compacted output: {out}"
        );
    }

    #[test]
    fn format_create_failure_truncates_oversize_body() {
        let big = "x".repeat(5000);
        let out = format_create_failure_detail(500, &big);
        assert!(out.starts_with("Issue creation returned status 500: "));
        // Truncated to 1024 + ellipsis. Some leading "Issue creation..." prefix.
        assert!(out.contains('…'), "ellipsis present: {}", &out[..120]);
        assert!(out.len() < 1200, "total bounded: {}", out.len());
    }

    #[test]
    fn format_create_failure_falls_through_html_body() {
        let html = "<html><body>Bad Request</body></html>";
        let out = format_create_failure_detail(400, html);
        assert!(out.contains("400"));
        assert!(out.contains("Bad Request"));
    }

    // ── Phase 24: copy-time audit loop unit tests ─────────────────────────────
    // Each test constructs an in-memory FieldMappingDb, calls write_copy_time_audit
    // directly, then reads back the rows to assert outcomes.

    fn make_row(
        src: &str,
        tgt: &str,
        kind: &str,
    ) -> crate::field_transform::FieldMappingRow {
        crate::field_transform::FieldMappingRow {
            source_field_id: src.to_string(),
            target_field_id: tgt.to_string(),
            transformer_kind: kind.to_string(),
            source_schema: crate::field_discovery::FieldSchemaType::String {
                system: None,
                custom: None,
                custom_id: None,
            },
            target_schema: crate::field_discovery::FieldSchemaType::String {
                system: None,
                custom: None,
                custom_id: None,
            },
        }
    }

    #[test]
    fn copy_time_audit_loop_writes_copied_for_resolved_field() {
        let mdb = crate::field_mapping_db::FieldMappingDb::open_in_memory()
            .expect("open in-memory db");
        let mapping_rows = vec![make_row("description", "description", "wiki_to_adf")];
        let source_body = serde_json::json!({ "fields": { "description": "some wiki text" } });
        let mut resolved = crate::field_transform::ResolvedFields::default();
        resolved
            .fields
            .insert("description".to_string(), serde_json::json!("ADF content"));
        let overrides = serde_json::Map::new();

        write_copy_time_audit(&mdb, "test-uuid-1234", &mapping_rows, &source_body, &resolved, &overrides);

        let rows = mdb.get_mapping_audit_log_page(0, 10).expect("read rows");
        assert_eq!(rows.len(), 1, "expected one row, got {}", rows.len());
        assert_eq!(rows[0].outcome, "copied");
        assert_eq!(rows[0].field_id, "description");
        assert!(!rows[0].source_value_hash.is_empty(), "source hash non-empty");
        assert!(!rows[0].target_value_hash.is_empty(), "target hash non-empty");
    }

    #[test]
    fn copy_time_audit_loop_writes_skipped_for_null_source() {
        let mdb = crate::field_mapping_db::FieldMappingDb::open_in_memory()
            .expect("open in-memory db");
        let mapping_rows = vec![make_row("customfield_99", "customfield_99", "identity")];
        // source_body has no customfield_99
        let source_body = serde_json::json!({ "fields": {} });
        let resolved = crate::field_transform::ResolvedFields::default();
        let overrides = serde_json::Map::new();

        write_copy_time_audit(&mdb, "skip-uuid", &mapping_rows, &source_body, &resolved, &overrides);

        let rows = mdb.get_mapping_audit_log_page(0, 10).expect("read rows");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].outcome, "skipped");
        assert_eq!(
            rows[0].failure_reason.as_deref(),
            Some("source value missing")
        );
    }

    #[test]
    fn copy_time_audit_loop_writes_failed_for_gap() {
        let mdb = crate::field_mapping_db::FieldMappingDb::open_in_memory()
            .expect("open in-memory db");
        let mapping_rows = vec![make_row("assignee", "assignee", "user")];
        // Source has an assignee, but it couldn't be resolved (gap)
        let source_body =
            serde_json::json!({ "fields": { "assignee": { "name": "jdoe" } } });
        let mut resolved = crate::field_transform::ResolvedFields::default();
        resolved
            .gaps
            .push(crate::field_transform::GapVariant::Person(
                crate::field_transform::UnresolvedPerson {
                    target_field_id: "assignee".to_string(),
                    source_username: Some("jdoe".to_string()),
                    source_key: None,
                    source_email: None,
                },
            ));
        let overrides = serde_json::Map::new();

        write_copy_time_audit(&mdb, "fail-uuid", &mapping_rows, &source_body, &resolved, &overrides);

        let rows = mdb.get_mapping_audit_log_page(0, 10).expect("read rows");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].outcome, "failed");
        assert_eq!(rows[0].gap_kind.as_deref(), Some("person"));
    }

    #[test]
    fn copy_time_audit_loop_uses_copy_id() {
        let mdb = crate::field_mapping_db::FieldMappingDb::open_in_memory()
            .expect("open in-memory db");
        let mapping_rows = vec![make_row("summary", "summary", "identity")];
        let source_body = serde_json::json!({ "fields": { "summary": "Bug title" } });
        let mut resolved = crate::field_transform::ResolvedFields::default();
        resolved
            .fields
            .insert("summary".to_string(), serde_json::json!("Bug title"));
        let overrides = serde_json::Map::new();

        write_copy_time_audit(&mdb, "test-uuid-1234", &mapping_rows, &source_body, &resolved, &overrides);

        let rows = mdb.get_mapping_audit_log_page(0, 10).expect("read rows");
        assert!(!rows.is_empty());
        for row in &rows {
            assert_eq!(row.copy_id, "test-uuid-1234");
        }
    }

    #[test]
    fn copy_time_audit_loop_skips_empty_target_field_id() {
        let mdb = crate::field_mapping_db::FieldMappingDb::open_in_memory()
            .expect("open in-memory db");
        // Row with empty target_field_id (dismissed suggestion)
        let mapping_rows = vec![make_row("description", "", "identity")];
        let source_body = serde_json::json!({ "fields": { "description": "text" } });
        let resolved = crate::field_transform::ResolvedFields::default();
        let overrides = serde_json::Map::new();

        write_copy_time_audit(&mdb, "skip-empty-uuid", &mapping_rows, &source_body, &resolved, &overrides);

        let rows = mdb.get_mapping_audit_log_page(0, 10).expect("read rows");
        assert_eq!(rows.len(), 0, "no rows written for empty target_field_id");
    }

    // ── Phase 25 tests ─────────────────────────────────────────────────────────

    #[test]
    fn resolve_description_to_adf_returns_doc_for_html() {
        use std::collections::HashMap;
        let result = crate::field_transform::wiki_to_adf::convert_and_postprocess(
            "<p>Hello world</p>",
            &HashMap::<String, Option<String>>::new(),
        );
        assert_eq!(result["type"], "doc");
        assert_eq!(result["version"], 1);
    }

    #[test]
    fn resolve_description_to_adf_returns_empty_doc_for_empty_html() {
        use std::collections::HashMap;
        let result = crate::field_transform::wiki_to_adf::convert_and_postprocess(
            "",
            &HashMap::<String, Option<String>>::new(),
        );
        assert_eq!(result["type"], "doc");
        let content = result["content"].as_array().expect("content must be array");
        assert!(content.is_empty());
    }

    #[test]
    fn resolve_description_to_adf_paragraph_content_non_empty() {
        use std::collections::HashMap;
        let result = crate::field_transform::wiki_to_adf::convert_and_postprocess(
            "<p>Test content</p>",
            &HashMap::<String, Option<String>>::new(),
        );
        let content = result["content"].as_array().expect("content must be array");
        assert!(!content.is_empty());
        assert_eq!(content[0]["type"], "paragraph");
    }

    #[test]
    fn preview_user_domain_grouping_two_same_domain() {
        // Verify that two users with the same email domain land in a single domain bucket.
        let entries = vec![
            PreviewUserEntry { username: "alice".into(), email: Some("alice@acme.com".into()) },
            PreviewUserEntry { username: "bob".into(), email: Some("bob@acme.com".into()) },
        ];
        let mut by_domain: std::collections::HashMap<String, Vec<(usize, String)>> =
            std::collections::HashMap::new();
        let mut no_domain: Vec<(usize, String)> = Vec::new();
        for (i, entry) in entries.iter().enumerate() {
            if let Some(email) = &entry.email {
                if let Some(domain) = email.split('@').nth(1) {
                    if !domain.is_empty() {
                        by_domain.entry(domain.to_string()).or_default().push((i, entry.username.clone()));
                        continue;
                    }
                }
            }
            no_domain.push((i, entry.username.clone()));
        }
        assert_eq!(by_domain.len(), 1, "both users should share one domain bucket");
        assert_eq!(by_domain["acme.com"].len(), 2);
        assert!(no_domain.is_empty());
    }

    #[test]
    fn preview_user_domain_grouping_no_email_goes_to_no_domain() {
        let entries = vec![
            PreviewUserEntry { username: "carol".into(), email: None },
        ];
        let mut by_domain: std::collections::HashMap<String, Vec<(usize, String)>> =
            std::collections::HashMap::new();
        let mut no_domain: Vec<(usize, String)> = Vec::new();
        for (i, entry) in entries.iter().enumerate() {
            if let Some(email) = &entry.email {
                if let Some(domain) = email.split('@').nth(1) {
                    if !domain.is_empty() {
                        by_domain.entry(domain.to_string()).or_default().push((i, entry.username.clone()));
                        continue;
                    }
                }
            }
            no_domain.push((i, entry.username.clone()));
        }
        assert!(by_domain.is_empty());
        assert_eq!(no_domain.len(), 1);
        assert_eq!(no_domain[0].1, "carol");
    }
}
