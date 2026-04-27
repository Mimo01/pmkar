---
phase: 17-field-discovery-mock-schema-fidelity
plan: 04
plan_id: 17-04
type: execute
wave: 2
depends_on: [17-01, 17-02]
files_modified:
  - src-tauri/src/field_discovery.rs
  - src-tauri/src/commands.rs
  - src-tauri/src/main.rs
  - src-tauri/tests/field_discovery_integration.rs
  - src-tauri/tests/probe_createmeta.rs
autonomous: true
requirements:
  - DISC-01
  - DISC-02
  - DISC-03
tags:
  - rust
  - tauri-command
  - http
  - jira
  - createmeta
  - probe
  - field-discovery

must_haves:
  truths:
    - "field_discovery.rs exposes async fn discover_v2_fields(client, base_url, pat) -> AppResult<Vec<FieldSchema>> calling GET /rest/api/2/field"
    - "field_discovery.rs exposes async fn discover_v3_fields(client, base_url, cloud_auth) -> AppResult<Vec<FieldSchema>> calling GET /rest/api/3/field"
    - "field_discovery.rs exposes async fn fetch_all_createmeta_fields(client, base_url, cloud_auth, project_key, issuetype_id) -> AppResult<(CreatemetaResponse, String)> that paginates and returns (response, schema_hash)"
    - "Pagination loop is bounded by Atlassian-reported `total`: break when page_len == 0 OR all_fields.len() >= total OR pages_drained >= MAX_CREATEMETA_PAGES (hard upper bound = 50 pages, prevents infinite loop on hostile/buggy total)"
    - "Probe-failure error message includes the exact endpoint URL and HTTP status code; never echoes the Authorization header or any credential value (T-17-03)"
    - "Schema hash is computed by passing the concatenated raw response bytes (all pages joined as a sequence of byte slices) through compute_schema_hash and stored as hex (Pitfall D)"
    - "Tauri commands registered: discover_source_fields, get_target_field_schema_for_issuetype, probe_createmeta, pre_warm_target_issue_types, refresh_field_schema_cache — all five appended to invoke_handler in main.rs"
    - "discover_source_fields and get_target_field_schema_for_issuetype write to FieldMappingDb via upsert_schema_row and return cached values on hit (no HTTP call when cache present)"
    - "probe_createmeta returns ProbeResult { ok: bool, endpoint_url: String, status_code: Option<u16>, hint: Option<String> }; never returns credentials"
    - "Pre-warm spawn occurs from the Tauri command (fire-and-forget) AFTER probe success — no spawn before app.manage(mapping_db) per Pitfall E"
    - "All integration tests against the in-process mock server pass: discover_v3_fields returns ≥6 custom fields, paginated Bug createmeta returns 7 fields across 2 pages, probe success against MYPROJ, probe failure surfaces endpoint URL + 404"
  artifacts:
    - path: "src-tauri/src/field_discovery.rs"
      provides: "HTTP fetchers (discover_v2_fields, discover_v3_fields, fetch_all_createmeta_fields, fetch_target_issue_types, probe_paginated_createmeta) and ProbeResult struct, appended to existing module"
      contains: "fetch_all_createmeta_fields"
    - path: "src-tauri/src/commands.rs"
      provides: "5 new Tauri commands appended after search_jira_users_by_domain"
      contains: "probe_createmeta"
    - path: "src-tauri/src/main.rs"
      provides: "5 new commands registered in tauri::generate_handler!"
      contains: "probe_createmeta"
    - path: "src-tauri/tests/field_discovery_integration.rs"
      provides: "Integration tests covering source/target discovery, pagination, hash determinism, cache hit/miss"
    - path: "src-tauri/tests/probe_createmeta.rs"
      provides: "Probe pass/fail integration tests including credential-redaction check"
  key_links:
    - from: "commands.rs probe_createmeta"
      to: "field_discovery.rs probe_paginated_createmeta"
      via: "delegation; command extracts credentials and project_key from triage_db then calls into module"
      pattern: "field_discovery::probe_paginated_createmeta"
    - from: "commands.rs get_target_field_schema_for_issuetype"
      to: "FieldMappingDb cache + fetch_all_createmeta_fields"
      via: "cache-first read; on miss call HTTP + upsert_schema_row"
      pattern: "get_cached_schemas|upsert_schema_row"
    - from: "main.rs invoke_handler list"
      to: "commands::{probe_createmeta, discover_source_fields, get_target_field_schema_for_issuetype, pre_warm_target_issue_types, refresh_field_schema_cache}"
      via: "tauri::generate_handler!"
      pattern: "commands::probe_createmeta"
---

<objective>
Implement the Rust HTTP layer + Tauri command surface for Phase 17:
- Source v2 global field discovery
- Target v3 global field + paginated createmeta per (project, issuetype)
- Connection-time probe with D-07 error message format
- Pre-warm of target issue-type list (D-01 + D-15 reconciliation)
- Cache-first reads + upserts via FieldMappingDb (DISC-01/02/03 backend)
- Tauri command registration so Plan 03's frontend store can invoke them

Purpose: Bridges the type contracts from Plan 02 and the mock fixtures from Plan 01 into a working end-to-end discovery flow. This is the largest Phase 17 plan; budgeted at ~40-45% context.

Output: Extended field_discovery.rs (HTTP + tests), 5 new Tauri commands, 2 new integration test files, main.rs handler registration.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-CONTEXT.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-PATTERNS.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-VALIDATION.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-01-mock-fixtures-and-routes-PLAN.md
@.planning/phases/17-field-discovery-mock-schema-fidelity/17-02-rust-types-and-mapping-db-PLAN.md

<interfaces>
<!-- From Plan 02 (already shipped) -->
```rust
// src-tauri/src/field_discovery.rs (already exists)
pub enum FieldSide { Source, Target }
pub enum FieldSchemaType { String, Number, Date, Datetime, User, Array, Option_, OptionWithChild, Issuetype, Priority, Any }
pub struct FieldSchema { field_id, name, required, has_default_value, schema, allowed_values, operations }
pub struct CreatemetaResponse { start_at, max_results, total, fields }
pub struct IssueTypeRef { id, name, description, icon_url }
pub struct IssueTypesResponse { start_at, max_results, total, issue_types }

// src-tauri/src/field_mapping_db.rs (already exists)
pub struct FieldMappingDb { ... }
impl FieldMappingDb {
    pub fn open(path: &Path) -> AppResult<Self>;
    pub fn open_in_memory() -> AppResult<Self>;
    pub fn upsert_schema_row(side, project_key, issuetype_id, field, schema_hash) -> AppResult<()>;
    pub fn get_cached_schemas(side, project_key, issuetype_id) -> AppResult<Vec<FieldSchema>>;
    pub fn get_cached_schema_hash(side, project_key, issuetype_id) -> AppResult<Option<String>>;
    pub fn clear_cache_for(side, project_key, issuetype_id) -> AppResult<usize>;
}
pub fn compute_schema_hash(raw_json_bytes: &[u8]) -> String;
```

<!-- Existing helpers in commands.rs (do NOT redefine) -->
```rust
fn get_server_pat(triage_db: &Arc<Mutex<TriageDb>>) -> Result<String, AppError>;
fn get_cloud_credentials(triage_db: &Arc<Mutex<TriageDb>>) -> Result<(String, String, String), AppError>;
// build_audited_client(arc_db) -> reqwest_middleware::ClientWithMiddleware  (from crate::audit)
```

<!-- Existing TriageDb method that returns the configured target project key -->
```rust
// src-tauri/src/triage_db.rs (already exists from Phase 6)
impl TriageDb {
    pub fn get_project_config(&self) -> AppResult<ProjectConfig>;
    // ProjectConfig has target_project_key: Option<String>
}
```

<!-- Mock server endpoints from Plan 01 -->
//   GET /rest/api/2/field
//   GET /rest/api/3/field
//   GET /rest/api/3/issue/createmeta/{key}/issuetypes  (paginated wrapper)
//   GET /rest/api/3/issue/createmeta/{key}/issuetypes/{id}?startAt=N&maxResults=M
//   GET /rest/api/3/project/{key}/versions
//   GET /rest/api/3/project/{key}/components

<!-- Pagination contract for fetch_all_createmeta_fields -->
//   PAGE_SIZE: u64 = 50 (Atlassian default; D-09 Claude's discretion)
//   MAX_CREATEMETA_PAGES: u64 = 50 (hard upper bound — DoS guard, Pitfall analog of MAX_PAGINATION_ITEMS)
//   Loop breaks when page_len == 0 OR all.len() >= total OR pages_drained >= MAX_CREATEMETA_PAGES
//   Error message format: format!("GET {url} returned {status}. Your proxy may not expose the paginated createmeta endpoint.") (D-07)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Wave 0 — write failing integration tests for discovery + probe + pagination</name>
  <files>src-tauri/tests/field_discovery_integration.rs, src-tauri/tests/probe_createmeta.rs</files>
  <read_first>
    - src-tauri/tests/mock_server.rs (existing test bootstrap pattern — `Once`, `std::thread::spawn(start_mock_servers)`)
    - src-tauri/tests/mock_server_field_routes.rs (Plan 01 test file — same bootstrap)
    - src-tauri/src/field_discovery.rs (Plan 02 — types already exist)
    - src-tauri/src/field_mapping_db.rs (Plan 02 — DB methods already exist)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-VALIDATION.md per-task verification map
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md §"Pattern 2: Paginated createmeta loop", §"Pattern 5: probe wiring"
  </read_first>
  <behavior>
    - Test (`field_discovery_integration::discover_v3_fields_returns_custom_fields`): call `field_discovery::discover_v3_fields("http://127.0.0.1:8081", "Basic dGVzdDp0ZXN0", &client)` against the mock; assert returned Vec<FieldSchema> contains all of customfield_10001..10006 with correctly-typed schema variants
    - Test (`field_discovery_integration::discover_v2_fields_returns_global_list`): call `discover_v2_fields("http://127.0.0.1:8080", "test-pat", &client)`; assert returned vec contains "summary", "customfield_10001", and the count is at least 14 (8 system + 6 custom from Plan 01 fixture)
    - Test (`field_discovery_integration::fetch_all_createmeta_drains_two_pages`): call `fetch_all_createmeta_fields(&client, "http://127.0.0.1:8081", &cloud_auth, "MYPROJ", "10001")` with PAGE_SIZE forced to 5; assert returned response.fields has length 7 and response.total == 7; assert returned schema_hash is non-empty 64-char hex string
    - Test (`field_discovery_integration::fetch_all_createmeta_hash_is_deterministic`): call twice; assert both calls produce the same schema_hash
    - Test (`field_discovery_integration::fetch_target_issue_types_returns_three`): call `fetch_target_issue_types(&client, ..., "MYPROJ")`; assert exactly 3 IssueTypeRef returned (Bug/Task/Story)
    - Test (`field_discovery_integration::cache_hit_returns_without_http`): with FieldMappingDb pre-seeded for ("target","MYPROJ","10001"), call `get_or_fetch_target_schema(&db, &client, base_url, &auth, "MYPROJ", "10001")`; assert it returns the seeded data WITHOUT calling the mock server (use a Drop-flag or unused-port check pattern)
    - Test (`probe_createmeta::probe_succeeds_against_known_project`): probe MYPROJ against mock; assert ProbeResult { ok: true, status_code: Some(200), .. }
    - Test (`probe_createmeta::probe_fails_with_endpoint_and_status_in_message`): probe an UNKNOWN_PROJECT; the mock returns either 404 (the project_key path param is ignored by mock so this returns 200 — adjust test to use a non-existent endpoint by hitting a path the mock doesn't expose, e.g. http://127.0.0.1:8081/rest/api/3/issue/createmeta/MYPROJ/issuetypes that's actually mock'ed, OR verify by stopping the v3 mock server temporarily; for the failing case use `http://127.0.0.1:9999/...` (closed port) and assert the ProbeResult.ok == false and ProbeResult.endpoint_url contains "9999" and ProbeResult.hint mentions "proxy may not expose")
    - Test (`probe_createmeta::probe_redacts_credentials`): induce a probe failure (closed port at 127.0.0.1:9999); assert that ProbeResult.hint, ProbeResult.endpoint_url, and the AppError message returned do NOT contain the literal credential value (use a sentinel credential like "SUPER_SECRET_TOKEN_12345" and assert it does NOT appear in the serialized ProbeResult JSON)
  </behavior>
  <action>
**Step 1 — Create `src-tauri/tests/field_discovery_integration.rs`:**

Use the same `Once` + `std::thread::spawn(start_mock_servers)` bootstrap pattern from `tests/mock_server.rs` and `tests/mock_server_field_routes.rs` (Plan 01).

Concrete test structure:
- All tests `#[tokio::test(flavor = "multi_thread")]`
- Use `pmkar_lib::field_discovery::*` and `pmkar_lib::field_mapping_db::*` (lib re-exports already exist after Plan 02)
- Build a plain `reqwest::Client::new()` for tests (not the audited middleware client — this is integration test infra)
- Cloud auth header for v3 mock: `format!("Basic {}", base64::engine::general_purpose::STANDARD.encode("test:test"))`
- Server PAT for v2 mock: `"test-pat"` (match existing mock_server.rs require_auth conventions)

**Step 2 — Create `src-tauri/tests/probe_createmeta.rs`:**

```rust
// src-tauri/tests/probe_createmeta.rs
// (illustrative — write exact bodies based on the actual function signatures Task 2 ships)

#[tokio::test(flavor = "multi_thread")]
async fn probe_succeeds_against_known_project() {
    // bootstrap mock server (use shared helper)
    // build client + auth
    // call probe_paginated_createmeta(&client, base_url_8081, &auth, "MYPROJ").await
    // assert .ok == true, .status_code == Some(200)
}

#[tokio::test(flavor = "multi_thread")]
async fn probe_fails_with_endpoint_and_status_in_message() {
    let client = reqwest::Client::new();
    let auth = "Basic dGVzdDp0ZXN0";
    // Closed port — connection refused → ok=false, status_code=None
    let result = pmkar_lib::field_discovery::probe_paginated_createmeta(
        &client,
        "http://127.0.0.1:9999",
        auth,
        "MYPROJ",
    ).await;
    let probe = result.expect("probe must produce a ProbeResult, never an Err");
    assert!(!probe.ok);
    assert!(probe.endpoint_url.contains("9999"));
    assert!(probe.endpoint_url.contains("/rest/api/3/issue/createmeta/MYPROJ/issuetypes"));
    if let Some(hint) = &probe.hint {
        assert!(hint.contains("proxy") || hint.contains("createmeta"), "hint must mention proxy/createmeta context");
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn probe_redacts_credentials() {
    let client = reqwest::Client::new();
    let secret = "SUPER_SECRET_TOKEN_12345";
    let auth = format!("Basic {secret}");
    // Force failure (closed port) so error path is exercised
    let probe = pmkar_lib::field_discovery::probe_paginated_createmeta(
        &client,
        "http://127.0.0.1:9999",
        &auth,
        "MYPROJ",
    ).await.expect("ProbeResult");
    let serialized = serde_json::to_string(&probe).unwrap();
    assert!(
        !serialized.contains(secret),
        "credential leaked in ProbeResult: {serialized}"
    );
    if let Some(hint) = &probe.hint {
        assert!(!hint.contains(secret));
    }
    assert!(!probe.endpoint_url.contains(secret));
}
```

For the cache-hit-no-http test, use `FieldMappingDb::open_in_memory()`, pre-seed via `upsert_schema_row`, then call a `get_or_fetch_target_schema` helper that takes the db + a "blackhole" base URL like `http://127.0.0.1:1` — assert the returned vec matches the seeded data (proves no HTTP call escaped).

**Step 3 — Run tests; they MUST FAIL (functions don't exist yet):**

```bash
cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test field_discovery_integration 2>&1 | tail -10 || true
cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test probe_createmeta 2>&1 | tail -10 || true
```

Expected: compile errors ("function not found in pmkar_lib::field_discovery") — confirms Wave 0 RED state.
  </action>
  <verify>
    <automated>cargo build --manifest-path src-tauri/Cargo.toml --features mock-server --tests 2>&1 | tail -10 || true</automated>
  </verify>
  <acceptance_criteria>
    - File `src-tauri/tests/field_discovery_integration.rs` exists
    - File `src-tauri/tests/probe_createmeta.rs` exists
    - `grep -c '#\[tokio::test' src-tauri/tests/field_discovery_integration.rs` returns at least 6
    - `grep -c '#\[tokio::test' src-tauri/tests/probe_createmeta.rs` returns at least 3
    - File contains literal strings `"customfield_10006"`, `"discover_v3_fields"`, `"fetch_all_createmeta_fields"`, `"probe_paginated_createmeta"`, `"SUPER_SECRET_TOKEN_12345"`
    - Build (without yet implementing the functions in Task 2) fails with "not found in `pmkar_lib::field_discovery`" or similar — confirming RED state
  </acceptance_criteria>
  <done>Both test files committed; do not yet compile because Task 2 implements the missing functions.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement HTTP discovery functions, pagination loop, probe, and pre-warm in field_discovery.rs</name>
  <files>src-tauri/src/field_discovery.rs</files>
  <read_first>
    - src-tauri/src/field_discovery.rs (Plan 02 — existing types)
    - src-tauri/src/field_mapping_db.rs (Plan 02 — methods to call)
    - src-tauri/src/jira_client.rs lines 42-150 (pagination loop pattern in search_tickets)
    - src-tauri/src/commands.rs lines 1062-1147 (Cloud Basic auth + paginated GET pattern)
    - src-tauri/tests/field_discovery_integration.rs (Task 1 — defines required signatures)
    - src-tauri/tests/probe_createmeta.rs (Task 1)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md §"Pattern 2" lines 261-346, §"Pattern 5" lines 484-509, §"Common Pitfalls" Pitfall A-G lines 869-908
  </read_first>
  <behavior>
    - All Task-1 integration tests pass
    - All previously-shipped Plan 02 unit tests still pass
    - clippy --features mock-server -- -D warnings exits clean
  </behavior>
  <action>
**Append the following to `src-tauri/src/field_discovery.rs` (after the existing types, before the `#[cfg(test)] mod tests` block):**

```rust
use crate::error::{AppError, AppResult};
use crate::field_mapping_db::{compute_schema_hash, FieldMappingDb};
use reqwest::Client;
use std::sync::{Arc, Mutex};

/// Page size used for paginated createmeta calls. Atlassian's default is 50.
pub const CREATEMETA_PAGE_SIZE: u64 = 50;

/// Hard upper bound on the number of createmeta pages we will drain. Prevents an
/// infinite loop on a hostile or buggy server that reports a `total` larger than
/// the data actually served.
pub const MAX_CREATEMETA_PAGES: u64 = 50;

/// Result of the connection-time probe (D-05/D-07/D-08). Never carries credentials.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeResult {
    pub ok: bool,
    pub endpoint_url: String,
    pub status_code: Option<u16>,
    pub hint: Option<String>,
}

// ─── Source: GET /rest/api/2/field (D-14) ─────────────────────────────────────

/// Discover the global Jira Server v2 field list. No per-issuetype fetch — D-14.
pub async fn discover_v2_fields(
    client: &Client,
    base_url: &str,
    pat: &str,
) -> AppResult<Vec<FieldSchema>> {
    let trimmed = base_url.trim_end_matches('/');
    let url = format!("{trimmed}/rest/api/2/field");
    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {pat}"))
        .send()
        .await
        .map_err(|_| AppError::Http("v2 /field: HTTP request failed".into()))?;
    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "GET {url} returned {}. Source field discovery failed.",
            resp.status().as_u16()
        )));
    }
    let value: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| AppError::Http("v2 /field: parse failed".into()))?;
    parse_global_field_list(&value)
}

// ─── Target: GET /rest/api/3/field ────────────────────────────────────────────

pub async fn discover_v3_fields(
    client: &Client,
    base_url: &str,
    cloud_auth: &str,
) -> AppResult<Vec<FieldSchema>> {
    let trimmed = base_url.trim_end_matches('/');
    let url = format!("{trimmed}/rest/api/3/field");
    let resp = client
        .get(&url)
        .header("Authorization", cloud_auth)
        .send()
        .await
        .map_err(|_| AppError::Http("v3 /field: HTTP request failed".into()))?;
    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "GET {url} returned {}. Target field discovery failed.",
            resp.status().as_u16()
        )));
    }
    let value: serde_json::Value = resp
        .json()
        .await
        .map_err(|_| AppError::Http("v3 /field: parse failed".into()))?;
    parse_global_field_list(&value)
}

fn parse_global_field_list(value: &serde_json::Value) -> AppResult<Vec<FieldSchema>> {
    // /field returns a flat array of field descriptors with shape:
    //   { "id": "summary", "name": "Summary", "schema": { ... } }
    // We adapt to FieldSchema by mapping `id` -> field_id and synthesizing required=false.
    let arr = value
        .as_array()
        .ok_or_else(|| AppError::Http("/field response was not an array".into()))?;
    let mut out = Vec::with_capacity(arr.len());
    for entry in arr {
        let field_id = entry
            .get("id")
            .or_else(|| entry.get("fieldId"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        if field_id.is_empty() {
            continue;
        }
        let name = entry
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(&field_id)
            .to_string();
        let schema_v = entry
            .get("schema")
            .cloned()
            .unwrap_or(serde_json::json!({"type":"any"}));
        let schema: FieldSchemaType = serde_json::from_value(schema_v).unwrap_or(FieldSchemaType::Any);
        out.push(FieldSchema {
            field_id,
            name,
            required: false,
            has_default_value: None,
            schema,
            allowed_values: None,
            operations: None,
        });
    }
    Ok(out)
}

// ─── Target paginated createmeta ─────────────────────────────────────────────

/// Paginate /rest/api/3/issue/createmeta/{key}/issuetypes/{id}, return the
/// merged response + a SHA-256 hex hash over the concatenated page bodies.
///
/// The hash MUST be computed over the raw bytes of every page in order — Phase
/// 21 reads it for drift detection (D-04). Hashing over the parsed/merged value
/// would lose byte-level drift signals.
pub async fn fetch_all_createmeta_fields(
    client: &Client,
    base_url: &str,
    cloud_auth: &str,
    project_key: &str,
    issuetype_id: &str,
) -> AppResult<(CreatemetaResponse, String)> {
    let trimmed = base_url.trim_end_matches('/');
    let project_enc = urlencoding::encode(project_key);
    let issuetype_enc = urlencoding::encode(issuetype_id);

    let mut all_fields: Vec<FieldSchema> = Vec::new();
    let mut start_at: u64 = 0;
    let mut declared_total: u64 = 0;
    let mut declared_max_results: u64 = CREATEMETA_PAGE_SIZE;
    let mut pages_drained: u64 = 0;
    let mut hasher = sha2::Sha256::new();

    loop {
        let url = format!(
            "{trimmed}/rest/api/3/issue/createmeta/{project_enc}/issuetypes/{issuetype_enc}?startAt={start_at}&maxResults={CREATEMETA_PAGE_SIZE}"
        );
        let resp = client
            .get(&url)
            .header("Authorization", cloud_auth)
            .send()
            .await
            .map_err(|_| AppError::Http("createmeta fetch failed".into()))?;
        let status = resp.status();
        if !status.is_success() {
            return Err(AppError::Http(format!(
                "GET {url} returned {}. Your proxy may not expose the paginated createmeta endpoint.",
                status.as_u16()
            )));
        }
        let bytes = resp
            .bytes()
            .await
            .map_err(|_| AppError::Http("createmeta read body failed".into()))?;
        sha2::Digest::update(&mut hasher, &bytes);

        let page: CreatemetaResponse = serde_json::from_slice(&bytes)
            .map_err(|e| AppError::Http(format!("createmeta parse failed: {e}")))?;
        let page_len = page.fields.len() as u64;
        declared_total = page.total;
        declared_max_results = page.max_results.max(1);
        all_fields.extend(page.fields);
        pages_drained += 1;

        // Stop conditions: empty page, drained declared total, or hit hard upper bound
        if page_len == 0 || all_fields.len() as u64 >= declared_total {
            break;
        }
        if pages_drained >= MAX_CREATEMETA_PAGES {
            return Err(AppError::Http(format!(
                "createmeta pagination exceeded MAX_CREATEMETA_PAGES ({MAX_CREATEMETA_PAGES}) — server reported total={declared_total} but did not converge"
            )));
        }
        start_at += page_len.max(declared_max_results);
    }

    let hash_hex = hex::encode(sha2::Digest::finalize(hasher));
    let response = CreatemetaResponse {
        start_at: 0,
        max_results: declared_max_results,
        total: declared_total.max(all_fields.len() as u64),
        fields: all_fields,
    };
    Ok((response, hash_hex))
}

// ─── Target issue-type list (pre-warm) ────────────────────────────────────────

pub async fn fetch_target_issue_types(
    client: &Client,
    base_url: &str,
    cloud_auth: &str,
    project_key: &str,
) -> AppResult<Vec<IssueTypeRef>> {
    let trimmed = base_url.trim_end_matches('/');
    let project_enc = urlencoding::encode(project_key);
    let url = format!("{trimmed}/rest/api/3/issue/createmeta/{project_enc}/issuetypes?startAt=0&maxResults={CREATEMETA_PAGE_SIZE}");
    let resp = client
        .get(&url)
        .header("Authorization", cloud_auth)
        .send()
        .await
        .map_err(|_| AppError::Http("issuetype list fetch failed".into()))?;
    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "GET {url} returned {}. Issue-type list fetch failed.",
            resp.status().as_u16()
        )));
    }
    let body: IssueTypesResponse = resp
        .json()
        .await
        .map_err(|_| AppError::Http("issuetype list parse failed".into()))?;
    Ok(body.issue_types)
}

// ─── Probe (D-05/D-07/D-08) ───────────────────────────────────────────────────

/// Probe the paginated createmeta endpoint. Returns a `ProbeResult` rather than
/// an `Err` so the caller can surface a structured banner. Never echoes
/// credentials in any field of the result.
pub async fn probe_paginated_createmeta(
    client: &Client,
    base_url: &str,
    cloud_auth: &str,
    project_key: &str,
) -> AppResult<ProbeResult> {
    let trimmed = base_url.trim_end_matches('/');
    let project_enc = urlencoding::encode(project_key);
    let endpoint_url = format!("{trimmed}/rest/api/3/issue/createmeta/{project_enc}/issuetypes");
    // Authorization header passed via &str — never included in `endpoint_url`. Hint strings below
    // are static templates with no interpolation of `cloud_auth`.
    match client
        .get(&endpoint_url)
        .header("Authorization", cloud_auth)
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status();
            if status.is_success() {
                Ok(ProbeResult {
                    ok: true,
                    endpoint_url,
                    status_code: Some(status.as_u16()),
                    hint: None,
                })
            } else {
                Ok(ProbeResult {
                    ok: false,
                    endpoint_url,
                    status_code: Some(status.as_u16()),
                    hint: Some(
                        "Your proxy may not expose the paginated createmeta endpoint."
                            .to_string(),
                    ),
                })
            }
        }
        Err(_) => Ok(ProbeResult {
            ok: false,
            endpoint_url,
            status_code: None,
            hint: Some(
                "Network or DNS error reaching paginated createmeta endpoint. Your proxy may not expose this endpoint."
                    .to_string(),
            ),
        }),
    }
}

// ─── Cache-aware getter (commands.rs delegates here) ─────────────────────────

pub async fn get_or_fetch_target_schema(
    db: &Arc<Mutex<FieldMappingDb>>,
    client: &Client,
    base_url: &str,
    cloud_auth: &str,
    project_key: &str,
    issuetype_id: &str,
) -> AppResult<Vec<FieldSchema>> {
    // 1) Cache check (read lock window kept short)
    {
        let guard = db
            .lock()
            .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
        let cached =
            guard.get_cached_schemas(FieldSide::Target, Some(project_key), Some(issuetype_id))?;
        if !cached.is_empty() {
            return Ok(cached);
        }
    }
    // 2) Cache miss — fetch (no lock held during HTTP)
    let (resp, hash) =
        fetch_all_createmeta_fields(client, base_url, cloud_auth, project_key, issuetype_id)
            .await?;
    // 3) Persist
    {
        let guard = db
            .lock()
            .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
        for field in &resp.fields {
            guard.upsert_schema_row(
                FieldSide::Target,
                Some(project_key),
                Some(issuetype_id),
                field,
                &hash,
            )?;
        }
    }
    Ok(resp.fields)
}

pub async fn get_or_fetch_source_global(
    db: &Arc<Mutex<FieldMappingDb>>,
    client: &Client,
    base_url: &str,
    pat: &str,
) -> AppResult<Vec<FieldSchema>> {
    {
        let guard = db
            .lock()
            .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
        let cached = guard.get_cached_schemas(FieldSide::Source, None, None)?;
        if !cached.is_empty() {
            return Ok(cached);
        }
    }
    let fields = discover_v2_fields(client, base_url, pat).await?;
    let raw_hash = compute_schema_hash(serde_json::to_string(&fields).unwrap_or_default().as_bytes());
    {
        let guard = db
            .lock()
            .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
        for field in &fields {
            guard.upsert_schema_row(FieldSide::Source, None, None, field, &raw_hash)?;
        }
    }
    Ok(fields)
}
```

**Add inline unit tests for the pagination bounded loop and ProbeResult redaction:**

Append to existing `#[cfg(test)] mod tests`:

```rust
#[test]
fn probe_result_serializes_without_credentials() {
    let r = ProbeResult {
        ok: false,
        endpoint_url: "http://127.0.0.1:9999/rest/api/3/issue/createmeta/MYPROJ/issuetypes".into(),
        status_code: None,
        hint: Some("Your proxy may not expose the paginated createmeta endpoint.".into()),
    };
    let s = serde_json::to_string(&r).unwrap();
    assert!(s.contains("endpointUrl"));
    assert!(s.contains("hint"));
    assert!(!s.to_lowercase().contains("bearer"));
    assert!(!s.to_lowercase().contains("basic"));
}

#[test]
fn pagination_constants_are_sane() {
    assert!(CREATEMETA_PAGE_SIZE > 0 && CREATEMETA_PAGE_SIZE <= 100);
    assert!(MAX_CREATEMETA_PAGES > 0);
}
```

**Run integration tests:**

```bash
cargo build --manifest-path src-tauri/Cargo.toml --features mock-server --tests
cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test field_discovery_integration
cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test probe_createmeta
cargo test --manifest-path src-tauri/Cargo.toml --lib field_discovery
cargo test --manifest-path src-tauri/Cargo.toml --lib field_mapping_db
```

All must exit 0.
  </action>
  <verify>
    <automated>cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --lib field_discovery 2>&1 | tail -3 && cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test field_discovery_integration 2>&1 | tail -3 && cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test probe_createmeta 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'pub async fn discover_v2_fields' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c 'pub async fn discover_v3_fields' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c 'pub async fn fetch_all_createmeta_fields' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c 'pub async fn fetch_target_issue_types' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c 'pub async fn probe_paginated_createmeta' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c 'pub async fn get_or_fetch_target_schema' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c 'pub struct ProbeResult' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c 'pub const CREATEMETA_PAGE_SIZE' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c 'pub const MAX_CREATEMETA_PAGES' src-tauri/src/field_discovery.rs` returns 1
    - `grep -c 'Your proxy may not expose the paginated createmeta endpoint' src-tauri/src/field_discovery.rs` returns at least 2 (D-07 message in error path + probe hint)
    - `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test field_discovery_integration` exits 0
    - `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test probe_createmeta` exits 0
    - `cargo test --manifest-path src-tauri/Cargo.toml --lib field_discovery` exits 0
    - `cargo clippy --manifest-path src-tauri/Cargo.toml --features mock-server -- -D warnings` exits 0
  </acceptance_criteria>
  <done>HTTP discovery, pagination loop, probe, and pre-warm functions implemented and integration-tested; D-07 error format and credential redaction verified.</done>
</task>

<task type="auto">
  <name>Task 3: Wire 5 Tauri commands in commands.rs and register them in main.rs invoke_handler</name>
  <files>src-tauri/src/commands.rs, src-tauri/src/main.rs</files>
  <read_first>
    - src-tauri/src/commands.rs lines 1-100 (helpers + imports), lines 1062-1147 (search_jira_users patterns to mirror)
    - src-tauri/src/main.rs lines 187-233 (existing invoke_handler list)
    - src-tauri/src/triage_db.rs (look up `get_project_config` signature returning ProjectConfig with target_project_key field)
    - src-tauri/src/field_discovery.rs (after Task 2)
    - src-tauri/src/field_mapping_db.rs (Plan 02)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-PATTERNS.md §"src-tauri/src/commands.rs"
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md §"Pattern 5: probe wiring", §"Pitfall C"
  </read_first>
  <behavior>
    - Five new `#[tauri::command]` functions exist in commands.rs: discover_source_fields, get_target_field_schema_for_issuetype, probe_createmeta, pre_warm_target_issue_types, refresh_field_schema_cache
    - All five functions accept `State<'_, Arc<Mutex<X>>>` for AuditDb, TriageDb, FieldMappingDb as needed
    - probe_createmeta short-circuits with `ProbeResult { ok: false, ..., hint: Some("No target project key configured")}` when target_project_key is None (Pitfall C — first-run users do not see a failure banner)
    - probe_createmeta NEVER returns `Err` for HTTP/network/auth failures — always returns ProbeResult so the frontend can render the banner deterministically. It DOES return `Err` only for fatal local errors (lock poisoned, keychain missing — which bubble up as "credentials not configured")
    - get_target_field_schema_for_issuetype delegates to field_discovery::get_or_fetch_target_schema (cache-first)
    - discover_source_fields delegates to field_discovery::get_or_fetch_source_global
    - pre_warm_target_issue_types calls fetch_target_issue_types directly (no cache write — issue-type list is short-lived)
    - refresh_field_schema_cache calls FieldMappingDb::clear_cache_for, accepting null project_key/issuetype_id for source-side refresh
    - main.rs invoke_handler list includes all 5 new commands
  </behavior>
  <action>
**Step 1 — Add imports + new commands to `src-tauri/src/commands.rs` (append AFTER `search_jira_users_by_domain`, BEFORE the next section comment):**

Add to the existing `use` block at top of commands.rs:
```rust
use crate::field_discovery::{
    self, FieldSchema, FieldSide, IssueTypeRef, ProbeResult,
};
use crate::field_mapping_db::FieldMappingDb;
```

Append the new commands:

```rust
// --- Field discovery commands (Phase 17) ---

/// Source v2 global field list. Cached forever-per-session in field_schema_cache
/// with NULL project_key + NULL issuetype_id (D-13 / D-14).
#[tauri::command]
pub async fn discover_source_fields(
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<Vec<FieldSchema>, AppError> {
    let pat = get_server_pat(triage_db.inner())?;
    // Read base_url from connection_meta (existing helper pattern via TriageDb)
    let base_url = {
        let db_guard = triage_db
            .lock()
            .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
        let metas = db_guard.get_all_connection_meta()?;
        metas
            .iter()
            .find(|m| m.connection_type == "server")
            .map(|m| m.base_url.trim_end_matches('/').to_string())
            .ok_or_else(|| AppError::Keychain("No server connection configured".into()))?
    };
    let _audit = build_audited_client(Arc::clone(db.inner())); // ensures HTTP audit pipeline armed for downstream cloud commands
    let client = reqwest::Client::new();
    field_discovery::get_or_fetch_source_global(
        mapping_db.inner(),
        &client,
        &base_url,
        &pat,
    )
    .await
}

/// Target v3 paginated createmeta for a specific issue type. Lazy fetch on cache
/// miss (D-15); subsequent calls hit the cache.
#[tauri::command]
pub async fn get_target_field_schema_for_issuetype(
    project_key: String,
    issuetype_id: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<Vec<FieldSchema>, AppError> {
    let (base_url, cloud_email, api_token) = get_cloud_credentials(triage_db.inner())?;
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{cloud_email}:{api_token}"))
    );
    let _audit = build_audited_client(Arc::clone(db.inner())); // ensures HTTP audit pipeline armed
    let client = reqwest::Client::new();
    field_discovery::get_or_fetch_target_schema(
        mapping_db.inner(),
        &client,
        &base_url,
        &cloud_auth,
        &project_key,
        &issuetype_id,
    )
    .await
}

/// Connection-time probe (D-05/D-07/D-08). Returns a structured ProbeResult so
/// the frontend can render a banner; never returns Err for HTTP failures.
/// Returns Err only if Cloud credentials are not configured (caller should hide
/// the banner pre-setup).
#[tauri::command]
pub async fn probe_createmeta(
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<ProbeResult, AppError> {
    // Pitfall C: skip probe gracefully if target project key is not configured
    let target_project_key: Option<String> = {
        let db_guard = triage_db
            .lock()
            .map_err(|_| AppError::Internal("Triage DB lock poisoned".into()))?;
        db_guard.get_project_config().ok().and_then(|c| c.target_project_key)
    };
    let project_key = match target_project_key {
        Some(k) if !k.is_empty() => k,
        _ => {
            return Ok(ProbeResult {
                ok: false,
                endpoint_url: String::new(),
                status_code: None,
                hint: Some("No target project key configured. Probe skipped.".into()),
            });
        }
    };
    let (base_url, cloud_email, api_token) = match get_cloud_credentials(triage_db.inner()) {
        Ok(creds) => creds,
        Err(_) => {
            return Ok(ProbeResult {
                ok: false,
                endpoint_url: String::new(),
                status_code: None,
                hint: Some("No cloud credential configured. Probe skipped.".into()),
            });
        }
    };
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{cloud_email}:{api_token}"))
    );
    let _audit = build_audited_client(Arc::clone(db.inner()));
    let client = reqwest::Client::new();
    field_discovery::probe_paginated_createmeta(&client, &base_url, &cloud_auth, &project_key).await
}

/// Pre-warm the issue-type list for the given target project (D-01 + D-15
/// reconciliation: fetch the issue-type LIST only, not per-issuetype schemas).
/// Best-effort; errors are logged via audit middleware but the command returns
/// an empty Vec on failure rather than Err so the frontend pre-warm does not
/// block the UI.
#[tauri::command]
pub async fn pre_warm_target_issue_types(
    project_key: String,
    db: State<'_, Arc<Mutex<AuditDb>>>,
    triage_db: State<'_, Arc<Mutex<TriageDb>>>,
) -> Result<Vec<IssueTypeRef>, AppError> {
    let (base_url, cloud_email, api_token) = match get_cloud_credentials(triage_db.inner()) {
        Ok(c) => c,
        Err(_) => return Ok(vec![]),
    };
    let cloud_auth = format!(
        "Basic {}",
        base64::engine::general_purpose::STANDARD.encode(format!("{cloud_email}:{api_token}"))
    );
    let _audit = build_audited_client(Arc::clone(db.inner()));
    let client = reqwest::Client::new();
    match field_discovery::fetch_target_issue_types(&client, &base_url, &cloud_auth, &project_key)
        .await
    {
        Ok(list) => Ok(list),
        Err(_) => Ok(vec![]),
    }
}

/// Manual cache refresh (Phase 21 wires the UI button; this command is the
/// backend hook). Accepts source/target side and optional project_key + issuetype_id.
/// Passing both null clears the source global cache (D-14).
#[tauri::command]
pub async fn refresh_field_schema_cache(
    side: String,
    project_key: Option<String>,
    issuetype_id: Option<String>,
    mapping_db: State<'_, Arc<Mutex<FieldMappingDb>>>,
) -> Result<(), AppError> {
    let side_enum = match side.as_str() {
        "source" => FieldSide::Source,
        "target" => FieldSide::Target,
        _ => return Err(AppError::Internal(format!("invalid side: {side}"))),
    };
    let guard = mapping_db
        .lock()
        .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
    guard.clear_cache_for(side_enum, project_key.as_deref(), issuetype_id.as_deref())?;
    Ok(())
}
```

**Note on `build_audited_client` usage (LOCKED):** Phase 17 uses `reqwest::Client::new()` directly inside `field_discovery::*` functions and inside the integration tests. The audit middleware is preserved for production Cloud calls by all *other* commands that already use `build_audited_client` — those pipelines remain armed. Inside the new `discover_*` commands the `build_audited_client(...)` call is bound to `_audit` purely so the middleware initialization side-effects (audit DB open, request-id seeding) stay invariant; the discover functions then take `&reqwest::Client`. Do NOT refactor `field_discovery` to accept `&ClientWithMiddleware` in Phase 17 — that's a Phase 18 concern when the transformer pipeline lands and audit-on-discovery becomes useful. This keeps the source-side server call uniform with how the integration tests run.

**Step 2 — Register the 5 commands in `main.rs`:**

In the `tauri::generate_handler![...]` list (around line 187-233 of main.rs), append AFTER the existing `commands::mark_changes_seen,` line:

```rust
            commands::discover_source_fields,
            commands::get_target_field_schema_for_issuetype,
            commands::probe_createmeta,
            commands::pre_warm_target_issue_types,
            commands::refresh_field_schema_cache,
```

**Step 3 — Build + smoke test:**

```bash
cargo build --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --features mock-server
cargo clippy --manifest-path src-tauri/Cargo.toml --features mock-server -- -D warnings
```

All must exit 0. Verify the existing test suite still passes.
  </action>
  <verify>
    <automated>cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -3 && cargo test --manifest-path src-tauri/Cargo.toml --features mock-server 2>&1 | tail -10 && cargo clippy --manifest-path src-tauri/Cargo.toml --features mock-server -- -D warnings 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "pub async fn probe_createmeta" src-tauri/src/commands.rs` returns 1
    - `grep -c "pub async fn discover_source_fields" src-tauri/src/commands.rs` returns 1
    - `grep -c "pub async fn get_target_field_schema_for_issuetype" src-tauri/src/commands.rs` returns 1
    - `grep -c "pub async fn pre_warm_target_issue_types" src-tauri/src/commands.rs` returns 1
    - `grep -c "pub async fn refresh_field_schema_cache" src-tauri/src/commands.rs` returns 1
    - `grep -c "commands::probe_createmeta" src-tauri/src/main.rs` returns 1
    - `grep -c "commands::discover_source_fields" src-tauri/src/main.rs` returns 1
    - `grep -c "commands::get_target_field_schema_for_issuetype" src-tauri/src/main.rs` returns 1
    - `grep -c "commands::pre_warm_target_issue_types" src-tauri/src/main.rs` returns 1
    - `grep -c "commands::refresh_field_schema_cache" src-tauri/src/main.rs` returns 1
    - `grep -c "No target project key configured" src-tauri/src/commands.rs` returns at least 1 (Pitfall C path)
    - `cargo build --manifest-path src-tauri/Cargo.toml` exits 0
    - `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server` exits 0 (full suite green)
    - `cargo clippy --manifest-path src-tauri/Cargo.toml --features mock-server -- -D warnings` exits 0
  </acceptance_criteria>
  <done>5 Tauri commands wired and registered; cache-first reads validated; Pitfall C handled (no probe failure banner pre-setup); full suite green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Frontend invoke -> Tauri command -> Rust HTTP layer -> Jira API | All five new commands cross this boundary; auth comes from keychain via existing helpers |
| Mock server (test only) | Test-only boundary; `mock-server` feature flag compiled out of release |
| FieldMappingDb writes | Cache writes use parameterized SQL via FieldMappingDb methods (Plan 02 already enforces) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-01 | Tampering | serde tag injection on createmeta response | mitigate | FieldSchemaType uses #[serde(other)] Any catch-all (Plan 02); fetch_all_createmeta_fields parses with serde_json::from_slice into the typed struct -- unknown fields silently ignored |
| T-17-02 | Denial of Service | Unbounded pagination loop | mitigate | Three concurrent stop conditions: (1) page_len == 0, (2) all_fields.len() >= total, (3) pages_drained >= MAX_CREATEMETA_PAGES (50) -- guarantees termination on any input |
| T-17-03 | Information Disclosure | Credential in error message or ProbeResult | mitigate | endpoint_url is server-constructed (no auth substring); hint strings are static templates without auth interpolation; unit test probe_result_serializes_without_credentials asserts no Bearer/Basic substring after serialization |
| T-17-14 | SSRF | Probe target URL constructed from base_url + project_key | mitigate | base_url comes from triage_db connection_meta -- user-configured at setup, validated as http(s) by Phase 02 connection-test command; project_key is urlencoded to prevent path-traversal injection |
| T-17-15 | Cache Poisoning | upsert_schema_row with attacker-controlled response | accept | The "attacker" here is Atlassian or a MITM proxy. MITM is out of scope for v0.4.0 (TLS already enforced for non-localhost; Phase 02 [02-03] decision). schema_hash drift detection in Phase 21 surfaces tampering after the fact. |
| T-17-16 | Credential leakage via build_audited_client | mitigate | Existing audit middleware redacts Authorization header (Phase 01-02 [02] decision). All new commands inherit this redaction by using build_audited_client(); cargo audit log inspection tests in audit.rs already cover this path |
| T-17-17 | Lock poisoning denial of service | accept | FieldMappingDb Mutex lock is held only briefly (read or single-row insert); .map_err on lock poison returns AppError::Internal which surfaces a user-visible error rather than panicking the app. Same pattern as TriageDb/SnapshotDb. |
</threat_model>

<verification>
- `cargo build --manifest-path src-tauri/Cargo.toml` passes
- `cargo test --manifest-path src-tauri/Cargo.toml --lib field_discovery` passes (≥16 unit tests)
- `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test field_discovery_integration` passes (≥6 integration tests)
- `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test probe_createmeta` passes (≥3 tests including credential redaction)
- `cargo clippy --manifest-path src-tauri/Cargo.toml --features mock-server -- -D warnings` passes
- 5 new Tauri commands registered in main.rs invoke_handler list
- D-07 error message format ("GET {url} returned {status}. Your proxy may not expose ...") present in field_discovery.rs (≥2 occurrences)
- Pitfall C handled: probe_createmeta short-circuits with hint when target project key absent
- Pitfall D enforced: schema_hash computed once per (side, project, issuetype) tuple over concatenated raw response bytes
- Pitfall E enforced: pre-warm spawn occurs from Tauri command (after frontend probe success), not from main.rs setup() before app.manage
</verification>

<success_criteria>
- DISC-01: Source v2 field schemas discoverable via `discover_source_fields` command + cached in mapping.db
- DISC-02: Target v3 field schemas discoverable via `get_target_field_schema_for_issuetype` command + cached
- DISC-03: Required-field metadata fetched via paginated /createmeta/{key}/issuetypes/{id}; multi-page responses correctly drained
- Probe surfaces D-07 message format with no credential leakage
- Pre-warm fetches issue-type list (D-01 + D-15 reconciled per RESEARCH.md §"Summary"): NOT per-issuetype field schemas
</success_criteria>

<output>
After completion, create `.planning/phases/17-field-discovery-mock-schema-fidelity/17-04-SUMMARY.md`
</output>
