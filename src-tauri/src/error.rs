use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Keychain error: {0}")]
    Keychain(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("HTTP error: {0}")]
    Http(String),

    #[error("Mock server error: {0}")]
    MockServer(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("{0}")]
    Internal(String),
}

// Tauri commands need Serialize for error responses
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        // Only serialize the display message — never the internal cause chain
        serializer.serialize_str(&self.to_string())
    }
}

// Convert external errors to sanitized AppError variants
impl From<keyring::Error> for AppError {
    fn from(e: keyring::Error) -> Self {
        // Sanitize: keyring errors can contain credential info in debug repr
        match e {
            keyring::Error::NoEntry => AppError::Keychain("No credential found".into()),
            keyring::Error::Ambiguous(_) => AppError::Keychain("Ambiguous credential entry".into()),
            _ => AppError::Keychain("Keychain operation failed".into()),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Database(format!("Database operation failed: {}", e))
    }
}

impl From<reqwest::Error> for AppError {
    fn from(_e: reqwest::Error) -> Self {
        // NEVER include reqwest error details — they can contain auth headers
        AppError::Http("HTTP request failed".into())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Serialization(format!("JSON error: {}", e))
    }
}

pub type AppResult<T> = Result<T, AppError>;
