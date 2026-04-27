---
phase: 18
plan: "05"
subsystem: field_transform
tags: [rust, pipeline, integration-tests, two-phase, mock-fixtures]
dependency_graph:
  requires:
    - phase: 18-01
      provides: field_transform module scaffolding — shared types, pipeline.rs stub
    - phase: 18-02
      provides: VersionResolver::resolve_name, ComponentResolver::resolve_name
    - phase: 18-03
      provides: UserResolver::resolve_batch, is_user_field, extract_usernames_from_field
    - phase: 18-04
      provides: wiki_to_adf::convert_and_postprocess, identity::transform_identity
  provides:
    - "pipeline::apply_mapping — two-phase async entry point (TRAN-01..06)"
    - "dispatch_user — single + array<user> write-shape correct, partial resolution (D-03)"
    - "dispatch_version_array — partial resolution with UnresolvedVersion gaps"
    - "dispatch_component_array — partial resolution with UnresolvedComponent gaps"
    - "12 pipeline tests (10 unit + 2 round-trip integration)"
  affects:
    - "Phase 23 copy_ticket_v2 — calls apply_mapping as the field translation entry point"
    - "Phase 22 required-field gating — reads ResolvedFields.gaps"
tech_stack:
  added: []
  patterns:
    - "Two-phase caller contract: caller pre-builds user_map via UserResolver::resolve_batch BEFORE calling apply_mapping"
    - "Dispatch by FieldSchemaType discriminant — no string transformer_kind lookup at runtime"
    - "Partial array resolution: resolved entries in output array, unresolved emitted as typed GapVariant per entry (D-03)"
    - "Description routing: prefer renderedFields over raw fields for wiki_to_adf input"
    - "Null-safe source access: source_issue.pointer() returns Option, unwrapped to Value::Null on miss"
key_files:
  created: []
  modified:
    - src-tauri/src/field_transform/pipeline.rs
decisions:
  - "apply_mapping does NOT call resolve_batch internally — caller is responsible for Phase 1; this decouples pipeline testability from network mocks"
  - "dispatch_user checks FieldSchemaType::Array discriminant for array-user vs single-user dispatch"
  - "dispatch_version_array / dispatch_component_array: omit field key entirely when ALL entries are unresolved (write-shape safety)"
  - "spawn_full_mock in tests serves all three needed endpoints (versions, components, user/search) from a single axum router"
  - "user_search mock matches query containing @acme.com (not exact equality) to handle URL-encoded query strings from UserResolver"
metrics:
  duration: 43
  completed_date: "2026-04-27"
  tasks_completed: 2
  files_created: 0
  files_modified: 1
---

# Phase 18 Plan 05: pipeline::apply_mapping Implementation Summary

**Two-phase async apply_mapping + per-row dispatch by FieldSchemaType + 12 tests covering all gap types and 8 field-type write shapes including ≥4 custom-field types round-trip**

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement two-phase apply_mapping with per-row dispatch + partial array resolution | 8b8f60a | src-tauri/src/field_transform/pipeline.rs |
| 2 | Round-trip integration test exercising ≥4 custom-field types end-to-end | 8b8f60a | src-tauri/src/field_transform/pipeline.rs |

Both tasks were committed together as a single coherent implementation (TDD: implementation + tests in one pass since the tests were written concurrently with the implementation).

## Key Function Signatures

```rust
// pipeline.rs — the two-phase async entry point
pub async fn apply_mapping(
    source_issue: &Value,
    mapping: &[FieldMappingRow],
    ctx: &TransformContext<'_>,
) -> ResolvedFields  // NEVER Err for business gaps (D-01)
```

## Dispatch Decision Table

| `source_schema` Discriminant | Dispatcher | Output |
|------------------------------|-----------|--------|
| `String { system: Some("description") }` | `wiki_to_adf::convert_and_postprocess` | ADF `doc` node |
| `User { .. }` | `dispatch_user` (single) | `{"accountId":"..."}` or `UnresolvedPerson` gap |
| `Array { items: "user" }` | `dispatch_user` (array) | `[{"accountId":"..."}]` + gaps per unresolved (D-03) |
| `Array { items: "version" }` | `dispatch_version_array` | `[{"id":"..."}]` + `UnresolvedVersion` gaps |
| `Array { items: "component" }` | `dispatch_component_array` | `[{"id":"..."}]` + `UnresolvedComponent` gaps |
| All others | `identity::transform_identity` | Write-shape corrected (Priority→`{id}`, Option_→`{value}`, passthrough for Number/String/Date) |

## Phase 23 Consumption Pattern

```rust
// In copy_ticket_v2 (Phase 23):
let user_map = ctx.user_resolver.resolve_batch(&source_issue, &mapping).await; // Phase 1
let ctx_with_map = TransformContext { user_map: &user_map, ..ctx };
let resolved = apply_mapping(&source_issue, &mapping, &ctx_with_map).await; // Phase 2
let post_body = json!({ "fields": resolved.fields });
// resolved.gaps → Phase 22 required-field gating UI
```

## Test Coverage

| Test | Covers |
|------|--------|
| `apply_mapping_returns_resolved_fields_for_text_only_mapping` | String identity passthrough |
| `apply_mapping_resolves_assignee_to_account_id` | Single user → `{accountId}` write shape |
| `apply_mapping_unresolvable_assignee_emits_unresolved_person_gap` | D-01/D-02: gap emitted, field omitted |
| `apply_mapping_array_users_partial_resolution_d3` | D-03: partial array resolution |
| `apply_mapping_priority_strips_to_id_write_shape` | Pitfall 4: Priority → `{id}` |
| `apply_mapping_version_resolves_to_id` | Array<version> → `[{id}]` |
| `apply_mapping_unresolvable_version_emits_gap` | UnresolvedVersion gap |
| `apply_mapping_component_resolves_to_id` | Array<component> → `[{id}]` |
| `apply_mapping_array_of_versions_partial_resolution` | Partial version array (D-03 analog) |
| `apply_mapping_description_runs_through_wiki_to_adf` | Description → ADF with mention node |
| `apply_mapping_round_trip_four_custom_fields` | 8 field types end-to-end, gap assertion, TRAN-06 counter |
| `apply_mapping_user_resolver_called_exactly_once` | TRAN-06: single HTTP call for Phase 1 batch |

## Test Results

```
running 12 tests
test field_transform::pipeline::tests::apply_mapping_array_of_versions_partial_resolution ... ok
test field_transform::pipeline::tests::apply_mapping_array_users_partial_resolution_d3 ... ok
test field_transform::pipeline::tests::apply_mapping_component_resolves_to_id ... ok
test field_transform::pipeline::tests::apply_mapping_description_runs_through_wiki_to_adf ... ok
test field_transform::pipeline::tests::apply_mapping_priority_strips_to_id_write_shape ... ok
test field_transform::pipeline::tests::apply_mapping_resolves_assignee_to_account_id ... ok
test field_transform::pipeline::tests::apply_mapping_returns_resolved_fields_for_text_only_mapping ... ok
test field_transform::pipeline::tests::apply_mapping_round_trip_four_custom_fields ... ok
test field_transform::pipeline::tests::apply_mapping_unresolvable_assignee_emits_unresolved_person_gap ... ok
test field_transform::pipeline::tests::apply_mapping_unresolvable_version_emits_gap ... ok
test field_transform::pipeline::tests::apply_mapping_user_resolver_called_exactly_once ... ok
test field_transform::pipeline::tests::apply_mapping_version_resolves_to_id ... ok

test result: ok. 12 passed; 0 failed; 0 ignored; 0 measured; 145 filtered out
```

Full `field_transform` module: **71 tests passing, 0 failing**.

## ROADMAP Success Criterion 4 Closed

Round-trip test `apply_mapping_round_trip_four_custom_fields` exercises 8 field types end-to-end:
1. **Number** (customfield_10001) — identity passthrough `5`
2. **Multi-select / Array<option>** (customfield_10006) — strips to `[{"value":"Blocker"}]`
3. **Single-user** (customfield_10003) — resolves to `{"accountId":"AID-A"}`
4. **Date** (customfield_10004) — identity passthrough `"2026-04-27"`
5. **Description** — ADF doc with `mention` node referencing resolved `accountId`
6. **Array<version>** (fixVersions) — partial: `[{"id":"20010"}]` + 1 UnresolvedVersion gap
7. **Array<component>** (components) — `[{"id":"30001"}]`
8. **Priority** — strips to `{"id":"3"}`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Clippy pedantic — doc_markdown missing backticks**
- **Found during:** Task 1 clippy run
- **Issue:** `FieldSchemaType` in module doc comment line 3 not in backticks
- **Fix:** Wrapped in backticks: `` `FieldSchemaType` ``
- **Files modified:** pipeline.rs
- **Commit:** 8b8f60a (included in final version)

**2. [Rule 1 - Bug] Clippy — unused import `std::collections::HashMap` in non-test scope**
- **Found during:** Task 1 clippy run
- **Issue:** `HashMap` was imported at the module level but only used inside `#[cfg(test)]` — clippy flags unused import at file level
- **Fix:** Removed module-level import; added `use std::collections::HashMap;` inside `mod tests`
- **Files modified:** pipeline.rs
- **Commit:** 8b8f60a (included in final version)

**3. [Rule 1 - Bug] Mock user/search query matching too strict**
- **Found during:** Task 2 round-trip test debugging
- **Issue:** The plan's `spawn_full_mock` used `qs == "@acme.com"` but `UserResolver::fetch_users_by_domain` URL-encodes the query string via `urlencoding::encode`, producing `%40acme.com` in the URL. The query parameter parsed from the URL is `@acme.com` however (browsers decode), but exact matching could be fragile with different query forms.
- **Fix:** Changed mock query check from `qs == "@acme.com"` to `qs.contains("@acme.com")` to be robust across any URL encoding variations
- **Files modified:** pipeline.rs
- **Commit:** 8b8f60a

## Phase Close Note

Phase 18 ships the complete pure-Rust v2→v3 translation pipeline:
- Plan 01: module scaffolding + shared types
- Plan 02: VersionResolver + ComponentResolver (HTTP + cache)
- Plan 03: UserResolver + batch resolution (TRAN-06)
- Plan 04: wiki_to_adf (mention nodes + macro placeholders) + identity (write-shape correction)
- Plan 05 (this plan): apply_mapping pipeline integration + tests

**Phase 19** adds `FieldMappingRow` persistence to SQLite (`field_mapping_db.rs`).
**Phase 23** wires `copy_ticket_v2` to call `apply_mapping` as the field translation entry point.

## Known Stubs

None — `pipeline.rs` is fully implemented. No data stubs, no placeholder text.

## Threat Flags

No new network endpoints introduced (tests spawn ephemeral axum mock servers on random ports, not production routes). Non-test code has zero `unwrap()` or `expect()` calls — T-18-22 mitigated (T-18-22: `cloud_auth` would leak via panic backtrace).

T-18-23 verified: `dispatch_user` constructs `json!({"accountId": ...})` explicitly — no code path emits `{"name":...}` or `{"key":...}` for user fields.

## Self-Check: PASSED

- [x] `src-tauri/src/field_transform/pipeline.rs` exists (699 lines)
- [x] Commit 8b8f60a exists
- [x] `pub async fn apply_mapping` present (count: 1)
- [x] `fn dispatch_user` present (count: 1)
- [x] `fn dispatch_version_array` present (count: 1)
- [x] `fn dispatch_component_array` present (count: 1)
- [x] `is_description_row` present (count: 2 — definition + call)
- [x] `wiki_to_adf::convert_and_postprocess` present (count: 1)
- [x] `identity::transform_identity` present (count: 1)
- [x] All 12 pipeline tests pass
- [x] Full field_transform suite: 71 passed, 0 failed
- [x] `cargo clippy --lib -- -D warnings` exits 0
- [x] Round-trip test exercises ≥4 custom-field types (exercises 8)
- [x] TRAN-06 invariant proven end-to-end (counter assertion in 2 tests)
