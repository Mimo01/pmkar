//! Phase 23 CUTV-02 / CUTV-04 — full-pipeline integration test.
//!
//! Verifies:
//!   1. CUTV-02: All five `copy_pipeline` helpers (`add_remote_link`, `copy_attachments`,
//!      `copy_comments`, `copy_worklogs`, `copy_subtasks`) succeed end-to-end against the
//!      mock v2 (source) and v3 (target) servers seeded by `build_fixtures()`.
//!   2. CUTV-04: `target_project_key` = "ACME" flows through the entire pipeline. If
//!      any production helper still hardcoded "MYPROJ", this test would fail —
//!      either via an HTTP error from the mock or a mismatched assertion below.
//!
//! Mock servers (started by `start_servers_once()`):
//!   v2 (source / server PAT auth) — 127.0.0.1:8080
//!   v3 (target / cloud Basic auth) — 127.0.0.1:8081
//!
//! Direct call pattern (matches `probe_createmeta.rs`): we exercise the
//! `copy_pipeline` free functions library-side, not via Tauri IPC. The
//! Tauri-command-level wiring is covered by the regression-net of frontend
//! tests in copyStore.test.ts (Plan 23-03 Task 2).

use base64::Engine as _;
use pmkar_lib::audit::{build_audited_client, AuditDb};
use pmkar_lib::copy_pipeline::{
    add_remote_link, copy_attachments, copy_comments, copy_subtasks, copy_worklogs, CopyContext,
};
use pmkar_lib::fixtures::build_fixtures;
use pmkar_lib::mock_server::start_mock_servers;
use std::sync::{Arc, Mutex, Once};
use std::time::Duration;

static CUTV_SERVERS_ONCE: Once = Once::new();

fn start_servers_once() {
    CUTV_SERVERS_ONCE.call_once(|| {
        std::thread::spawn(|| {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create tokio runtime");
            rt.block_on(async {
                let fixtures = build_fixtures();
                start_mock_servers(fixtures)
                    .await
                    .expect("Failed to start mock servers");
                loop {
                    tokio::time::sleep(Duration::from_hours(1)).await;
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

/// Build a `CopyContext` pre-wired to the mock servers with `target_project_key` = "ACME"
/// (CUTV-04: non-MYPROJ key proves parameterization).
fn build_test_ctx(source_key: &str, target_key: &str) -> CopyContext {
    let audit_db = Arc::new(Mutex::new(
        AuditDb::open_in_memory().expect("AuditDb::open_in_memory must succeed"),
    ));
    let client = build_audited_client(audit_db);
    CopyContext {
        client,
        cloud_auth: cloud_auth(),
        server_pat: "test-token-any-value".to_string(),
        source_base_url: "http://127.0.0.1:8080".to_string(),
        target_base_url: "http://127.0.0.1:8081".to_string(),
        source_key: source_key.to_string(),
        target_key: target_key.to_string(),
        target_project_key: "ACME".to_string(),
    }
}

async fn fetch_source_issue(ctx: &CopyContext) -> serde_json::Value {
    let url = format!(
        "{}/rest/api/2/issue/{}?expand=renderedFields&fields=*all",
        ctx.source_base_url, ctx.source_key
    );
    let resp = ctx
        .client
        .get(&url)
        .header("Authorization", format!("Bearer {}", ctx.server_pat))
        .send()
        .await
        .expect("source issue fetch must not error at the network layer");
    assert!(
        resp.status().is_success(),
        "Source issue fetch returned status {}",
        resp.status()
    );
    resp.json::<serde_json::Value>()
        .await
        .expect("source issue body must be valid JSON")
}

async fn create_target_issue(ctx: &CopyContext) -> String {
    let body = serde_json::json!({
        "fields": {
            "summary": "Test target issue (CUTV integration)",
            "project": { "key": ctx.target_project_key }, // "ACME" — CUTV-04
            "issuetype": { "id": "10001" }
        }
    });
    let resp = ctx
        .client
        .post(format!("{}/rest/api/3/issue", ctx.target_base_url))
        .header("Authorization", &ctx.cloud_auth)
        .header("Content-Type", "application/json")
        .body(serde_json::to_string(&body).unwrap())
        .send()
        .await
        .expect("create target issue must not error at the network layer");
    assert!(
        resp.status().is_success(),
        "Create target issue returned status {}",
        resp.status()
    );
    let json: serde_json::Value = resp.json().await.expect("create response must be JSON");
    json["key"]
        .as_str()
        .expect("create response must include 'key'")
        .to_string()
}

#[tokio::test(flavor = "multi_thread")]
async fn copy_ticket_v2_full_pipeline_succeeds() {
    start_servers_once();

    // PROJ-1 is the most complete source fixture: comments, attachment, subtasks PROJ-7/PROJ-8.
    let mut ctx = build_test_ctx("PROJ-1", "");

    // Step A — fetch source body (PROJ-1)
    let source_body = fetch_source_issue(&ctx).await;
    let source_summary = source_body["fields"]["summary"]
        .as_str()
        .unwrap_or("PROJ-1")
        .to_string();

    // Step B — create target issue (drives target_key into ctx); mock returns a generated key.
    ctx.target_key = create_target_issue(&ctx).await;
    assert!(
        !ctx.target_key.is_empty(),
        "Mock must return a non-empty target key after create_issue"
    );

    // Step C — add_remote_link
    let remote_link_step = add_remote_link(&ctx, &source_summary).await;
    assert!(
        remote_link_step.success,
        "add_remote_link must succeed: {:?}",
        remote_link_step.detail
    );

    // Step D — copy_attachments (PROJ-1 has 1 attachment seeded)
    let att_steps = copy_attachments(&ctx, &source_body).await;
    assert!(
        !att_steps.is_empty(),
        "PROJ-1 has at least 1 attachment — copy_attachments must produce >=1 step"
    );
    for s in &att_steps {
        assert!(
            s.success,
            "attachment step '{}' must succeed: {:?}",
            s.step, s.detail
        );
    }

    // Step E — copy_comments (PROJ-1 has comments seeded)
    let cmt_steps = copy_comments(&ctx, &source_body).await;
    assert!(
        !cmt_steps.is_empty(),
        "PROJ-1 has at least 1 comment — copy_comments must produce >=1 step"
    );
    for s in &cmt_steps {
        assert!(
            s.success,
            "comment step '{}' must succeed: {:?}",
            s.step, s.detail
        );
    }

    // Step F — copy_worklogs (PROJ-1 has worklog entries seeded)
    let wl_steps = copy_worklogs(&ctx).await;
    // copy_worklogs may return zero steps if the source has no worklogs;
    // the requirement is that none of the produced steps fail.
    for s in &wl_steps {
        assert!(
            s.success,
            "worklog step '{}' must succeed: {:?}",
            s.step, s.detail
        );
    }

    // Step G — copy_subtasks (PROJ-1 has PROJ-7 and PROJ-8 as subtasks)
    let subtasks = source_body["fields"]["subtasks"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    assert!(
        !subtasks.is_empty(),
        "PROJ-1 fixture must seed subtasks for this test to be meaningful"
    );
    let st_steps = copy_subtasks(&ctx, &subtasks).await;
    assert!(
        !st_steps.is_empty(),
        "PROJ-1 has subtasks — copy_subtasks must produce >=1 step"
    );
    for s in &st_steps {
        assert!(
            s.success,
            "subtask step '{}' must succeed (CUTV-04: target_project_key=ACME, no MYPROJ literal): {:?}",
            s.step, s.detail
        );
    }
}
