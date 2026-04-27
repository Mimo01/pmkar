use pmkar_lib::fixtures::build_fixtures;
use pmkar_lib::mock_server::start_mock_servers;
use std::sync::Once;
use std::time::Duration;

static PAG_SERVERS_ONCE: Once = Once::new();

/// Starts mock servers in a dedicated background thread with its own tokio runtime.
/// This ensures servers outlive individual test runtimes.
/// Safe to call from multiple tests — servers start only once.
fn start_servers_once() {
    PAG_SERVERS_ONCE.call_once(|| {
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

/// Test Bug createmeta paginates across 2 pages: total=7, page1=5 fields, page2=2 fields.
/// Together they yield 7 unique fieldIds.
/// Uses: startAt=0&maxResults=5 → 5 fields, startAt=5&maxResults=5 → 2 fields.
#[tokio::test(flavor = "multi_thread")]
async fn test_bug_createmeta_paginates_two_pages() {
    start_servers_once();
    let client = reqwest::Client::new();

    // Page 1: startAt=0&maxResults=5
    let resp1 = client
        .get("http://127.0.0.1:8081/rest/api/3/issue/createmeta/MYPROJ/issuetypes/10001?startAt=0&maxResults=5")
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Page 1 request failed");
    assert_eq!(resp1.status().as_u16(), 200);
    let body1: serde_json::Value = resp1.json().await.expect("Page 1 invalid JSON");

    assert_eq!(
        body1["total"],
        7,
        "Bug createmeta total should be 7 (Pitfall F pagination boundary)"
    );
    let page1_fields = body1["fields"]
        .as_array()
        .expect("page1 fields should be an array");
    assert_eq!(
        page1_fields.len(),
        5,
        "Page 1 should return exactly 5 fields (maxResults=5)"
    );

    // Page 2: startAt=5&maxResults=5
    let resp2 = client
        .get("http://127.0.0.1:8081/rest/api/3/issue/createmeta/MYPROJ/issuetypes/10001?startAt=5&maxResults=5")
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Page 2 request failed");
    assert_eq!(resp2.status().as_u16(), 200);
    let body2: serde_json::Value = resp2.json().await.expect("Page 2 invalid JSON");

    assert_eq!(
        body2["total"],
        7,
        "Bug createmeta total on page 2 should still be 7"
    );
    let page2_fields = body2["fields"]
        .as_array()
        .expect("page2 fields should be an array");
    assert_eq!(
        page2_fields.len(),
        2,
        "Page 2 should return exactly 2 fields (remaining)"
    );

    // Combine and verify 7 unique fieldIds
    let mut all_field_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    for f in page1_fields.iter().chain(page2_fields.iter()) {
        let field_id = f["fieldId"]
            .as_str()
            .expect("fieldId should be a string")
            .to_string();
        all_field_ids.insert(field_id);
    }
    assert_eq!(
        all_field_ids.len(),
        7,
        "Combining both pages should yield 7 unique fieldIds"
    );
}
