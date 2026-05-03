---
phase: 18
plan: "01"
subsystem: field_transform
tags: [rust, tauri, field-mapping, scaffolding, types]
dependency_graph:
  requires: []
  provides:
    - "src-tauri/src/field_transform/mod.rs — ResolvedFields, GapVariant, UnresolvedPerson, UnresolvedVersion, UnresolvedComponent, TransformContext, TransformError, FieldMappingRow"
    - "src-tauri/src/field_transform/pipeline.rs — apply_mapping stub"
    - "src-tauri/src/field_transform/user.rs — UserResolver stub"
    - "src-tauri/src/field_transform/version.rs — VersionResolver stub"
    - "src-tauri/src/field_transform/component.rs — ComponentResolver stub"
    - "src-tauri/src/field_transform/wiki_to_adf.rs — convert_and_postprocess stub"
    - "src-tauri/src/field_transform/identity.rs — transform_identity stub"
  affects:
    - "src-tauri/src/lib.rs — pub mod field_transform; registered"
tech_stack:
  added: []
  patterns:
    - "Discriminated union GapVariant with serde tag='kind' (lowercase) over Unresolved* structs"
    - "TransformContext as dependency carrier (no Debug derive — T-18-03 security)"
    - "Stub fn (not async) for no-await-point functions per Phase 17-04 clippy pattern"
    - "BuildHasher generic for HashMap params (implicit_hasher clippy rule)"
key_files:
  created:
    - src-tauri/src/field_transform/mod.rs
    - src-tauri/src/field_transform/pipeline.rs
    - src-tauri/src/field_transform/user.rs
    - src-tauri/src/field_transform/version.rs
    - src-tauri/src/field_transform/component.rs
    - src-tauri/src/field_transform/wiki_to_adf.rs
    - src-tauri/src/field_transform/identity.rs
  modified:
    - src-tauri/src/lib.rs
decisions:
  - "Stub resolve_batch/resolve_name without async (clippy unused_async per Phase 17-04 pattern); Plans 02-03 add async back when adding await points"
  - "TransformContext intentionally has no Debug derive (T-18-03: cloud_auth &str borrow must not appear in backtraces)"
  - "FieldMappingRow stub defined in mod.rs until Phase 19 moves it to field_mapping_db.rs"
  - "BuildHasher generic on convert_and_postprocess to satisfy clippy implicit_hasher"
metrics:
  duration: 29
  completed_date: "2026-04-27"
  tasks_completed: 2
  files_created: 7
  files_modified: 1
---

# Phase 18 Plan 01: field_transform Module Scaffolding Summary

Wave 0 scaffolding for `field_transform/` submodule — shared types, 6 transformer stubs, and lib.rs registration. All 10 tests pass, clippy clean.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create field_transform/mod.rs with shared types and re-exports | 9715a9e | src-tauri/src/field_transform/mod.rs |
| 2 | Create stub files for all 6 transformer modules + register in lib.rs | 774b4b6 | pipeline.rs, user.rs, version.rs, component.rs, wiki_to_adf.rs, identity.rs, lib.rs |

## Key Contracts

### ResolvedFields (mod.rs)
```rust
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ResolvedFields {
    pub fields: serde_json::Map<String, serde_json::Value>,
    pub gaps: Vec<GapVariant>,
}
```

### GapVariant (mod.rs)
```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum GapVariant {
    Person(UnresolvedPerson),
    Version(UnresolvedVersion),
    Component(UnresolvedComponent),
}
```

### TransformContext (mod.rs — no Debug derive, T-18-03)
```rust
pub struct TransformContext<'a> {
    pub client: &'a reqwest::Client,
    pub cloud_auth: &'a str,
    pub cloud_base_url: &'a str,
    pub target_project_key: &'a str,
    pub user_resolver: &'a UserResolver,
    pub version_resolver: &'a VersionResolver,
    pub component_resolver: &'a ComponentResolver,
    pub user_map: &'a HashMap<String, Option<String>>,
}
```

### TransformError (mod.rs)
```rust
#[derive(Debug, thiserror::Error)]
pub enum TransformError {
    #[error("HTTP error: {0}")] Http(String),
    #[error("Internal error: {0}")] Internal(String),
    #[error("Serialization error: {0}")] Serialization(String),
}
impl From<crate::error::AppError> for TransformError { ... }
```

### Stub signatures for Plans 02-05

```rust
// pipeline.rs — Plan 05 fills body
pub async fn apply_mapping(
    _source_issue: &serde_json::Value,
    _mapping: &[FieldMappingRow],
    _ctx: &TransformContext<'_>,
) -> ResolvedFields

// user.rs — Plan 03 makes async and fills body
pub fn resolve_batch(&self, _source_issue: &serde_json::Value, _mapping: &[FieldMappingRow]) -> HashMap<String, Option<String>>

// version.rs / component.rs — Plan 02 makes async and fills body
pub fn resolve_name(&self, _project_key: &str, _source_name: &str) -> Option<String>

// wiki_to_adf.rs — Plan 04 fills body
pub fn convert_and_postprocess<S: BuildHasher>(_html: &str, _user_map: &HashMap<String, Option<String>, S>) -> serde_json::Value

// identity.rs — Plan 04 fills body
pub fn transform_identity(source_value: &Value, _target_schema: &FieldSchemaType) -> Value
```

## Test Results

```
running 10 tests
test field_transform::tests::transform_error_distinct_from_gaps ... ok
test field_transform::tests::resolved_fields_default_empty ... ok
test field_transform::tests::gap_variant_serializes_with_kind_tag ... ok
test field_transform::tests::unresolved_person_carries_source_identity ... ok
test field_transform::identity::tests::identity_stub_passes_text_through ... ok
test field_transform::wiki_to_adf::tests::wiki_to_adf_stub_returns_empty_doc ... ok
test field_transform::pipeline::tests::apply_mapping_stub_returns_empty_resolved_fields ... ok
test field_transform::version::tests::version_resolver_stub_constructs ... ok
test field_transform::component::tests::component_resolver_stub_constructs ... ok
test field_transform::user::tests::user_resolver_stub_constructs ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 86 filtered out
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Clippy pedantic gate failures on stub async functions**
- **Found during:** Task 2 verification
- **Issue:** clippy `unused_async` lint on `resolve_batch` (user.rs), `resolve_name` (version.rs, component.rs) — stub bodies have no await points; `-D warnings` treats this as an error
- **Fix:** Removed `async` from stub signatures; added doc note "Plan 02/03 makes this async". Pattern consistent with Phase 17-04 decision: "refresh_field_schema_cache is synchronous — no await points; clippy unused_async enforced by -D warnings"
- **Files modified:** user.rs, version.rs, component.rs
- **Commit:** 774b4b6

**2. [Rule 1 - Bug] Clippy doc formatting warnings**
- **Found during:** Task 2 verification
- **Issue:** `doc_list_item_overindented` in mod.rs line 9 (continuation of bullet list was over-indented); `doc_list_item_without_indentation` in pipeline.rs (list item continuation lacked blank line separator)
- **Fix:** Adjusted indentation to 4 spaces in mod.rs; added blank lines around numbered list in pipeline.rs doc comment
- **Files modified:** mod.rs, pipeline.rs
- **Commit:** 774b4b6

**3. [Rule 1 - Bug] Clippy doc_markdown — unquoted filename in wiki_to_adf.rs module doc**
- **Found during:** Task 2 verification
- **Issue:** `wiki_to_adf.rs` in module doc not wrapped in backticks
- **Fix:** Wrapped in backticks: `` `wiki_to_adf.rs` ``
- **Files modified:** wiki_to_adf.rs
- **Commit:** 774b4b6

**4. [Rule 1 - Bug] Clippy implicit_hasher on convert_and_postprocess**
- **Found during:** Task 2 verification
- **Issue:** `HashMap<String, Option<String>>` parameter not generic over hasher
- **Fix:** Added `<S: BuildHasher>` generic to `convert_and_postprocess` and updated the `HashMap` parameter type to `HashMap<String, Option<String>, S>`
- **Files modified:** wiki_to_adf.rs
- **Commit:** 774b4b6

## Next-Plan Hand-off Notes

**Plan 02** fills `version.rs` and `component.rs`. Expects:
- `SessionVersionCache = Arc<Mutex<HashMap<String, Vec<serde_json::Value>>>>` from mod.rs
- `SessionComponentCache` (same shape) from mod.rs
- `VersionResolver::new(client, cloud_auth, cloud_base_url)` constructor from version.rs
- `ComponentResolver::new(client, cloud_auth, cloud_base_url)` constructor from component.rs
- Plan 02 should change `pub fn resolve_name` to `pub async fn resolve_name` when adding the real HTTP body

**Plan 03** fills `user.rs`. Expects:
- `UserResolver::new(client, cloud_auth, cloud_base_url)` constructor
- `FieldMappingRow` struct from mod.rs for `resolve_batch` signature
- Plan 03 should change `pub fn resolve_batch` to `pub async fn resolve_batch` when adding the real HTTP body

**Plan 04** fills `wiki_to_adf.rs` and `identity.rs`. Expects:
- `FieldSchemaType` from `crate::field_discovery` already imported in identity.rs
- `convert_and_postprocess` is generic over hasher (`S: BuildHasher`) — maintain this signature

**Plan 05** fills `pipeline.rs`. Expects:
- `TransformContext<'a>` fully assembled with all resolver references
- `apply_mapping` is already `async fn` — no change needed to the stub signature

## Known Stubs

All stub functions are intentional — each has a doc comment indicating which downstream plan fills the real body. No stubs prevent the plan's goal (scaffolding the module contracts).

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced in Plan 01. All files define pure types and synchronous/no-op stubs. T-18-03 mitigated by no `Debug` derive on `TransformContext`.

## Self-Check: PASSED

- [x] `src-tauri/src/field_transform/mod.rs` exists
- [x] `src-tauri/src/field_transform/pipeline.rs` exists
- [x] `src-tauri/src/field_transform/user.rs` exists
- [x] `src-tauri/src/field_transform/version.rs` exists
- [x] `src-tauri/src/field_transform/component.rs` exists
- [x] `src-tauri/src/field_transform/wiki_to_adf.rs` exists
- [x] `src-tauri/src/field_transform/identity.rs` exists
- [x] Commit 9715a9e exists (Task 1)
- [x] Commit 774b4b6 exists (Task 2)
- [x] 10 tests pass
- [x] clippy --lib -- -D warnings exits 0
- [x] cargo build --lib exits 0
