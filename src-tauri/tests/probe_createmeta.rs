//! Integration tests for Phase 17 Plan 04: `probe_paginated_createmeta`.
//!
//! Tests:
//!   1. Probe succeeds against MYPROJ on mock v3 (port 8081) → ok=true, status_code=200
//!   2. Probe fails gracefully on closed port 9999 → ok=false, no Err returned
//!   3. Probe never leaks credential values in any ProbeResult field

use base64::Engine as _;
use pmkar_lib::field_discovery::probe_paginated_createmeta;
use pmkar_lib::fixtures::build_fixtures;
use pmkar_lib::mock_server::start_mock_servers;
use std::sync::Once;
use std::time::Duration;

static PROBE_SERVERS_ONCE: Once = Once::new();

fn start_servers_once() {
    PROBE_SERVERS_ONCE.call_once(|| {
        std::thread::spawn(|| {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
            rt.block_on(async {
                let fixtures = build_fixtures();
                start_mock_servers(fixtures)
                    .await
                    .expect("Failed to start mock servers");
                loop {
                    tokio::time::sleep(Duration::from_secs(3600)).await;
                }
            });
        });
        std::thread::sleep(Duration::from_millis(300));
    });
}

fn cloud_auth() -> String {
    format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode("test:test")
    )
}

// Test 1: Probe succeeds against mock v3 server for MYPROJ
#[tokio::test(flavor = "multi_thread")]
async fn probe_succeeds_against_known_project() {
    start_servers_once();
    let client = reqwest::Client::new();
    let auth = cloud_auth();

    let result = probe_paginated_createmeta(&client, "http://127.0.0.1:8081", &auth, "MYPROJ")
        .await
        .expect("probe must produce a ProbeResult, never an Err");

    assert!(result.ok, "Probe against MYPROJ must succeed");
    assert_eq!(
        result.status_code,
        Some(200),
        "Probe success must report status_code=200"
    );
    assert!(
        result.endpoint_url.contains("MYPROJ"),
        "endpoint_url must contain the project key"
    );
    assert!(
        result
            .endpoint_url
            .contains("/rest/api/3/issue/createmeta/MYPROJ/issuetypes"),
        "endpoint_url must contain the issuetypes path"
    );
    assert!(result.hint.is_none(), "Probe success must not set hint");
}

// Test 2: Probe fails gracefully on a closed port
#[tokio::test(flavor = "multi_thread")]
async fn probe_fails_with_endpoint_and_status_in_message() {
    let client = reqwest::Client::new();
    let auth = "Basic dGVzdDp0ZXN0"; // base64("test:test")

    // Closed port — connection refused → ok=false, status_code=None
    let result = probe_paginated_createmeta(&client, "http://127.0.0.1:9999", auth, "MYPROJ").await;

    let probe = result.expect("probe must produce a ProbeResult, never an Err");
    assert!(!probe.ok, "Probe on closed port must be ok=false");
    assert!(
        probe.endpoint_url.contains("9999"),
        "endpoint_url must contain the port (9999)"
    );
    assert!(
        probe
            .endpoint_url
            .contains("/rest/api/3/issue/createmeta/MYPROJ/issuetypes"),
        "endpoint_url must reference the createmeta path"
    );
    if let Some(hint) = &probe.hint {
        assert!(
            hint.contains("proxy") || hint.contains("createmeta"),
            "hint must mention proxy/createmeta context, got: {hint}"
        );
    }
}

// Test 3: Probe never leaks credential value in any ProbeResult field
#[tokio::test(flavor = "multi_thread")]
async fn probe_redacts_credentials() {
    let client = reqwest::Client::new();
    let secret = "SUPER_SECRET_TOKEN_12345";
    let auth = format!("Basic {secret}");

    // Force failure (closed port) so the error path is exercised
    let probe = probe_paginated_createmeta(&client, "http://127.0.0.1:9999", &auth, "MYPROJ")
        .await
        .expect("ProbeResult");

    // Serialize to JSON and check the credential does not appear anywhere
    let serialized = serde_json::to_string(&probe).unwrap();
    assert!(
        !serialized.contains(secret),
        "credential leaked in ProbeResult JSON: {serialized}"
    );

    if let Some(hint) = &probe.hint {
        assert!(
            !hint.contains(secret),
            "credential leaked in hint field: {hint}"
        );
    }
    assert!(
        !probe.endpoint_url.contains(secret),
        "credential leaked in endpoint_url field: {}",
        probe.endpoint_url
    );
}
