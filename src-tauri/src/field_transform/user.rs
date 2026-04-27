//! Phase 18 — user.rs: batch user resolution (TRAN-01, TRAN-06, D-06).
//! Stub in Plan 01; real impl in Plan 03.

use std::collections::HashMap;

/// Resolves source user identifiers to Cloud `accountId`s in a single batched
/// HTTP pass per email domain. Plan 03 implements `resolve_batch`.
pub struct UserResolver {
    pub client: reqwest::Client,
    pub cloud_auth: String,
    pub cloud_base_url: String,
}

impl UserResolver {
    pub fn new(client: reqwest::Client, cloud_auth: String, cloud_base_url: String) -> Self {
        Self { client, cloud_auth, cloud_base_url }
    }

    /// Plan 03 replaces this stub. Pre-scans source issue + mapping for unique
    /// usernames (incl. `[~username]` patterns in description per D-06), runs
    /// one HTTP search per unique domain, returns map of source identifier →
    /// `Option<accountId>`. None means "couldn't resolve" — caller emits an
    /// `UnresolvedPerson` gap (D-01).
    ///
    /// Plan 03 makes this `async`; stub is sync (no await points).
    pub fn resolve_batch(
        &self,
        _source_issue: &serde_json::Value,
        _mapping: &[crate::field_transform::FieldMappingRow],
    ) -> HashMap<String, Option<String>> {
        HashMap::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_resolver_stub_constructs() {
        let r = UserResolver::new(
            reqwest::Client::new(),
            "Basic Zm9vOmJhcg==".into(),
            "https://example.atlassian.net".into(),
        );
        assert_eq!(r.cloud_base_url, "https://example.atlassian.net");
    }
}
