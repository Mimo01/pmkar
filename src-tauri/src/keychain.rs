use crate::error::{AppError, AppResult};
use keyring::Entry;

/// The keyring service prefix. All pmkar credentials use this prefix.
const SERVICE_PREFIX: &str = "pmkar";

/// Build the full service name: "pmkar-{connection_type}"
/// connection_type: "jira-server" or "jira-cloud"
fn service_name(connection_type: &str) -> String {
    format!("{}-{}", SERVICE_PREFIX, connection_type)
}

/// Store a credential (PAT or API token) in the OS keychain.
/// - connection_type: "jira-server" or "jira-cloud"
/// - username: the account identifier (e.g., email for Cloud, username for Server)
/// - secret: the PAT or API token value
pub fn store_credential(connection_type: &str, username: &str, secret: &str) -> AppResult<()> {
    let entry = Entry::new(&service_name(connection_type), username)
        .map_err(|e| AppError::Keychain(format!("Failed to create keychain entry: {}", e)))?;
    entry.set_password(secret)?;
    Ok(())
}

/// Retrieve a credential from the OS keychain.
/// Returns the stored secret string.
pub fn get_credential(connection_type: &str, username: &str) -> AppResult<String> {
    let entry = Entry::new(&service_name(connection_type), username)
        .map_err(|e| AppError::Keychain(format!("Failed to create keychain entry: {}", e)))?;
    let password = entry.get_password()?;
    Ok(password)
}

/// Delete a credential from the OS keychain.
pub fn delete_credential(connection_type: &str, username: &str) -> AppResult<()> {
    let entry = Entry::new(&service_name(connection_type), username)
        .map_err(|e| AppError::Keychain(format!("Failed to create keychain entry: {}", e)))?;
    entry.delete_credential()?;
    Ok(())
}
