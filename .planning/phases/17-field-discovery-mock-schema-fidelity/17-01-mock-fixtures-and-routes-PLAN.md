---
phase: 17-field-discovery-mock-schema-fidelity
plan: 01
plan_id: 17-01
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/fixtures.rs
  - src-tauri/src/mock_server.rs
  - src-tauri/tests/mock_server_field_routes.rs
  - src-tauri/tests/createmeta_pagination.rs
autonomous: true
requirements:
  - DISC-03
  - DISC-04
tags:
  - jira
  - mock-server
  - fixtures
  - createmeta
  - field-discovery

must_haves:
  truths:
    - "GET /rest/api/2/field on the mock server returns a flat array containing all 6 custom fields (customfield_10001..customfield_10006) plus standard system fields (summary, description, priority, assignee, reporter, labels, fixVersions, components)"
    - "GET /rest/api/3/field on the mock server returns the same logical 6 custom fields plus system fields with v3-shape user identity (accountId-based) — divergence from v2"
    - "GET /rest/api/3/issue/createmeta/MYPROJ/issuetypes returns 3 issue types (Bug id=10001, Task id=10002, Story id=10003) wrapped in {startAt, maxResults, total: 3, issueTypes: [...]}"
    - "GET /rest/api/3/issue/createmeta/MYPROJ/issuetypes/10001 (Bug) returns 7 fields total across 2 pages (page 1: maxResults=5, page 2: 2 fields). Required fields include priority + customfield_10006 'Severity'"
    - "GET /rest/api/3/issue/createmeta/MYPROJ/issuetypes/10002 (Task) returns fields where only 'summary' is required"
    - "GET /rest/api/3/issue/createmeta/MYPROJ/issuetypes/10003 (Story) returns fields where customfield_10001 'Story Points' is required"
    - "GET /rest/api/3/project/MYPROJ/versions returns versions with target IDs that DIFFER from v2 source version IDs (forces real lookup per D-12 divergence 2)"
    - "GET /rest/api/3/project/MYPROJ/components returns components for the mock target project"
    - "Mock priority response shape: v2 returns full {name, id, iconUrl}; v3 write side accepts only {id} (D-12 divergence 3)"
    - "customfield_10005 'Department/Team' is a cascading-select with allowedValues nested as [{id, value, children: [{id, value}]}] (D-10)"
  artifacts:
    - path: "src-tauri/src/fixtures.rs"
      provides: "FixtureState extended with v2_fields, v3_fields, v3_createmeta_issuetypes, v3_createmeta_fields (HashMap<String, Vec<Value>>), v3_project_versions, v3_project_components"
      contains: "customfield_10001"
    - path: "src-tauri/src/fixtures.rs"
      provides: "All 6 custom field fixture definitions per D-09/D-10"
      contains: "customfield_10006"
    - path: "src-tauri/src/mock_server.rs"
      provides: "v2 route /rest/api/2/field plus v3 routes /rest/api/3/field, /rest/api/3/issue/createmeta/{key}/issuetypes, /rest/api/3/issue/createmeta/{key}/issuetypes/{id}, /rest/api/3/project/{key}/versions, /rest/api/3/project/{key}/components"
      contains: "createmeta"
    - path: "src-tauri/tests/mock_server_field_routes.rs"
      provides: "Integration tests verifying every new route returns expected fixture shape"
    - path: "src-tauri/tests/createmeta_pagination.rs"
      provides: "Integration test verifying Bug createmeta endpoint paginates across 2 pages and total field count is 7"
  key_links:
    - from: "mock_server.rs build_v3_router"
      to: "fixtures.rs FixtureState fields"
      via: "State<SharedFixtures>"
      pattern: "State\\(fixtures\\): State<SharedFixtures>"
    - from: "mock_server.rs v3::get_createmeta_fields"
      to: "fixtures.rs v3_createmeta_fields HashMap"
      via: "lookup by issuetype_id"
      pattern: "v3_createmeta_fields\\.get"
---

<objective>
Extend mock fixtures and mock-server routes so the rest of Phase 17 (and downstream phases) can exercise field discovery against realistic Jira Server v2 + Cloud v3 schemas.

Purpose: Without these mock routes, none of `field_discovery.rs`, `field_mapping_db.rs`, or the probe command can be integration-tested. Foundation plan.

Output:
- 6 custom field fixtures (D-09: customfield_10001-10004 standard, D-10: customfield_10005 cascading, D-11: customfield_10006 Severity)
- 3 issue types (Bug, Task, Story) with distinct required-field sets per D-11
- New v2 + v3 mock routes covering /field, paginated createmeta (issue-type list + per-issue-type fields), versions, components
- All 4 v2/v3 shape divergences from D-12
- Bug createmeta pagination boundary case (total=7, maxResults=5) for Pitfall F coverage
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

<interfaces>
<!-- Existing FixtureState struct in fixtures.rs (must be EXTENDED, not replaced) -->

```rust
// src-tauri/src/fixtures.rs (current)
#[derive(Debug, Clone)]
pub struct FixtureState {
    pub server_v2_issues: HashMap<String, JiraIssue>,
    pub cloud_v3_issues: HashMap<String, JiraIssue>,
    pub next_issue_id: u32,
}

pub type SharedFixtures = Arc<Mutex<FixtureState>>;

// Phase 17 EXTENSION (add to FixtureState struct):
pub v2_fields: Vec<serde_json::Value>,           // GET /rest/api/2/field
pub v3_fields: Vec<serde_json::Value>,           // GET /rest/api/3/field
pub v3_createmeta_issuetypes: serde_json::Value, // GET /createmeta/MYPROJ/issuetypes (paginated wrapper)
pub v3_createmeta_fields: HashMap<String, Vec<serde_json::Value>>, // keyed by issuetype_id ("10001"/"10002"/"10003")
pub v3_project_versions: Vec<serde_json::Value>,
pub v3_project_components: Vec<serde_json::Value>,
```

<!-- mock_server.rs build_v2_router / build_v3_router pattern (lines 802-861 of current file) -->
<!-- New routes are added BEFORE .layer(middleware::from_fn(require_auth)) -->

<!-- Stateful handler pattern (must lock fixtures, clone vec, return Json) -->
```rust
pub async fn get_v3_fields(State(fixtures): State<SharedFixtures>) -> impl IntoResponse {
    let state = fixtures.lock().unwrap();
    Json(state.v3_fields.clone())
}
```

<!-- Path-param handler with pagination Query extractor -->
```rust
#[derive(Deserialize)]
pub struct CreametaPageQuery {
    #[serde(default)]
    pub start_at: u64,    // serde(rename = "startAt")
    #[serde(default = "default_max_results")]
    pub max_results: u64, // serde(rename = "maxResults")
}

fn default_max_results() -> u64 { 50 }

pub async fn get_createmeta_fields(
    State(fixtures): State<SharedFixtures>,
    Path((project_key, issuetype_id)): Path<(String, String)>,
    Query(params): Query<CreametaPageQuery>,
) -> impl IntoResponse { /* ... */ }
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Wave 0 — write failing integration tests for new mock routes + pagination</name>
  <files>src-tauri/tests/mock_server_field_routes.rs, src-tauri/tests/createmeta_pagination.rs</files>
  <read_first>
    - src-tauri/tests/mock_server.rs (existing test patterns — `#[tokio::test]`, `start_mock_servers`, reqwest::Client::new, the `std::sync::Once` test-server bootstrap)
    - src-tauri/src/mock_server.rs lines 802-886 (router construction + `start_mock_servers`)
    - src-tauri/src/fixtures.rs lines 1-250 (FixtureState shape + helpers)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md §"Createmeta Paginated Endpoint — Full Shape Reference" (lines 560-749) and §"Mock Fixture Choices" (lines 800-833)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-VALIDATION.md (per-task verification map)
  </read_first>
  <behavior>
    - Test 1 (`mock_server_field_routes::test_v2_field_returns_custom_fields`): GET http://127.0.0.1:8080/rest/api/2/field with valid Bearer auth returns 200 + array containing field id "customfield_10001" with name "Story Points"
    - Test 2 (`mock_server_field_routes::test_v3_field_returns_custom_fields`): GET http://127.0.0.1:8081/rest/api/3/field returns 200 + array containing all of customfield_10001/10002/10003/10004/10005/10006
    - Test 3 (`mock_server_field_routes::test_v3_createmeta_issuetypes_returns_three`): GET http://127.0.0.1:8081/rest/api/3/issue/createmeta/MYPROJ/issuetypes returns 200, body has `total == 3` and issueTypes array contains ids "10001","10002","10003" with names "Bug","Task","Story"
    - Test 4 (`mock_server_field_routes::test_v3_createmeta_bug_required_fields`): GET .../issuetypes/10001 (page 1) returns response containing fieldId "priority" with required:true AND fieldId "customfield_10006" with required:true and name "Severity"
    - Test 5 (`mock_server_field_routes::test_v3_createmeta_task_minimal_required`): GET .../issuetypes/10002 returns 'summary' as the only required:true field
    - Test 6 (`mock_server_field_routes::test_v3_createmeta_story_required`): GET .../issuetypes/10003 returns customfield_10001 (Story Points) with required:true
    - Test 7 (`mock_server_field_routes::test_v3_project_versions_diverge_from_v2`): GET /rest/api/3/project/MYPROJ/versions returns at least one version whose `id` is NOT equal to the corresponding source v2 version id (forces real lookup per D-12 divergence 2)
    - Test 8 (`mock_server_field_routes::test_v3_project_components`): GET /rest/api/3/project/MYPROJ/components returns 200 + non-empty array of component objects with `id` and `name`
    - Test 9 (`mock_server_field_routes::test_v3_cascading_select_shape`): in createmeta response for Bug or Story, the field customfield_10005 has schema.type == "option-with-child" and allowedValues is a non-empty array whose first item has a `children` array
    - Test 10 (`createmeta_pagination::test_bug_createmeta_paginates_two_pages`): paginated GET .../issuetypes/10001?startAt=0&maxResults=5 returns body with total==7 and exactly 5 fields. Second GET with startAt=5&maxResults=5 returns 2 fields. Combining both pages yields 7 unique fieldIds.
  </behavior>
  <action>
Create both test files. Use the existing `src-tauri/tests/mock_server.rs` test bootstrap pattern (read it first to copy the `std::sync::Once` + `std::thread::spawn(start_mock_servers)` initialization — it persists across per-test tokio runtimes). Reuse the `Authorization: Bearer test-pat` header used by existing mock server tests.

Concrete content of `src-tauri/tests/mock_server_field_routes.rs`:
- Add `use std::sync::Once;` and the same one-time mock-server boot helper used by `mock_server.rs` tests (copy verbatim or factor a shared helper if necessary, but do not introduce a new bootstrap pattern).
- Each test marked `#[tokio::test(flavor = "multi_thread")]` per existing convention.
- Use `reqwest::Client::new()` (NOT the audited middleware client) — these tests bypass the audit pipeline.
- Assertions use `serde_json::Value` access patterns already used in `mock_server.rs` tests: `body["fields"].as_array().unwrap().iter().any(|f| f["fieldId"] == "customfield_10001")`.

Concrete content of `src-tauri/tests/createmeta_pagination.rs`:
- Single integration test `test_bug_createmeta_paginates_two_pages`.
- After Wave 0 these tests MUST FAIL (the routes don't exist yet). Confirm by running `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test mock_server_field_routes` and observing failures matching "404", "connection refused", or assertion failures on missing fields.

Do NOT implement the routes or fixtures in this task. This task only writes the failing tests.
  </action>
  <verify>
    <automated>cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test mock_server_field_routes 2>&1 | tee /tmp/w0-routes.txt; cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test createmeta_pagination 2>&1 | tee /tmp/w0-pag.txt; grep -q FAILED /tmp/w0-routes.txt && grep -q FAILED /tmp/w0-pag.txt</automated>
  </verify>
  <acceptance_criteria>
    - File `src-tauri/tests/mock_server_field_routes.rs` exists
    - File `src-tauri/tests/createmeta_pagination.rs` exists
    - `grep -c '#\[tokio::test' src-tauri/tests/mock_server_field_routes.rs` returns at least 9 (9+ tests defined)
    - `grep -c '#\[tokio::test' src-tauri/tests/createmeta_pagination.rs` returns at least 1
    - File `mock_server_field_routes.rs` contains the literal strings `"customfield_10001"`, `"customfield_10005"`, `"customfield_10006"`, `"option-with-child"`, `"MYPROJ"`, `"10001"`, `"10002"`, `"10003"`
    - File `createmeta_pagination.rs` contains literal strings `"startAt=0&maxResults=5"`, `"startAt=5&maxResults=5"`, `"total"`, `"7"` (or assertion comparing field count to 7)
    - Running both test files via `cargo test --features mock-server` shows test failures (these are the RED state of the TDD cycle — Tasks 2 + 3 will turn them green)
  </acceptance_criteria>
  <done>Both test files committed, contain the test bodies above, and currently fail because the new mock routes do not yet exist.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend FixtureState and build_fixtures with custom-field, issue-type, createmeta, version, and component data</name>
  <files>src-tauri/src/fixtures.rs</files>
  <read_first>
    - src-tauri/src/fixtures.rs lines 1-250 (existing FixtureState, helpers v2_user/v3_user/priority, build_fixtures top)
    - src-tauri/src/fixtures.rs (full file — read top to bottom in one pass to understand build_fixtures)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md §"Createmeta Paginated Endpoint — Full Shape Reference" lines 560-749, §"Mock Fixture Choices" lines 800-833, §"v2 vs v3 Shape Divergence" lines 753-797
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-CONTEXT.md decisions D-09, D-10, D-11, D-12
  </read_first>
  <behavior>
    - FixtureState struct gains the 6 new fields listed in <interfaces>
    - build_fixtures() populates v2_fields with 6 custom + 8 system fields; v3_fields with same logical fields but v3 user shape
    - v3_createmeta_issuetypes has total:3 and 3 issueTypes (Bug 10001, Task 10002, Story 10003)
    - v3_createmeta_fields["10001"] has 7 fields total: summary (required:true system), priority (required:true), customfield_10006 Severity (required:true), assignee, customfield_10001 Story Points, customfield_10004 Team, customfield_10005 Department/Team — exactly to match Pitfall F pagination boundary (5 + 2)
    - v3_createmeta_fields["10002"] has fields where only `summary` is required:true
    - v3_createmeta_fields["10003"] has fields where customfield_10001 'Story Points' is required:true
    - v3_project_versions includes target version id "20010" (different from a v2 source id "10010") for "1.2.0"
    - v3_project_components has at least 2 component objects with id+name
  </behavior>
  <action>
**Step 1 — Extend `FixtureState`:**
Add the 6 new public fields exactly as shown in `<interfaces>` to `pub struct FixtureState`. Keep existing fields untouched.

**Step 2 — Add fixture-builder helpers ABOVE `build_fixtures`:**

```rust
fn createmeta_field(
    field_id: &str,
    name: &str,
    required: bool,
    schema: serde_json::Value,
    allowed_values: Option<serde_json::Value>,
) -> serde_json::Value {
    let mut field = json!({
        "fieldId": field_id,
        "key": field_id,
        "name": name,
        "required": required,
        "hasDefaultValue": false,
        "operations": ["set"],
        "schema": schema,
    });
    if let Some(av) = allowed_values {
        field["allowedValues"] = av;
    }
    field
}

fn global_field(id: &str, name: &str, custom: bool, schema: serde_json::Value) -> serde_json::Value {
    json!({
        "id": id,
        "name": name,
        "custom": custom,
        "orderable": true,
        "navigable": true,
        "searchable": !custom,
        "clauseNames": [id, name],
        "schema": schema,
    })
}
```

**Step 3 — Concrete fixture data inside `build_fixtures()` (append AFTER existing v2/v3 issue construction, BEFORE the final `Arc::new(Mutex::new(...))` return):**

```rust
// === Phase 17: field discovery fixtures ===

// Severity custom field allowed values (Bug-specific)
let severity_allowed = json!([
    { "id": "10300", "value": "Critical" },
    { "id": "10301", "value": "Major" },
    { "id": "10302", "value": "Minor" }
]);

// Team multi-select allowed values
let team_allowed = json!([
    { "id": "10100", "value": "Backend",  "disabled": false },
    { "id": "10101", "value": "Frontend", "disabled": false },
    { "id": "10102", "value": "Platform", "disabled": true }
]);

// Cascading-select Department/Team allowed values (D-10)
let dept_allowed = json!([
    { "id": "10200", "value": "Engineering", "children": [
        { "id": "10201", "value": "Backend" },
        { "id": "10202", "value": "Frontend" }
    ]},
    { "id": "10210", "value": "Product", "children": [
        { "id": "10211", "value": "Design" },
        { "id": "10212", "value": "Management" }
    ]}
]);

// Schemas reused across global field list AND createmeta entries
let sp_schema     = json!({ "type": "number", "custom": "com.atlassian.jira.plugin.system.customfieldtypes:float", "customId": 10001 });
let sprint_schema = json!({ "type": "array", "items": "string", "custom": "com.pyxis.greenhopper.jira:gh-sprint", "customId": 10002 });
let epic_schema   = json!({ "type": "string", "custom": "com.atlassian.jira.plugin.system.customfieldtypes:epic-link", "customId": 10003 });
let team_schema   = json!({ "type": "array", "items": "option", "custom": "com.atlassian.jira.plugin.system.customfieldtypes:multiselect", "customId": 10004 });
let dept_schema   = json!({ "type": "option-with-child", "custom": "com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect", "customId": 10005 });
let sev_schema    = json!({ "type": "option", "custom": "com.atlassian.jira.plugin.system.customfieldtypes:select", "customId": 10006 });

let summary_schema  = json!({ "type": "string",   "system": "summary" });
let assignee_schema = json!({ "type": "user",     "system": "assignee" });
let reporter_schema = json!({ "type": "user",     "system": "reporter" });
let priority_schema = json!({ "type": "priority", "system": "priority" });
let labels_schema   = json!({ "type": "array",    "items": "string", "system": "labels" });
let fixv_schema     = json!({ "type": "array",    "items": "version", "system": "fixVersions" });
let comp_schema     = json!({ "type": "array",    "items": "component", "system": "components" });
let desc_schema_v2  = json!({ "type": "string",   "system": "description" });

// Global field list — v2
let v2_fields = vec![
    global_field("summary",     "Summary",     false, summary_schema.clone()),
    global_field("description", "Description", false, desc_schema_v2.clone()),
    global_field("priority",    "Priority",    false, priority_schema.clone()),
    global_field("assignee",    "Assignee",    false, assignee_schema.clone()),
    global_field("reporter",    "Reporter",    false, reporter_schema.clone()),
    global_field("labels",      "Labels",      false, labels_schema.clone()),
    global_field("fixVersions", "Fix Versions",false, fixv_schema.clone()),
    global_field("components",  "Components",  false, comp_schema.clone()),
    global_field("customfield_10001", "Story Points",     true, sp_schema.clone()),
    global_field("customfield_10002", "Sprint",           true, sprint_schema.clone()),
    global_field("customfield_10003", "Epic Link",        true, epic_schema.clone()),
    global_field("customfield_10004", "Team",             true, team_schema.clone()),
    global_field("customfield_10005", "Department/Team",  true, dept_schema.clone()),
    global_field("customfield_10006", "Severity",         true, sev_schema.clone()),
];

// Global field list — v3 (same logical fields; differs ONLY where shape divergence applies)
let v3_fields = v2_fields.clone();

// Issue-type list (paginated wrapper, total:3)
let v3_createmeta_issuetypes = json!({
    "startAt": 0,
    "maxResults": 50,
    "total": 3,
    "issueTypes": [
        { "id": "10001", "name": "Bug",   "description": "A defect or problem", "iconUrl": "https://example.com/bug.png" },
        { "id": "10002", "name": "Task",  "description": "A task to do",        "iconUrl": "https://example.com/task.png" },
        { "id": "10003", "name": "Story", "description": "A user story",        "iconUrl": "https://example.com/story.png" }
    ]
});

let priority_allowed = json!([
    { "id": "1", "name": "Highest" },
    { "id": "2", "name": "High" },
    { "id": "3", "name": "Medium" },
    { "id": "4", "name": "Low" },
    { "id": "5", "name": "Lowest" }
]);

// Bug — 7 fields total (Pitfall F pagination boundary). Required: priority + Severity + summary
let bug_fields = vec![
    createmeta_field("summary",           "Summary",          true,  summary_schema.clone(),  None),
    createmeta_field("priority",          "Priority",         true,  priority_schema.clone(), Some(priority_allowed.clone())),
    createmeta_field("customfield_10006", "Severity",         true,  sev_schema.clone(),      Some(severity_allowed)),
    createmeta_field("assignee",          "Assignee",         false, assignee_schema.clone(), None),
    createmeta_field("customfield_10001", "Story Points",     false, sp_schema.clone(),       None),
    createmeta_field("customfield_10004", "Team",             false, team_schema.clone(),     Some(team_allowed.clone())),
    createmeta_field("customfield_10005", "Department/Team",  false, dept_schema.clone(),     Some(dept_allowed.clone())),
];

// Task — only summary required
let task_fields = vec![
    createmeta_field("summary",           "Summary",   true,  summary_schema.clone(),  None),
    createmeta_field("priority",          "Priority",  false, priority_schema.clone(), Some(priority_allowed.clone())),
    createmeta_field("assignee",          "Assignee",  false, assignee_schema.clone(), None),
    createmeta_field("customfield_10002", "Sprint",    false, sprint_schema.clone(),   None),
];

// Story — Story Points required
let story_fields = vec![
    createmeta_field("summary",           "Summary",        false, summary_schema.clone(),  None),
    createmeta_field("customfield_10001", "Story Points",   true,  sp_schema.clone(),       None),
    createmeta_field("priority",          "Priority",       false, priority_schema.clone(), Some(priority_allowed)),
    createmeta_field("customfield_10004", "Team",           false, team_schema.clone(),     Some(team_allowed)),
];

let mut v3_createmeta_fields: HashMap<String, Vec<serde_json::Value>> = HashMap::new();
v3_createmeta_fields.insert("10001".into(), bug_fields);
v3_createmeta_fields.insert("10002".into(), task_fields);
v3_createmeta_fields.insert("10003".into(), story_fields);

// D-12 divergence 2: target version IDs differ from v2 source version IDs
let v3_project_versions = vec![
    json!({ "id": "20010", "name": "1.2.0", "released": false, "archived": false }),
    json!({ "id": "20011", "name": "1.3.0", "released": false, "archived": false }),
];

let v3_project_components = vec![
    json!({ "id": "30001", "name": "API",      "description": "Backend API" }),
    json!({ "id": "30002", "name": "Frontend", "description": "Web UI" }),
];

// Plumb the new fields into the FixtureState constructor (find the existing FixtureState{...} init and append):
//     v2_fields,
//     v3_fields,
//     v3_createmeta_issuetypes,
//     v3_createmeta_fields,
//     v3_project_versions,
//     v3_project_components,
```

**Step 4 — Update FixtureState struct initialization where `build_fixtures()` constructs it.** Locate the existing `FixtureState { server_v2_issues: ..., cloud_v3_issues: ..., next_issue_id: ... }` literal at the bottom of `build_fixtures()` and append the new fields. Compile-check with `cargo check --features mock-server`.

Note on D-12 divergence 4: The v3 multi-select read shape (with `id` + `value`) versus write shape (`{value}` only) is enforced by Phase 18's transform pipeline; in Phase 17 the FIXTURES expose the read-shape via allowedValues — write-shape tests live in Phase 18.

Note on D-12 divergence 3 (priority): `priority` field allowedValues includes `{name, id}` shape (matching Atlassian docs). Strict v3 write-shape `{ "id": "X" }`-only enforcement is exercised by `mock_server.rs` v3 issue-create handler (already exists for current copy path) — Phase 17 does not need additional write-side route changes.
  </action>
  <verify>
    <automated>cargo check --manifest-path src-tauri/Cargo.toml --features mock-server</automated>
  </verify>
  <acceptance_criteria>
    - `cargo check --manifest-path src-tauri/Cargo.toml --features mock-server` exits 0
    - `grep -c 'pub v3_createmeta_fields' src-tauri/src/fixtures.rs` returns 1
    - `grep -c 'customfield_10001' src-tauri/src/fixtures.rs` returns at least 3 (schema + global field + createmeta entry)
    - `grep -c 'customfield_10005' src-tauri/src/fixtures.rs` returns at least 3
    - `grep -c 'customfield_10006' src-tauri/src/fixtures.rs` returns at least 2
    - `grep -c 'option-with-child' src-tauri/src/fixtures.rs` returns at least 1
    - `grep -c '"20010"' src-tauri/src/fixtures.rs` returns at least 1 (v3 version id divergence)
    - `grep -c 'fn createmeta_field' src-tauri/src/fixtures.rs` returns 1
    - `grep -c 'v3_createmeta_issuetypes' src-tauri/src/fixtures.rs` returns at least 2 (struct field + initializer)
  </acceptance_criteria>
  <done>FixtureState extended with all 6 new fields, build_fixtures populates them per D-09/D-10/D-11/D-12, project compiles with mock-server feature.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Register v2 + v3 mock routes for /field, paginated createmeta, /project/{key}/versions, /project/{key}/components</name>
  <files>src-tauri/src/mock_server.rs</files>
  <read_first>
    - src-tauri/src/mock_server.rs (full file — focus lines 1-100 for imports, 700-861 for v2/v3 modules and router builders)
    - src-tauri/src/fixtures.rs (after Task 2 — confirm new field shapes)
    - .planning/phases/17-field-discovery-mock-schema-fidelity/17-RESEARCH.md §"Pattern 6: Mock server route registration"
  </read_first>
  <behavior>
    - GET /rest/api/2/field returns the v2_fields vec from fixtures
    - GET /rest/api/3/field returns the v3_fields vec from fixtures
    - GET /rest/api/3/issue/createmeta/{key}/issuetypes returns the issuetype list (paginated wrapper); ignores `key` content (mock always returns the configured fixture)
    - GET /rest/api/3/issue/createmeta/{key}/issuetypes/{id} returns paginated `{ startAt, maxResults, total, fields: [...] }` with maxResults clamping (default 50; honored when client passes ?maxResults=5)
    - For id=10001 (Bug) requested with maxResults=5, page 1 returns first 5 fields, page 2 (startAt=5) returns 2 fields, total field count is 7
    - GET /rest/api/3/project/{key}/versions returns v3_project_versions
    - GET /rest/api/3/project/{key}/components returns v3_project_components
    - All Wave 0 tests in `mock_server_field_routes.rs` and `createmeta_pagination.rs` pass
  </behavior>
  <action>
**Step 1 — Add new handler functions inside `mod v2 { ... }`:**

```rust
pub async fn get_fields(State(fixtures): State<SharedFixtures>) -> impl IntoResponse {
    let state = fixtures.lock().unwrap();
    Json(state.v2_fields.clone())
}
```

**Step 2 — Add new handler functions inside `mod v3 { ... }`:**

```rust
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CreametaPageQuery {
    #[serde(default)]
    pub start_at: Option<u64>,
    #[serde(default)]
    pub max_results: Option<u64>,
}

pub async fn get_fields(State(fixtures): State<SharedFixtures>) -> impl IntoResponse {
    let state = fixtures.lock().unwrap();
    Json(state.v3_fields.clone())
}

pub async fn get_createmeta_issuetypes(
    State(fixtures): State<SharedFixtures>,
    Path(_project_key): Path<String>,
) -> impl IntoResponse {
    let state = fixtures.lock().unwrap();
    Json(state.v3_createmeta_issuetypes.clone())
}

pub async fn get_createmeta_fields(
    State(fixtures): State<SharedFixtures>,
    Path((_project_key, issuetype_id)): Path<(String, String)>,
    Query(params): Query<CreametaPageQuery>,
) -> impl IntoResponse {
    let state = fixtures.lock().unwrap();
    let all = state
        .v3_createmeta_fields
        .get(&issuetype_id)
        .cloned()
        .unwrap_or_default();
    let total = all.len() as u64;
    let start_at = params.start_at.unwrap_or(0);
    let max_results = params.max_results.unwrap_or(50);
    let start_idx = std::cmp::min(start_at as usize, all.len());
    let end_idx = std::cmp::min(start_idx + max_results as usize, all.len());
    let page = all[start_idx..end_idx].to_vec();
    Json(json!({
        "startAt": start_at,
        "maxResults": max_results,
        "total": total,
        "fields": page,
    }))
}

pub async fn get_project_versions(
    State(fixtures): State<SharedFixtures>,
    Path(_project_key): Path<String>,
) -> impl IntoResponse {
    let state = fixtures.lock().unwrap();
    Json(state.v3_project_versions.clone())
}

pub async fn get_project_components(
    State(fixtures): State<SharedFixtures>,
    Path(_project_key): Path<String>,
) -> impl IntoResponse {
    let state = fixtures.lock().unwrap();
    Json(state.v3_project_components.clone())
}
```

**Imports to add at the top of `mock_server.rs` if not already present:** `use axum::extract::Query;`. Path/State/Json already in use.

**Step 3 — Register routes in `build_v2_router` (insert BEFORE `.layer(middleware::from_fn(require_auth))`):**

```rust
.route("/rest/api/2/field", get(v2::get_fields))
```

**Step 4 — Register routes in `build_v3_router` (insert BEFORE `.layer(...)`):**

```rust
.route("/rest/api/3/field", get(v3::get_fields))
.route(
    "/rest/api/3/issue/createmeta/{key}/issuetypes",
    get(v3::get_createmeta_issuetypes),
)
.route(
    "/rest/api/3/issue/createmeta/{key}/issuetypes/{id}",
    get(v3::get_createmeta_fields),
)
.route(
    "/rest/api/3/project/{key}/versions",
    get(v3::get_project_versions),
)
.route(
    "/rest/api/3/project/{key}/components",
    get(v3::get_project_components),
)
```

Use `{key}` and `{id}` axum 0.8 path-param syntax (matches existing routes like `/rest/api/2/issue/{key}` at line 807).

**Step 5 — Verify all Wave 0 tests now pass.** Run the integration test files. Adjust handler order or mutex-lock duration only if a borrow-checker / test failure appears.
  </action>
  <verify>
    <automated>cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test mock_server_field_routes && cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test createmeta_pagination</automated>
  </verify>
  <acceptance_criteria>
    - Both test files exit with `test result: ok` (zero failures)
    - `grep -c 'get(v3::get_createmeta_fields)' src-tauri/src/mock_server.rs` returns 1
    - `grep -c 'get(v2::get_fields)' src-tauri/src/mock_server.rs` returns 1
    - `grep -c 'pub async fn get_createmeta_fields' src-tauri/src/mock_server.rs` returns 1
    - `grep -c 'pub async fn get_createmeta_issuetypes' src-tauri/src/mock_server.rs` returns 1
    - `grep -c '/rest/api/3/project/.key./versions' src-tauri/src/mock_server.rs` returns 1
    - `cargo clippy --manifest-path src-tauri/Cargo.toml --features mock-server -- -D warnings` exits 0
  </acceptance_criteria>
  <done>All 6 new mock routes registered and Wave 0 tests pass; pagination boundary case (Bug createmeta total=7, maxResults=5) verified.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Test client → mock server | Untrusted Path/Query input crosses here (project_key, issuetype_id, startAt, maxResults) |
| Fixture data → JSON serialization | All fixture values are app-controlled constants; no user input flows in |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-01-A | Tampering | `get_createmeta_fields` Path<(String, String)> | mitigate | issuetype_id used only as `HashMap` key lookup — `.get()` returns `None` for unknown keys; never used in `format!` to a filesystem path or shell command |
| T-17-01-B | Information Disclosure | mock-server feature flag | accept | mock_server module is gated by `#[cfg(feature="mock-server")]` and compiled out of release builds (decision recorded in STATE.md `[01-01]`); release artifacts cannot expose mock data |
| T-17-02-mock | Denial of Service | `get_createmeta_fields` pagination | mitigate | `max_results` clamped via `std::cmp::min(start_idx + max_results as usize, all.len())` — no possibility of out-of-bounds slice; oversize `max_results` is harmless because total fixture size is small (≤7 fields) |
| T-17-04 | Spoofing | All new routes inherit `require_auth` middleware (router `.layer(middleware::from_fn(require_auth))`) | mitigate | Existing middleware enforces Bearer token presence; new routes registered BEFORE `.layer(...)` per pattern, so middleware applies |
</threat_model>

<verification>
- `cargo check --manifest-path src-tauri/Cargo.toml --features mock-server` passes
- `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test mock_server_field_routes` passes (all 9+ tests)
- `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server --test createmeta_pagination` passes
- `cargo clippy --manifest-path src-tauri/Cargo.toml --features mock-server -- -D warnings` passes
- All existing tests (mock_server.rs, audit.rs, etc.) still pass: `cargo test --manifest-path src-tauri/Cargo.toml --features mock-server`
</verification>

<success_criteria>
- 6 custom field fixtures present (D-09, D-10, D-11)
- 3 issue types with distinct required-field sets present (D-11)
- All 4 v2/v3 shape divergences exercised by mock fixtures (D-12)
- Pagination boundary case for Bug createmeta (total=7, maxResults=5) verifiable from integration test
- v2 + v3 routes for /field, paginated createmeta (issue-types + per-id fields), versions, components all serve fixture data behind require_auth middleware
</success_criteria>

<output>
After completion, create `.planning/phases/17-field-discovery-mock-schema-fidelity/17-01-SUMMARY.md`
</output>
