//! Phase 17: Field discovery types + (Plan 04) HTTP fetchers + Tauri commands.
//!
//! This module owns:
//!   - `FieldSchemaType` — serde-tagged discriminated union over Atlassian schema.type values
//!   - `FieldSchema` — one row of a /field or /createmeta response
//!   - `CreatemetaResponse` — paginated createmeta wrapper
//!   - `IssueTypeRef` — entry in /createmeta/{key}/issuetypes
//!   - `FieldSide` — 'source' | 'target' discriminant for the cache key
//!
//! Plan 04 will add: `discover_v2_fields`, `discover_v3_fields`,
//! `fetch_all_createmeta_fields`, `fetch_createmeta_issuetypes`, `probe_createmeta`,
//! plus the Tauri commands in `commands.rs` that delegate here.

use serde::{Deserialize, Serialize};

/// Side discriminant for the schema cache key. Mirrors the `SQLite` `CHECK`
/// constraint `side IN ('source','target')`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldSide {
    Source,
    Target,
}

impl FieldSide {
    pub fn as_str(&self) -> &'static str {
        match self {
            FieldSide::Source => "source",
            FieldSide::Target => "target",
        }
    }
}

/// Polymorphic Jira `schema` object. The serde tag is `type`; unknown variants
/// fall through to `Any` rather than failing deserialization (Pitfall A).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum FieldSchemaType {
    String {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Number {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Date {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Datetime {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    User {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Array {
        items: String, // "option" | "string" | "user" | "component" | "version" | "group"
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    #[serde(rename = "option")]
    Option_ {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    #[serde(rename = "option-with-child")]
    OptionWithChild {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Issuetype,
    Priority,
    /// Catch-all for any future Atlassian schema.type not yet handled here.
    /// Renderers must treat this as a read-only "Unsupported type" pill.
    #[serde(other)]
    Any,
}

/// One row in a /field or paginated /createmeta response.
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allowed_values: Option<Vec<serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operations: Option<Vec<String>>,
}

/// Paginated wrapper returned by /rest/api/3/issue/createmeta/{key}/issuetypes/{id}.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatemetaResponse {
    pub start_at: u64,
    pub max_results: u64,
    pub total: u64,
    pub fields: Vec<FieldSchema>,
}

/// Issue-type entry in /createmeta/{key}/issuetypes (used by pre-warm + Phase 22 chooser).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTypeRef {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
}

/// Issue-type list page wrapper (mirrors createmeta paginated shape).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTypesResponse {
    pub start_at: u64,
    pub max_results: u64,
    pub total: u64,
    pub issue_types: Vec<IssueTypeRef>,
}

// ─── Phase 17 Plan 04: HTTP discovery functions ───────────────────────────────

use crate::error::{AppError, AppResult};
use crate::field_mapping_db::{compute_schema_hash, FieldMappingDb};
use reqwest::Client;
use sha2::Digest as _;
use std::sync::{Arc, Mutex};

/// Page size used for paginated createmeta calls. Atlassian's default is 50.
pub const CREATEMETA_PAGE_SIZE: u64 = 50;

/// Hard upper bound on pages drained per `fetch_all_createmeta_fields` call.
/// Guards against a hostile/buggy server that never reaches `total`. (Pitfall
/// analog of `MAX_PAGINATION_ITEMS`.)
pub const MAX_CREATEMETA_PAGES: u64 = 50;

/// Result of the connection-time probe (D-05/D-07/D-08). **Never** carries
/// credentials in any field — enforced by unit test
/// `probe_result_serializes_without_credentials`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeResult {
    pub ok: bool,
    pub endpoint_url: String,
    pub status_code: Option<u16>,
    pub hint: Option<String>,
}

// ─── Source: GET /rest/api/2/field (D-14) ─────────────────────────────────────

/// Discover the global Jira Server v2 field list. No per-issuetype fetch (D-14).
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

/// Discover the global Jira Cloud v3 field list.
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

/// Parse the flat-array response from `/field` (both v2 and v3 return the same
/// array shape). Returns one `FieldSchema` per entry; entries missing an `id`
/// are silently dropped.
fn parse_global_field_list(value: &serde_json::Value) -> AppResult<Vec<FieldSchema>> {
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
            .unwrap_or(serde_json::json!({"type": "any"}));
        let schema: FieldSchemaType =
            serde_json::from_value(schema_v).unwrap_or(FieldSchemaType::Any);
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

// ─── Target paginated createmeta ──────────────────────────────────────────────

/// Fetch all fields for a specific issue type via the paginated createmeta
/// endpoint, returning the merged response plus a SHA-256 hex hash over the
/// concatenated raw response bytes (D-04, Pitfall D).
///
/// Three stop conditions (T-17-02 `DoS` guard):
///   1. `page_len == 0`                       — empty page
///   2. `all_fields.len() >= declared_total`  — drained what server promised
///   3. `pages_drained >= MAX_CREATEMETA_PAGES` — hard upper bound
///
/// Error message format (D-07): `"GET {url} returned {status}. Your proxy may
/// not expose the paginated createmeta endpoint."`
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
    let mut pages_drained: u64 = 0;
    // `server_total` carries the server-reported total from the most-recent page.
    // Rustc unused_assignments fires on any initial value here (it sees the loop
    // assignment as always-overwrites); the allow suppresses that false positive.
    #[allow(unused_assignments)]
    let mut server_total: u64 = 0;
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
        let declared_total = page.total;
        let declared_max_results = page.max_results.max(1);
        server_total = declared_total;
        all_fields.extend(page.fields);
        pages_drained += 1;

        // Stop condition 1: empty page
        // Stop condition 2: drained declared total
        if page_len == 0 || all_fields.len() as u64 >= declared_total {
            break;
        }
        // Stop condition 3: hard upper bound
        if pages_drained >= MAX_CREATEMETA_PAGES {
            return Err(AppError::Http(format!(
                "createmeta pagination exceeded MAX_CREATEMETA_PAGES ({MAX_CREATEMETA_PAGES}) — server reported total={declared_total} but did not converge"
            )));
        }
        start_at += page_len.max(declared_max_results);
    }

    let hash_hex = hex::encode(sha2::Digest::finalize(hasher));
    // Use the larger of server-reported total and actual drained count (guards against
    // a server that under-reports total while over-delivering fields).
    let merged_total = server_total.max(all_fields.len() as u64);
    let response = CreatemetaResponse {
        start_at: 0,
        max_results: CREATEMETA_PAGE_SIZE,
        total: merged_total,
        fields: all_fields,
    };
    Ok((response, hash_hex))
}

// ─── Target issue-type list (pre-warm, D-01 + D-15 reconciliation) ────────────

/// Fetch the issue-type list for a project from the paginated createmeta
/// endpoint. This is the **lightweight** pre-warm: only the type list is
/// fetched, not per-issuetype field schemas (D-15 lazy).
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

/// Connection-time probe for the paginated createmeta endpoint (D-05/D-07/D-08).
///
/// Returns `ProbeResult` instead of `Err` for HTTP / network failures so the
/// frontend can render a deterministic banner. `Err` is reserved for fatal
/// **local** errors (e.g., lock poison, keychain failure).
///
/// **Credential safety (T-17-03):** `endpoint_url` is constructed by the app
/// from `base_url` + URL-encoded `project_key`; `cloud_auth` is passed only as
/// a request header and never interpolated into any string in the result.
/// Hint strings are static templates with no auth interpolation.
pub async fn probe_paginated_createmeta(
    client: &Client,
    base_url: &str,
    cloud_auth: &str,
    project_key: &str,
) -> AppResult<ProbeResult> {
    let trimmed = base_url.trim_end_matches('/');
    let project_enc = urlencoding::encode(project_key);
    // endpoint_url contains NO credential value — only the scheme+host+path
    let endpoint_url =
        format!("{trimmed}/rest/api/3/issue/createmeta/{project_enc}/issuetypes");

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
                "Network or DNS error reaching paginated createmeta endpoint. \
                 Your proxy may not expose this endpoint."
                    .to_string(),
            ),
        }),
    }
}

// ─── Cache-aware getters (delegates from commands.rs) ─────────────────────────

/// Cache-first fetch of target schemas for `(project_key, issuetype_id)`.
///
/// 1. Check cache (short lock window).
/// 2. On miss: fetch via `fetch_all_createmeta_fields` (no lock held during HTTP).
/// 3. Persist result rows + hash via `upsert_schema_row`.
pub async fn get_or_fetch_target_schema(
    db: &Arc<Mutex<FieldMappingDb>>,
    client: &Client,
    base_url: &str,
    cloud_auth: &str,
    project_key: &str,
    issuetype_id: &str,
) -> AppResult<Vec<FieldSchema>> {
    // 1) Cache check — lock window kept short
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
    // 2) Cache miss — fetch (no lock held during HTTP call)
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

/// Cache-first fetch of the source global field list.
pub async fn get_or_fetch_source_global(
    db: &Arc<Mutex<FieldMappingDb>>,
    client: &Client,
    base_url: &str,
    pat: &str,
) -> AppResult<Vec<FieldSchema>> {
    // 1) Cache check
    {
        let guard = db
            .lock()
            .map_err(|_| AppError::Internal("FieldMappingDb lock poisoned".into()))?;
        let cached = guard.get_cached_schemas(FieldSide::Source, None, None)?;
        if !cached.is_empty() {
            return Ok(cached);
        }
    }
    // 2) Fetch
    let fields = discover_v2_fields(client, base_url, pat).await?;
    let raw_hash = compute_schema_hash(
        serde_json::to_string(&fields)
            .unwrap_or_default()
            .as_bytes(),
    );
    // 3) Persist
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn round_trip(v: serde_json::Value) -> FieldSchemaType {
        let parsed: FieldSchemaType = serde_json::from_value(v.clone())
            .unwrap_or_else(|e| panic!("deserialize failed for {v}: {e}"));
        parsed
    }

    #[test]
    fn serde_round_trip_string() {
        let parsed = round_trip(json!({"type": "string", "system": "summary"}));
        assert!(matches!(parsed, FieldSchemaType::String { ref system, .. } if system.as_deref() == Some("summary")));
    }

    #[test]
    fn serde_round_trip_number_with_custom() {
        let parsed = round_trip(json!({
            "type": "number",
            "custom": "com.atlassian.jira.plugin.system.customfieldtypes:float",
            "customId": 10001
        }));
        match parsed {
            FieldSchemaType::Number { custom, custom_id, .. } => {
                assert_eq!(custom.as_deref(), Some("com.atlassian.jira.plugin.system.customfieldtypes:float"));
                assert_eq!(custom_id, Some(10001));
            }
            _ => panic!("expected Number variant"),
        }
    }

    #[test]
    fn serde_round_trip_date() {
        let parsed = round_trip(json!({"type": "date"}));
        assert!(matches!(parsed, FieldSchemaType::Date { .. }));
    }

    #[test]
    fn serde_round_trip_datetime() {
        let parsed = round_trip(json!({"type": "datetime"}));
        assert!(matches!(parsed, FieldSchemaType::Datetime { .. }));
    }

    #[test]
    fn serde_round_trip_user() {
        let parsed = round_trip(json!({"type": "user", "system": "assignee"}));
        assert!(matches!(parsed, FieldSchemaType::User { ref system, .. } if system.as_deref() == Some("assignee")));
    }

    #[test]
    fn serde_round_trip_multiselect_array() {
        let parsed = round_trip(json!({
            "type": "array",
            "items": "option",
            "custom": "com.atlassian.jira.plugin.system.customfieldtypes:multiselect",
            "customId": 10004
        }));
        match parsed {
            FieldSchemaType::Array { items, custom_id, .. } => {
                assert_eq!(items, "option");
                assert_eq!(custom_id, Some(10004));
            }
            _ => panic!("expected Array variant"),
        }
    }

    #[test]
    fn serde_round_trip_option() {
        let parsed = round_trip(json!({"type": "option", "custom": "...:select"}));
        assert!(matches!(parsed, FieldSchemaType::Option_ { .. }));
    }

    #[test]
    fn serde_round_trip_cascading() {
        let parsed = round_trip(json!({
            "type": "option-with-child",
            "custom": "com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect",
            "customId": 10005
        }));
        assert!(matches!(parsed, FieldSchemaType::OptionWithChild { .. }));
    }

    #[test]
    fn serde_round_trip_issuetype() {
        let parsed = round_trip(json!({"type": "issuetype"}));
        assert!(matches!(parsed, FieldSchemaType::Issuetype));
    }

    #[test]
    fn serde_round_trip_priority() {
        let parsed = round_trip(json!({"type": "priority", "system": "priority"}));
        assert!(matches!(parsed, FieldSchemaType::Priority));
    }

    #[test]
    fn serde_unknown_type_falls_through_to_any() {
        // Pitfall A: never panic on unknown schema.type
        let parsed = round_trip(json!({"type": "watches"}));
        assert!(matches!(parsed, FieldSchemaType::Any));
        let parsed2 = round_trip(json!({"type": "timetracking"}));
        assert!(matches!(parsed2, FieldSchemaType::Any));
    }

    #[test]
    fn field_schema_full_row_parses() {
        let row: FieldSchema = serde_json::from_value(json!({
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
        })).unwrap();
        assert_eq!(row.field_id, "customfield_10001");
        assert!(matches!(row.schema, FieldSchemaType::Number { .. }));
    }

    #[test]
    fn createmeta_response_parses_paginated_wrapper() {
        let resp: CreatemetaResponse = serde_json::from_value(json!({
            "startAt": 0,
            "maxResults": 5,
            "total": 7,
            "fields": []
        })).unwrap();
        assert_eq!(resp.start_at, 0);
        assert_eq!(resp.max_results, 5);
        assert_eq!(resp.total, 7);
    }

    #[test]
    fn issue_type_ref_parses() {
        let it: IssueTypeRef = serde_json::from_value(json!({
            "id": "10001",
            "name": "Bug",
            "description": "A defect",
            "iconUrl": "https://example.com/bug.png"
        })).unwrap();
        assert_eq!(it.id, "10001");
        assert_eq!(it.name, "Bug");
    }

    #[test]
    fn field_side_serializes_lowercase() {
        assert_eq!(serde_json::to_value(FieldSide::Source).unwrap(), json!("source"));
        assert_eq!(serde_json::to_value(FieldSide::Target).unwrap(), json!("target"));
    }

    #[test]
    fn field_side_as_str() {
        assert_eq!(FieldSide::Source.as_str(), "source");
        assert_eq!(FieldSide::Target.as_str(), "target");
    }

    // ── Plan 04 unit tests ──────────────────────────────────────────────────

    #[test]
    fn probe_result_serializes_without_credentials() {
        let r = ProbeResult {
            ok: false,
            endpoint_url: "http://127.0.0.1:9999/rest/api/3/issue/createmeta/MYPROJ/issuetypes"
                .into(),
            status_code: None,
            hint: Some(
                "Your proxy may not expose the paginated createmeta endpoint.".into(),
            ),
        };
        let s = serde_json::to_string(&r).unwrap();
        // Must use camelCase keys
        assert!(s.contains("endpointUrl"), "missing endpointUrl key: {s}");
        assert!(s.contains("hint"), "missing hint key: {s}");
        // Must NOT contain any credential substring
        assert!(
            !s.to_lowercase().contains("bearer"),
            "credential leaked (bearer): {s}"
        );
        assert!(
            !s.to_lowercase().contains("basic"),
            "credential leaked (basic): {s}"
        );
    }

    #[test]
    fn pagination_constants_are_sane() {
        assert!(
            CREATEMETA_PAGE_SIZE > 0 && CREATEMETA_PAGE_SIZE <= 100,
            "CREATEMETA_PAGE_SIZE out of range: {CREATEMETA_PAGE_SIZE}"
        );
        assert!(
            MAX_CREATEMETA_PAGES > 0,
            "MAX_CREATEMETA_PAGES must be positive"
        );
    }
}
