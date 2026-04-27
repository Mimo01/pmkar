//! Integration tests for Phase 17 Plan 04: field discovery HTTP functions.
//!
//! These tests exercise:
//!   - `discover_v2_fields` / `discover_v3_fields` against the mock v2/v3 servers
//!   - `fetch_all_createmeta_fields` — multi-page drain (Bug has 7 fields, 2 pages)
//!   - `fetch_target_issue_types` — list of 3 types for MYPROJ
//!   - `get_or_fetch_target_schema` — cache-first; cache hit does not invoke HTTP
//!
//! Mock servers: v2 on 127.0.0.1:8080, v3 on 127.0.0.1:8081.
//! Auth: Bearer test-token-any-value (mock accepts any non-empty Authorization header).
//! Cloud Basic auth: Base64("test:test") → matches mock's accept-any behavior.

use base64::Engine as _;
use pmkar_lib::field_discovery::{
    discover_v2_fields, discover_v3_fields, fetch_all_createmeta_fields,
    fetch_target_issue_types, get_or_fetch_source_global, get_or_fetch_target_schema,
};
use pmkar_lib::field_mapping_db::FieldMappingDb;
use pmkar_lib::fixtures::build_fixtures;
use pmkar_lib::mock_server::start_mock_servers;
use std::sync::{Arc, Mutex, Once};
use std::time::Duration;

static DISC_SERVERS_ONCE: Once = Once::new();

fn start_servers_once() {
    DISC_SERVERS_ONCE.call_once(|| {
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

fn v2_base() -> &'static str {
    "http://127.0.0.1:8080"
}

fn v3_base() -> &'static str {
    "http://127.0.0.1:8081"
}

// Test 1: discover_v3_fields returns ≥6 custom fields
#[tokio::test(flavor = "multi_thread")]
async fn discover_v3_fields_returns_custom_fields() {
    start_servers_once();
    let client = reqwest::Client::new();
    let auth = cloud_auth();
    let fields = discover_v3_fields(&client, v3_base(), &auth)
        .await
        .expect("discover_v3_fields must succeed");

    // All 6 custom fields from Plan 01 fixtures must be present
    for cf_id in &[
        "customfield_10001",
        "customfield_10002",
        "customfield_10003",
        "customfield_10004",
        "customfield_10005",
        "customfield_10006",
    ] {
        let found = fields.iter().any(|f| f.field_id == *cf_id);
        assert!(found, "discover_v3_fields must return {cf_id}");
    }

    // Must contain at least the 6 custom fields (likely more with system fields)
    assert!(
        fields.len() >= 6,
        "Expected at least 6 fields, got {}",
        fields.len()
    );
}

// Test 2: discover_v2_fields returns global list with system + custom fields
#[tokio::test(flavor = "multi_thread")]
async fn discover_v2_fields_returns_global_list() {
    start_servers_once();
    let client = reqwest::Client::new();
    let fields = discover_v2_fields(&client, v2_base(), "test-pat")
        .await
        .expect("discover_v2_fields must succeed");

    let has_summary = fields.iter().any(|f| f.field_id == "summary");
    assert!(has_summary, "v2 field list must contain 'summary'");

    let has_cf1 = fields.iter().any(|f| f.field_id == "customfield_10001");
    assert!(has_cf1, "v2 field list must contain 'customfield_10001'");

    // 8 system + 6 custom = 14 minimum
    assert!(
        fields.len() >= 14,
        "Expected at least 14 fields, got {}",
        fields.len()
    );
}

// Test 3: fetch_all_createmeta_fields drains two pages for Bug (total=7)
#[tokio::test(flavor = "multi_thread")]
async fn fetch_all_createmeta_drains_two_pages() {
    start_servers_once();
    let client = reqwest::Client::new();
    let auth = cloud_auth();
    let (resp, hash) =
        fetch_all_createmeta_fields(&client, v3_base(), &auth, "MYPROJ", "10001")
            .await
            .expect("fetch_all_createmeta_fields must succeed");

    assert_eq!(
        resp.fields.len(),
        7,
        "Bug createmeta must return 7 fields across 2 pages, got {}",
        resp.fields.len()
    );
    assert_eq!(resp.total, 7, "total must be 7");

    // Hash must be a 64-char lowercase hex string
    assert_eq!(hash.len(), 64, "schema_hash must be 64 hex chars");
    assert!(
        hash.chars().all(|c| c.is_ascii_hexdigit()),
        "schema_hash must be hex"
    );
}

// Test 4: fetch_all_createmeta_fields hash is deterministic
#[tokio::test(flavor = "multi_thread")]
async fn fetch_all_createmeta_hash_is_deterministic() {
    start_servers_once();
    let client = reqwest::Client::new();
    let auth = cloud_auth();

    let (_, hash1) =
        fetch_all_createmeta_fields(&client, v3_base(), &auth, "MYPROJ", "10001")
            .await
            .expect("first call must succeed");
    let (_, hash2) =
        fetch_all_createmeta_fields(&client, v3_base(), &auth, "MYPROJ", "10001")
            .await
            .expect("second call must succeed");

    assert_eq!(
        hash1, hash2,
        "schema_hash must be deterministic across calls"
    );
    assert!(!hash1.is_empty(), "hash must be non-empty");
}

// Test 5: fetch_target_issue_types returns exactly 3 types (Bug/Task/Story)
#[tokio::test(flavor = "multi_thread")]
async fn fetch_target_issue_types_returns_three() {
    start_servers_once();
    let client = reqwest::Client::new();
    let auth = cloud_auth();
    let types = fetch_target_issue_types(&client, v3_base(), &auth, "MYPROJ")
        .await
        .expect("fetch_target_issue_types must succeed");

    assert_eq!(
        types.len(),
        3,
        "MYPROJ must have exactly 3 issue types, got {}",
        types.len()
    );

    let has_bug = types.iter().any(|t| t.name == "Bug");
    let has_task = types.iter().any(|t| t.name == "Task");
    let has_story = types.iter().any(|t| t.name == "Story");
    assert!(has_bug, "Issue types must include Bug");
    assert!(has_task, "Issue types must include Task");
    assert!(has_story, "Issue types must include Story");
}

// Test 6: get_or_fetch_target_schema returns cached data without HTTP on cache hit
#[tokio::test(flavor = "multi_thread")]
async fn cache_hit_returns_without_http() {
    use pmkar_lib::field_discovery::{FieldSchema, FieldSchemaType, FieldSide};

    // Pre-seed the DB with one field for (Target, MYPROJ, 10001)
    let db = Arc::new(Mutex::new(
        FieldMappingDb::open_in_memory().expect("open_in_memory"),
    ));
    let seed_field = FieldSchema {
        field_id: "seeded_field".into(),
        name: "Seeded Field".into(),
        required: false,
        has_default_value: Some(false),
        schema: FieldSchemaType::String {
            system: Some("seeded".into()),
            custom: None,
            custom_id: None,
        },
        allowed_values: None,
        operations: None,
    };
    {
        let guard = db.lock().unwrap();
        guard
            .upsert_schema_row(
                FieldSide::Target,
                Some("MYPROJ"),
                Some("10001"),
                &seed_field,
                "seeded-hash",
            )
            .expect("upsert seed");
    }

    // Use a "blackhole" base URL — any HTTP call will fail immediately
    let client = reqwest::Client::new();
    let result = get_or_fetch_target_schema(
        &db,
        &client,
        "http://127.0.0.1:1", // port 1 — connection refused immediately
        "Basic dGVzdDp0ZXN0",
        "MYPROJ",
        "10001",
    )
    .await
    .expect("cache hit must return seeded data without HTTP");

    assert_eq!(result.len(), 1, "Must return exactly the 1 seeded field");
    assert_eq!(result[0].field_id, "seeded_field");
}

// Test 7: get_or_fetch_source_global cache miss triggers HTTP
#[tokio::test(flavor = "multi_thread")]
async fn get_or_fetch_source_global_cache_miss_hits_http() {
    start_servers_once();
    let client = reqwest::Client::new();
    let db = Arc::new(Mutex::new(
        FieldMappingDb::open_in_memory().expect("open_in_memory"),
    ));

    let fields = get_or_fetch_source_global(&db, &client, v2_base(), "test-pat")
        .await
        .expect("get_or_fetch_source_global must succeed on cache miss");

    assert!(
        fields.len() >= 14,
        "cache miss must fetch and return ≥14 v2 fields, got {}",
        fields.len()
    );
}
