use tauri::State;
use std::sync::{Arc, Mutex};
use crate::error::AppError;
use crate::audit::{AuditDb, AuditEntry, build_audited_client};
use crate::keychain;
use crate::fixtures::SharedFixtures;
use crate::mock_server;
use base64::Engine as _;

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
pub fn get_credential(
    connection_type: String,
    username: String,
) -> Result<String, AppError> {
    keychain::get_credential(&connection_type, &username)
}

#[tauri::command]
pub fn delete_credential(
    connection_type: String,
    username: String,
) -> Result<(), AppError> {
    keychain::delete_credential(&connection_type, &username)
}

// --- Audit commands ---

#[tauri::command]
pub fn get_audit_logs(
    db: State<'_, Arc<Mutex<AuditDb>>>,
) -> Result<Vec<AuditEntry>, AppError> {
    let db = db.lock().map_err(|_| AppError::Internal("Database lock poisoned".into()))?;
    db.get_all().map_err(Into::into)
}

#[tauri::command]
pub fn clear_audit_logs(
    db: State<'_, Arc<Mutex<AuditDb>>>,
) -> Result<(), AppError> {
    let db = db.lock().map_err(|_| AppError::Internal("Database lock poisoned".into()))?;
    db.clear_logs().map_err(Into::into)
}

// --- Mock server commands ---

#[tauri::command]
pub async fn start_mock_servers_cmd(
    fixtures: State<'_, SharedFixtures>,
) -> Result<(), AppError> {
    mock_server::start_mock_servers(fixtures.inner().clone()).await
}

// --- Health check / ping commands (for DevStatusPanel) ---

#[tauri::command]
pub async fn ping_mock_servers() -> Result<serde_json::Value, AppError> {
    let client = reqwest::Client::new();
    let v2_ok = client.get("http://127.0.0.1:8080/rest/api/2/search")
        .header("authorization", "Bearer ping")
        .send().await.is_ok();
    let v3_ok = client.post("http://127.0.0.1:8081/rest/api/3/search/jql")
        .header("authorization", "Bearer ping")
        .header("content-type", "application/json")
        .body(r#"{"jql":"order by created"}"#)
        .send().await.is_ok();
    Ok(serde_json::json!({
        "server_v2": v2_ok,
        "cloud_v3": v3_ok
    }))
}

// --- Connection test commands ---

#[derive(serde::Serialize, Clone, Debug)]
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
    let url = format!("{}/rest/api/{}/serverInfo", base_url, api_version);
    let resp = client
        .get(&url)
        .header("Authorization", auth_header)
        .send()
        .await
        .ok()?;
    if resp.status().is_success() {
        let body: serde_json::Value = resp.json().await.ok()?;
        body["version"].as_str().map(|s| s.to_string())
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
        .get(format!("{}/rest/api/2/myself", trimmed_url))
        .header("Authorization", format!("Bearer {}", pat))
        .send()
        .await;

    let myself_resp = match myself_resp {
        Ok(r) => r,
        Err(_) => {
            return Ok(ConnectionTestResult {
                success: false,
                username: None,
                server_version: None,
                error_kind: Some("network".into()),
                retry_after_secs: None,
            });
        }
    };

    let status = myself_resp.status().as_u16();
    if status != 200 {
        return Ok(map_error_status(status, &myself_resp));
    }

    let myself_body: serde_json::Value = myself_resp.json().await
        .map_err(|_| AppError::Http("Failed to parse /myself response".into()))?;
    let username = myself_body["name"].as_str()
        .or_else(|| myself_body["displayName"].as_str())
        .unwrap_or("unknown")
        .to_string();

    let server_version = fetch_server_version(&client, trimmed_url, &format!("Bearer {}", pat), 2).await;

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

    let credentials = base64::engine::general_purpose::STANDARD
        .encode(format!("{}:{}", email, api_token));
    let auth_header = format!("Basic {}", credentials);

    let myself_resp = client
        .get(format!("{}/rest/api/3/myself", trimmed_url))
        .header("Authorization", auth_header.clone())
        .send()
        .await;

    let myself_resp = match myself_resp {
        Ok(r) => r,
        Err(_) => {
            return Ok(ConnectionTestResult {
                success: false,
                username: None,
                server_version: None,
                error_kind: Some("network".into()),
                retry_after_secs: None,
            });
        }
    };

    let status = myself_resp.status().as_u16();
    if status != 200 {
        return Ok(map_error_status(status, &myself_resp));
    }

    let myself_body: serde_json::Value = myself_resp.json().await
        .map_err(|_| AppError::Http("Failed to parse /myself response".into()))?;
    let username = myself_body["displayName"].as_str()
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
            .map_err(|e| AppError::Internal(format!("Failed to open URL: {}", e)))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", &url])
            .spawn()
            .map_err(|e| AppError::Internal(format!("Failed to open URL: {}", e)))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| AppError::Internal(format!("Failed to open URL: {}", e)))?;
    }
    Ok(())
}

#[tauri::command]
pub fn ping_keychain() -> Result<bool, AppError> {
    // Try to store and immediately delete a test value
    let test_type = "pmkar-health-check";
    let test_user = "ping";
    match keychain::store_credential(test_type, test_user, "ping") {
        Ok(_) => {
            let _ = keychain::delete_credential(test_type, test_user);
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}
