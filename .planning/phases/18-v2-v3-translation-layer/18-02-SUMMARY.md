---
phase: 18
plan: "02"
subsystem: field_transform
tags: [rust, http, version-component-resolution, session-cache, tdd]
dependency_graph:
  requires: [18-01]
  provides: [VersionResolver, ComponentResolver]
  affects: [18-05-pipeline]
tech_stack:
  added: []
  patterns:
    - Cache-first Arc<Mutex<HashMap>> with short lock windows (no lock held during HTTP await)
    - Case-insensitive name matching via eq_ignore_ascii_case (Pitfall D mitigation)
    - Pagination guard with MAX_*_PAGES=50 upper bound (T-18-07 DoS mitigation)
    - urlencoding::encode for path segments (T-18-05 path injection mitigation)
    - Dual body-shape detection (flat array OR {values: [...]}) for endpoint flexibility
key_files:
  created: []
  modified:
    - src-tauri/src/field_transform/version.rs
    - src-tauri/src/field_transform/component.rs
decisions:
  - "resolve_name changed from sync to async (stub was sync; implementation requires HTTP await)"
  - "No Debug derive on resolver structs — cloud_auth credential must not appear in debug output (T-18-06)"
  - "Return None (not Err) on HTTP failure — pipeline keeps flowing via UnresolvedVersion/Component gaps (D-01)"
metrics:
  duration: "~8 min"
  completed: "2026-04-27"
  tasks: 2
  files_modified: 2
---

# Phase 18 Plan 02: VersionResolver + ComponentResolver Summary

**One-liner:** Cached HTTP resolvers for v2 version/component names to Cloud IDs using Arc<Mutex<HashMap>> session cache with short lock windows and case-insensitive matching.

## What Was Built

### VersionResolver (`src-tauri/src/field_transform/version.rs`)

Final type signature:

```rust
pub struct VersionResolver {
    pub client: reqwest::Client,
    pub cloud_auth: String,
    pub cloud_base_url: String,
    pub cache: SessionVersionCache,  // Arc<Mutex<HashMap<String, Vec<serde_json::Value>>>>
}

impl VersionResolver {
    pub fn new(client: reqwest::Client, cloud_auth: String, cloud_base_url: String) -> Self
    pub async fn resolve_name(&self, project_key: &str, source_name: &str) -> Option<String>
}
```

Endpoint: `GET /rest/api/3/project/{key}/versions`

### ComponentResolver (`src-tauri/src/field_transform/component.rs`)

Structurally identical twin:

```rust
pub struct ComponentResolver {
    pub client: reqwest::Client,
    pub cloud_auth: String,
    pub cloud_base_url: String,
    pub cache: SessionComponentCache,  // Arc<Mutex<HashMap<String, Vec<serde_json::Value>>>>
}

impl ComponentResolver {
    pub fn new(client: reqwest::Client, cloud_auth: String, cloud_base_url: String) -> Self
    pub async fn resolve_name(&self, project_key: &str, source_name: &str) -> Option<String>
}
```

Endpoint: `GET /rest/api/3/project/{key}/components`

## Test Results

### VersionResolver — 6/6 tests passing

| Test | Status |
|------|--------|
| `resolve_name_returns_id_for_exact_name` | PASS |
| `resolve_name_case_insensitive` | PASS |
| `resolve_name_returns_none_for_missing` | PASS |
| `cache_hit_skips_second_http` | PASS |
| `http_failure_returns_none_not_err` | PASS |
| `empty_project_key_returns_none_no_panic` | PASS |

### ComponentResolver — 6/6 tests passing

| Test | Status |
|------|--------|
| `resolve_name_returns_id_for_exact_name` | PASS |
| `resolve_name_case_insensitive` | PASS |
| `resolve_name_returns_none_for_missing` | PASS |
| `cache_hit_skips_second_http` | PASS |
| `http_failure_returns_none_not_err` | PASS |
| `empty_inputs_return_none` | PASS |

Total: 12 tests, 12 passing. `cargo build --lib` clean. `cargo clippy -D warnings`: 0 errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stub API mismatch] resolve_name changed from sync to async**
- **Found during:** Task 1 implementation
- **Issue:** Plan 01 stub declared `resolve_name` as `fn` (sync) with comment "Plan 02 makes this async". The implementation required `async fn` to support `await` on the HTTP fetch. This is a trivial API evolution, not a structural change.
- **Fix:** Changed function signature to `pub async fn resolve_name(...)` in both files. No callers in the codebase yet (pipeline.rs stub doesn't call resolve_name), so zero downstream breakage.
- **Files modified:** `version.rs`, `component.rs`
- **Commit:** 32eb4be, ce7f8d6

None — plan executed exactly as written (aside from the expected async promotion documented above).

## Threat Surface

All threats in plan's threat register were addressed:

| Threat | Status |
|--------|--------|
| T-18-05: Path injection via project_key | Mitigated — urlencoding::encode in both files |
| T-18-06: cloud_auth credential in debug output | Mitigated — no `#[derive(Debug)]` on resolver structs |
| T-18-07: Pagination DoS via hostile endpoint | Mitigated — MAX_*_PAGES=50 hard ceiling |
| T-18-08: Unexpected body shape | Accepted — returns Err(()) → None, no panic |
| T-18-09: Bypasses audit middleware | Accepted — plain client for Phase 18; Phase 23 wires audited client |

No new threat surface introduced beyond what the plan's threat model covers.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: VersionResolver | 32eb4be | src-tauri/src/field_transform/version.rs |
| Task 2: ComponentResolver | ce7f8d6 | src-tauri/src/field_transform/component.rs |

## Hand-off to Plan 05

Plan 05 (`pipeline.rs`) constructs both resolvers via `TransformContext`:

```rust
let ctx = TransformContext {
    version_resolver: &VersionResolver::new(client.clone(), cloud_auth.into(), base_url.into()),
    component_resolver: &ComponentResolver::new(client.clone(), cloud_auth.into(), base_url.into()),
    // ...
};
```

For each mapping row with `transformer_kind = "version"`, pipeline calls `ctx.version_resolver.resolve_name(ctx.target_project_key, source_name).await`. On `None`, it appends `GapVariant::Version(UnresolvedVersion { ... })` to `ResolvedFields.gaps`. Same pattern for `"component"` kind using `ComponentResolver`.

## Self-Check: PASSED

- [x] `src-tauri/src/field_transform/version.rs` exists and has 195+ lines
- [x] `src-tauri/src/field_transform/component.rs` exists and has 189+ lines
- [x] Commit 32eb4be exists (VersionResolver)
- [x] Commit ce7f8d6 exists (ComponentResolver)
- [x] 12/12 tests pass
- [x] clippy -D warnings: 0 errors
- [x] No stubs or TODO markers in implemented files
