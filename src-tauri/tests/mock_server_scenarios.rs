#![cfg(feature = "mock-server")]

use pmkar_lib::fixtures::{build_fixtures, MockScenario};
use pmkar_lib::jira_client::search_tickets;
use pmkar_lib::mock_server::start_mock_servers_on;

const AUTH: &str = "Bearer test-token-any-value";

async fn start(scenario: MockScenario) -> String {
    let fixtures = build_fixtures();
    fixtures.lock().unwrap().scenario = scenario;
    start_mock_servers_on(fixtures, "127.0.0.1:0", "127.0.0.1:0")
        .await
        .expect("mock servers failed to start")
        .v2_base_url
}

async fn search(base: &str, jql: &str) -> reqwest::Response {
    reqwest::Client::new()
        .get(format!("{base}/rest/api/2/search?jql={jql}"))
        .header("Authorization", AUTH)
        .send()
        .await
        .expect("search request failed")
}

async fn search_keys(base: &str, jql: &str) -> Vec<String> {
    let body: serde_json::Value = search(base, jql).await.json().await.unwrap();
    body["issues"]
        .as_array()
        .unwrap()
        .iter()
        .map(|i| i["key"].as_str().unwrap().to_string())
        .collect()
}

async fn get_issue(base: &str, key: &str) -> reqwest::Response {
    reqwest::Client::new()
        .get(format!("{base}/rest/api/2/issue/{key}"))
        .header("Authorization", AUTH)
        .send()
        .await
        .unwrap()
}

#[tokio::test]
async fn default_search_includes_proj1() {
    let base = start(MockScenario::Default).await;
    assert!(search_keys(&base, "assignee=jdoe")
        .await
        .contains(&"PROJ-1".to_string()));
}

#[tokio::test]
async fn drop_hides_issue_from_search_but_not_get() {
    let base = start(MockScenario::Drop {
        keys: vec!["PROJ-1".into()],
    })
    .await;
    assert!(!search_keys(&base, "assignee=jdoe")
        .await
        .contains(&"PROJ-1".to_string()));
    assert_eq!(get_issue(&base, "PROJ-1").await.status().as_u16(), 200);
}

#[tokio::test]
async fn partial_fail_errors_only_for_target_assignee() {
    let base = start(MockScenario::PartialFail {
        assignee: "csmith".into(),
    })
    .await;
    assert_eq!(
        search(&base, "assignee=csmith").await.status().as_u16(),
        500
    );
    assert_eq!(search(&base, "assignee=jdoe").await.status().as_u16(), 200);
}

#[tokio::test]
async fn truncated_drives_client_truncation() {
    let base = start(MockScenario::Truncated).await;
    let (issues, truncated) = search_tickets(&base, "assignee=jdoe", "token")
        .await
        .expect("search_tickets failed");
    assert_eq!(issues.len(), 1000);
    assert!(truncated);
}

#[tokio::test]
async fn runtime_scenario_switch_via_http() {
    let base = start(MockScenario::Default).await;
    let client = reqwest::Client::new();
    let body = serde_json::json!({"scenario": "drop", "keys": ["PROJ-1"]});
    let resp = client
        .post(format!("{base}/__mock/scenario"))
        .header("Authorization", AUTH)
        .json(&body)
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status().as_u16(), 200);
    let echoed: serde_json::Value = client
        .get(format!("{base}/__mock/scenario"))
        .header("Authorization", AUTH)
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(echoed, body);
    assert!(!search_keys(&base, "assignee=jdoe")
        .await
        .contains(&"PROJ-1".to_string()));
}

#[tokio::test]
async fn mutate_updates_issue_and_404s_unknown_key() {
    let base = start(MockScenario::Default).await;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{base}/__mock/mutate"))
        .header("Authorization", AUTH)
        .json(&serde_json::json!({"key": "PROJ-1", "summary": "Changed by mock", "status": "In Review"}))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status().as_u16(), 200);
    let issue: serde_json::Value = get_issue(&base, "PROJ-1").await.json().await.unwrap();
    assert_eq!(issue["fields"]["summary"], "Changed by mock");
    assert_eq!(issue["fields"]["status"]["name"], "In Review");

    let resp = client
        .post(format!("{base}/__mock/mutate"))
        .header("Authorization", AUTH)
        .json(&serde_json::json!({"key": "NOPE-1", "summary": "x"}))
        .send()
        .await
        .unwrap();
    assert_eq!(resp.status().as_u16(), 404);
}

#[tokio::test]
async fn control_routes_require_auth() {
    let base = start(MockScenario::Default).await;
    let client = reqwest::Client::new();
    let r = client
        .get(format!("{base}/__mock/scenario"))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status().as_u16(), 401);
    let r = client
        .post(format!("{base}/__mock/mutate"))
        .json(&serde_json::json!({"key": "PROJ-1"}))
        .send()
        .await
        .unwrap();
    assert_eq!(r.status().as_u16(), 401);
}
