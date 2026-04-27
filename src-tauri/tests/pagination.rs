//! Regression tests for the Jira `/rest/api/2/search` pagination loop.
//!
//! See debug session: `.planning/debug/jira-fetch-pagination-50-cap.md`.
//!
//! These tests spin up a tiny purpose-built axum mock server (separate from the
//! larger pmkar `mock_server`) on an OS-assigned port. The server returns exactly
//! `total` synthetic issues, sliced by `startAt` / `maxResults`, so we can drive
//! `jira_client::search_tickets` through known multi-page scenarios.

use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use pmkar_lib::jira_client::{search_tickets, MAX_PAGINATION_ITEMS, SEARCH_PAGE_SIZE};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
struct PageQuery {
    #[serde(rename = "startAt")]
    start_at: Option<u64>,
    #[serde(rename = "maxResults")]
    max_results: Option<u64>,
    #[allow(dead_code)]
    jql: Option<String>,
    #[allow(dead_code)]
    fields: Option<String>,
}

#[derive(Clone)]
struct AppState {
    total: u64,
}

async fn search_handler(
    State(state): State<Arc<AppState>>,
    Query(q): Query<PageQuery>,
) -> Json<Value> {
    let start_at = q.start_at.unwrap_or(0);
    let max_results = q.max_results.unwrap_or(50);
    let total = state.total;

    let start = start_at.min(total);
    let end = (start_at + max_results).min(total);
    let issues: Vec<Value> = (start..end)
        .map(|i| {
            json!({
                "id": i.to_string(),
                "key": format!("PROJ-{i}"),
                "fields": { "summary": format!("Synthetic ticket {i}") }
            })
        })
        .collect();

    Json(json!({
        "startAt": start_at,
        "maxResults": max_results,
        "total": total,
        "issues": issues,
    }))
}

/// Spawn a tiny mock Jira on a free OS-assigned port, returning the base URL.
/// Each test gets its own independent server, sized to its scenario.
async fn spawn_mock(total: u64) -> String {
    let state = Arc::new(AppState { total });
    let app = Router::new()
        .route("/rest/api/2/search", get(search_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind failed");
    let addr = listener.local_addr().expect("local_addr failed");
    tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });
    // Brief yield so the server is ready before the first request.
    tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    format!("http://{addr}")
}

#[tokio::test]
async fn search_tickets_paginates_past_first_page() {
    // 120 issues — three pages at the 50-item page size.
    let base = spawn_mock(120).await;
    let (issues, truncated) = search_tickets(&base, "project=PROJ", "test-pat")
        .await
        .expect("search_tickets failed");
    assert_eq!(
        issues.len(),
        120,
        "expected all 120 issues across pages — got {}",
        issues.len()
    );
    assert!(
        !truncated,
        "should not be truncated below MAX_PAGINATION_ITEMS"
    );
    // Spot-check the boundary issues to confirm we paginated rather than repeated.
    assert_eq!(issues.first().unwrap()["key"], "PROJ-0");
    assert_eq!(issues.last().unwrap()["key"], "PROJ-119");
}

#[tokio::test]
async fn search_tickets_handles_exact_page_boundary() {
    // Exactly one page — must NOT trigger an extra request that returns an empty page.
    let base = spawn_mock(SEARCH_PAGE_SIZE).await;
    let (issues, truncated) = search_tickets(&base, "project=PROJ", "test-pat")
        .await
        .expect("search_tickets failed");
    assert_eq!(issues.len(), usize::try_from(SEARCH_PAGE_SIZE).unwrap());
    assert!(!truncated);
}

#[tokio::test]
async fn search_tickets_returns_empty_when_total_is_zero() {
    let base = spawn_mock(0).await;
    let (issues, truncated) = search_tickets(&base, "project=NONE", "test-pat")
        .await
        .expect("search_tickets failed");
    assert!(issues.is_empty());
    assert!(!truncated);
}

#[tokio::test]
async fn search_tickets_caps_at_max_pagination_items() {
    // 1500 > MAX_PAGINATION_ITEMS (1000) — must cap and flag truncated.
    let base = spawn_mock(1500).await;
    let (issues, truncated) = search_tickets(&base, "project=BIG", "test-pat")
        .await
        .expect("search_tickets failed");
    assert_eq!(
        u64::try_from(issues.len()).unwrap(),
        MAX_PAGINATION_ITEMS,
        "should cap at MAX_PAGINATION_ITEMS"
    );
    assert!(truncated, "should flag truncated when cap is hit");
}
