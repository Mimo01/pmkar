// src-tauri/tests/resolve_users_preview_integration.rs
//
// Phase 25 — integration test for UserResolver::fetch_users_by_domain against mock Cloud server.
// Uses the shared free-port mock servers from tests/common.
// Cloud v3 mock base URL comes from `common::v3_base()`.
// GET /rest/api/3/user/search?query=@example.com returns the "jdoe@example.com" user.

mod common;

use pmkar_lib::field_transform::user::UserResolver;

/// Phase 25 — verify fetch_users_by_domain returns accountId for known mock user.
///
/// The Cloud v3 mock serves:
///   GET /rest/api/3/user/search?query=@example.com
/// returning [{ accountId: "5b10ac8d82e05b22cc7d4ef5", displayName: "Jane Doe", ... }].
/// fetch_users_by_domain("example.com") constructs query=@example.com and calls this route.
#[tokio::test(flavor = "multi_thread")]
async fn resolve_users_preview_returns_account_id_for_known_mock_user() {
    let resolver = UserResolver::new(
        reqwest::Client::new(),
        "Basic dGVzdDp0ZXN0".to_string(), // base64("test:test") — mock ignores auth
        common::v3_base().to_string(),
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
