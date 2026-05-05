// src-tauri/tests/resolve_users_preview_integration.rs
//
// Phase 25 — integration test for UserResolver::fetch_users_by_domain against mock Cloud server.
// Uses the same start_servers_once() pattern as mock_server_field_routes.rs.
// Cloud v3 mock is at http://127.0.0.1:8081 (start_mock_servers binds this port).
// GET /rest/api/3/user/search?query=@example.com returns the "jdoe@example.com" user.

use pmkar_lib::field_transform::user::UserResolver;
use pmkar_lib::fixtures::build_fixtures;
use pmkar_lib::mock_server::start_mock_servers;
use std::sync::Once;
use std::time::Duration;

static RESOLVE_USERS_ONCE: Once = Once::new();

fn start_servers_once() {
    RESOLVE_USERS_ONCE.call_once(|| {
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

/// Phase 25 — verify fetch_users_by_domain returns accountId for known mock user.
///
/// The Cloud v3 mock at 127.0.0.1:8081 serves:
///   GET /rest/api/3/user/search?query=@example.com
/// returning [{ accountId: "5b10ac8d82e05b22cc7d4ef5", displayName: "Jane Doe", ... }].
/// fetch_users_by_domain("example.com") constructs query=@example.com and calls this route.
#[tokio::test(flavor = "multi_thread")]
async fn resolve_users_preview_returns_account_id_for_known_mock_user() {
    start_servers_once();

    let resolver = UserResolver::new(
        reqwest::Client::new(),
        "Basic dGVzdDp0ZXN0".to_string(), // base64("test:test") — mock ignores auth
        "http://127.0.0.1:8081".to_string(),
    );

    let results = resolver
        .fetch_users_by_domain("example.com")
        .await
        .expect("fetch_users_by_domain should not fail against mock server");

    assert!(
        !results.is_empty(),
        "Expected at least one user for domain example.com"
    );
    let first = &results[0];
    let account_id = first["accountId"].as_str().unwrap_or("");
    let display_name = first["displayName"].as_str().unwrap_or("");
    assert!(
        !account_id.is_empty(),
        "accountId must be non-empty; got: {:?}",
        first
    );
    assert!(
        !display_name.is_empty(),
        "displayName must be non-empty; got: {:?}",
        first
    );
}
