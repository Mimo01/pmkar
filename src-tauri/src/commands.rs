// Tauri command functions receive owned types by design — the framework serializes arguments
// from the frontend and passes them as owned values. Using references is not possible here.
#![allow(clippy::needless_pass_by_value)]

use crate::audit::{build_audited_client, AuditDb, AuditEntry};
use crate::copy_pipeline::{
    add_remote_link, copy_attachments, copy_comments, copy_subtasks, copy_worklogs, CopyContext,
};
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
        std::process::Command::new("cmd")
            .args(["/C", "start", &url])
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
        "{trimmed_url}/rest/api/2/issue/{issue_key}?expand=renderedFields,changelog&fields=*all"
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
    // Security: prevent SSRF by validating URL origin
    let trimmed_base = base_url.trim_end_matches('/');
    if !image_url.starts_with(trimmed_base) {
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
        return Ok(vec![]);
    }

    let users: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();

    Ok(users)
}

// --- Cloud user search command ---

#[tauri::command]
pub async fn search_jira_users_by_domain(
    domain: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<serde_json::Value>, AppError> {
    const PAGE_SIZE: usize = 50;

    let (base_url, cloud_email, api_token) = get_cloud_credentials(triage_db.inner())?;
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);

    let clean_domain = domain.trim_start_matches('@');
    let query = format!("@{clean_domain}");
    let encoded_query = urlencoding::encode(&query);

    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{cloud_email}:{api_token}"))
    );

    let mut all_users: Vec<serde_json::Value> = Vec::new();
    let mut start_at: usize = 0;

    loop {
        let url = format!(
            "{base_url}/rest/api/3/user/search?query={encoded_query}&maxResults={PAGE_SIZE}&startAt={start_at}"
        );

        let resp = client
            .get(&url)
            .header("Authorization", cloud_auth.clone())
            .send()
            .await
            .map_err(|_| AppError::Http("Failed to search users by domain".into()))?;

        if !resp.status().is_success() {
            break;
        }

        let page: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
        let page_len = page.len();
        all_users.extend(page);

        if page_len < PAGE_SIZE {
            // Last page — no more results
            break;
        }
        start_at += PAGE_SIZE;
    }

    Ok(all_users)
}

// --- Field discovery commands (Phase 17) ---

use crate::field_discovery::{self, FieldSchema, FieldSide, IssueTypeRef, ProbeResult};
use crate::field_mapping_db::FieldMappingDb;
use crate::field_transform::FieldMappingRow;

/// Source v2 global field list. Cache-first via `get_or_fetch_source_global`
/// (`side='source'`, `project_key=NULL`, `issuetype_id=NULL` — D-14).
#[tauri::command]
pub async fn discover_source_fields(
    db: State<'_, Arc<Mutex<AuditDb>>>,
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
    // Arm audit middleware side-effects (request-id seeding) for downstream calls.
    let _audit = build_audited_client(Arc::clone(db.inner()));
    let client = reqwest::Client::new();
    field_discovery::get_or_fetch_source_global(mapping_db.inner(), &client, &base_url, &pat).await
}

/// Target v3 paginated createmeta for a specific issue type. Cache-first via
/// `get_or_fetch_target_schema`; subsequent calls hit the cache (D-15).
#[tauri::command]
pub async fn get_target_field_schema_for_issuetype(
    project_key: String,
    issuetype_id: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<Vec<FieldSchema>, AppError> {
    let (base_url, cloud_email, api_token) = get_cloud_credentials(triage_db.inner())?;
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD
            .encode(format!("{cloud_email}:{api_token}"))
    );
    let _audit = build_audited_client(Arc::clone(db.inner()));
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
    db: State<'_, Arc<Mutex<AuditDb>>>,
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
        base64::engine::general_purpose::STANDARD
            .encode(format!("{cloud_email}:{api_token}"))
    );
    let _audit = build_audited_client(Arc::clone(db.inner()));
    let client = reqwest::Client::new();
    field_discovery::probe_paginated_createmeta(&client, &base_url, &cloud_auth, &project_key)
        .await
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
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<IssueTypeRef>, AppError> {
    let Ok((base_url, cloud_email, api_token)) = get_cloud_credentials(triage_db.inner()) else {
        return Ok(vec![]);
    };
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD
            .encode(format!("{cloud_email}:{api_token}"))
    );
    let _audit = build_audited_client(Arc::clone(db.inner()));
    let client = reqwest::Client::new();
    match field_discovery::fetch_target_issue_types(
        &client,
        &base_url,
        &cloud_auth,
        &project_key,
    )
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
    guard.clear_cache_for(
        side_enum,
        project_key.as_deref(),
        issuetype_id.as_deref(),
    )?;
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

// --- Copy ticket command ---

/// Replace old image URLs in HTML with new Cloud attachment URLs.
/// Used in the two-pass copy pipeline (D-03) before HTML→ADF conversion.
fn rewrite_image_urls(html: &str, url_map: &HashMap<String, String>) -> String {
    let mut result = html.to_string();
    for (old_url, new_url) in url_map {
        result = result.replace(old_url.as_str(), new_url.as_str());
    }
    result
}

/// Extract (`src_url`, filename) pairs for all `<img` tags in HTML.
/// Uses simple string parsing — no regex dependency needed.
fn extract_image_urls(html: &str) -> Vec<(String, String)> {
    let mut results = Vec::new();
    let mut remaining = html;
    while let Some(img_start) = remaining.find("<img") {
        let after_img = &remaining[img_start..];
        // Find end of tag
        let tag_end = after_img.find('>').unwrap_or(after_img.len());
        let tag = &after_img[..tag_end];
        // Find src="..." within the tag
        if let Some(src_pos) = tag.find("src=\"") {
            let after_src = &tag[src_pos + 5..];
            if let Some(quote_end) = after_src.find('"') {
                let url = &after_src[..quote_end];
                if url.starts_with("http://") || url.starts_with("https://") {
                    // Extract filename from URL path
                    let filename = url
                        .split('/')
                        .next_back()
                        .and_then(|f| f.split('?').next())
                        .unwrap_or("image.png")
                        .to_string();
                    results.push((url.to_string(), filename));
                }
            }
        }
        remaining = &remaining[img_start + 4..];
    }
    results
}

// copy_ticket has 11 args — all required by the Tauri frontend call site.
// Refactoring into a struct would require frontend changes and is deferred.
#[allow(clippy::too_many_arguments)]
#[allow(clippy::too_many_lines)]
#[tauri::command]
pub async fn copy_ticket(
    source_key: String,
    source_base_url: String,
    target_base_url: String,
    target_summary: String,
    target_description: Option<String>,
    target_status: String, // informational only — status transitions not supported at creation
    target_priority_id: String,
    target_labels: Vec<String>,
    current_account_id: String,
    target_project_key: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<CopyTicketResult, AppError> {
    let arc_db = Arc::clone(db.inner());
    let client = build_audited_client(arc_db);
    let mut steps: Vec<CopyStepResult> = Vec::new();

    let trimmed_source = source_base_url.trim_end_matches('/');
    let trimmed_target = target_base_url.trim_end_matches('/');

    // Get Cloud credentials for target API calls
    let (_, cloud_email, cloud_api_token) = get_cloud_credentials(triage_db.inner())?;
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD
            .encode(format!("{cloud_email}:{cloud_api_token}"))
    );

    // Get Server PAT for source API calls
    let server_pat = get_server_pat(triage_db.inner())?;

    // Step 1: Fetch source issue with renderedFields
    let source_url =
        format!("{trimmed_source}/rest/api/2/issue/{source_key}?expand=renderedFields&fields=*all");
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

    // Step 2: Extract rendered HTML description and summary
    let html_description = source_body["renderedFields"]["description"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let source_summary = source_body["fields"]["summary"]
        .as_str()
        .unwrap_or(&source_key)
        .to_string();

    // Step 3: Collect inline image URLs from HTML
    let image_pairs = extract_image_urls(&html_description);

    // Step 4: Create issue in Cloud with placeholder description (two-pass approach per D-03)
    let create_body = serde_json::json!({
        "fields": {
            "project": { "key": target_project_key },
            "issuetype": { "name": "Task" },
            "summary": target_summary,
            "priority": { "id": target_priority_id },
            "labels": target_labels,
            "assignee": { "accountId": current_account_id }
        }
    });

    // target_status is captured for informational purposes (used in preview UI per D-07)
    // Status transitions are not supported at Cloud issue creation; user intent is recorded
    let _ = &target_status;

    let create_body_str = serde_json::to_string(&create_body)
        .map_err(|e| AppError::Serialization(format!("Failed to serialize create body: {e}")))?;
    let create_resp = client
        .post(format!("{trimmed_target}/rest/api/3/issue"))
        .header("Authorization", &cloud_auth)
        .header("Content-Type", "application/json")
        .body(create_body_str)
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to create issue in Cloud Jira".into()))?;

    if !create_resp.status().is_success() {
        let status = create_resp.status().as_u16();
        steps.push(CopyStepResult {
            step: "create_issue".to_string(),
            success: false,
            detail: Some(format!("Cloud issue creation returned status {status}")),
        });
        return Ok(CopyTicketResult {
            target_key: None,
            target_url: None,
            steps,
        });
    }

    let create_resp_text = create_resp
        .text()
        .await
        .map_err(|_| AppError::Http("Failed to read create issue response".into()))?;
    let create_resp_body: serde_json::Value = serde_json::from_str(&create_resp_text)
        .map_err(|_| AppError::Http("Failed to parse create issue response".into()))?;
    let target_key = create_resp_body["key"]
        .as_str()
        .unwrap_or("UNKNOWN")
        .to_string();

    steps.push(CopyStepResult {
        step: "create_issue".to_string(),
        success: true,
        detail: Some(target_key.clone()),
    });

    // Step 5: Upload inline images and build URL map (per D-03)
    let mut url_map: HashMap<String, String> = HashMap::new();

    for (old_url, filename) in &image_pairs {
        // Download image bytes from source Jira using Server PAT
        let img_resp = client
            .get(old_url)
            .header("Authorization", format!("Bearer {server_pat}"))
            .send()
            .await;

        match img_resp {
            Ok(resp) if resp.status().is_success() => {
                let content_type = resp
                    .headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("image/png")
                    .to_string();

                match resp.bytes().await {
                    Ok(img_bytes) => {
                        // Upload to target ticket using plain reqwest::Client
                        // (reqwest_middleware doesn't support multipart)
                        let plain_client = reqwest::Client::new();
                        let part = reqwest::multipart::Part::bytes(img_bytes.to_vec())
                            .file_name(filename.clone())
                            .mime_str(&content_type)
                            .unwrap_or_else(|_| {
                                reqwest::multipart::Part::bytes(img_bytes.to_vec())
                                    .file_name(filename.clone())
                            });
                        let form = reqwest::multipart::Form::new().part("file", part);

                        let upload_resp = plain_client
                            .post(format!(
                                "{trimmed_target}/rest/api/3/issue/{target_key}/attachments"
                            ))
                            .header("Authorization", &cloud_auth)
                            .header("X-Atlassian-Token", "no-check")
                            .multipart(form)
                            .send()
                            .await;

                        match upload_resp {
                            Ok(up_resp) if up_resp.status().is_success() => {
                                let up_body: serde_json::Value =
                                    up_resp.json().await.unwrap_or_default();
                                // Response is a JSON array; first element has `content` field
                                let new_url = up_body
                                    .as_array()
                                    .and_then(|arr| arr.first())
                                    .and_then(|el| el["content"].as_str())
                                    .unwrap_or("")
                                    .to_string();
                                if !new_url.is_empty() {
                                    url_map.insert(old_url.clone(), new_url.clone());
                                }
                                steps.push(CopyStepResult {
                                    step: format!("upload_image:{filename}"),
                                    success: true,
                                    detail: Some(new_url),
                                });
                            }
                            Ok(up_resp) => {
                                let up_status = up_resp.status().as_u16();
                                steps.push(CopyStepResult {
                                    step: format!("upload_image:{filename}"),
                                    success: false,
                                    detail: Some(format!("Upload returned status {up_status}")),
                                });
                            }
                            Err(_) => {
                                steps.push(CopyStepResult {
                                    step: format!("upload_image:{filename}"),
                                    success: false,
                                    detail: Some("Network error during upload".to_string()),
                                });
                            }
                        }
                    }
                    Err(_) => {
                        steps.push(CopyStepResult {
                            step: format!("upload_image:{filename}"),
                            success: false,
                            detail: Some("Failed to read image bytes".to_string()),
                        });
                    }
                }
            }
            _ => {
                steps.push(CopyStepResult {
                    step: format!("upload_image:{filename}"),
                    success: false,
                    detail: Some("Failed to download source image".to_string()),
                });
            }
        }
    }

    // Step 6: Build ADF description
    // If user provided edited description, wrap as plain text ADF.
    // Otherwise, rewrite HTML image URLs and convert via htmltoadf pipeline.
    let mut adf_value: serde_json::Value = match target_description {
        Some(ref edited) if !edited.is_empty() => {
            // User-edited description — wrap as plain text ADF
            serde_json::json!({
                "version": 1,
                "type": "doc",
                "content": [{
                    "type": "paragraph",
                    "content": [{
                        "type": "text",
                        "text": edited
                    }]
                }]
            })
        }
        _ => {
            // Use source HTML → rewrite images → convert to ADF
            let rewritten_html = rewrite_image_urls(&html_description, &url_map);
            let adf_str = htmltoadf::convert_html_str_to_adf_str(rewritten_html);
            serde_json::from_str(&adf_str)
                .map_err(|e| AppError::Serialization(format!("Failed to parse ADF JSON: {e}")))?
        }
    };

    // Append sub-tasks footer to ADF description (per D-09, D-10)
    let subtasks = source_body["fields"]["subtasks"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    if !subtasks.is_empty() {
        if let Some(content) = adf_value["content"].as_array_mut() {
            content.push(serde_json::json!({
                "type": "heading",
                "attrs": { "level": 3 },
                "content": [{ "type": "text", "text": "Sub-tasks" }]
            }));
            let items: Vec<serde_json::Value> = subtasks
                .iter()
                .map(|st| {
                    let key = st["key"].as_str().unwrap_or("?");
                    let summary = st["fields"]["summary"].as_str().unwrap_or("?");
                    serde_json::json!({
                        "type": "listItem",
                        "content": [{
                            "type": "paragraph",
                            "content": [{ "type": "text", "text": format!("{}: {}", key, summary) }]
                        }]
                    })
                })
                .collect();
            content.push(serde_json::json!({
                "type": "bulletList",
                "content": items
            }));
        }
    }

    // Append linked issues footer to ADF description (per D-11, D-12)
    let issuelinks = source_body["fields"]["issuelinks"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    if !issuelinks.is_empty() {
        if let Some(content) = adf_value["content"].as_array_mut() {
            content.push(serde_json::json!({
                "type": "heading",
                "attrs": { "level": 3 },
                "content": [{ "type": "text", "text": "Linked Issues" }]
            }));
            let items: Vec<serde_json::Value> = issuelinks.iter().filter_map(|link| {
                if let Some(outward) = link["outwardIssue"].as_object() {
                    let link_type = link["type"]["outward"].as_str().unwrap_or("relates to");
                    let key = outward.get("key").and_then(|k| k.as_str()).unwrap_or("?");
                    let summary = outward.get("fields")
                        .and_then(|f| f["summary"].as_str())
                        .unwrap_or("?");
                    Some(serde_json::json!({
                        "type": "listItem",
                        "content": [{
                            "type": "paragraph",
                            "content": [{ "type": "text", "text": format!("{}: {} \u{2014} {}", link_type, key, summary) }]
                        }]
                    }))
                } else if let Some(inward) = link["inwardIssue"].as_object() {
                    let link_type = link["type"]["inward"].as_str().unwrap_or("relates to");
                    let key = inward.get("key").and_then(|k| k.as_str()).unwrap_or("?");
                    let summary = inward.get("fields")
                        .and_then(|f| f["summary"].as_str())
                        .unwrap_or("?");
                    Some(serde_json::json!({
                        "type": "listItem",
                        "content": [{
                            "type": "paragraph",
                            "content": [{ "type": "text", "text": format!("{}: {} \u{2014} {}", link_type, key, summary) }]
                        }]
                    }))
                } else {
                    None
                }
            }).collect();
            if !items.is_empty() {
                content.push(serde_json::json!({
                    "type": "bulletList",
                    "content": items
                }));
            }
        }
    }

    steps.push(CopyStepResult {
        step: "convert_description".to_string(),
        success: true,
        detail: None,
    });

    // Step 7: Update issue description with ADF (two-pass: PUT after image uploads)
    let update_body = serde_json::json!({
        "fields": {
            "description": adf_value
        }
    });
    let update_body_str = serde_json::to_string(&update_body)
        .map_err(|e| AppError::Serialization(format!("Failed to serialize update body: {e}")))?;

    let update_resp = client
        .put(format!("{trimmed_target}/rest/api/3/issue/{target_key}"))
        .header("Authorization", &cloud_auth)
        .header("Content-Type", "application/json")
        .body(update_body_str)
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to update issue description in Cloud Jira".into()))?;

    let update_status = update_resp.status().as_u16();
    let update_success = update_resp.status().is_success();
    steps.push(CopyStepResult {
        step: "update_description".to_string(),
        success: update_success,
        detail: if update_success {
            None
        } else {
            Some(format!(
                "Description update returned status {update_status}"
            ))
        },
    });

    // Phase 23 D-08/D-09 — construct CopyContext and delegate the remaining
    // helper blocks (remote link, attachments, comments, worklogs, subtasks)
    // to the extracted free helpers. copy_ticket_v2 (Plan 23-03) reuses the
    // same helpers — refactoring the OLD path first proves they work before
    // copy_ticket is deleted.
    let ctx = CopyContext {
        client: client.clone(),
        cloud_auth: cloud_auth.clone(),
        server_pat: server_pat.clone(),
        source_base_url: trimmed_source.to_string(),
        target_base_url: trimmed_target.to_string(),
        source_key: source_key.clone(),
        target_key: target_key.clone(),
        target_project_key: target_project_key.clone(),
    };

    // Step 8: Add remote link back to source ticket (origin tracking, D-15)
    steps.push(add_remote_link(&ctx, &source_summary).await);

    // Attachment copy loop (per D-05, D-06)
    steps.extend(copy_attachments(&ctx, &source_body).await);

    // Comment copy loop (per D-01 through D-04)
    steps.extend(copy_comments(&ctx, &source_body).await);

    // Work log copy (per D-07, D-08)
    steps.extend(copy_worklogs(&ctx).await);

    // Sub-task child issue creation (COPY-05)
    // Note: subtasks variable already defined above for description footer
    let subtasks_arr = source_body["fields"]["subtasks"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    steps.extend(copy_subtasks(&ctx, &subtasks_arr).await);

    // Step 9: Update triage state to copied
    {
        let db = triage_db
            .lock()
            .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
        db.set_triage_copied(&source_key, &target_key)?;
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
