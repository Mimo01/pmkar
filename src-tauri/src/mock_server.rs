use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, Request, StatusCode},
    middleware::{self, Next},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

use crate::error::AppResult;
use crate::fixtures::{AdfDoc, JiraIssue, SharedFixtures};

/// Auth middleware: accepts any non-empty Authorization header, returns 401 otherwise.
async fn require_auth(
    headers: HeaderMap,
    request: Request<axum::body::Body>,
    next: Next,
) -> Result<impl IntoResponse, StatusCode> {
    match headers.get("authorization") {
        Some(value) if !value.is_empty() => Ok(next.run(request).await),
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}

// --- Query params ---

#[derive(Debug, Deserialize)]
pub struct UserSearchQuery {
    pub username: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct V3UserSearchQuery {
    pub query: Option<String>,
    #[serde(rename = "maxResults")]
    pub max_results: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub jql: Option<String>,
    #[serde(rename = "startAt")]
    pub start_at: Option<u64>,
    #[serde(rename = "maxResults")]
    pub max_results: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct IssueQuery {
    pub expand: Option<String>,
    pub fields: Option<String>,
}

// --- Search response helpers ---

fn make_search_response(issues: &[&JiraIssue]) -> Value {
    make_search_response_paged(issues, 0, 50)
}

/// Paginated variant of `make_search_response`: returns the slice
/// `[start_at .. start_at + max_results]` of `issues`, while still reporting the
/// full `total`. Used to drive multi-page regression tests for
/// `fetch_tickets` / `search_tickets`.
fn make_search_response_paged(issues: &[&JiraIssue], start_at: u64, max_results: u64) -> Value {
    let total = issues.len() as u64;
    let start = usize::try_from(start_at.min(total)).unwrap_or(usize::MAX);
    let end = usize::try_from((start_at + max_results).min(total)).unwrap_or(usize::MAX);
    let page_slice = if start < end {
        &issues[start..end]
    } else {
        &[]
    };
    let issues_json: Vec<Value> = page_slice
        .iter()
        .map(|i| {
            json!({
                "id": i.id,
                "key": i.key,
                "fields": i.fields
            })
        })
        .collect();
    json!({
        "startAt": start_at,
        "maxResults": max_results,
        "total": total,
        "issues": issues_json
    })
}

/// Filter issues by simple JQL: if jql contains `assignee=X`, filter by assignee name/accountId.
fn filter_issues<'a>(
    issues: &'a HashMap<String, JiraIssue>,
    jql: Option<&String>,
) -> Vec<&'a JiraIssue> {
    let mut result: Vec<&JiraIssue> = issues.values().collect();

    if let Some(jql_str) = jql {
        // Simple assignee filter: assignee=jdoe or assignee = jdoe
        if let Some(assignee_val) = extract_jql_assignee(jql_str) {
            result.retain(|issue| {
                let assignee = &issue.fields["assignee"];
                // v2: name field, v3: accountId field
                let name = assignee["name"].as_str().unwrap_or("");
                let account_id = assignee["accountId"].as_str().unwrap_or("");
                name == assignee_val || account_id == assignee_val
            });
        }
    }

    // Sort by key for deterministic ordering
    result.sort_by(|a, b| a.key.cmp(&b.key));
    result
}

fn extract_jql_assignee(jql: &str) -> Option<String> {
    // Match patterns like: assignee=jdoe, assignee = jdoe, assignee="jdoe"
    let lower = jql.to_lowercase();
    if let Some(pos) = lower.find("assignee") {
        let rest = &jql[pos + "assignee".len()..];
        let rest = rest.trim_start();
        if let Some(stripped) = rest.strip_prefix('=') {
            let after_eq = stripped.trim_start();
            // Handle quoted value: assignee = "jdoe"
            if let Some(inner) = after_eq.strip_prefix('"') {
                if let Some(end_quote) = inner.find('"') {
                    let val = &inner[..end_quote];
                    if !val.is_empty() {
                        return Some(val.to_string());
                    }
                }
            } else {
                // Unquoted value — take until whitespace
                let end = after_eq
                    .find(|c: char| c.is_whitespace())
                    .unwrap_or(after_eq.len());
                let val = &after_eq[..end];
                if !val.is_empty() {
                    return Some(val.to_string());
                }
            }
        }
    }
    None
}

// --- Server v2 handlers ---

mod v2 {
    use super::{
        filter_issues, json, IntoResponse, IssueQuery, JiraIssue, Json, Path, Query, SearchQuery,
        SharedFixtures, State, StatusCode, UserSearchQuery, Value,
    };

    pub async fn get_myself() -> impl IntoResponse {
        Json(json!({
            "name": "jdoe",
            "displayName": "John Doe",
            "emailAddress": "jdoe@example.com",
            "active": true,
            "self": "http://127.0.0.1:8080/rest/api/2/user?username=jdoe"
        }))
    }

    pub async fn get_server_info() -> impl IntoResponse {
        Json(json!({
            "version": "8.20.0",
            "buildNumber": 802_000,
            "buildDate": "2022-01-01T00:00:00.000+0000",
            "serverTitle": "Mock Jira Server",
            "baseUrl": "http://127.0.0.1:8080"
        }))
    }

    pub async fn get_issue(
        State(fixtures): State<SharedFixtures>,
        Path(key): Path<String>,
        Query(params): Query<IssueQuery>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        match state.server_v2_issues.get(&key) {
            Some(issue) => {
                let mut body = json!({
                    "id": issue.id,
                    "key": issue.key,
                    "fields": issue.fields
                });

                let expand = params.expand.unwrap_or_default();

                // Support expand=renderedFields
                if expand.contains("renderedFields") {
                    let desc = issue.fields["description"].as_str().unwrap_or("");
                    let rendered_comments: Vec<Value> = issue.fields["comment"]["comments"]
                        .as_array()
                        .cloned()
                        .unwrap_or_default()
                        .iter()
                        .map(|c| {
                            let body_str = c["body"].as_str().unwrap_or("");
                            let mut rendered = c.clone();
                            rendered["body"] = json!(format!("<p>{}</p>", body_str));
                            rendered
                        })
                        .collect();
                    body["renderedFields"] = json!({
                        "description": format!("<p>{}</p>", desc),
                        "comment": {
                            "comments": rendered_comments
                        }
                    });
                }

                // Support expand=changelog
                if expand.contains("changelog") {
                    body["changelog"] = json!({
                        "histories": [
                            {
                                "id": "50001",
                                "created": "2026-01-14T12:00:00.000+0000",
                                "author": {"name": "jdoe", "displayName": "Jane Doe"},
                                "items": [{
                                    "field": "status",
                                    "fromString": "Open",
                                    "toString": "In Progress"
                                }]
                            },
                            {
                                "id": "50002",
                                "created": "2026-01-15T08:00:00.000+0000",
                                "author": {"name": "csmith", "displayName": "Chris Smith"},
                                "items": [{
                                    "field": "priority",
                                    "fromString": "Medium",
                                    "toString": "High"
                                }]
                            }
                        ]
                    });
                }

                (StatusCode::OK, Json(body)).into_response()
            }
            None => StatusCode::NOT_FOUND.into_response(),
        }
    }

    pub async fn get_worklog(
        State(fixtures): State<SharedFixtures>,
        Path(key): Path<String>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        match state.server_v2_issues.get(&key) {
            Some(issue) => {
                let worklogs = issue
                    .fields
                    .get("worklog")
                    .and_then(|w| w.get("worklogs"))
                    .cloned()
                    .unwrap_or(json!([]));
                (StatusCode::OK, Json(json!({ "worklogs": worklogs }))).into_response()
            }
            None => StatusCode::NOT_FOUND.into_response(),
        }
    }

    pub async fn search_users(Query(params): Query<UserSearchQuery>) -> impl IntoResponse {
        let mock_users = vec![
            json!({"name": "jdoe", "displayName": "Jane Doe", "emailAddress": "jdoe@example.com", "active": true, "avatarUrls": {"48x48": "https://avatar.example.com/jdoe/48x48.png", "32x32": "https://avatar.example.com/jdoe/32x32.png", "24x24": "https://avatar.example.com/jdoe/24x24.png", "16x16": "https://avatar.example.com/jdoe/16x16.png"}}),
            json!({"name": "csmith", "displayName": "Chris Smith", "emailAddress": "csmith@example.com", "active": true, "avatarUrls": {"48x48": "https://avatar.example.com/csmith/48x48.png", "32x32": "https://avatar.example.com/csmith/32x32.png", "24x24": "https://avatar.example.com/csmith/24x24.png", "16x16": "https://avatar.example.com/csmith/16x16.png"}}),
            json!({"name": "bwilson", "displayName": "Bob Wilson", "emailAddress": "bwilson@example.com", "active": true, "avatarUrls": {"48x48": "https://avatar.example.com/bwilson/48x48.png", "32x32": "https://avatar.example.com/bwilson/32x32.png", "24x24": "https://avatar.example.com/bwilson/24x24.png", "16x16": "https://avatar.example.com/bwilson/16x16.png"}}),
            json!({"name": "admin", "displayName": "Admin User", "emailAddress": "admin@example.com", "active": true, "avatarUrls": {"48x48": "https://avatar.example.com/admin/48x48.png", "32x32": "https://avatar.example.com/admin/32x32.png", "24x24": "https://avatar.example.com/admin/24x24.png", "16x16": "https://avatar.example.com/admin/16x16.png"}}),
        ];
        let query = params.username.unwrap_or_default().to_lowercase();
        let filtered: Vec<Value> = if query.is_empty() {
            mock_users
        } else {
            mock_users
                .into_iter()
                .filter(|u| {
                    let name = u["name"].as_str().unwrap_or("").to_lowercase();
                    let display = u["displayName"].as_str().unwrap_or("").to_lowercase();
                    name.contains(&query) || display.contains(&query)
                })
                .collect()
        };
        (StatusCode::OK, Json(filtered)).into_response()
    }

    pub async fn search_issues(
        State(fixtures): State<SharedFixtures>,
        Query(params): Query<SearchQuery>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        let filtered = filter_issues(&state.server_v2_issues, params.jql.as_ref());
        let start_at = params.start_at.unwrap_or(0);
        let max_results = params.max_results.unwrap_or(50);
        let response = super::make_search_response_paged(&filtered, start_at, max_results);
        (StatusCode::OK, Json(response)).into_response()
    }

    pub async fn create_issue(
        State(fixtures): State<SharedFixtures>,
        Json(body): Json<Value>,
    ) -> impl IntoResponse {
        let mut state = fixtures.lock().unwrap();
        let id = state.next_issue_id;
        state.next_issue_id += 1;
        let key = format!("PROJ-{}", id - 10000);
        let issue_id = id.to_string();

        let summary = body["fields"]["summary"]
            .as_str()
            .unwrap_or("Untitled")
            .to_string();
        let description = body["fields"]["description"].clone();

        let now = chrono::Utc::now().to_rfc3339();
        let new_issue = JiraIssue {
            id: issue_id.clone(),
            key: key.clone(),
            fields: json!({
                "summary": summary,
                "status": { "name": "Open", "id": "1" },
                "priority": body["fields"]["priority"].clone(),
                "description": description,
                "assignee": null,
                "reporter": null,
                "labels": if body["fields"]["labels"].is_array() { body["fields"]["labels"].clone() } else { json!([]) },
                "components": [],
                "fixVersions": [],
                "comment": { "comments": [] },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "created": now,
                "updated": now
            }),
        };

        state.server_v2_issues.insert(key.clone(), new_issue);

        let response = json!({ "id": issue_id, "key": key });
        (StatusCode::CREATED, Json(response)).into_response()
    }

    pub async fn update_issue(
        State(fixtures): State<SharedFixtures>,
        Path(key): Path<String>,
        Json(body): Json<Value>,
    ) -> impl IntoResponse {
        let mut state = fixtures.lock().unwrap();
        match state.server_v2_issues.get_mut(&key) {
            Some(issue) => {
                // Merge fields from update body
                if let Some(fields) = body["fields"].as_object() {
                    for (k, v) in fields {
                        issue.fields[k] = v.clone();
                    }
                }
                StatusCode::NO_CONTENT.into_response()
            }
            None => StatusCode::NOT_FOUND.into_response(),
        }
    }

    pub async fn add_comment(
        State(fixtures): State<SharedFixtures>,
        Path(key): Path<String>,
        Json(body): Json<Value>,
    ) -> impl IntoResponse {
        let mut state = fixtures.lock().unwrap();
        match state.server_v2_issues.get_mut(&key) {
            Some(issue) => {
                let comment_id = format!("c{}", uuid::Uuid::new_v4());
                let new_comment = json!({
                    "id": comment_id,
                    "author": { "name": "api-user", "displayName": "API User" },
                    "body": body["body"].clone(),
                    "created": chrono::Utc::now().to_rfc3339()
                });
                if let Some(arr) = issue.fields["comment"]["comments"].as_array_mut() {
                    arr.push(new_comment.clone());
                }
                (StatusCode::CREATED, Json(new_comment)).into_response()
            }
            None => StatusCode::NOT_FOUND.into_response(),
        }
    }

    pub async fn add_attachment(
        State(fixtures): State<SharedFixtures>,
        Path(key): Path<String>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        if state.server_v2_issues.contains_key(&key) {
            let mock_attachment = json!([{
                "id": "mock-attachment-id",
                "filename": "uploaded-file.bin",
                "size": 0,
                "mimeType": "application/octet-stream",
                "content": format!("http://localhost:8080/secure/attachment/mock-attachment-id/uploaded-file.bin")
            }]);
            (StatusCode::OK, Json(mock_attachment)).into_response()
        } else {
            StatusCode::NOT_FOUND.into_response()
        }
    }

    /// Serve mock attachment binary content for download
    pub async fn download_attachment(
        Path((_id, filename)): Path<(String, String)>,
    ) -> impl IntoResponse {
        let body = format!("mock-content-for-{filename}");
        (
            StatusCode::OK,
            [(
                axum::http::header::CONTENT_TYPE,
                "application/octet-stream".to_string(),
            )],
            body,
        )
    }

    pub async fn get_projects() -> impl IntoResponse {
        Json(json!([
            { "key": "PROJ", "name": "Project Alpha" },
            { "key": "TEST", "name": "Test Project" }
        ]))
    }

    pub async fn get_fields(State(fixtures): State<SharedFixtures>) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        (StatusCode::OK, Json(state.v2_fields.clone())).into_response()
    }
}

// --- Cloud v3 handlers ---

mod v3 {
    use super::{
        filter_issues, json, make_search_response, AdfDoc, IntoResponse, IssueQuery, JiraIssue,
        Json, Path, Query, SharedFixtures, State, StatusCode, V3UserSearchQuery, Value,
    };
    use serde::Deserialize;

    #[derive(Debug, Deserialize)]
    pub struct CreametaPageQuery {
        #[serde(rename = "startAt")]
        pub start_at: Option<u64>,
        #[serde(rename = "maxResults")]
        pub max_results: Option<u64>,
    }

    pub async fn search_users(Query(params): Query<V3UserSearchQuery>) -> impl IntoResponse {
        let mock_users = vec![
            json!({
                "accountId": "5b10ac8d82e05b22cc7d4ef5",
                "displayName": "Jane Doe",
                "emailAddress": "jdoe@example.com",
                "active": true,
                "avatarUrls": {
                    "48x48": "https://avatar.example.com/jdoe/48x48.png",
                    "32x32": "https://avatar.example.com/jdoe/32x32.png",
                    "24x24": "https://avatar.example.com/jdoe/24x24.png",
                    "16x16": "https://avatar.example.com/jdoe/16x16.png"
                }
            }),
            json!({
                "accountId": "5b10a2844c20165700ede21g",
                "displayName": "Chris Smith",
                "emailAddress": "csmith@example.com",
                "active": true,
                "avatarUrls": {
                    "48x48": "https://avatar.example.com/csmith/48x48.png",
                    "32x32": "https://avatar.example.com/csmith/32x32.png",
                    "24x24": "https://avatar.example.com/csmith/24x24.png",
                    "16x16": "https://avatar.example.com/csmith/16x16.png"
                }
            }),
            // Privacy-simulation user: no emailAddress field at all (simulates Cloud privacy)
            json!({
                "accountId": "5b10b3955c98780123abcdef",
                "displayName": "Private User",
                "active": true,
                "avatarUrls": {
                    "48x48": "https://avatar.example.com/private/48x48.png",
                    "32x32": "https://avatar.example.com/private/32x32.png",
                    "24x24": "https://avatar.example.com/private/24x24.png",
                    "16x16": "https://avatar.example.com/private/16x16.png"
                }
            }),
        ];
        let query = params.query.unwrap_or_default().to_lowercase();
        let filtered: Vec<Value> = if query.is_empty() {
            mock_users
        } else {
            mock_users
                .into_iter()
                .filter(|u| {
                    let email = u["emailAddress"].as_str().unwrap_or("").to_lowercase();
                    let display = u["displayName"].as_str().unwrap_or("").to_lowercase();
                    email.contains(&query) || display.contains(&query)
                })
                .collect()
        };
        (StatusCode::OK, Json(filtered)).into_response()
    }

    pub async fn get_myself() -> impl IntoResponse {
        Json(json!({
            "accountId": "5b10a2844c20165700ede21g",
            "displayName": "John Doe",
            "emailAddress": "jdoe@example.com",
            "active": true,
            "accountType": "atlassian"
        }))
    }

    pub async fn get_server_info() -> impl IntoResponse {
        Json(json!({
            "version": "1001.0.0",
            "buildNumber": 100_229,
            "serverTitle": "Mock Jira Cloud",
            "baseUrl": "http://127.0.0.1:8081",
            "deploymentType": "Cloud"
        }))
    }

    pub async fn get_issue(
        State(fixtures): State<SharedFixtures>,
        Path(key): Path<String>,
        Query(params): Query<IssueQuery>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        match state.cloud_v3_issues.get(&key) {
            Some(issue) => {
                let mut body = json!({
                    "id": issue.id,
                    "key": issue.key,
                    "fields": issue.fields
                });

                let expand = params.expand.unwrap_or_default();

                if expand.contains("renderedFields") {
                    // For v3, description is ADF; render the text content of the first paragraph
                    let desc_text = issue.fields["description"]["content"]
                        .as_array()
                        .and_then(|arr| arr.first())
                        .and_then(|p| p["content"].as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|t| t["text"].as_str())
                        .unwrap_or("");
                    body["renderedFields"] = json!({
                        "description": format!("<p>{}</p>", desc_text)
                    });
                }

                if expand.contains("changelog") {
                    body["changelog"] = json!({
                        "histories": [
                            {
                                "id": "50001",
                                "created": "2026-01-14T12:00:00.000+0000",
                                "author": {"accountId": "acc-jdoe", "displayName": "Jane Doe"},
                                "items": [{
                                    "field": "status",
                                    "fromString": "Open",
                                    "toString": "In Progress"
                                }]
                            },
                            {
                                "id": "50002",
                                "created": "2026-01-15T08:00:00.000+0000",
                                "author": {"accountId": "acc-csmith", "displayName": "Chris Smith"},
                                "items": [{
                                    "field": "priority",
                                    "fromString": "Medium",
                                    "toString": "High"
                                }]
                            }
                        ]
                    });
                }

                (StatusCode::OK, Json(body)).into_response()
            }
            None => StatusCode::NOT_FOUND.into_response(),
        }
    }

    pub async fn get_worklog(
        State(fixtures): State<SharedFixtures>,
        Path(key): Path<String>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        match state.cloud_v3_issues.get(&key) {
            Some(issue) => {
                let worklogs = issue
                    .fields
                    .get("worklog")
                    .and_then(|w| w.get("worklogs"))
                    .cloned()
                    .unwrap_or(json!([]));
                (StatusCode::OK, Json(json!({ "worklogs": worklogs }))).into_response()
            }
            None => StatusCode::NOT_FOUND.into_response(),
        }
    }

    pub async fn add_worklog(
        State(fixtures): State<SharedFixtures>,
        Path(key): Path<String>,
        Json(_body): Json<Value>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        if state.cloud_v3_issues.contains_key(&key) {
            let nanos = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .subsec_nanos();
            let mock_worklog = json!({
                "id": format!("wl-{}", nanos),
                "timeSpent": "2h",
                "timeSpentSeconds": 7200,
                "started": "2026-01-15T10:00:00.000+0000"
            });
            (StatusCode::CREATED, Json(mock_worklog)).into_response()
        } else {
            StatusCode::NOT_FOUND.into_response()
        }
    }

    pub async fn search_issues(
        State(fixtures): State<SharedFixtures>,
        Json(body): Json<Value>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        let jql = body["jql"].as_str().map(std::string::ToString::to_string);
        let filtered = filter_issues(&state.cloud_v3_issues, jql.as_ref());
        let response = make_search_response(&filtered);
        (StatusCode::OK, Json(response)).into_response()
    }

    pub async fn create_issue(
        State(fixtures): State<SharedFixtures>,
        Json(body): Json<Value>,
    ) -> impl IntoResponse {
        let mut state = fixtures.lock().unwrap();
        let id = state.next_issue_id;
        state.next_issue_id += 1;
        let key = format!("PROJ-{}", id - 10000);
        let issue_id = id.to_string();

        let summary = body["fields"]["summary"]
            .as_str()
            .unwrap_or("Untitled")
            .to_string();
        let description = if body["fields"]["description"].is_object() {
            body["fields"]["description"].clone()
        } else {
            serde_json::to_value(AdfDoc::paragraph("")).unwrap()
        };

        let now = chrono::Utc::now().to_rfc3339();
        let new_issue = JiraIssue {
            id: issue_id.clone(),
            key: key.clone(),
            fields: json!({
                "summary": summary,
                "status": { "name": "Open", "statusCategory": { "key": "new" } },
                "priority": body["fields"]["priority"].clone(),
                "description": description,
                "assignee": null,
                "reporter": null,
                "labels": if body["fields"]["labels"].is_array() { body["fields"]["labels"].clone() } else { json!([]) },
                "components": [],
                "fixVersions": [],
                "comment": { "comments": [] },
                "attachment": [],
                "subtasks": [],
                "issuelinks": [],
                "created": now,
                "updated": now
            }),
        };

        state.cloud_v3_issues.insert(key.clone(), new_issue);

        let response = json!({ "id": issue_id, "key": key });
        (StatusCode::CREATED, Json(response)).into_response()
    }

    pub async fn update_issue(
        State(fixtures): State<SharedFixtures>,
        Path(key): Path<String>,
        Json(body): Json<Value>,
    ) -> impl IntoResponse {
        let mut state = fixtures.lock().unwrap();
        match state.cloud_v3_issues.get_mut(&key) {
            Some(issue) => {
                if let Some(fields) = body["fields"].as_object() {
                    for (k, v) in fields {
                        issue.fields[k] = v.clone();
                    }
                }
                StatusCode::NO_CONTENT.into_response()
            }
            None => StatusCode::NOT_FOUND.into_response(),
        }
    }

    pub async fn add_comment(
        State(fixtures): State<SharedFixtures>,
        Path(key): Path<String>,
        Json(body): Json<Value>,
    ) -> impl IntoResponse {
        let mut state = fixtures.lock().unwrap();
        match state.cloud_v3_issues.get_mut(&key) {
            Some(issue) => {
                let comment_id = format!("c{}", uuid::Uuid::new_v4());
                let adf_body = if body["body"].is_object() {
                    body["body"].clone()
                } else {
                    serde_json::to_value(AdfDoc::paragraph(body["body"].as_str().unwrap_or("")))
                        .unwrap()
                };
                let new_comment = json!({
                    "id": comment_id,
                    "author": { "accountId": "api-user", "displayName": "API User" },
                    "body": adf_body,
                    "created": chrono::Utc::now().to_rfc3339()
                });
                if let Some(arr) = issue.fields["comment"]["comments"].as_array_mut() {
                    arr.push(new_comment.clone());
                }
                (StatusCode::CREATED, Json(new_comment)).into_response()
            }
            None => StatusCode::NOT_FOUND.into_response(),
        }
    }

    pub async fn add_attachment(
        State(fixtures): State<SharedFixtures>,
        Path(key): Path<String>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        if state.cloud_v3_issues.contains_key(&key) {
            let mock_attachment = json!([{
                "id": "att-1",
                "filename": "image.png",
                "size": 12345,
                "mimeType": "application/octet-stream",
                "content": "http://localhost:8081/rest/api/3/attachment/content/att-1"
            }]);
            (StatusCode::OK, Json(mock_attachment)).into_response()
        } else {
            StatusCode::NOT_FOUND.into_response()
        }
    }

    pub async fn create_remotelink(
        Path(_key): Path<String>,
        Json(_body): Json<Value>,
    ) -> impl IntoResponse {
        (StatusCode::CREATED, Json(json!({ "id": 10001 })))
    }

    pub async fn get_priorities() -> impl IntoResponse {
        Json(json!([
            { "id": "1", "name": "Highest", "iconUrl": "" },
            { "id": "2", "name": "High", "iconUrl": "" },
            { "id": "3", "name": "Medium", "iconUrl": "" },
            { "id": "4", "name": "Low", "iconUrl": "" },
            { "id": "5", "name": "Lowest", "iconUrl": "" }
        ]))
    }

    pub async fn get_project_statuses(Path(_key): Path<String>) -> impl IntoResponse {
        Json(json!([{
            "id": "10001",
            "name": "Task",
            "statuses": [
                { "id": "1", "name": "Open" },
                { "id": "3", "name": "In Progress" },
                { "id": "5", "name": "Resolved" },
                { "id": "6", "name": "Closed" }
            ]
        }]))
    }

    pub async fn get_statuses() -> impl IntoResponse {
        Json(json!([
            { "id": "1", "name": "Open" },
            { "id": "3", "name": "In Progress" },
            { "id": "5", "name": "Resolved" },
            { "id": "6", "name": "Closed" }
        ]))
    }

    pub async fn get_projects() -> impl IntoResponse {
        Json(json!([
            { "key": "MYPROJ", "name": "My Project" },
            { "key": "DEV", "name": "Development" }
        ]))
    }

    pub async fn get_fields(State(fixtures): State<SharedFixtures>) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        (StatusCode::OK, Json(state.v3_fields.clone())).into_response()
    }

    pub async fn get_createmeta_issuetypes(
        State(fixtures): State<SharedFixtures>,
        Path(_key): Path<String>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        (StatusCode::OK, Json(state.v3_createmeta_issuetypes.clone())).into_response()
    }

    pub async fn get_createmeta_fields(
        State(fixtures): State<SharedFixtures>,
        Path((_key, issuetype_id)): Path<(String, String)>,
        Query(params): Query<CreametaPageQuery>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        let all_fields = match state.v3_createmeta_fields.get(&issuetype_id) {
            Some(fields) => fields.clone(),
            None => {
                return (
                    StatusCode::NOT_FOUND,
                    Json(json!({"error": "Issue type not found"})),
                )
                    .into_response();
            }
        };
        let start_at = usize::try_from(params.start_at.unwrap_or(0)).unwrap_or(usize::MAX);
        let max_results = usize::try_from(params.max_results.unwrap_or(50)).unwrap_or(usize::MAX);
        let total = all_fields.len();
        let end = (start_at + max_results).min(total);
        let page_fields: Vec<Value> = if start_at < total {
            all_fields[start_at..end].to_vec()
        } else {
            vec![]
        };
        let response = json!({
            "startAt": start_at,
            "maxResults": max_results,
            "total": total,
            "fields": page_fields
        });
        (StatusCode::OK, Json(response)).into_response()
    }

    pub async fn get_project_versions(
        State(fixtures): State<SharedFixtures>,
        Path(_key): Path<String>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        (StatusCode::OK, Json(state.v3_project_versions.clone())).into_response()
    }

    pub async fn get_project_components(
        State(fixtures): State<SharedFixtures>,
        Path(_key): Path<String>,
    ) -> impl IntoResponse {
        let state = fixtures.lock().unwrap();
        (StatusCode::OK, Json(state.v3_project_components.clone())).into_response()
    }
}

// --- Router construction ---

pub fn build_v2_router(fixtures: SharedFixtures) -> Router {
    Router::new()
        .route("/rest/api/2/myself", get(v2::get_myself))
        .route("/rest/api/2/serverInfo", get(v2::get_server_info))
        .route(
            "/rest/api/2/issue/{key}",
            get(v2::get_issue).put(v2::update_issue),
        )
        .route("/rest/api/2/issue", post(v2::create_issue))
        .route("/rest/api/2/search", get(v2::search_issues))
        .route("/rest/api/2/user/search", get(v2::search_users))
        .route("/rest/api/2/issue/{key}/comment", post(v2::add_comment))
        .route("/rest/api/2/issue/{key}/worklog", get(v2::get_worklog))
        .route(
            "/rest/api/2/issue/{key}/attachments",
            post(v2::add_attachment),
        )
        .route(
            "/secure/attachment/{id}/{filename}",
            get(v2::download_attachment),
        )
        .route("/rest/api/2/project", get(v2::get_projects))
        .route("/rest/api/2/field", get(v2::get_fields))
        .layer(middleware::from_fn(require_auth))
        .with_state(fixtures)
}

pub fn build_v3_router(fixtures: SharedFixtures) -> Router {
    Router::new()
        .route("/rest/api/3/myself", get(v3::get_myself))
        .route("/rest/api/3/serverInfo", get(v3::get_server_info))
        .route(
            "/rest/api/3/issue/{key}",
            get(v3::get_issue).put(v3::update_issue),
        )
        .route("/rest/api/3/issue", post(v3::create_issue))
        .route("/rest/api/3/search/jql", post(v3::search_issues))
        .route("/rest/api/3/issue/{key}/comment", post(v3::add_comment))
        .route(
            "/rest/api/3/issue/{key}/worklog",
            get(v3::get_worklog).post(v3::add_worklog),
        )
        .route(
            "/rest/api/3/issue/{key}/attachments",
            post(v3::add_attachment),
        )
        .route(
            "/rest/api/3/issue/{key}/remotelink",
            post(v3::create_remotelink),
        )
        .route("/rest/api/3/priority", get(v3::get_priorities))
        .route("/rest/api/3/status", get(v3::get_statuses))
        .route("/rest/api/3/project", get(v3::get_projects))
        .route(
            "/rest/api/3/project/{key}/statuses",
            get(v3::get_project_statuses),
        )
        .route("/rest/api/3/user/search", get(v3::search_users))
        .route("/rest/api/3/field", get(v3::get_fields))
        .route(
            "/rest/api/3/issue/createmeta/{key}/issuetypes",
            get(v3::get_createmeta_issuetypes),
        )
        .route(
            "/rest/api/3/issue/createmeta/{key}/issuetypes/{id}",
            get(v3::get_createmeta_fields),
        )
        .route(
            "/rest/api/3/project/{key}/versions",
            get(v3::get_project_versions),
        )
        .route(
            "/rest/api/3/project/{key}/components",
            get(v3::get_project_components),
        )
        .layer(middleware::from_fn(require_auth))
        .with_state(fixtures)
}

/// Start both mock servers as background tokio tasks.
/// Server v2 binds to 127.0.0.1:8080, Cloud v3 binds to 127.0.0.1:8081.
pub async fn start_mock_servers(fixtures: SharedFixtures) -> AppResult<()> {
    let v2_router = build_v2_router(Arc::clone(&fixtures));
    let v3_router = build_v3_router(Arc::clone(&fixtures));

    let v2_listener = tokio::net::TcpListener::bind("127.0.0.1:8080")
        .await
        .map_err(|e| crate::error::AppError::MockServer(format!("Failed to bind :8080: {e}")))?;

    let v3_listener = tokio::net::TcpListener::bind("127.0.0.1:8081")
        .await
        .map_err(|e| crate::error::AppError::MockServer(format!("Failed to bind :8081: {e}")))?;

    tokio::spawn(async move {
        axum::serve(v2_listener, v2_router).await.ok();
    });

    tokio::spawn(async move {
        axum::serve(v3_listener, v3_router).await.ok();
    });

    Ok(())
}
