use crate::audit::{build_audited_client, AuditDb};
use reqwest_middleware::ClientWithMiddleware;
use std::sync::{Arc, Mutex};

/// The Jira HTTP client. Wraps reqwest with `AuditMiddleware`.
/// All outbound requests are logged to `SQLite` with Authorization redacted.
pub struct JiraClient {
    pub client: ClientWithMiddleware,
}

impl JiraClient {
    pub fn new(audit_db: Arc<Mutex<AuditDb>>) -> Self {
        Self {
            client: build_audited_client(audit_db),
        }
    }
}
