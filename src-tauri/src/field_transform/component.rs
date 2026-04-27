//! Phase 18 — component.rs: source component name → target ID via cached
//! `/project/{key}/components` (TRAN-04, D-09, D-10). Stub in Plan 01; real
//! impl in Plan 02.

use crate::field_transform::SessionComponentCache;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub struct ComponentResolver {
    pub client: reqwest::Client,
    pub cloud_auth: String,
    pub cloud_base_url: String,
    pub cache: SessionComponentCache,
}

impl ComponentResolver {
    pub fn new(client: reqwest::Client, cloud_auth: String, cloud_base_url: String) -> Self {
        Self {
            client,
            cloud_auth,
            cloud_base_url,
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Plan 02 implements: returns target component ID for `source_name`
    /// (case-insensitive match), or None if not found.
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
    fn component_resolver_stub_constructs() {
        let r = ComponentResolver::new(
            reqwest::Client::new(),
            "Basic Zm9vOmJhcg==".into(),
            "https://example.atlassian.net".into(),
        );
        assert_eq!(r.cloud_base_url, "https://example.atlassian.net");
    }
}
