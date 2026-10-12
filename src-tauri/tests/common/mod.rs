//! Shared helpers for integration tests that need the mock Jira servers.

use pmkar_lib::fixtures::build_fixtures;
use pmkar_lib::mock_server::{start_mock_servers_on, MockServerUrls};
use std::sync::{mpsc, OnceLock};
use std::time::Duration;

static MOCK_SERVERS: OnceLock<MockServerUrls> = OnceLock::new();

/// Starts the v2/v3 mock servers once per test binary on free ports and returns
/// their base URLs. Free ports keep tests isolated from a running dev app (which
/// holds the default 8080/8081) and from other test binaries.
///
/// Servers run on a dedicated thread with its own tokio runtime so they outlive
/// individual `#[tokio::test]` runtimes.
pub fn mock_servers() -> &'static MockServerUrls {
    MOCK_SERVERS.get_or_init(|| {
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
            rt.block_on(async move {
                let urls = start_mock_servers_on(build_fixtures(), "127.0.0.1:0", "127.0.0.1:0")
                    .await
                    .expect("Failed to start mock servers");
                tx.send(urls).expect("Failed to report mock server URLs");
                loop {
                    tokio::time::sleep(Duration::from_secs(3600)).await;
                }
            });
        });
        rx.recv().expect("Mock server thread exited before binding")
    })
}

/// Base URL of the Server v2 mock.
#[allow(dead_code)]
pub fn v2_base() -> &'static str {
    &mock_servers().v2_base_url
}

/// Base URL of the Cloud v3 mock.
#[allow(dead_code)]
pub fn v3_base() -> &'static str {
    &mock_servers().v3_base_url
}
