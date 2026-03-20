use tauri::State;
use std::sync::Mutex;
use crate::error::AppError;
use crate::audit::{AuditDb, AuditEntry};
use crate::keychain;
use crate::fixtures::SharedFixtures;
use crate::mock_server;

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
    db: State<'_, Mutex<AuditDb>>,
) -> Result<Vec<AuditEntry>, AppError> {
    let db = db.lock().map_err(|_| AppError::Internal("Database lock poisoned".into()))?;
    db.get_all().map_err(Into::into)
}

#[tauri::command]
pub fn clear_audit_logs(
    db: State<'_, Mutex<AuditDb>>,
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
