//! Phase 18 — version.rs: source version name → target ID via cached
//! `/project/{key}/versions` (TRAN-03, D-09, D-10).

use crate::field_transform::SessionVersionCache;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Page size used for the (currently flat-array) versions endpoint. Cloud may
/// add pagination; we request a generous page to be future-proof.
const VERSIONS_PAGE_SIZE: usize = 100;
/// Hard upper bound on pagination loops.
const MAX_VERSIONS_PAGES: usize = 50;

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

    /// Resolves a source version name to a target Cloud version ID.
    ///   - Returns `Some(id)` on case-insensitive name match (Pitfall D).
    ///   - Returns `None` on miss OR on HTTP failure (caller emits
    ///     `UnresolvedVersion` gap; D-01 keeps the pipeline flowing).
    ///   - Caches the version list per `project_key` for the session (D-09).
    pub async fn resolve_name(&self, project_key: &str, source_name: &str) -> Option<String> {
        if project_key.is_empty() || source_name.is_empty() {
            return None;
        }
        let versions = self.get_or_fetch_versions(project_key).await?;
        for v in &versions {
            let name = v.get("name").and_then(|x| x.as_str()).unwrap_or("");
            if name.eq_ignore_ascii_case(source_name) {
                return v.get("id").and_then(|x| x.as_str()).map(str::to_string);
            }
        }
        None
    }

    /// Cache-first fetch with short lock windows (analog: field_discovery.rs:498-529).
    /// Returns the cached list on hit; on miss fetches once, caches, returns.
    async fn get_or_fetch_versions(&self, project_key: &str) -> Option<Vec<serde_json::Value>> {
        // 1) Cache check — lock kept short, NOT held during HTTP.
        {
            let guard = self.cache.lock().ok()?;
            if let Some(cached) = guard.get(project_key) {
                return Some(cached.clone());
            }
        }
        // 2) HTTP fetch — no lock held.
        let fetched = self.fetch_versions_http(project_key).await.ok()?;
        // 3) Cache write — lock kept short.
        {
            if let Ok(mut guard) = self.cache.lock() {
                guard.insert(project_key.to_string(), fetched.clone());
            }
        }
        Some(fetched)
    }

    async fn fetch_versions_http(&self, project_key: &str) -> Result<Vec<serde_json::Value>, ()> {
        let trimmed = self.cloud_base_url.trim_end_matches('/');
        let project_enc = urlencoding::encode(project_key);
        let mut all: Vec<serde_json::Value> = Vec::new();
        let mut start_at: usize = 0;
        for _ in 0..MAX_VERSIONS_PAGES {
            let url = format!(
                "{trimmed}/rest/api/3/project/{project_enc}/versions?startAt={start_at}&maxResults={VERSIONS_PAGE_SIZE}"
            );
            let resp = self
                .client
                .get(&url)
                .header("Authorization", self.cloud_auth.clone())
                .send()
                .await
                .map_err(|_| ())?;
            if !resp.status().is_success() {
                return Err(());
            }
            // Endpoint may return either a flat array (typical) or a paginated wrapper.
            // Handle both: parse as Value, then check shape.
            let body: serde_json::Value = resp.json().await.map_err(|_| ())?;
            let page: Vec<serde_json::Value> = if body.is_array() {
                serde_json::from_value(body).map_err(|_| ())?
            } else if let Some(values) = body.get("values").and_then(|v| v.as_array()) {
                values.clone()
            } else {
                return Err(());
            };
            let page_len = page.len();
            all.extend(page);
            if page_len < VERSIONS_PAGE_SIZE {
                break;
            }
            start_at += VERSIONS_PAGE_SIZE;
        }
        Ok(all)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::response::IntoResponse;
    use serde_json::json;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn build_resolver_against(base_url: String) -> VersionResolver {
        VersionResolver::new(
            reqwest::Client::new(),
            "Basic Zm9vOmJhcg==".into(),
            base_url,
        )
    }

    /// Spins up an axum mock that returns a fixed versions array AND counts
    /// invocations. Returns (base_url, hit_counter, shutdown_handle).
    async fn spawn_versions_mock(
        body: Vec<serde_json::Value>,
        status: u16,
    ) -> (String, Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
        use axum::{routing::get, Json, Router};
        use std::net::SocketAddr;
        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = Arc::clone(&counter);
        let body_clone = body.clone();
        let app: Router = Router::new().route(
            "/rest/api/3/project/{key}/versions",
            get(move || {
                let c = Arc::clone(&counter_clone);
                let b = body_clone.clone();
                async move {
                    c.fetch_add(1, Ordering::SeqCst);
                    if status == 200 {
                        (axum::http::StatusCode::OK, Json(b)).into_response()
                    } else {
                        axum::http::StatusCode::from_u16(status).unwrap().into_response()
                    }
                }
            }),
        );
        let listener = tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
            .await
            .unwrap();
        let addr = listener.local_addr().unwrap();
        let handle = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        (format!("http://{addr}"), counter, handle)
    }

    #[tokio::test]
    async fn resolve_name_returns_id_for_exact_name() {
        let (base, _c, h) = spawn_versions_mock(
            vec![
                json!({"id":"20010","name":"1.2.0","released":false}),
                json!({"id":"20011","name":"1.3.0","released":false}),
            ],
            200,
        )
        .await;
        let r = build_resolver_against(base);
        assert_eq!(r.resolve_name("MYPROJ", "1.2.0").await.as_deref(), Some("20010"));
        h.abort();
    }

    #[tokio::test]
    async fn resolve_name_case_insensitive() {
        let (base, _c, h) = spawn_versions_mock(
            vec![json!({"id":"99","name":"v1.2.3-RC"})],
            200,
        )
        .await;
        let r = build_resolver_against(base);
        assert_eq!(r.resolve_name("MYPROJ", "v1.2.3-rc").await.as_deref(), Some("99"));
        h.abort();
    }

    #[tokio::test]
    async fn resolve_name_returns_none_for_missing() {
        let (base, _c, h) = spawn_versions_mock(
            vec![json!({"id":"20010","name":"1.2.0"})],
            200,
        )
        .await;
        let r = build_resolver_against(base);
        assert_eq!(r.resolve_name("MYPROJ", "9.9.9").await, None);
        h.abort();
    }

    #[tokio::test]
    async fn cache_hit_skips_second_http() {
        let (base, counter, h) = spawn_versions_mock(
            vec![json!({"id":"20010","name":"1.2.0"})],
            200,
        )
        .await;
        let r = build_resolver_against(base);
        let _ = r.resolve_name("MYPROJ", "1.2.0").await;
        let _ = r.resolve_name("MYPROJ", "1.2.0").await;
        // Cache means only ONE HTTP call.
        assert_eq!(counter.load(Ordering::SeqCst), 1);
        h.abort();
    }

    #[tokio::test]
    async fn http_failure_returns_none_not_err() {
        let (base, _c, h) = spawn_versions_mock(vec![], 500).await;
        let r = build_resolver_against(base);
        assert_eq!(r.resolve_name("MYPROJ", "1.2.0").await, None);
        h.abort();
    }

    #[tokio::test]
    async fn empty_project_key_returns_none_no_panic() {
        let r = build_resolver_against("http://127.0.0.1:1".into());
        // No HTTP fired because guard short-circuits on empty key.
        assert_eq!(r.resolve_name("", "1.2.0").await, None);
        assert_eq!(r.resolve_name("MYPROJ", "").await, None);
    }
}
