use pmkar_lib::field_discovery::fetch_target_issue_types;
use pmkar_lib::fixtures::build_fixtures;
use pmkar_lib::mock_server::start_mock_servers;
use std::sync::Once;
use std::time::Duration;

static FIELD_SERVERS_ONCE: Once = Once::new();

/// Starts mock servers in a dedicated background thread with its own tokio runtime.
/// This ensures servers outlive individual test runtimes.
/// Safe to call from multiple tests — servers start only once.
fn start_servers_once() {
    FIELD_SERVERS_ONCE.call_once(|| {
        std::thread::spawn(|| {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
            rt.block_on(async {
                let fixtures = build_fixtures();
                start_mock_servers(fixtures)
                    .await
                    .expect("Failed to start mock servers");
                // Keep the runtime alive indefinitely
                loop {
                    tokio::time::sleep(Duration::from_secs(3600)).await;
                }
            });
        });
        // Give servers time to bind
        std::thread::sleep(Duration::from_millis(300));
    });
}

fn auth_header() -> &'static str {
    "Bearer test-token-any-value"
}

// Test 1: v2 /field returns array with customfield_10001 "Story Points"
#[tokio::test(flavor = "multi_thread")]
async fn test_v2_field_returns_custom_fields() {
    start_servers_once();
    let client = reqwest::Client::new();
    let resp = client
        .get("http://127.0.0.1:8080/rest/api/2/field")
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    let fields = body.as_array().expect("Response should be an array");
    let has_story_points = fields
        .iter()
        .any(|f| f["id"] == "customfield_10001" && f["name"] == "Story Points");
    assert!(
        has_story_points,
        "v2 /field should contain customfield_10001 'Story Points'"
    );
}

// Test 2: v3 /field returns array with all 6 custom fields
#[tokio::test(flavor = "multi_thread")]
async fn test_v3_field_returns_custom_fields() {
    start_servers_once();
    let client = reqwest::Client::new();
    let resp = client
        .get("http://127.0.0.1:8081/rest/api/3/field")
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    let fields = body.as_array().expect("Response should be an array");

    for field_id in &[
        "customfield_10001",
        "customfield_10002",
        "customfield_10003",
        "customfield_10004",
        "customfield_10005",
        "customfield_10006",
    ] {
        let has_field = fields.iter().any(|f| f["id"] == *field_id);
        assert!(has_field, "v3 /field should contain {field_id}");
    }
}

// Test 3: v3 createmeta issuetypes returns 3 types (Bug, Task, Story)
#[tokio::test(flavor = "multi_thread")]
async fn test_v3_createmeta_issuetypes_returns_three() {
    start_servers_once();
    let client = reqwest::Client::new();
    let resp = client
        .get("http://127.0.0.1:8081/rest/api/3/issue/createmeta/MYPROJ/issuetypes")
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    assert_eq!(body["total"], 3, "Should have total: 3 issue types");
    let issue_types = body["issueTypes"]
        .as_array()
        .expect("issueTypes should be an array");
    assert_eq!(issue_types.len(), 3, "Should have 3 issue types");

    let has_bug = issue_types
        .iter()
        .any(|t| t["id"] == "10001" && t["name"] == "Bug");
    let has_task = issue_types
        .iter()
        .any(|t| t["id"] == "10002" && t["name"] == "Task");
    let has_story = issue_types
        .iter()
        .any(|t| t["id"] == "10003" && t["name"] == "Story");
    assert!(has_bug, "Should contain Bug issue type with id 10001");
    assert!(has_task, "Should contain Task issue type with id 10002");
    assert!(has_story, "Should contain Story issue type with id 10003");
}

// Test 3b: fetch_target_issue_types (used by pre_warm_target_issue_types command) successfully
// deserializes the mock server response into Vec<IssueTypeRef>. This exercises the full
// Rust deserialization path that pre_warm_target_issue_types uses at runtime — previously
// this was untested, meaning a shape mismatch could silently return Ok(vec![]).
#[tokio::test(flavor = "multi_thread")]
async fn test_fetch_target_issue_types_deserializes_mock_response() {
    start_servers_once();
    let client = reqwest::Client::new();
    let result =
        fetch_target_issue_types(&client, "http://127.0.0.1:8081", auth_header(), "MYPROJ").await;
    assert!(
        result.is_ok(),
        "fetch_target_issue_types should succeed against mock: {:?}",
        result.err()
    );
    let types = result.unwrap();
    assert_eq!(
        types.len(),
        3,
        "Should return 3 issue types, got: {:?}",
        types
    );
    let bug = types.iter().find(|t| t.id == "10001");
    assert!(bug.is_some(), "Should contain Bug (id 10001)");
    assert_eq!(bug.unwrap().name, "Bug");
}

// Test 4: v3 createmeta Bug (10001) has priority and Severity as required
#[tokio::test(flavor = "multi_thread")]
async fn test_v3_createmeta_bug_required_fields() {
    start_servers_once();
    let client = reqwest::Client::new();
    let resp = client
        .get("http://127.0.0.1:8081/rest/api/3/issue/createmeta/MYPROJ/issuetypes/10001")
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    let fields = body["fields"]
        .as_array()
        .expect("fields should be an array");

    let priority_required = fields
        .iter()
        .any(|f| f["fieldId"] == "priority" && f["required"] == true);
    assert!(
        priority_required,
        "Bug createmeta should have priority as required"
    );

    let severity_required = fields.iter().any(|f| {
        f["fieldId"] == "customfield_10006" && f["name"] == "Severity" && f["required"] == true
    });
    assert!(
        severity_required,
        "Bug createmeta should have customfield_10006 Severity as required"
    );
}

// Test 5: v3 createmeta Task (10002) has only summary as required
#[tokio::test(flavor = "multi_thread")]
async fn test_v3_createmeta_task_minimal_required() {
    start_servers_once();
    let client = reqwest::Client::new();
    let resp = client
        .get("http://127.0.0.1:8081/rest/api/3/issue/createmeta/MYPROJ/issuetypes/10002")
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    let fields = body["fields"]
        .as_array()
        .expect("fields should be an array");

    let summary_required = fields
        .iter()
        .any(|f| f["fieldId"] == "summary" && f["required"] == true);
    assert!(
        summary_required,
        "Task createmeta should have summary as required"
    );

    // No other field should be required
    let other_required: Vec<_> = fields
        .iter()
        .filter(|f| f["fieldId"] != "summary" && f["required"] == true)
        .collect();
    assert!(
        other_required.is_empty(),
        "Task createmeta should have only summary as required, found: {:?}",
        other_required
    );
}

// Test 6: v3 createmeta Story (10003) has customfield_10001 Story Points as required
#[tokio::test(flavor = "multi_thread")]
async fn test_v3_createmeta_story_required() {
    start_servers_once();
    let client = reqwest::Client::new();
    let resp = client
        .get("http://127.0.0.1:8081/rest/api/3/issue/createmeta/MYPROJ/issuetypes/10003")
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    let fields = body["fields"]
        .as_array()
        .expect("fields should be an array");

    let story_points_required = fields
        .iter()
        .any(|f| f["fieldId"] == "customfield_10001" && f["required"] == true);
    assert!(
        story_points_required,
        "Story createmeta should have customfield_10001 Story Points as required"
    );
}

// Test 7: v3 project versions has IDs different from v2 source version IDs
#[tokio::test(flavor = "multi_thread")]
async fn test_v3_project_versions_diverge_from_v2() {
    start_servers_once();
    let client = reqwest::Client::new();
    let resp = client
        .get("http://127.0.0.1:8081/rest/api/3/project/MYPROJ/versions")
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    let versions = body.as_array().expect("Response should be an array");
    assert!(!versions.is_empty(), "Should return at least one version");
    // Target version id "20010" is different from any v2 source version id
    // (v2 source fixtures use ids like "10010")
    let has_divergent_id = versions.iter().any(|v| v["id"] == "20010");
    assert!(
        has_divergent_id,
        "v3 versions should contain id '20010' which differs from v2 source version ids"
    );
}

// Test 8: v3 project components returns non-empty array with id and name
#[tokio::test(flavor = "multi_thread")]
async fn test_v3_project_components() {
    start_servers_once();
    let client = reqwest::Client::new();
    let resp = client
        .get("http://127.0.0.1:8081/rest/api/3/project/MYPROJ/components")
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    let components = body.as_array().expect("Response should be an array");
    assert!(
        !components.is_empty(),
        "Should return at least one component"
    );
    let first = &components[0];
    assert!(first["id"].is_string(), "Component should have id");
    assert!(first["name"].is_string(), "Component should have name");
}

// Test 9: v3 createmeta includes cascading-select with option-with-child schema and children
#[tokio::test(flavor = "multi_thread")]
async fn test_v3_cascading_select_shape() {
    start_servers_once();
    let client = reqwest::Client::new();
    // Bug has customfield_10005 Department/Team cascading select
    let resp = client
        .get("http://127.0.0.1:8081/rest/api/3/issue/createmeta/MYPROJ/issuetypes/10001?startAt=5&maxResults=5")
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status().as_u16(), 200);
    let body: serde_json::Value = resp.json().await.expect("Invalid JSON");
    let fields = body["fields"]
        .as_array()
        .expect("fields should be an array");

    let dept_field = fields.iter().find(|f| f["fieldId"] == "customfield_10005");
    assert!(
        dept_field.is_some(),
        "Bug page 2 should contain customfield_10005 Department/Team"
    );

    let dept = dept_field.unwrap();
    assert_eq!(
        dept["schema"]["type"], "option-with-child",
        "customfield_10005 schema type should be option-with-child"
    );

    let allowed_values = dept["allowedValues"]
        .as_array()
        .expect("allowedValues should be an array");
    assert!(
        !allowed_values.is_empty(),
        "customfield_10005 should have allowedValues"
    );

    let first_av = &allowed_values[0];
    let children = first_av["children"]
        .as_array()
        .expect("First allowedValue should have children array");
    assert!(
        !children.is_empty(),
        "First allowedValue should have at least one child"
    );
}
