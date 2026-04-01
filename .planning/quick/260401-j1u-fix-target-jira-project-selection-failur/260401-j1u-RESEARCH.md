# Fix Target Jira Project Selection Failure - Research

**Researched:** 2026-04-01
**Domain:** Jira Cloud REST API v3 project listing, Tauri frontend-backend data flow
**Confidence:** HIGH

## Summary

The target (Cloud) Jira project selector fails because `fetch_cloud_projects` in `commands.rs` assumes `GET /rest/api/3/project` returns a **flat JSON array**, but Jira Cloud has been migrating endpoints to return **paginated objects** with a `{ values: [...], isLast, startAt, ... }` shape. When the response is paginated, `body.as_array()` returns `None` and the code falls through to `unwrap_or(&vec![])`, yielding an empty project list.

The codebase already has a precedent for handling this exact ambiguity: the `/rest/api/3/priority` fetch at line 191-197 of `commands.rs` defensively handles both flat array and paginated `{ values: [...] }` responses. The project fetch does not apply this same pattern.

Additionally, Atlassian has **deprecated** `GET /rest/api/3/project` in favor of `GET /rest/api/3/project/search`, which always returns a paginated response.

**Primary recommendation:** Apply the same dual-format parsing pattern used for `/priority` to `fetch_cloud_projects`, and consider migrating to `/rest/api/3/project/search` for future-proofing.

## Root Cause Analysis

### The Bug

**File:** `src-tauri/src/commands.rs`, lines 342-352

```rust
// CURRENT (broken for paginated responses):
let projects: Vec<JiraProject> = body
    .as_array()           // Returns None when body is { values: [...] }
    .unwrap_or(&vec![])   // Falls to empty vec
    .iter()
    .filter_map(|p| { ... })
    .collect();
```

### The Fix Pattern (already in codebase)

**File:** `src-tauri/src/commands.rs`, lines 191-197 (priority endpoint)

```rust
// Jira Cloud /rest/api/3/priority returns either a flat array (older) or a
// paginated SearchResult object { values: [...], isLast: bool } (newer).
// Handle both formats defensively.
let prio_items: &Vec<serde_json::Value> = &match prio_body.as_array() {
    Some(arr) => arr.clone(),
    None => prio_body["values"].as_array().cloned().unwrap_or_default(),
};
```

### Why Source Works but Target Fails

| Aspect | Source (Server v2) | Target (Cloud v3) |
|--------|-------------------|-------------------|
| Endpoint | `GET /rest/api/2/project` | `GET /rest/api/3/project` |
| Response format | Always flat JSON array | May be flat array OR paginated object |
| `body.as_array()` | Always `Some(...)` | `None` when paginated |
| Result | Projects load correctly | Empty list (silent failure) |

## Affected Files

| File | Lines | What to Change |
|------|-------|----------------|
| `src-tauri/src/commands.rs` | 342-352 | Apply dual-format parsing (array or `values` key) |
| `src-tauri/src/mock_server.rs` | 771-776 | Optionally update v3 mock to return paginated format for testing |

## Frontend Flow (confirmed working)

The frontend `ProjectSelector` component at `src/features/connections/SettingsPage.tsx` lines 45-69 is correctly structured:

1. For cloud: calls `invoke('fetch_cloud_projects', {})` (no args needed - credentials from DB)
2. Rust command registered in `main.rs` line 220
3. Credentials retrieved via `get_cloud_credentials()` from connection_meta + keychain
4. API call made with Basic auth header
5. **Response parsing is where the bug is** - only handles flat array format

The `onSelect` handler and `saveProjectConfig` flow are correct.

## Fix Implementation

### Minimal Fix (recommended)

Replace lines 342-352 in `commands.rs`:

```rust
// Jira Cloud /rest/api/3/project returns either a flat array (older) or a
// paginated SearchResult object { values: [...], isLast: bool } (newer).
// Handle both formats defensively.
let items = match body.as_array() {
    Some(arr) => arr.clone(),
    None => body["values"].as_array().cloned().unwrap_or_default(),
};

let projects: Vec<JiraProject> = items
    .iter()
    .filter_map(|p| {
        Some(JiraProject {
            key: p["key"].as_str()?.to_string(),
            name: p["name"].as_str()?.to_string(),
        })
    })
    .collect();
```

### Optional: Update Mock Server

Update `src-tauri/src/mock_server.rs` v3 `get_projects` (line 771) to return paginated format:

```rust
pub async fn get_projects() -> impl IntoResponse {
    Json(json!({
        "values": [
            { "key": "MYPROJ", "name": "My Project" },
            { "key": "DEV", "name": "Development" }
        ],
        "startAt": 0,
        "maxResults": 50,
        "total": 2,
        "isLast": true
    }))
}
```

This ensures the mock more accurately represents real Cloud behavior and tests the dual-format parsing.

## Common Pitfalls

### Pitfall 1: Silent Empty Results
**What goes wrong:** `body.as_array().unwrap_or(&vec![])` silently returns empty when the format doesn't match, instead of erroring
**How to avoid:** Log a warning when neither format is detected, or return an error

### Pitfall 2: Jira Cloud API Deprecation
**What goes wrong:** `GET /rest/api/3/project` is deprecated; may stop working entirely
**How to avoid:** Consider migrating to `GET /rest/api/3/project/search` which is the current recommended endpoint and always returns paginated format

## Sources

### Primary (HIGH confidence)
- `src-tauri/src/commands.rs` lines 191-197 - existing dual-format pattern for priority endpoint
- `src-tauri/src/commands.rs` lines 310-355 - the buggy `fetch_cloud_projects` implementation
- `src/features/connections/SettingsPage.tsx` lines 45-69 - ProjectSelector component

### Secondary (MEDIUM confidence)
- [Atlassian REST API Search Endpoints Deprecation](https://docs.adaptavist.com/sr4jc/latest/release-notes/breaking-changes/atlassian-rest-api-search-endpoints-deprecation) - confirms API migration pattern
- [Jira Cloud REST API Projects](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/) - official API reference
- [Community: empty array from project endpoint](https://community.atlassian.com/forums/Jira-questions/when-I-am-trying-to-get-project-list-getting-empty-array/qaq-p/1131909) - confirms empty response issue

## Metadata

**Confidence breakdown:**
- Root cause: HIGH - same pattern already fixed for `/priority` endpoint in same file
- Fix approach: HIGH - copy existing pattern from same codebase
- API deprecation: MEDIUM - based on web search, not verified against latest Atlassian changelog

**Research date:** 2026-04-01
**Valid until:** 2026-05-01
