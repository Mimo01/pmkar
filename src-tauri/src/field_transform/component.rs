//! Phase 18 — component.rs: source component name → target ID via cached
//! `/project/{key}/components` (TRAN-04, D-09, D-10). Twin of version.rs —
//! same cache semantics, same HTTP pattern, different endpoint.

use crate::field_transform::SessionComponentCache;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

const COMPONENTS_PAGE_SIZE: usize = 100;
const MAX_COMPONENTS_PAGES: usize = 50;

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

    /// Resolves a source component name to a target Cloud component ID.
    ///   - Returns `Some(id)` on case-insensitive name match (Pitfall D).
    ///   - Returns `None` on miss OR on HTTP failure (caller emits
    ///     `UnresolvedComponent` gap; D-01 keeps the pipeline flowing).
    ///   - Caches the component list per `project_key` for the session (D-09).
    pub async fn resolve_name(&self, project_key: &str, source_name: &str) -> Option<String> {
        if project_key.is_empty() || source_name.is_empty() {
            return None;
        }
        let comps = self.get_or_fetch_components(project_key).await?;
        for c in &comps {
            let name = c.get("name").and_then(|x| x.as_str()).unwrap_or("");
            if name.eq_ignore_ascii_case(source_name) {
                return c.get("id").and_then(|x| x.as_str()).map(str::to_string);
            }
        }
        None
    }

    /// Cache-first fetch with short lock windows (analog: field_discovery.rs:498-529).
    /// Returns the cached list on hit; on miss fetches once, caches, returns.
    async fn get_or_fetch_components(&self, project_key: &str) -> Option<Vec<serde_json::Value>> {
        // 1) Cache check — lock kept short, NOT held during HTTP.
        {
            let guard = self.cache.lock().ok()?;
            if let Some(cached) = guard.get(project_key) {
                return Some(cached.clone());
            }
        }
        // 2) HTTP fetch — no lock held.
        let fetched = self.fetch_components_http(project_key).await.ok()?;
        // 3) Cache write — lock kept short.
        {
            if let Ok(mut guard) = self.cache.lock() {
                guard.insert(project_key.to_string(), fetched.clone());
            }
        }
        Some(fetched)
    }

    async fn fetch_components_http(&self, project_key: &str) -> Result<Vec<serde_json::Value>, ()> {
        let trimmed = self.cloud_base_url.trim_end_matches('/');
        let project_enc = urlencoding::encode(project_key);
        let mut all: Vec<serde_json::Value> = Vec::new();
        let mut start_at: usize = 0;
        for _ in 0..MAX_COMPONENTS_PAGES {
            let url = format!(
                "{trimmed}/rest/api/3/project/{project_enc}/components?startAt={start_at}&maxResults={COMPONENTS_PAGE_SIZE}"
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
            if page_len < COMPONENTS_PAGE_SIZE {
                break;
            }
            start_at += COMPONENTS_PAGE_SIZE;
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

    fn build_resolver_against(base_url: String) -> ComponentResolver {
        ComponentResolver::new(
            reqwest::Client::new(),
            "Basic Zm9vOmJhcg==".into(),
            base_url,
        )
    }

    async fn spawn_components_mock(
        body: Vec<serde_json::Value>,
        status: u16,
    ) -> (String, Arc<AtomicUsize>, tokio::task::JoinHandle<()>) {
        use axum::{routing::get, Json, Router};
        use std::net::SocketAddr;
        let counter = Arc::new(AtomicUsize::new(0));
        let counter_clone = Arc::clone(&counter);
        let body_clone = body.clone();
        let app: Router = Router::new().route(
            "/rest/api/3/project/{key}/components",
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
        let (base, _c, h) = spawn_components_mock(
            vec![
                json!({"id":"30001","name":"API"}),
                json!({"id":"30002","name":"Frontend"}),
            ],
            200,
        )
        .await;
        let r = build_resolver_against(base);
        assert_eq!(r.resolve_name("MYPROJ", "API").await.as_deref(), Some("30001"));
        h.abort();
    }

    #[tokio::test]
    async fn resolve_name_case_insensitive() {
        let (base, _c, h) = spawn_components_mock(
            vec![json!({"id":"30001","name":"API"})],
            200,
        )
        .await;
        let r = build_resolver_against(base);
        assert_eq!(r.resolve_name("MYPROJ", "api").await.as_deref(), Some("30001"));
        h.abort();
    }

    #[tokio::test]
    async fn resolve_name_returns_none_for_missing() {
        let (base, _c, h) = spawn_components_mock(
            vec![json!({"id":"30001","name":"API"})],
            200,
        )
        .await;
        let r = build_resolver_against(base);
        assert_eq!(r.resolve_name("MYPROJ", "Backend").await, None);
        h.abort();
    }

    #[tokio::test]
    async fn cache_hit_skips_second_http() {
        let (base, counter, h) = spawn_components_mock(
            vec![json!({"id":"30001","name":"API"})],
            200,
        )
        .await;
        let r = build_resolver_against(base);
        let _ = r.resolve_name("MYPROJ", "API").await;
        let _ = r.resolve_name("MYPROJ", "API").await;
        assert_eq!(counter.load(Ordering::SeqCst), 1);
        h.abort();
    }

    #[tokio::test]
    async fn http_failure_returns_none_not_err() {
        let (base, _c, h) = spawn_components_mock(vec![], 500).await;
        let r = build_resolver_against(base);
        assert_eq!(r.resolve_name("MYPROJ", "API").await, None);
        h.abort();
    }

    #[tokio::test]
    async fn empty_inputs_return_none() {
        let r = build_resolver_against("http://127.0.0.1:1".into());
        assert_eq!(r.resolve_name("", "API").await, None);
        assert_eq!(r.resolve_name("MYPROJ", "").await, None);
    }
}
