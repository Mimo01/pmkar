mod common;

fn auth_header() -> &'static str {
    "Bearer test-token-any-value"
}

// Test 1: v2 get issue returns 200 with correct key and string description
#[tokio::test]
async fn test_mock_v2_get_issue_returns_200() {
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/rest/api/2/issue/PROJ-1", common::v2_base()))
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    assert_eq!(body["key"], "PROJ-1");
    // v2 description must be a string
    assert!(
        body["fields"]["description"].is_string(),
        "v2 description should be a string"
    );
}

// Test 2: v3 get issue returns 200 with ADF description (version: 1)
#[tokio::test]
async fn test_mock_v3_get_issue_returns_200() {
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/rest/api/3/issue/PROJ-1", common::v3_base()))
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    assert_eq!(body["key"], "PROJ-1");
    // v3 description must be ADF with version: 1
    assert_eq!(
        body["fields"]["description"]["version"], 1,
        "v3 ADF description must have version: 1"
    );
    assert_eq!(body["fields"]["description"]["type"], "doc");
}

// Test 3: v2 search returns 200 with issues array
#[tokio::test]
async fn test_mock_v2_search_returns_issues() {
    let client = reqwest::Client::new();
    let resp = client
        .get(format!(
            "{}/rest/api/2/search?jql=assignee=jdoe",
            common::v2_base()
        ))
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    assert!(
        body["issues"].is_array(),
        "Response should have issues array"
    );
    assert!(
        body["total"].is_number(),
        "Response should have total count"
    );
}

// Test 4: v3 search (POST) returns 200 with issues array
#[tokio::test]
async fn test_mock_v3_search_returns_issues() {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/rest/api/3/search/jql", common::v3_base()))
        .header("Authorization", auth_header())
        .header("Content-Type", "application/json")
        .body(r#"{"jql": "project = PROJ"}"#)
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    assert!(
        body["issues"].is_array(),
        "Response should have issues array"
    );
}

// Test 5: Missing auth returns 401
#[tokio::test]
async fn test_mock_missing_auth_returns_401() {
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/rest/api/2/issue/PROJ-1", common::v2_base()))
        // No Authorization header
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        401,
        "Missing auth should return 401"
    );
}

// Test 6: Any non-empty Authorization token is accepted
#[tokio::test]
async fn test_mock_any_auth_token_accepted() {
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/rest/api/2/issue/PROJ-1", common::v2_base()))
        .header("Authorization", "Bearer any-value-here")
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        200,
        "Any non-empty auth token should be accepted"
    );
}

// Test 7: v2 create issue returns 201
#[tokio::test]
async fn test_mock_v2_create_issue_returns_201() {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "fields": {
            "summary": "Test created ticket",
            "description": "Created via mock API",
            "priority": { "name": "Medium" }
        }
    });
    let resp = client
        .post(format!("{}/rest/api/2/issue", common::v2_base()))
        .header("Authorization", auth_header())
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        201,
        "Create issue should return 201"
    );
    let resp_body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    assert!(
        resp_body["key"].as_str().unwrap_or("").starts_with("PROJ-"),
        "Created issue should have PROJ- key"
    );
}

// Test 8: v3 create issue returns 201
#[tokio::test]
async fn test_mock_v3_create_issue_returns_201() {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "fields": {
            "summary": "Test v3 created ticket",
            "description": {
                "version": 1,
                "type": "doc",
                "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Test body" }] }]
            }
        }
    });
    let resp = client
        .post(format!("{}/rest/api/3/issue", common::v3_base()))
        .header("Authorization", auth_header())
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        201,
        "Create issue should return 201"
    );
    let resp_body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    assert!(
        resp_body["key"].as_str().unwrap_or("").starts_with("PROJ-"),
        "Created issue should have PROJ- key"
    );
}

// Test 9: Unknown issue key returns 404
#[tokio::test]
async fn test_mock_unknown_key_returns_404() {
    let client = reqwest::Client::new();
    let resp = client
        .get(format!(
            "{}/rest/api/2/issue/UNKNOWN-999",
            common::v2_base()
        ))
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(
        resp.status().as_u16(),
        404,
        "Unknown issue key should return 404"
    );
}
