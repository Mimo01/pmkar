//! Phase 18 — version.rs: source version name → target ID via cached
//! `/project/{key}/versions` (TRAN-03, D-09, D-10). Stub in Plan 01; real
//! impl in Plan 02.

use crate::field_transform::SessionVersionCache;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct VersionResolver {
    pub client: reqwest::Client,
    pub cloud_auth: String,
    pub cloud_base_url: String,
    pub cache: SessionVersionCache,
}

impl VersionResolver {
    pub fn new(client: reqwest::Client, cloud_auth: String, cloud_base_url: String) -> Self {
        Self {
            client,
            cloud_auth,
            cloud_base_url,
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Plan 02 implements: returns target version ID for `source_name` (case-insensitive
    /// match per Pitfall D), or None if not found in the target project's version list.
    ///
    /// Plan 02 makes this `async`; stub is sync (no await points).
    pub fn resolve_name(
        &self,
        _project_key: &str,
        _source_name: &str,
    ) -> Option<String> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_resolver_stub_constructs() {
        let r = VersionResolver::new(
            reqwest::Client::new(),
            "Basic Zm9vOmJhcg==".into(),
            "https://example.atlassian.net".into(),
        );
        assert_eq!(r.cloud_base_url, "https://example.atlassian.net");
    }
}
