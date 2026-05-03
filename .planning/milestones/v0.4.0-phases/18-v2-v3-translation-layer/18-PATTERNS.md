# Phase 18: v2→v3 Translation Layer - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 8 (7 new + 1 modified)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src-tauri/src/field_transform/mod.rs` | module/types | transform | `src-tauri/src/field_discovery.rs` (type definitions block) | role-match |
| `src-tauri/src/field_transform/pipeline.rs` | service | transform + request-response | `src-tauri/src/field_discovery.rs` (`get_or_fetch_target_schema`, cache-first pattern) | role-match |
| `src-tauri/src/field_transform/user.rs` | service | request-response (batch HTTP) | `src-tauri/src/commands.rs` (`search_jira_users_by_domain`, lines 1096–1147) | exact |
| `src-tauri/src/field_transform/version.rs` | service | request-response + session cache | `src-tauri/src/field_discovery.rs` (`get_or_fetch_target_schema`, lines 490–529) | exact |
| `src-tauri/src/field_transform/component.rs` | service | request-response + session cache | `src-tauri/src/field_discovery.rs` (`get_or_fetch_target_schema`, lines 490–529) | exact |
| `src-tauri/src/field_transform/wiki_to_adf.rs` | utility | transform | `src-tauri/src/commands.rs` (`htmltoadf` call, lines 1654–1659) | role-match |
| `src-tauri/src/field_transform/identity.rs` | utility | transform | `src-tauri/src/field_discovery.rs` (`parse_global_field_list`, lines 252–289) | role-match |
| `src-tauri/src/lib.rs` | config | — | existing `src-tauri/src/lib.rs` | exact |

---

## Pattern Assignments

### `src-tauri/src/field_transform/mod.rs` (module/types, transform)

**Analog:** `src-tauri/src/field_discovery.rs` (lines 1–33, 36–112, 114–129)

**Imports pattern** (`field_discovery.rs` lines 14, 165–169):
```rust
use serde::{Deserialize, Serialize};
use crate::error::{AppError, AppResult};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
```

**Enum definition pattern — serde-tagged discriminated union** (`field_discovery.rs` lines 36–112):
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum FieldSchemaType {
    String { ... },
    Array { items: String, ... },
    #[serde(other)]
    Any,
}
```
Apply same `#[derive(Debug, Clone, Serialize, Deserialize)]` + `#[serde(tag = "kind")]` for `GapVariant`:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum GapVariant {
    Person(UnresolvedPerson),
    Version(UnresolvedVersion),
    Component(UnresolvedComponent),
}
```

**Struct definition pattern** (`field_discovery.rs` lines 114–129):
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldSchema {
    pub field_id: String,
    pub name: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_default_value: Option<bool>,
    pub schema: FieldSchemaType,
    ...
}
```
Apply same derive stack + `#[serde(rename_all = "camelCase")]` on `UnresolvedPerson`, `UnresolvedVersion`, `UnresolvedComponent`, `ResolvedFields`.

**FieldSide enum pattern** (`field_discovery.rs` lines 18–32) — copy the `#[serde(rename_all = "lowercase")]` + `as_str()` impl pattern for any string-keyed discriminant types in `mod.rs`.

---

### `src-tauri/src/field_transform/pipeline.rs` (service, transform + request-response)

**Analog:** `src-tauri/src/field_discovery.rs` — `get_or_fetch_target_schema` (lines 490–529) and `fetch_all_createmeta_fields` pagination loop (lines 304–382)

**Imports pattern** (`field_discovery.rs` lines 163–169):
```rust
use crate::error::{AppError, AppResult};
use crate::field_mapping_db::{compute_schema_hash, FieldMappingDb};
use reqwest::Client;
use std::sync::{Arc, Mutex};
```

**Two-phase async function signature pattern** — `apply_mapping` follows the same `async fn ... -> AppResult<T>` convention as `get_or_fetch_target_schema`:
```rust
pub async fn get_or_fetch_target_schema(
    db: &Arc<Mutex<FieldMappingDb>>,
    client: &Client,
    base_url: &str,
    cloud_auth: &str,
    project_key: &str,
    issuetype_id: &str,
) -> AppResult<Vec<FieldSchema>> {
```
`apply_mapping` will return `ResolvedFields` (not `AppResult`) — gaps are typed variants not `Err`, per D-01.

**JSON value extraction pattern** — use `serde_json::Value::pointer` or `get()`:
```rust
// commands.rs pattern — extract fields from source JSON
let value: serde_json::Value = resp.json().await
    .map_err(|_| AppError::Http("parse failed".into()))?;
```

**Test pattern** (`field_discovery.rs` lines 567–575, `field_mapping_db.rs` lines 202–222):
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // Helper builder for test fixtures
    fn sample_field(id: &str, required: bool) -> FieldSchema { ... }

    #[test]
    fn test_name() {
        // arrange → act → assert
    }
    // Async integration tests use:
    #[tokio::test]
    async fn async_test_name() { ... }
}
```

---

### `src-tauri/src/field_transform/user.rs` (service, request-response batch HTTP)

**Analog:** `src-tauri/src/commands.rs` — `search_jira_users_by_domain` (lines 1096–1147)

**Imports pattern** (`commands.rs` lines 5–17):
```rust
use crate::audit::{build_audited_client, AuditDb};
use crate::error::AppError;
use base64::Engine as _;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
```

**Basic auth construction pattern** (`commands.rs` lines 1111–1114):
```rust
let cloud_auth = format!(
    "Basic {}",
    base64::engine::general_purpose::STANDARD.encode(format!("{cloud_email}:{api_token}"))
);
```

**Paginated Cloud user search HTTP pattern** (`commands.rs` lines 1119–1147):
```rust
const PAGE_SIZE: usize = 50;
let mut all_users: Vec<serde_json::Value> = Vec::new();
let mut start_at: usize = 0;

loop {
    let url = format!(
        "{base_url}/rest/api/3/user/search?query={encoded_query}&maxResults={PAGE_SIZE}&startAt={start_at}"
    );
    let resp = client
        .get(&url)
        .header("Authorization", cloud_auth.clone())
        .send()
        .await
        .map_err(|_| AppError::Http("Failed to search users by domain".into()))?;

    if !resp.status().is_success() {
        break;
    }

    let page: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
    let page_len = page.len();
    all_users.extend(page);

    if page_len < PAGE_SIZE {
        break;  // last page
    }
    start_at += PAGE_SIZE;
}
```
`user.rs` wraps this into `UserResolver::lookup_single(username)` for each unique username collected in the pre-scan.

**URL encoding pattern** (`field_discovery.rs` lines 312–313):
```rust
let project_enc = urlencoding::encode(project_key);
// Apply same for user query string:
let encoded_query = urlencoding::encode(&query);
```

**Error handling pattern** (`commands.rs` lines 1129–1133):
```rust
.map_err(|_| AppError::Http("Failed to search users by domain".into()))?;

if !resp.status().is_success() {
    break;  // soft failure — return partial results, not Err
}
```
For `user.rs` batch resolution, a failed HTTP call for one user returns `None` in the resolution map (not pipeline `Err`), consistent with typed gap variant design (D-01).

---

### `src-tauri/src/field_transform/version.rs` (service, request-response + session cache)

**Analog:** `src-tauri/src/field_discovery.rs` — `get_or_fetch_target_schema` (lines 490–529) and `fetch_target_issue_types` (lines 389–417)

**Cache-first pattern with short lock windows** (`field_discovery.rs` lines 498–529):
```rust
pub async fn get_or_fetch_target_schema(
    db: &Arc<Mutex<FieldMappingDb>>,
    ...
) -> AppResult<Vec<FieldSchema>> {
    // 1) Cache check — lock window kept short
    {
        let guard = db
            .lock()
            .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
        let cached = guard.get_cached_schemas(...)?;
        if !cached.is_empty() {
            return Ok(cached);
        }
    }
    // 2) Cache miss — fetch (no lock held during HTTP call)
    let (resp, hash) = fetch_all_createmeta_fields(...).await?;
    // 3) Persist
    {
        let guard = db.lock()
            .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
        for field in &resp.fields {
            guard.upsert_schema_row(...)?;
        }
    }
    Ok(resp.fields)
}
```
`version.rs` mirrors this with `Arc<Mutex<HashMap<String, Vec<VersionEntry>>>>` instead of SQLite. Two separate lock scopes: one for read, one for write — no lock held during HTTP.

**Flat-array HTTP fetch pattern** (`field_discovery.rs` lines 389–417):
```rust
pub async fn fetch_target_issue_types(
    client: &Client,
    base_url: &str,
    cloud_auth: &str,
    project_key: &str,
) -> AppResult<Vec<IssueTypeRef>> {
    let trimmed = base_url.trim_end_matches('/');
    let project_enc = urlencoding::encode(project_key);
    let url = format!(
        "{trimmed}/rest/api/3/issue/createmeta/{project_enc}/issuetypes?startAt=0&maxResults={CREATEMETA_PAGE_SIZE}"
    );
    let resp = client
        .get(&url)
        .header("Authorization", cloud_auth)
        .send()
        .await
        .map_err(|_| AppError::Http("issuetype list fetch failed".into()))?;
    if !resp.status().is_success() {
        return Err(AppError::Http(format!(
            "GET {url} returned {}. ...",
            resp.status().as_u16()
        )));
    }
    let body: IssueTypesResponse = resp.json().await
        .map_err(|_| AppError::Http("issuetype list parse failed".into()))?;
    Ok(body.issue_types)
}
```
Apply same pattern for `/rest/api/3/project/{key}/versions`. Add pagination loop (matching `fetch_all_createmeta_fields` lines 325–369) as a guard for projects with many versions.

**Case-insensitive name matching** — use `eq_ignore_ascii_case` (per RESEARCH.md Pitfall D):
```rust
versions.iter()
    .find(|v| v.name.eq_ignore_ascii_case(source_name))
    .map(|v| v.id.clone())
```

---

### `src-tauri/src/field_transform/component.rs` (service, request-response + session cache)

**Analog:** `src-tauri/src/field_discovery.rs` — same as `version.rs` above

Identical structural pattern to `version.rs`. Replace endpoint `/rest/api/3/project/{key}/versions` with `/rest/api/3/project/{key}/components`. Replace `VersionEntry`/`VersionResolver` type names with `ComponentEntry`/`ComponentResolver`. Replace `UnresolvedVersion` gap emission with `UnresolvedComponent`.

All cache, HTTP, lock-window, and error-handling patterns are direct copies from the `version.rs` analog — see above.

---

### `src-tauri/src/field_transform/wiki_to_adf.rs` (utility, transform)

**Analog:** `src-tauri/src/commands.rs` — `htmltoadf` call block (lines 1653–1659) and ADF tree manipulation (lines 1662–1700)

**Imports pattern** (`commands.rs` lines 1–14):
```rust
use crate::error::AppError;
use std::collections::HashMap;
// htmltoadf is a crate-level dep — no `use` needed, called as:
// htmltoadf::convert_html_str_to_adf_str(html)
```

**htmltoadf call pattern** (`commands.rs` lines 1654–1659):
```rust
let adf_str = htmltoadf::convert_html_str_to_adf_str(rewritten_html);
serde_json::from_str(&adf_str)
    .map_err(|e| AppError::Serialization(format!("Failed to parse ADF JSON: {e}")))?
```
Wrap with a fallback for parse failure (empty doc):
```rust
let mut adf: serde_json::Value = serde_json::from_str(&adf_str)
    .unwrap_or_else(|_| serde_json::json!({"version":1,"type":"doc","content":[]}));
```

**ADF tree mutation pattern** (`commands.rs` lines 1662–1700):
```rust
// Walk content array, push new nodes
if let Some(content) = adf_value["content"].as_array_mut() {
    content.push(serde_json::json!({
        "type": "heading",
        "attrs": { "level": 3 },
        "content": [{ "type": "text", "text": "Sub-tasks" }]
    }));
}
```
The post-processor walks this same `content` array recursively, replacing `type: "text"` nodes containing `[~username]` with `mention` nodes. Never mutate `type: "code_block"` children (Pitfall F guard).

**ADF mention node shape** (from RESEARCH.md — Atlassian spec):
```json
{
  "type": "mention",
  "attrs": {
    "id": "557058:abc123-def456",
    "text": "@DisplayName"
  }
}
```

**Error handling pattern** — parse failures produce an empty-doc fallback (never `Err`) since an empty doc is safer than a broken ADF POST body.

---

### `src-tauri/src/field_transform/identity.rs` (utility, transform)

**Analog:** `src-tauri/src/field_discovery.rs` — `parse_global_field_list` (lines 252–289)

**Value extraction + passthrough pattern** (`field_discovery.rs` lines 260–277):
```rust
let field_id = entry
    .get("id")
    .or_else(|| entry.get("fieldId"))
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();

// Graceful fallback on missing key
let schema_v = entry
    .get("schema")
    .cloned()
    .unwrap_or(serde_json::json!({"type": "any"}));
let schema: FieldSchemaType =
    serde_json::from_value(schema_v).unwrap_or(FieldSchemaType::Any);
```
`identity.rs` applies the same `.get("...").and_then(|v| v.as_...)` chain to extract string/number/date values from the source issue, then passes them through as-is to the output fields map.

**FieldSchemaType dispatch match pattern** — mirrors how `parse_global_field_list` pattern-matches on the schema value, but here matches on `FieldSchemaType` variants from `field_discovery.rs` lines 36–112:
```rust
match &row.source_schema {
    FieldSchemaType::String { .. } => { /* passthrough */ }
    FieldSchemaType::Number { .. } => { /* passthrough */ }
    FieldSchemaType::Date { .. }   => { /* passthrough */ }
    FieldSchemaType::Datetime { .. } => { /* passthrough */ }
    FieldSchemaType::Option_ { .. } => { /* value name passthrough */ }
    FieldSchemaType::Array { items, .. } if items == "option" => { /* array of value names */ }
    FieldSchemaType::Priority      => { /* pass { id } write shape only */ }
    FieldSchemaType::Any           => { /* skip — unsupported */ }
    _ => { /* dispatch to other resolvers, not identity */ }
}
```

---

### `src-tauri/src/lib.rs` (config, module registration)

**Analog:** existing `src-tauri/src/lib.rs` (lines 1–14)

**Module registration pattern** (lines 1–14):
```rust
pub mod audit;
pub mod commands;
pub mod error;
pub mod field_discovery;
pub mod field_mapping_db;
pub mod fixtures;
pub mod jira_client;
pub mod keychain;
pub mod mock_server;
pub mod notification_dispatcher;
pub mod poll_engine;
pub mod snapshot_db;
pub mod triage_db;
```
Add `pub mod field_transform;` to this list, maintaining alphabetical order (between `field_mapping_db` and `fixtures`).

---

## Shared Patterns

### AppError / AppResult
**Source:** `src-tauri/src/error.rs` (lines 1–66)
**Apply to:** All service files (`pipeline.rs`, `user.rs`, `version.rs`, `component.rs`, `wiki_to_adf.rs`)
```rust
// error.rs lines 4–22
pub enum AppError {
    Http(String),
    Internal(String),
    Serialization(String),
    // ...
}
pub type AppResult<T> = Result<T, AppError>;

// Construction:
AppError::Http("Failed to search users by domain".into())
AppError::Internal("FieldMappingDb lock poisoned".into())
AppError::Serialization(format!("Failed to parse ADF JSON: {e}"))
```
**Rule:** Infrastructure failures (`Err`) vs. expected business gaps (typed variants in `ResolvedFields.gaps`) are distinct. Never use `AppError` for unresolvable person/version/component — use gap variants.

### Arc<Mutex<>> Lock Pattern (short lock windows)
**Source:** `src-tauri/src/field_discovery.rs` lines 498–529
**Apply to:** `version.rs`, `component.rs` in-memory cache; `pipeline.rs` if it holds any shared state
```rust
// Lock scope 1: read check — held only for cache lookup, NOT during HTTP
{
    let guard = cache.lock()
        .map_err(|_| AppError::Internal("cache lock poisoned".into()))?;
    if let Some(v) = guard.get(key) {
        return Some(v.clone());
    }
}
// HTTP call — NO lock held here
let result = fetch_from_api(...).await?;
// Lock scope 2: write — held only for insert
{
    let mut guard = cache.lock()
        .map_err(|_| AppError::Internal("cache lock poisoned".into()))?;
    guard.insert(key.to_string(), result.clone());
}
```

### Basic Auth Header Construction
**Source:** `src-tauri/src/commands.rs` lines 1111–1114
**Apply to:** `user.rs`, `version.rs`, `component.rs` — all Cloud API callers
```rust
use base64::Engine as _;

let cloud_auth = format!(
    "Basic {}",
    base64::engine::general_purpose::STANDARD.encode(format!("{cloud_email}:{api_token}"))
);
```

### reqwest HTTP GET with Authorization Header
**Source:** `src-tauri/src/commands.rs` lines 1124–1130
**Apply to:** `user.rs`, `version.rs`, `component.rs`
```rust
let resp = client
    .get(&url)
    .header("Authorization", cloud_auth.clone())
    .send()
    .await
    .map_err(|_| AppError::Http("Failed to ...".into()))?;

if !resp.status().is_success() {
    // Soft failure: break/return None rather than Err for expected cases
    break;
}
let page: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
```

### URL Encoding for Path Segments
**Source:** `src-tauri/src/field_discovery.rs` lines 312–313
**Apply to:** `version.rs`, `component.rs` (project key in path), `user.rs` (query param)
```rust
let project_enc = urlencoding::encode(project_key);
let url = format!("{trimmed}/rest/api/3/project/{project_enc}/versions");
```

### Serde Derive Stack for Public Types
**Source:** `src-tauri/src/field_discovery.rs` lines 36, 116–117
**Apply to:** All new types in `mod.rs` (`GapVariant`, `UnresolvedPerson`, etc.)
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MyType { ... }

// For enums with tagged variants:
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum GapVariant { ... }
```

### Test Module Structure
**Source:** `src-tauri/src/field_discovery.rs` lines 567–575; `src-tauri/src/field_mapping_db.rs` lines 202–222
**Apply to:** All new `field_transform/` files
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // Helper builder functions for test data
    fn make_source_issue() -> serde_json::Value { json!({ ... }) }

    #[test]
    fn sync_unit_test() { /* arrange → act → assert */ }

    #[tokio::test]
    async fn async_integration_test() { /* arrange → act → assert */ }
}
```

---

## No Analog Found

All files have analogs in the existing codebase. No files require falling back to RESEARCH.md patterns exclusively.

---

## Metadata

**Analog search scope:** `src-tauri/src/` — `field_discovery.rs`, `field_mapping_db.rs`, `commands.rs`, `jira_client.rs`, `error.rs`, `lib.rs`
**Files scanned:** 6 source files (full reads or targeted sections)
**Pattern extraction date:** 2026-04-27
