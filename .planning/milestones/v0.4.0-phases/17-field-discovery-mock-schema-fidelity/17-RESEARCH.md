# Phase 17: Field Discovery + Mock Schema Fidelity - Research

**Researched:** 2026-04-27
**Domain:** Jira REST API field discovery (v2 + v3 createmeta/field endpoints), Rust serde discriminated unions, SQLite schema design, Tauri app-launch lifecycle, mock server fixture design
**Confidence:** HIGH — codebase directly inspected; Atlassian API structure verified via official docs and community references; all patterns have direct code precedent in the project

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01**: Pre-warm at app launch — background fetch fires immediately after the connection-time createmeta probe succeeds
- **D-02**: Session-bound + manual refresh — cache lives until app exit OR manual Refresh (Phase 21, DISC-05). No TTL.
- **D-03**: Cache miss inside Copy Preview → fetch synchronously, show skeleton on target-fields panel
- **D-04**: Store SHA-256 schema hash per (project, issuetype) row in `field_schema_cache`
- **D-05**: Soft warning banner — app launches normally, banner "Required-field detection unavailable on Cloud target." Triage stays usable.
- **D-06**: NO legacy `/createmeta?expand=projects.issuetypes.fields` fallback — paginated endpoint only
- **D-07**: Specific error message with exact endpoint URL + HTTP status code + one-line cause hint
- **D-08**: Failure surfaces in two places — app-shell banner AND red status pill on Cloud connection row in Settings → Connections
- **D-09**: `customfield_10001 "Story Points"`, `customfield_10002 "Sprint"`, `customfield_10003 "Epic Link"`, `customfield_10004 "Team"`
- **D-10**: 5th custom field `customfield_10005 "Department/Team"` cascading select
- **D-11**: 3 mock issue types (Bug, Task, Story); Bug requires `priority + Severity`, Task requires `summary` only, Story requires `Story Points`
- **D-12**: Mock reflects all 4 v2/v3 shape divergences: user identity, versions/components, priority object, custom-field read/write asymmetry
- **D-13**: Cache key = `(side, project_key, issuetype_id)` where `side ∈ {'source', 'target'}`
- **D-14**: Source v2 = global `/rest/api/2/field` only, no per-issuetype fetch
- **D-15**: Target v3 = lazy fetch on issue-type selection in Copy Preview
- **D-16**: Issue-type change inside open Copy Preview → sync fetch + skeleton, Copy button disabled during fetch

### Claude's Discretion
- Exact pagination page-size for createmeta (default 50)
- Tauri command surface naming
- Error retry/backoff policy for transient network failures during pre-warm
- Exact serde tag names for `FieldSchema` enum discriminant values
- Skeleton UI animation/layout details
- Whether pre-warm runs in `tauri::async_runtime::spawn` vs existing tokio runtime used by `poll_engine`

### Deferred Ideas (OUT OF SCOPE)
- TTL-based cache invalidation
- Eager pre-fetch of all target issue types
- Per-field schema hash (vs per-(project, issuetype) hash)
- Legacy `/createmeta?expand=...` fallback
- Customer-specific mock fixtures
- Auto-refresh on mapping-editor open
- Schema discovery for non-configured projects
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-01 | User can fetch field schemas from source Jira Server v2 including custom fields with type detection | §Standard Stack: v2 `/rest/api/2/field` endpoint shape; §Rust FieldSchema Pattern; §Field Discovery module design |
| DISC-02 | User can fetch field schemas from target Jira Cloud v3 including custom fields with type detection | §Createmeta v3 Endpoint Shape; §Rust FieldSchema Pattern; §FieldSchema serde tag values |
| DISC-03 | System fetches target required-field metadata per (project, issue type) via paginated `createmeta/{key}/issuetypes/{id}` | §Createmeta Paginated Endpoint; §Pagination Loop Pattern; §Connection-time probe |
| DISC-04 | Mock Jira server exposes realistic field schemas including ≥4 custom fields covering renderer registry | §Mock Fixture Choices; §v2/v3 Shape Divergence; §Mock Routes |
</phase_requirements>

---

## Summary

Phase 17 builds the foundation that every other v0.4.0 phase consumes: a typed Rust `FieldSchema` struct (serde-discriminated), two discovery commands (source v2 global `/field`, target v3 paginated `/createmeta`), a new `mapping.db` SQLite file with `field_schema_cache` table and SHA-256 hash column, a connection-time probe that fires at app launch and exposes failures in two UI locations, and mock server extensions exercising all 4 documented v2/v3 shape divergences plus 5 custom field types.

The highest-risk implementation decision in Phase 17 is correctly modeling the polymorphic Jira `schema` object in Rust. The `schema.type` field is the primary discriminant, but custom fields need `schema.custom` (the full plugin URI) as a secondary discriminant to distinguish e.g. a cascade-select (`option-with-child`) from a plain select (`option`). The second risk area is pagination: the v3 `createmeta/{key}/issuetypes/{id}` endpoint returns fields in pages (default `maxResults=50`, response includes `startAt`/`maxResults`/`total`), and the loop must drain all pages before caching.

The pre-warm/lazy reconciliation (D-01 vs D-15) is resolved as: pre-warm = fetch the issue-type list for the configured target project (lightweight `GET /createmeta/{key}/issuetypes`), NOT the per-issuetype field schema. Field schemas are fetched lazily on issue-type selection (D-15), but the type list is ready so the type chooser renders immediately.

**Primary recommendation:** Implement `field_discovery.rs` as a thin HTTP module (follows `jira_client.rs` + `commands.rs` pattern), `field_mapping_db.rs` as a clone of `snapshot_db.rs`'s struct/lifecycle pattern, and extend `mock_server.rs` by adding routes at the bottom of `build_v2_router` and `build_v3_router` exactly as existing user-search routes are registered.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| v2 `/field` fetch + parse | API / Backend (`field_discovery.rs`) | Database (`mapping.db`) | HTTP call requires credentials from keychain; cache write is synchronous after successful fetch |
| v3 createmeta paginated fetch | API / Backend (`field_discovery.rs`) | Database (`mapping.db`) | Multi-page HTTP loop; credentials from triage_db; result cached in field_schema_cache |
| Schema hash computation | API / Backend (Rust, `sha2` crate — already in Cargo.toml) | — | Pure Rust computation on response JSON bytes; no frontend involvement |
| Connection-time probe | API / Backend (new Tauri command, extends app-launch flow) | Frontend (banner + status pill) | HTTP request belongs in Rust; failure state surfaced via Zustand store |
| Pre-warm issue-type list | API / Backend (`tauri::async_runtime::spawn`) | — | Background task, no UI involvement; fires after probe success |
| Lazy per-issuetype schema fetch | API / Backend (on Tauri command call from frontend) | Frontend (skeleton state) | Frontend triggers on issue-type selection; skeleton rendered while Rust fetches |
| `mapping.db` lifecycle | API / Backend (`field_mapping_db.rs`, opened in `main.rs`) | — | Same as `snapshot_db.rs` pattern: open on startup, `Arc<Mutex<>>`, closed on app exit |
| Mock field schema routes | Mock Server (`mock_server.rs`, `fixtures.rs`) | — | New axum routes registered on existing v2/v3 routers |
| Probe failure banner | Frontend (Zustand store + React component) | — | Per-session-dismissable banner reuses Phase 16 privacy-mode banner pattern |
| Settings status pill | Frontend (Settings → Connections, existing `ConnectionCard` component) | — | Adds a status pill data point to existing connection row |

---

## Standard Stack

### Core (all already in Cargo.toml — no new deps for Phase 17)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `rusqlite` | 0.39 (bundled) | `field_schema_cache` table in `mapping.db` | Established pattern: `snapshot_db.rs`, `triage_db.rs`, `audit_db.rs` all use it [VERIFIED: Cargo.toml] |
| `serde` + `serde_json` | 1.x | Deserializing API responses into `FieldSchema` structs | Whole codebase uses it [VERIFIED: Cargo.toml] |
| `sha2` | 0.10 | SHA-256 hash for D-04 schema drift detection | Already a dep (used in `snapshot_db.rs` for `compute_hash`) [VERIFIED: Cargo.toml] |
| `hex` | 0.4 | Encode SHA-256 bytes to hex string | Already a dep [VERIFIED: Cargo.toml] |
| `reqwest` + `reqwest-middleware` | 0.13 / 0.5 | Audited HTTP calls for field discovery | All Jira HTTP calls use this; new calls inherit audit middleware for free [VERIFIED: Cargo.toml] |
| `tokio` | 1.x (`full` features) | `async_runtime::spawn` for pre-warm background task | Already the async runtime [VERIFIED: Cargo.toml] |
| `chrono` | 0.4 | `cached_at` timestamps in `field_schema_cache` | Used in `snapshot_db.rs` for timestamps [VERIFIED: Cargo.toml] |
| `axum` | 0.8 | New mock routes on existing v2/v3 routers | Mock server already built on axum [VERIFIED: Cargo.toml] |
| `base64` | 0.22 | Cloud Basic auth header construction | Used in `search_jira_users_by_domain` already [VERIFIED: Cargo.toml] |
| `urlencoding` | 2 | URL-encode project key / issue-type ID in path segments | Used in existing commands [VERIFIED: Cargo.toml] |

### Frontend (no new npm deps needed for Phase 17)

Phase 17 is primarily a Rust backend + mock server phase. The frontend surface is minimal:
- A Zustand store slice for probe status (banner + status pill state) — no new libraries needed
- The banner pattern is copied from the Phase 16 privacy-mode banner (already exists in codebase)
- No new React components are shipped in Phase 17 (the Copy Preview skeleton is set up here but the actual form comes in Phase 22)

[VERIFIED: package.json — existing Zustand 5.x, existing shadcn/Radix primitives cover all Phase 17 frontend needs]

### No New Dependencies Required

Phase 17 adds zero new Cargo or npm dependencies. All required primitives are already present.

---

## Architecture Patterns

### System Architecture Diagram

```
App Launch
    │
    ├── main.rs: open mapping.db (new, mirrors snapshot_db.rs pattern)
    │   └── FieldMappingDb::open(path) → Arc<Mutex<FieldMappingDb>>
    │
    ├── app.manage(Arc<Mutex<FieldMappingDb>>) [new managed state]
    │
    └── #[cfg(feature="mock-server")]: start_mock_servers
           └── now includes: GET /field (v2+v3), GET /createmeta/... (v3)

Frontend startup
    │
    └── connectionStore.checkConnections() [existing]
           │
           ├── test_jira_cloud_connection [existing command]
           │
           └── probe_createmeta [NEW command]
                  │
                  ├── 200 + valid JSON → probeStatus = "ok"
                  │   └── tauri::async_runtime::spawn(prewarm_issuetype_list)
                  │           └── GET /createmeta/{targetProject}/issuetypes
                  │               └── mapping.db: cache issuetype list
                  │
                  └── non-200 / network error → probeStatus = "failed"
                       ├── banner: "Required-field detection unavailable"
                       └── Settings → Connections: red pill on Cloud row

Copy Preview (issue-type selection, D-15/D-16)
    │
    └── get_target_field_schema_for_issuetype(projectKey, issueTypeId) [NEW command]
           │
           ├── cache hit → return immediately
           │
           └── cache miss → paginated loop:
                   GET /createmeta/{key}/issuetypes/{id}?startAt=0&maxResults=50
                       → store page, check total, loop until startAt+len >= total
                   → compute SHA-256 hash of raw response JSON
                   → INSERT INTO field_schema_cache (..., schema_hash=hex_hash)
                   → return FieldSchema[]

Source field discovery (DISC-01, D-14)
    └── discover_source_fields [NEW command]
           └── GET /rest/api/2/field
               → INSERT INTO field_schema_cache (side='source', project_key=NULL, issuetype_id=NULL, ...)
               → return FieldSchema[]
```

### Recommended Project Structure (Phase 17 additions)

```
src-tauri/src/
├── field_discovery.rs          # NEW — HTTP + parsing; Tauri commands
├── field_mapping_db.rs         # NEW — mapping.db SQLite; open/CRUD methods
├── lib.rs                      # MODIFIED — add pub mod declarations
├── main.rs                     # MODIFIED — open mapping.db + probe_createmeta on launch
├── commands.rs                 # MODIFIED — register new commands
├── mock_server.rs              # MODIFIED — add 6 new routes at bottom of v2/v3 routers
└── fixtures.rs                 # MODIFIED — add custom field + createmeta fixture data

src/features/
├── connections/
│   ├── connectionStore.ts      # MODIFIED — add probeStatus field + actions
│   ├── SettingsPage.tsx        # MODIFIED — add red pill on Cloud connection row (D-08)
│   └── ConnectionCard.tsx      # MODIFIED — consume probeStatus for pill
└── (no new feature dir in Phase 17 — mapping/ is Phase 19+)
```

### Pattern 1: `mapping.db` file lifecycle (mirrors `snapshot_db.rs`)

**What:** `FieldMappingDb` wraps a `rusqlite::Connection`, opened in `main.rs`'s setup closure, wrapped in `Arc<Mutex<>>`, managed via `app.manage()`. Migration is `CREATE TABLE IF NOT EXISTS ...` + `ALTER TABLE ... ADD COLUMN ... .ok()` for future columns.

**When to use:** Phase 17 creates the file + `field_schema_cache` table. Phase 19 extends it with `field_mapping` + `mapping_meta` tables by adding `CREATE TABLE IF NOT EXISTS` blocks in the same `FieldMappingDb::open()` function.

**Example (Phase 17 only):**
```rust
// src-tauri/src/field_mapping_db.rs
use rusqlite::Connection;
use crate::error::AppResult;

const CREATE_FIELD_SCHEMA_CACHE: &str = "
    CREATE TABLE IF NOT EXISTS field_schema_cache (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        side            TEXT NOT NULL CHECK(side IN ('source','target')),
        project_key     TEXT,
        issuetype_id    TEXT,
        field_id        TEXT NOT NULL,
        field_name      TEXT NOT NULL,
        schema_json     TEXT NOT NULL,
        required        INTEGER NOT NULL DEFAULT 0,
        allowed_values_json TEXT,
        schema_hash     TEXT,           -- SHA-256 of raw per-(side,project,issuetype) response
        cached_at       TEXT NOT NULL,
        UNIQUE(side, project_key, issuetype_id, field_id)
    )
";
const CREATE_INDEX: &str =
    "CREATE INDEX IF NOT EXISTS idx_fsc_scope ON field_schema_cache(side, project_key, issuetype_id)";

pub struct FieldMappingDb {
    conn: Connection,
}

impl FieldMappingDb {
    pub fn open(path: &std::path::Path) -> AppResult<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(CREATE_FIELD_SCHEMA_CACHE)?;
        conn.execute_batch(CREATE_INDEX)?;
        // Phase 19 will add field_mapping + mapping_meta here via
        // additional CREATE TABLE IF NOT EXISTS + .ok() ALTER TABLE blocks
        Ok(Self { conn })
    }

    pub fn open_in_memory() -> AppResult<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(CREATE_FIELD_SCHEMA_CACHE)?;
        conn.execute_batch(CREATE_INDEX)?;
        Ok(Self { conn })
    }
}
```

**main.rs addition:**
```rust
// After existing snapshot_db block in setup() closure
let mapping_db_path = app_dir.join("mapping.db");
let mapping_db = FieldMappingDb::open(&mapping_db_path)
    .expect("Failed to open mapping database");
app.manage(Arc::new(Mutex::new(mapping_db)));
```
[VERIFIED: pattern from `src-tauri/src/main.rs` lines 130–138 (snapshot_db block)]

### Pattern 2: Paginated createmeta loop

**What:** The v3 `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}` endpoint returns a paginated response with `{ startAt, maxResults, total, fields: [...] }`. The loop must continue until `startAt + page_len >= total`.

**Response shape (verified):**
```json
{
  "startAt": 0,
  "maxResults": 50,
  "total": 67,
  "fields": [
    {
      "fieldId": "summary",
      "key": "summary",
      "name": "Summary",
      "required": true,
      "hasDefaultValue": false,
      "operations": ["set"],
      "schema": {
        "type": "string",
        "system": "summary"
      }
    },
    {
      "fieldId": "customfield_10001",
      "key": "customfield_10001",
      "name": "Story Points",
      "required": false,
      "hasDefaultValue": false,
      "operations": ["set"],
      "schema": {
        "type": "number",
        "custom": "com.atlassian.jira.plugin.system.customfieldtypes:float",
        "customId": 10001
      }
    }
  ]
}
```

[CITED: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/ — paginated response shape confirmed; field structure confirmed via community thread and server v2 docs]

**Rust loop pattern:**
```rust
// src-tauri/src/field_discovery.rs
async fn fetch_all_createmeta_fields(
    client: &ClientWithMiddleware,
    base_url: &str,
    auth: &str,
    project_key: &str,
    issuetype_id: &str,
) -> AppResult<Vec<serde_json::Value>> {
    let mut all_fields: Vec<serde_json::Value> = Vec::new();
    let mut start_at: u64 = 0;
    const PAGE_SIZE: u64 = 50;

    loop {
        let url = format!(
            "{base_url}/rest/api/3/issue/createmeta/{project_key}/issuetypes/{issuetype_id}?startAt={start_at}&maxResults={PAGE_SIZE}"
        );
        let resp = client.get(&url).header("Authorization", auth).send().await
            .map_err(|_| AppError::Http("createmeta fetch failed".into()))?;

        if !resp.status().is_success() {
            return Err(AppError::Http(format!(
                "GET {} returned {}. Your proxy may not expose the paginated createmeta endpoint.",
                url, resp.status().as_u16()
            )));
        }

        let body: serde_json::Value = resp.json().await
            .map_err(|_| AppError::Http("createmeta parse failed".into()))?;

        let fields = body["fields"].as_array().cloned().unwrap_or_default();
        let total = body["total"].as_u64().unwrap_or(0);
        let page_len = fields.len() as u64;

        all_fields.extend(fields);

        if page_len == 0 || all_fields.len() as u64 >= total { break; }
        start_at += PAGE_SIZE;
    }

    Ok(all_fields)
}
```
[VERIFIED: mirrors `jira_client.rs::search_tickets` pagination pattern, lines 55–103]

### Pattern 3: Rust `FieldSchema` serde discriminated union

**What:** Jira's `schema` object is polymorphic. The `type` field is the primary discriminant; for custom fields, `custom` (the plugin URI suffix) is a secondary discriminant used by Phase 18's transform pipeline to determine read/write shape.

**Serde tag values to use:**

| Jira `schema.type` | Rust variant name | Notes |
|-------------------|------------------|-------|
| `"string"` | `String` | system fields: summary, description, URL |
| `"number"` | `Number` | Story Points, numeric custom fields |
| `"date"` | `Date` | Due date, date custom fields (`YYYY-MM-DD`) |
| `"datetime"` | `Datetime` | Datetime custom fields (ISO 8601) |
| `"user"` | `User` | assignee, reporter, single user picker |
| `"array"` | `Array { items: ArrayItems }` | multi-select, versions, components, labels, multi-user |
| `"option"` | `Option_` | single-select, priority, radio (use `Option_` to avoid Rust keyword clash) |
| `"option-with-child"` | `OptionWithChild` | cascading select (D-10) |
| `"issuetype"` | `IssueType` | issue type field |
| `"any"` | `Any` | fallback for unrecognized types |

**`ArrayItems` enum values:** `"option"` → `Option_`, `"string"` → `String`, `"user"` → `User`, `"component"` → `Component`, `"version"` → `Version`, `"group"` → `Group`

**Recommended struct:**
```rust
// src-tauri/src/field_discovery.rs (or dedicated jira_field_schema.rs)
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum FieldSchemaType {
    String {
        system: Option<String>,
        custom: Option<String>,
        #[serde(rename = "customId")]
        custom_id: Option<u64>,
    },
    Number {
        custom: Option<String>,
        #[serde(rename = "customId")]
        custom_id: Option<u64>,
    },
    Date {
        custom: Option<String>,
        #[serde(rename = "customId")]
        custom_id: Option<u64>,
    },
    Datetime {
        custom: Option<String>,
        #[serde(rename = "customId")]
        custom_id: Option<u64>,
    },
    User {
        system: Option<String>,
        custom: Option<String>,
        #[serde(rename = "customId")]
        custom_id: Option<u64>,
    },
    Array {
        items: String,   // "option" | "string" | "user" | "component" | "version" | "group"
        custom: Option<String>,
        #[serde(rename = "customId")]
        custom_id: Option<u64>,
    },
    // serde(rename) needed: Rust enum variant "Option_" must serialize as "option"
    #[serde(rename = "option")]
    Option_ {
        custom: Option<String>,
        #[serde(rename = "customId")]
        custom_id: Option<u64>,
    },
    #[serde(rename = "option-with-child")]
    OptionWithChild {
        custom: Option<String>,
        #[serde(rename = "customId")]
        custom_id: Option<u64>,
    },
    Issuetype,
    Priority,
    // Catch-all for any future Atlassian type not yet handled
    #[serde(other)]
    Any,
}

// The complete FieldSchema struct (one per field in the API response)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldSchema {
    pub field_id: String,         // "summary" | "customfield_10001"
    pub name: String,             // Human-readable display name
    pub required: bool,
    pub has_default_value: Option<bool>,
    pub schema: FieldSchemaType,
    pub allowed_values: Option<Vec<serde_json::Value>>,
    pub operations: Option<Vec<String>>,
}
```
[VERIFIED: serde `#[serde(tag = "type")]` used in `fixtures.rs::JiraStatus`, `JiraPriority` — consistent with project pattern. `#[serde(other)]` for catch-all is standard Rust/serde pattern. `rename_all = "kebab-case"` handles `option-with-child` variant cleanly.]

**Note on `Priority` variant:** The Jira `priority` system field has `schema: { "type": "priority", "system": "priority" }` — not "option". Include a dedicated `Priority` variant to avoid it falling into `Any`.

### Pattern 4: TypeScript discriminated union mirroring

**What:** Hand-written TypeScript union in `src/features/mapping/fields/types.ts` (Phase 19+ uses it; Phase 17 defines the shape). No codegen.

**Example:**
```typescript
// src/features/mapping/fields/types.ts (NEW in Phase 17 — shape definition only)
export type FieldSchemaType =
  | { type: 'string'; system?: string; custom?: string; customId?: number }
  | { type: 'number'; custom?: string; customId?: number }
  | { type: 'date'; custom?: string; customId?: number }
  | { type: 'datetime'; custom?: string; customId?: number }
  | { type: 'user'; system?: string; custom?: string; customId?: number }
  | { type: 'array'; items: 'option' | 'string' | 'user' | 'component' | 'version' | 'group'; custom?: string; customId?: number }
  | { type: 'option'; custom?: string; customId?: number }
  | { type: 'option-with-child'; custom?: string; customId?: number }
  | { type: 'issuetype' }
  | { type: 'priority' }
  | { type: 'any' }; // fallback for unrecognized

export interface FieldSchema {
  fieldId: string;
  name: string;
  required: boolean;
  hasDefaultValue?: boolean;
  schema: FieldSchemaType;
  allowedValues?: unknown[];
  operations?: string[];
}

// Side discriminant for the cache key (mirrors Rust 'source' | 'target')
export type FieldSide = 'source' | 'target';
```
[ASSUMED — TypeScript shape based on Rust struct mirror and codebase conventions. No runtime verification in this session.]

### Pattern 5: Connection-time probe + pre-warm wiring

**What:** A new `probe_createmeta` Tauri command is called from the frontend after a successful Cloud connection test. It performs a GET to the paginated issuetypes endpoint for the configured target project. Result (pass/fail) is stored in a Zustand store slice and consumed by two UI locations (D-05/D-08).

**Where it hooks in (verified from code inspection):**

`fetch_cloud_meta` (commands.rs lines 141–244) is called from the frontend's `connectionStore` during setup and on Settings save. The probe chains after `test_jira_cloud_connection` (lines 575–629) or is called as a separate command immediately after connection success.

**Exact hook:** The frontend calls `probe_createmeta` as part of the app-launch connection validation sequence, after `fetch_cloud_meta` succeeds. On probe success, it calls `prewarm_issuetype_list` in a `tauri::async_runtime::spawn` background task (per Claude's Discretion on runtime choice — `tauri::async_runtime::spawn` is the standard pattern in `main.rs` for background tasks, consistent with `poll_engine` spawn at line 165).

**Pre-warm scope (D-01 + D-15 reconciliation):**
- Pre-warm = fetch the **issue-type list** only: `GET /rest/api/3/issue/createmeta/{targetProjectKey}/issuetypes`
- Cache result in `field_schema_cache` with `issuetype_id = NULL` and a special `field_id = '__issuetypes__'` sentinel OR as a separate lightweight table (see Open Question 1)
- This ensures the issue-type chooser in Copy Preview renders immediately without a loading state
- Per-issuetype field schemas are NOT pre-fetched — D-15 says lazy; pre-warm only provides the list so the type chooser is ready

**Probe definition:**
- Request: `GET /rest/api/3/issue/createmeta/{configured_target_project_key}/issuetypes`
- Pass: HTTP 200 + response body contains `issueTypes` key (or `values` key depending on paginated wrapper)
- Fail: any non-200 HTTP status, network error, missing required JSON key
- On fail: emit `ProbeStatus::Failed { endpoint_url, status_code, hint }` struct to Zustand store

**D-07 error message format:**
```
GET /rest/api/3/issue/createmeta/MYPROJ/issuetypes returned 404.
Your proxy may not expose the paginated createmeta endpoint.
```

### Pattern 6: Mock server route registration

**What:** New routes are added at the bottom of `build_v2_router` and `build_v3_router` in `mock_server.rs`, exactly like the existing `search_users` route registration at line 858.

**v2 router additions** (after line 824, before `.layer(...)`):
```rust
.route("/rest/api/2/field", get(v2::get_fields))
.route("/rest/api/2/issue/createmeta", get(v2::get_createmeta_legacy))
// Note: v2 legacy createmeta is present for mock completeness but will return a helpful
// "use v3 paginated endpoint" response if the frontend accidentally calls it (D-06 enforcement)
```

**v3 router additions** (after line 858, before `.layer(...)`):
```rust
.route("/rest/api/3/field", get(v3::get_fields))
.route(
    "/rest/api/3/issue/createmeta/:project_key/issuetypes",
    get(v3::get_createmeta_issuetypes),
)
.route(
    "/rest/api/3/issue/createmeta/:project_key/issuetypes/:issuetype_id",
    get(v3::get_createmeta_fields),
)
.route("/rest/api/3/project/:project_key/versions", get(v3::get_project_versions))
.route("/rest/api/3/project/:project_key/components", get(v3::get_project_components))
```
[VERIFIED: mock_server.rs lines 800–861 for exact route registration syntax]

### Anti-Patterns to Avoid

- **Single `schema` flat struct with optional fields for all variants:** Makes it impossible to write exhaustive match arms in Phase 18's transform pipeline. Use the serde-tagged enum instead.
- **Storing `schema_hash` as per-field:** D-04 explicitly chose per-(project, issuetype) granularity. The hash covers the entire raw JSON response for a (side, project, issuetype) tuple, not individual fields.
- **`CREATE TABLE IF NOT EXISTS` in `triage_db.rs`:** Violates db-per-concern. Phase 17 creates `mapping.db` independently. [VERIFIED: CONTEXT.md explicitly forbids extending triage_db.rs]
- **Firing pre-warm before probe success:** Pre-warm must be conditional on probe passing — if the paginated endpoint is unreachable, pre-warm will fail with a confusing error.
- **Returning an empty `fields: []` on createmeta error:** Pitfall 15 — empty required-field set looks like "all clear". The probe failure must surface as a hard error state, not as an empty list.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-256 hash | Custom hash | `sha2` crate (already in Cargo.toml, used in `snapshot_db.rs`) | Correct padding, no off-by-one bugs |
| Hex encoding | Custom byte → hex | `hex` crate (already in Cargo.toml) | One-liner |
| Pagination loop | Ad-hoc while loop | Mirror `jira_client.rs::search_tickets` pattern (lines 55–103) | Existing pattern handles `page_len == 0` guard, truncation, error propagation consistently |
| Mock JSON fixtures | Inline `json!({})` per handler | Define constants in `fixtures.rs`, share via `SharedFixtures` | Prevents drift between tests and handler responses; mirrors existing `build_fixtures()` structure |
| Per-session-dismissable banner | New React state | Copy Phase 16 privacy-mode banner pattern (`connectionStore` `privacyWarningDismissed` field) | Pattern already understood, tested, consistent |

---

## Createmeta Paginated Endpoint — Full Shape Reference

### `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes`

**Purpose:** Fetch issue type list for a project (used for pre-warm + type chooser).

**Request:** No required query params. Pagination: `?startAt=0&maxResults=50`.

**Response shape:**
```json
{
  "startAt": 0,
  "maxResults": 50,
  "total": 3,
  "issueTypes": [
    { "id": "10001", "name": "Bug", "description": "...", "iconUrl": "..." },
    { "id": "10002", "name": "Task", "description": "...", "iconUrl": "..." },
    { "id": "10003", "name": "Story", "description": "...", "iconUrl": "..." }
  ]
}
```
[CITED: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/ — paginated wrapper shape confirmed]

### `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes/{issueTypeId}`

**Purpose:** Fetch all writable fields for a specific issue type — the primary source of target schema.

**Request:** Pagination: `?startAt=0&maxResults=50` (default 50 per page).

**Response shape:**
```json
{
  "startAt": 0,
  "maxResults": 50,
  "total": 12,
  "fields": [
    {
      "fieldId": "summary",
      "key": "summary",
      "name": "Summary",
      "required": true,
      "hasDefaultValue": false,
      "operations": ["set"],
      "schema": { "type": "string", "system": "summary" }
    },
    {
      "fieldId": "assignee",
      "key": "assignee",
      "name": "Assignee",
      "required": false,
      "hasDefaultValue": false,
      "operations": ["set"],
      "schema": { "type": "user", "system": "assignee" }
    },
    {
      "fieldId": "priority",
      "key": "priority",
      "name": "Priority",
      "required": false,
      "hasDefaultValue": true,
      "operations": ["set"],
      "schema": { "type": "priority", "system": "priority" },
      "allowedValues": [
        { "id": "1", "name": "Highest" },
        { "id": "2", "name": "High" },
        { "id": "3", "name": "Medium" },
        { "id": "4", "name": "Low" },
        { "id": "5", "name": "Lowest" }
      ]
    },
    {
      "fieldId": "customfield_10001",
      "key": "customfield_10001",
      "name": "Story Points",
      "required": false,
      "hasDefaultValue": false,
      "operations": ["set"],
      "schema": {
        "type": "number",
        "custom": "com.atlassian.jira.plugin.system.customfieldtypes:float",
        "customId": 10001
      }
    },
    {
      "fieldId": "customfield_10002",
      "key": "customfield_10002",
      "name": "Sprint",
      "required": false,
      "hasDefaultValue": false,
      "operations": ["set"],
      "schema": {
        "type": "array",
        "items": "string",
        "custom": "com.pyxis.greenhopper.jira:gh-sprint",
        "customId": 10002
      }
    },
    {
      "fieldId": "customfield_10004",
      "key": "customfield_10004",
      "name": "Team",
      "required": false,
      "hasDefaultValue": false,
      "operations": ["set"],
      "schema": {
        "type": "array",
        "items": "option",
        "custom": "com.atlassian.jira.plugin.system.customfieldtypes:multiselect",
        "customId": 10004
      },
      "allowedValues": [
        { "id": "10100", "value": "Backend", "disabled": false },
        { "id": "10101", "value": "Frontend", "disabled": false },
        { "id": "10102", "value": "Platform", "disabled": true }
      ]
    },
    {
      "fieldId": "customfield_10005",
      "key": "customfield_10005",
      "name": "Department/Team",
      "required": false,
      "hasDefaultValue": false,
      "operations": ["set"],
      "schema": {
        "type": "option-with-child",
        "custom": "com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect",
        "customId": 10005
      },
      "allowedValues": [
        {
          "id": "10200",
          "value": "Engineering",
          "children": [
            { "id": "10201", "value": "Backend" },
            { "id": "10202", "value": "Frontend" }
          ]
        },
        {
          "id": "10210",
          "value": "Product",
          "children": [
            { "id": "10211", "value": "Design" },
            { "id": "10212", "value": "Management" }
          ]
        }
      ]
    }
  ]
}
```
[CITED: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/ — pagination shape; https://developer.atlassian.com/server/jira/platform/jira-rest-api-example-discovering-meta-data-for-creating-issues-6291669/ — field schema object structure; cascading-select shape from Atlassian docs on custom field types]

**Important nuance:** Cloud v3 `createmeta` uses an **array** (`fields: [...]`) for the per-issuetype endpoint, NOT a `fields` map keyed by field ID (which is what the legacy v2 `createmeta?expand=...` returns). Phase 18 planners need to know this when writing the writer.

### `GET /rest/api/2/field` (source side, D-14)

**Purpose:** Returns a flat array of all fields known to the Server instance.

**Response shape:**
```json
[
  {
    "id": "summary",
    "name": "Summary",
    "custom": false,
    "orderable": true,
    "navigable": true,
    "searchable": true,
    "clauseNames": ["summary"],
    "schema": { "type": "string", "system": "summary" }
  },
  {
    "id": "customfield_10001",
    "name": "Story Points",
    "custom": true,
    "orderable": false,
    "navigable": true,
    "searchable": false,
    "clauseNames": ["cf[10001]", "Story Points"],
    "schema": {
      "type": "number",
      "custom": "com.atlassian.jira.plugin.system.customfieldtypes:float",
      "customId": 10001
    }
  }
]
```
[CITED: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-fields/ — confirms flat array response for `/field`; schema object structure is same across v2 and v3 global field list]

Note: v2 `/field` has NO `required` or `allowedValues` fields — those only appear in `createmeta`. Source-side fields are used for the source-field picker labels only (D-14).

---

## v2 vs v3 Shape Divergence (D-12 — 4 concrete examples)

These must all be present in `fixtures.rs` to satisfy D-12.

### Divergence 1: User Identity

| | v2 (Server) | v3 (Cloud) |
|-|------------|-----------|
| **Read shape** | `{ "name": "jdoe", "key": "JIRAUSER10100", "displayName": "John Doe", "emailAddress": "jdoe@example.com" }` | `{ "accountId": "557058:abc-def-123", "displayName": "John Doe" }` |
| **Write shape (target)** | N/A — writing to Server not in scope | `{ "accountId": "557058:abc-def-123" }` — ONLY accountId, no name/key |
| **Mock representation** | `v2_user("jdoe", "John Doe")` — existing helper | `v3_user("acc-jdoe", "John Doe")` — existing helper |

[VERIFIED: `fixtures.rs` already has `v2_user()` and `v3_user()` helpers, and Pitfall 1 documents this in detail]

### Divergence 2: Versions and Components

| | v2 (Server) | v3 (Cloud) |
|-|------------|-----------|
| **Read shape** | `"fixVersions": [{ "name": "1.2.0", "id": "10010", "released": false }]` | Same read shape |
| **Write shape (target)** | N/A | `"fixVersions": [{ "id": "10010" }]` — target id, not source id; obtained via `/project/{key}/versions` lookup by name |
| **Mock requirement** | v2 fixture includes `fixVersions` with name + id | v3 `/project/MYPROJ/versions` returns `[{"id":"20010","name":"1.2.0","released":false}]` (different IDs to force real lookup) |

[VERIFIED: Pitfall in PITFALLS.md, Integration Gotchas table; existing `snapshot_db.rs::WATCHED_FIELDS` includes `fix_versions`]

### Divergence 3: Priority Object

| | v2 (Server) read | v3 (Cloud) write |
|-|-----------------|-----------------|
| **Read shape** | `"priority": { "name": "High", "id": "2", "self": "...", "iconUrl": "..." }` | `"priority": { "name": "High", "id": "2", "statusColor": "#FF7452" }` |
| **Write shape (target)** | N/A | `"priority": { "id": "2" }` — only id accepted; name/iconUrl/statusColor cause 400 on some Cloud versions |
| **Mock requirement** | v2 issue has full `{ name, id, iconUrl }` priority object | v3 write accepts only `{ "id": "X" }` |

[CITED: PITFALLS.md Pitfall 4 read/write asymmetry table; `fixtures.rs::priority()` helper returns `{ name, id }` shape]

### Divergence 4: Custom-Field Read/Write Asymmetry (multi-select example)

| | Read shape (v2 or v3 GET) | Write shape (v3 POST) |
|-|--------------------------|----------------------|
| **multi-select** | `[{ "id": "10100", "value": "Backend", "self": "..." }]` | `[{ "value": "Backend" }]` — bare objects without `id` |
| **single-select / radio** | `{ "id": "10100", "value": "Backend", "self": "..." }` | `{ "value": "Backend" }` OR `{ "id": "10100" }` |
| **cascading-select read** | `{ "value": "Engineering", "child": { "value": "Backend" } }` | `{ "value": "Engineering", "child": { "value": "Backend" } }` — symmetric in this case |
| **user picker custom field** | `{ "accountId": "...", "displayName": "...", "avatarUrls": {...} }` | `{ "accountId": "..." }` — only accountId |

[CITED: PITFALLS.md Pitfall 4 full read/write asymmetry table]

---

## Mock Fixture Choices (D-09 through D-12)

### Issue Types (D-11)

| Issue Type ID | Name | Required Fields | Notes |
|--------------|------|-----------------|-------|
| `"10001"` | Bug | `priority` (system), `customfield_10006` "Severity" (custom single-select) | `customfield_10006` is Bug-specific |
| `"10002"` | Task | `summary` (system only) | Minimal required set |
| `"10003"` | Story | `customfield_10001` "Story Points" (number) | Only story-points required |

### Custom Field Fixture Definitions (D-09, D-10)

| Field ID | Name | schema.type | schema.custom suffix | Mock `allowedValues` | v2/v3 divergence? |
|----------|------|-------------|---------------------|----------------------|-------------------|
| `customfield_10001` | Story Points | `number` | `customfieldtypes:float` | none | none (number is symmetric) |
| `customfield_10002` | Sprint | `array` (items: `string`) | `greenhopper.jira:gh-sprint` | none (free-text sprint names) | none |
| `customfield_10003` | Epic Link | `string` | `customfieldtypes:epic-link` | none | read: epic key string; write: epic key string |
| `customfield_10004` | Team | `array` (items: `option`) | `customfieldtypes:multiselect` | `[{id,value,disabled}]` | read has `id`; write is `[{value}]` only |
| `customfield_10005` | Department/Team | `option-with-child` | `customfieldtypes:cascadingselect` | nested `[{id,value,children:[...]}]` | read has `{value,child:{value}}`; write is same (cascading-select is symmetric) |
| `customfield_10006` | Severity | `option` | `customfieldtypes:select` | `[{id:"10300",value:"Critical"},{id:"10301",value:"Major"},{id:"10302",value:"Minor"}]` | Bug-required field; read has `{id,value,self}`; write is `{value}` |

### v2 Mock `GET /rest/api/2/field` Response

Must include all standard system fields plus all 6 custom fields above. No `required` or `allowedValues` in `/field` response — those are createmeta-only.

### v3 Mock `GET /rest/api/3/issue/createmeta/MYPROJ/issuetypes` Response

Returns 3 issue types (Bug/Task/Story) in paginated wrapper with `total: 3`.

### v3 Mock `GET /rest/api/3/issue/createmeta/MYPROJ/issuetypes/{id}` Response

One endpoint per issue type ID. Returns relevant fields with `required` set correctly per D-11. Include a `total > maxResults` case for Bug (force multi-page pagination test): Bug returns `total: 7`, first page has `maxResults: 5`, second page has 2 more.

**Mock fixture in `fixtures.rs`:** Add a new `FixtureState` field `createmeta_fields: HashMap<(String, String), Vec<CreametaFieldFixture>>` keyed by `(project_key, issuetype_id)`.

---

## `field_schema_cache` DDL

This is the complete table definition for Phase 17. Phase 19 adds more tables to the same `mapping.db` file but does NOT alter this table.

```sql
CREATE TABLE IF NOT EXISTS field_schema_cache (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    side                 TEXT NOT NULL CHECK(side IN ('source','target')),
    project_key          TEXT,           -- NULL for source global field list
    issuetype_id         TEXT,           -- NULL for source global field list or issuetype list
    field_id             TEXT NOT NULL,  -- "summary" | "customfield_10001"
    field_name           TEXT NOT NULL,
    schema_json          TEXT NOT NULL,  -- JSON of the schema sub-object
    required             INTEGER NOT NULL DEFAULT 0,
    allowed_values_json  TEXT,           -- JSON array or NULL
    has_default_value    INTEGER NOT NULL DEFAULT 0,
    schema_hash          TEXT,           -- SHA-256 hex of the raw full-page response JSON
                                         -- (same value on all rows for the same (side,project,issuetype))
    cached_at            TEXT NOT NULL,
    UNIQUE(side, project_key, issuetype_id, field_id)
);
CREATE INDEX IF NOT EXISTS idx_fsc_key
    ON field_schema_cache(side, project_key, issuetype_id);
```

**`schema_hash` design:** One hash covers the entire `createmeta/{key}/issuetypes/{id}` raw response (all pages concatenated before hashing). All rows for the same `(side, project_key, issuetype_id)` tuple store the same hash value. Phase 21 reads the hash for drift detection; it does not need per-field granularity.

**Phase 19 extensibility:** Phase 19 adds `field_mapping` and `mapping_meta` tables in `FieldMappingDb::open()`. It does NOT add columns to `field_schema_cache`. The schema above is stable.

---

## Common Pitfalls

### Pitfall A: `serde(other)` catch-all missing — new Atlassian types panic
**What goes wrong:** A `schema.type` value not in the enum causes serde deserialization failure, crashing the discovery command.
**Why it happens:** Atlassian occasionally adds new schema types (e.g. `"timetracking"`, `"watches"`). Without a catch-all, the enum is closed.
**How to avoid:** Include `#[serde(other)] Any` variant in `FieldSchemaType`. Downstream code uses exhaustive match with `Any => log warning + render as text input`.
**Warning signs:** Unit test with a `type: "watches"` field fails to deserialize.

### Pitfall B: `createmeta` returns `fields` as **array** in v3, **object** in v2 legacy
**What goes wrong:** Code written for v2 legacy format expects `body["fields"]["summary"]` keyed access; v3 paginated endpoint returns `body["fields"]` as an array.
**Why it happens:** The two endpoint generations have different response shapes.
**How to avoid:** Write separate parsers. The new paginated endpoint always returns an array. The v2 legacy endpoint returns an object. Never share a single parse function.
**Warning signs:** `body["fields"]["summary"]` works in legacy tests but returns null against v3 mock.

### Pitfall C: Probe fires before configured target project key is available
**What goes wrong:** Probe is called on app launch, but the user hasn't configured a target project key yet. The probe has no project key to use.
**Why it happens:** `probe_createmeta` needs a project key; first-run users don't have one.
**How to avoid:** Read target project key from `triage_db`'s `get_project_config()` (already exists). If `target_project_key` is `None`, skip the probe silently — don't surface a failure banner. Probe only fires when both Cloud credentials AND a target project key are configured.
**Warning signs:** First-run users see "Required-field detection unavailable" banner before they've finished setup.

### Pitfall D: `schema_hash` computed per-field instead of per-(side, project, issuetype)
**What goes wrong:** Phase 21 reads hashes to detect drift. If the hash is computed per-field, Phase 21 must compare N hashes. If computed per-tuple, one comparison suffices.
**Why it happens:** Misreading D-04 as "hash each field".
**How to avoid:** Hash the entire raw JSON response body for the full `(side, project_key, issuetype_id)` tuple (all pages concatenated). Store the same hex hash on every row sharing that tuple.

### Pitfall E: Pre-warm spawns before managed state is ready (Tauri setup order)
**What goes wrong:** `tauri::async_runtime::spawn` fires the pre-warm task before `app.manage(mapping_db)` completes, causing a panic on the first `app.state::<Arc<Mutex<FieldMappingDb>>>()` call.
**Why it happens:** `setup()` closure runs sequentially, but `spawn` is non-blocking.
**How to avoid:** Pre-warm must be spawned AFTER all `app.manage()` calls. Use the pattern from `main.rs` lines 160–171: pass `Arc::clone` of the state into the spawn closure, rather than accessing `app.state()` from inside the spawned task.
[VERIFIED: `main.rs` lines 160–171 show the correct pattern — `Arc::clone` of state before `spawn`]

### Pitfall F (Pitfall 13 from PITFALLS.md): Mock schema does not exercise pagination
**What goes wrong:** Mock `createmeta` returns all fields in one page (`total == len`). Pagination loop is never exercised. Real Cloud with >50 fields truncates silently.
**How to avoid:** At least one mock issue type (recommend Bug with 7 fields) must return `total: 7, maxResults: 5` — forcing a second page fetch.
**Warning signs:** No integration test that asserts all fields are present after pagination.

### Pitfall G (Pitfall 3 from PITFALLS.md): `editmeta` vs `createmeta`
**What goes wrong:** Using `editmeta` to determine required-at-create fields. `editmeta` requires an existing issue; required-at-create differs from required-at-edit.
**How to avoid:** Phase 17 uses ONLY `createmeta/{key}/issuetypes/{id}`. `editmeta` is not fetched in Phase 17.
[VERIFIED: CONTEXT.md confirms; ARCHITECTURE.md Anti-Pattern 5 explicitly prohibits this]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Rust integration tests | `cargo test` — existing `src-tauri/tests/` directory with `#[tokio::test]` pattern |
| Frontend unit tests | Vitest 4.1 — `npm test` |
| Quick run | `cargo test --test mock_server` (Rust) / `npm test -- --reporter=verbose` (frontend) |
| Full suite | `cargo test && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| DISC-01 | v2 `/field` returns parseable `FieldSchema[]` | Unit (Rust) | `cargo test --lib field_discovery::tests::test_parse_v2_field_response` | `src-tauri/src/field_discovery.rs` (Wave 0 gap) |
| DISC-01 | `FieldSchemaType::Number` deserializes from `schema.type:"number"` JSON | Unit (Rust) | `cargo test --lib field_discovery::tests::test_serde_roundtrip_number` | `src-tauri/src/field_discovery.rs` (Wave 0 gap) |
| DISC-01 | `FieldSchemaType::Array{items:"option"}` deserializes from multi-select JSON | Unit (Rust) | `cargo test --lib field_discovery::tests::test_serde_roundtrip_multiselect` | `src-tauri/src/field_discovery.rs` (Wave 0 gap) |
| DISC-01 | `FieldSchemaType::OptionWithChild` deserializes from cascading-select JSON | Unit (Rust) | `cargo test --lib field_discovery::tests::test_serde_roundtrip_cascading` | `src-tauri/src/field_discovery.rs` (Wave 0 gap) |
| DISC-01 | `FieldSchemaType::Any` catches unrecognized `schema.type` values without panic | Unit (Rust) | `cargo test --lib field_discovery::tests::test_serde_unknown_type_fallback` | `src-tauri/src/field_discovery.rs` (Wave 0 gap) |
| DISC-02 | Mock v3 `/field` returns 200 with at least 6 custom fields | Integration (Rust) | `cargo test --test mock_server test_mock_v3_field_returns_custom_fields` | `src-tauri/tests/mock_server.rs` (Wave 0 gap) |
| DISC-03 | Mock v3 createmeta issuetypes endpoint returns paginated Bug fields (2 pages) | Integration (Rust) | `cargo test --test mock_server test_mock_v3_createmeta_pagination_two_pages` | `src-tauri/tests/mock_server.rs` (Wave 0 gap) |
| DISC-03 | `fetch_all_createmeta_fields` collects all fields across multiple pages | Unit (Rust) | `cargo test --lib field_discovery::tests::test_pagination_drains_all_pages` | `src-tauri/src/field_discovery.rs` (Wave 0 gap) |
| DISC-03 | Schema hash is stored and matches SHA-256 of raw response | Unit (Rust) | `cargo test --lib field_discovery::tests::test_schema_hash_stored` | `src-tauri/src/field_discovery.rs` (Wave 0 gap) |
| DISC-03 | Cache hit returns without HTTP call | Unit (Rust) | `cargo test --lib field_mapping_db::tests::test_cache_hit_no_http` | `src-tauri/src/field_mapping_db.rs` (Wave 0 gap) |
| DISC-03 | Probe failure → probe status = failed (non-200 response) | Integration (Rust) | `cargo test --test mock_server test_probe_createmeta_fail_on_404` | `src-tauri/tests/mock_server.rs` (Wave 0 gap) |
| DISC-04 | Mock v3 createmeta for Bug includes `customfield_10006 "Severity"` as required | Integration (Rust) | `cargo test --test mock_server test_mock_bug_required_fields_include_severity` | `src-tauri/tests/mock_server.rs` (Wave 0 gap) |
| DISC-04 | Mock v3 createmeta for Story includes `customfield_10001 "Story Points"` as required | Integration (Rust) | `cargo test --test mock_server test_mock_story_required_fields_include_story_points` | `src-tauri/tests/mock_server.rs` (Wave 0 gap) |
| DISC-04 | Mock v2 issue fields include v2-style user shape (`name`, no `accountId`) | Integration (Rust) | `cargo test --test mock_server test_mock_v2_user_shape_has_name_not_account_id` | `src-tauri/tests/mock_server.rs` (existing, extend) |
| DISC-04 | Mock v3 issue fields include v3-style user shape (`accountId`, no `name`) | Integration (Rust) | `cargo test --test mock_server test_mock_v3_user_shape_has_account_id_not_name` | `src-tauri/tests/mock_server.rs` (existing, extend) |
| D-08 | probe status in Zustand store triggers banner render | Unit (Frontend) | `npm test -- src/features/connections/__tests__/ProbeStatusBanner.test.tsx` | `src/features/connections/__tests__/ProbeStatusBanner.test.tsx` (Wave 0 gap) |

### Sampling Rate
- **Per task commit:** `cargo test --test mock_server` + `npm test -- --reporter=dot`
- **Per wave merge:** `cargo test && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps (test files that must be created before implementation)

- [ ] `src-tauri/src/field_discovery.rs` — module with inline `#[cfg(test)]` mod covering serde round-trips for each FieldSchemaType variant + pagination drain test
- [ ] `src-tauri/src/field_mapping_db.rs` — inline `#[cfg(test)]` mod covering `open_in_memory`, cache write/read, cache hit returns same data
- [ ] `src-tauri/tests/mock_server.rs` — extend existing file with new tests for v2/v3 field + createmeta routes
- [ ] `src/features/connections/__tests__/ProbeStatusBanner.test.tsx` — unit test for the probe-failure banner (renders when `probeStatus === 'failed'`, dismissable, shows correct message)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — Phase 17 reuses existing credential fetch patterns | existing keychain + Basic auth pattern |
| V3 Session Management | No — stateless HTTP calls | — |
| V4 Access Control | No — Phase 17 does not add new authorization surfaces | — |
| V5 Input Validation | Yes — parse raw Jira API responses into typed structs | `serde` typed deserialization + `#[serde(other)]` catch-all; `schema_hash` computed from raw bytes before parse |
| V6 Cryptography | Partial — SHA-256 for schema drift hash (D-04) | `sha2` + `hex` crates (same as `snapshot_db.rs`) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Schema response injection (malicious field names with JS) | Tampering | serde typed deserialization; `field_name` stored as TEXT, never eval'd |
| Credential leak via error messages (D-07 error includes endpoint URL) | Info Disclosure | Error message includes endpoint URL + status code ONLY — not credentials. URL is constructed by the app, not echoed from the server |
| Auth token in `schema_hash` computation | Info Disclosure | Hash computed on response body JSON only, NOT on request headers |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `GET /rest/api/3/issue/createmeta?expand=projects.issuetypes.fields` (combined legacy endpoint) | `GET /rest/api/3/issue/createmeta/{key}/issuetypes` + `/{id}` (paginated, per-issuetype) | Atlassian Cloud post-2023 rollout | Legacy endpoint deprecated; paginated is the supported path. D-06 locks this choice. |
| Server username as person identifier | Cloud `accountId` as person identifier | Atlassian GDPR changes 2019 | `name`/`key` silently ignored by Cloud v3 write endpoints |
| v2 `fields` map in createmeta response (object keyed by fieldId) | v3 `fields` array in paginated createmeta (array of field objects, `fieldId` is a property) | Atlassian Cloud v3 API design | Parse code must handle array, not object keyed access |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `sha2` crate | SHA-256 schema hash (D-04) | Yes | 0.10 (in Cargo.toml) | — |
| `hex` crate | Hex-encode hash | Yes | 0.4 (in Cargo.toml) | — |
| `chrono` crate | `cached_at` timestamps | Yes | 0.4 (in Cargo.toml) | — |
| `rusqlite` bundled | `mapping.db` | Yes | 0.39 (in Cargo.toml) | — |
| Vitest 4.1 | Frontend unit tests | Yes | 4.1.1 (in package.json) | — |
| Mock server (feature flag `mock-server`) | Integration tests | Yes (compile-time feature) | axum 0.8 | — |

All Phase 17 dependencies are already present in the project. No installation steps required.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TypeScript `FieldSide = 'source' \| 'target'` type shape will map cleanly to the Rust cache key | §Pattern 4 TypeScript | Low — trivial string type; planners can adjust naming |
| A2 | `tauri::async_runtime::spawn` is the correct runtime for the pre-warm background task (vs starting a new tokio task) | §Pattern 5 pre-warm wiring | Low — both work; `tauri::async_runtime::spawn` is consistent with poll_engine spawn pattern in main.rs |
| A3 | The probe GET hits `/createmeta/{project}/issuetypes` (not `/{project}/issuetypes/{id}`), and 200 + `issueTypes` key = pass | §Pattern 5 probe definition | Medium — if the endpoint returns 200 without that key, probe logic needs adjustment |
| A4 | Cascading select `allowedValues` shape is `[{id, value, children: [{id, value}]}]` | §Createmeta endpoint shape (cascading example) | Medium — Atlassian docs are inconsistent on exact children property name; may be `childOptions` in some versions |
| A5 | Sprint (`customfield_10002`) mock type should be `array/items:string` with `gh-sprint` custom suffix | §Mock Fixture Choices | Low — Sprint field in real Atlassian is more complex (object, not string), but for Phase 17 mock purposes string array is sufficient |

---

## Open Questions (RESOLVED)

1. **Issuetype list caching key:** Should the pre-warmed issuetype list be stored in `field_schema_cache` (with a sentinel `field_id = '__issuetypes__'` and `issuetype_id = NULL`) or in a separate `field_issuetype_list` table? The sentinel approach avoids a schema migration but is semantically impure. Recommendation: sentinel approach for Phase 17 simplicity; Phase 19 can introduce a proper table if needed.
   **RESOLVED:** Adopted — sentinel approach inside `field_schema_cache`. Phase 19 may introduce a dedicated table without migrating existing rows since `CREATE TABLE IF NOT EXISTS` is additive.

2. **Probe command naming:** Should the Tauri command be `probe_createmeta` or `check_field_discovery_availability`? Recommendation: `probe_createmeta` — short, specific to the endpoint being tested.
   **RESOLVED:** Adopted `probe_createmeta`. Plan 17-04 registers the command under this exact name; Plan 17-05 invokes it.

3. **Pre-warm error handling:** If the pre-warm issuetype-list fetch fails (network error after probe succeeded), should it silently fail or retry? Recommendation: silent fail with a warning logged to audit; the probe already told us the endpoint is reachable, so a transient failure here is non-blocking.
   **RESOLVED:** Adopted silent fail with audit-log warning. Plan 17-04 guards the spawned pre-warm with a `match` that logs but does not surface to the user; UI banner only fires on probe failure (D-05/D-08), not pre-warm failure.

4. **`priority` Jira schema type:** Jira returns `"type": "priority"` for the priority system field, which is NOT in the standard type list (`string`, `number`, `date`, etc.). The Rust enum needs an explicit `Priority` variant OR the catch-all `Any`. Recommendation: explicit `Priority` variant so Phase 18's transform pipeline can match it exhaustively.
   **RESOLVED:** Adopted explicit `Priority` variant. Plan 17-02 defines `FieldSchemaType::Priority` alongside the other variants; Plan 17-03 mirrors it on the TypeScript side.

5. **v2 legacy createmeta mock endpoint:** Should the mock return a helpful 404 with a message (to test D-06 no-fallback enforcement), or simply not register the route? Recommendation: register it but return `{ "error": "Use paginated v3 endpoint /rest/api/3/issue/createmeta/{key}/issuetypes" }` with status 410 (Gone) — provides a clear developer signal without routing ambiguity.
   **RESOLVED:** Omitted from Phase 17 (Claude's Discretion). D-06 enforces "no legacy fallback" at the Rust caller — `field_discovery.rs` never invokes the legacy endpoint, so a mock route is unnecessary. Phase 18 may add the 410 mock if a proxy-misconfiguration regression test becomes useful.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection — `src-tauri/src/snapshot_db.rs` (migration/lifecycle pattern), `src-tauri/src/main.rs` (managed state + spawn pattern), `src-tauri/src/mock_server.rs` (route registration), `src-tauri/src/fixtures.rs` (fixture structure), `src-tauri/src/commands.rs` (command patterns + fetch_cloud_meta + search_jira_users_by_domain), `src-tauri/Cargo.toml` (all dep versions), `package.json` (frontend deps)
- [Jira REST API createmeta v2 example with full field schema JSON](https://developer.atlassian.com/server/jira/platform/jira-rest-api-example-discovering-meta-data-for-creating-issues-6291669/) — schema object structure for system + custom fields
- [Jira Cloud REST API v3 — Issues group](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/) — paginated createmeta endpoint, pagination response shape
- [Jira Cloud REST API v3 — Issue Fields group](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-fields/) — `/field` endpoint response shape
- `.planning/research/PITFALLS.md` — Pitfalls 1, 3, 4, 13, 18 (all directly quoted in §Common Pitfalls)
- `.planning/research/ARCHITECTURE.md` — SQLite schema DDL, module placement, mock route list
- `.planning/phases/17-field-discovery-mock-schema-fidelity/17-CONTEXT.md` — all 16 locked decisions

### Secondary (MEDIUM confidence)
- [Atlassian Community: createmeta issue type fields endpoint](https://community.developer.atlassian.com/t/issue-createmeta-projectidorkey-issuetypes-issuetypeid-does-not-send-the-reporter-field-anymore/80973) — confirms pagination shape + `reporter` field edge case
- [Atlassian Community: get all custom fields](https://community.developer.atlassian.com/t/get-all-custom-fields-and-values/30154) — confirms custom field schema pattern
- `.planning/research/STACK.md` — custom field type → Rust/TS type mapping table

### Tertiary (LOW confidence)
- A4 (Cascading select `children` property name) — based on general Atlassian documentation patterns; should be verified during implementation with mock test

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps in Cargo.toml, no new additions
- Createmeta API shape: HIGH — verified from official Atlassian docs + existing v0.4.0 research
- FieldSchema Rust enum design: MEDIUM-HIGH — serde tag pattern is established in codebase; exact variant names are Claude's Discretion (per CONTEXT.md)
- Mock fixture values: HIGH — locked in D-09/D-10/D-11/D-12; concrete JSON shapes derived from documented Atlassian types
- App-launch probe wiring: HIGH — main.rs code inspected directly; spawn pattern verified
- Phase 19 extensibility of mapping.db: HIGH — `CREATE TABLE IF NOT EXISTS` pattern means additive; no migration needed

**Research date:** 2026-04-27
**Valid until:** 90 days (Atlassian API v3 schema is stable; custom field type strings are longstanding)
