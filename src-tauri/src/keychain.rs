use crate::error::AppResult;

/// The keyring service prefix. All pmkar credentials use this prefix.
const SERVICE_PREFIX: &str = "pmkar";

/// Build the full service name: "pmkar-{connection_type}"
/// `connection_type`: "jira-server" or "jira-cloud"
fn service_name(connection_type: &str) -> String {
    format!("{SERVICE_PREFIX}-{connection_type}")
}

// ---- Debug: file-based store ----
#[cfg(debug_assertions)]
mod file_store {
    use std::collections::HashMap;
    use std::path::PathBuf;
    use std::sync::Once;

    use crate::error::{AppError, AppResult};

    static WARN_ONCE: Once = Once::new();

    fn dev_cred_path() -> AppResult<PathBuf> {
        dirs::home_dir()
            .map(|p| p.join(".pmkar-dev-credentials.json"))
            .ok_or_else(|| AppError::Keychain("Cannot determine home directory".into()))
    }

    fn load_map() -> AppResult<HashMap<String, String>> {
        let path = dev_cred_path()?;
        if !path.exists() {
            return Ok(HashMap::new());
        }
        let raw = std::fs::read_to_string(&path)
            .map_err(|e| AppError::Keychain(format!("Failed to read credential file: {e}")))?;
        let map: HashMap<String, String> = serde_json::from_str(&raw)
            .map_err(|e| AppError::Keychain(format!("Failed to parse credential file: {e}")))?;
        Ok(map)
    }

    fn save_map(map: &HashMap<String, String>) -> AppResult<()> {
        let path = dev_cred_path()?;
        let raw = serde_json::to_string_pretty(map)
            .map_err(|e| AppError::Keychain(format!("Failed to serialize credentials: {e}")))?;
        std::fs::write(&path, raw)
            .map_err(|e| AppError::Keychain(format!("Failed to write credential file: {e}")))?;
        Ok(())
    }

    fn announce() {
        WARN_ONCE.call_once(|| {
            eprintln!("[dev] Using file-based credential store (~/.pmkar-dev-credentials.json)");
        });
    }

    pub fn store(service: &str, username: &str, secret: &str) -> AppResult<()> {
        announce();
        let key = format!("{service}:{username}");
        let mut map = load_map()?;
        map.insert(key, secret.to_string());
        save_map(&map)
    }

    pub fn get(service: &str, username: &str) -> AppResult<String> {
        announce();
        let key = format!("{service}:{username}");
        let map = load_map()?;
        map.get(&key)
            .cloned()
            .ok_or_else(|| AppError::Keychain(format!("Credential not found: {key}")))
    }

    pub fn delete(service: &str, username: &str) -> AppResult<()> {
        announce();
        let key = format!("{service}:{username}");
        let mut map = load_map()?;
        if map.remove(&key).is_none() {
            return Err(AppError::Keychain(format!("Credential not found: {key}")));
        }
        save_map(&map)
    }
}

// ---- Debug public API ----

#[cfg(debug_assertions)]
/// Store a credential in the dev file-based store (debug builds only).
pub fn store_credential(connection_type: &str, username: &str, secret: &str) -> AppResult<()> {
    file_store::store(&service_name(connection_type), username, secret)
}

#[cfg(debug_assertions)]
/// Retrieve a credential from the dev file-based store (debug builds only).
pub fn get_credential(connection_type: &str, username: &str) -> AppResult<String> {
    file_store::get(&service_name(connection_type), username)
}

#[cfg(debug_assertions)]
/// Delete a credential from the dev file-based store (debug builds only).
pub fn delete_credential(connection_type: &str, username: &str) -> AppResult<()> {
    file_store::delete(&service_name(connection_type), username)
}

// ---- Release: OS keychain ----

#[cfg(not(debug_assertions))]
use crate::error::AppError;
#[cfg(not(debug_assertions))]
use keyring::Entry;

#[cfg(not(debug_assertions))]
/// Store a credential (PAT or API token) in the OS keychain.
/// - `connection_type`: "jira-server" or "jira-cloud"
/// - username: the account identifier (e.g., email for Cloud, username for Server)
/// - secret: the PAT or API token value
pub fn store_credential(connection_type: &str, username: &str, secret: &str) -> AppResult<()> {
    let entry = Entry::new(&service_name(connection_type), username)
        .map_err(|e| AppError::Keychain(format!("Failed to create keychain entry: {e}")))?;
    entry.set_password(secret)?;
    Ok(())
}

#[cfg(not(debug_assertions))]
/// Retrieve a credential from the OS keychain.
/// Returns the stored secret string.
pub fn get_credential(connection_type: &str, username: &str) -> AppResult<String> {
    let entry = Entry::new(&service_name(connection_type), username)
        .map_err(|e| AppError::Keychain(format!("Failed to create keychain entry: {e}")))?;
    let password = entry.get_password()?;
    Ok(password)
}

#[cfg(not(debug_assertions))]
/// Delete a credential from the OS keychain.
pub fn delete_credential(connection_type: &str, username: &str) -> AppResult<()> {
    let entry = Entry::new(&service_name(connection_type), username)
        .map_err(|e| AppError::Keychain(format!("Failed to create keychain entry: {e}")))?;
    entry.delete_credential()?;
    Ok(())
}
