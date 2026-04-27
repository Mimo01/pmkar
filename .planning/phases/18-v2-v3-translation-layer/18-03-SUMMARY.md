---
phase: 18
plan: "03"
subsystem: field-transform
tags: [rust, http, user-resolution, batched-lookup, mention-prescan, tdd]
dependency_graph:
  requires: [18-01]
  provides: [user-resolver, scan-mention-patterns, scan-html-profile-links, resolve-batch]
  affects: [18-05-pipeline]
tech_stack:
  added: []
  patterns: [paginated-http-per-domain, hand-written-scanner, privacy-mode-heuristic]
key_files:
  created: []
  modified:
    - src-tauri/src/field_transform/user.rs
decisions:
  - "Hand-written byte-level mention scanner chosen over regex to avoid adding regex crate dep (per RESEARCH recommendation)"
  - "DoS bound of 500 KB enforced at scanner level — not configurable — matches RESEARCH §Security Domain"
  - "Privacy-mode Pitfall 2 handled by implicit single-result match when no emailAddress present in domain search results"
  - "fetch_users_by_domain hard-bounded to 50 pagination iterations (mirrors commands.rs:1096-1147 pattern)"
  - "extract_email_for_username prefers name > key > emailAddress order — consistent with Phase 16 identifier preference"
metrics:
  duration: "12 min"
  completed: "2026-04-27"
  tasks: 2
  files: 1
---

# Phase 18 Plan 03: UserResolver Batch Resolution Summary

UserResolver::resolve_batch with one-HTTP-per-domain batching, hand-written mention scanners, privacy-mode matching, and 20 passing tests.

## What Was Built

### Task 1: Helper Layer (12 tests)

Five helper functions implemented in `src-tauri/src/field_transform/user.rs`:

- `scan_mention_patterns(text: &str) -> HashSet<String>` — hand-written byte scanner for `[~username]` wiki patterns, bounded to 500 KB
- `scan_html_profile_links(text: &str) -> HashSet<String>` — matches `?name=USERNAME` or `&name=USERNAME` URL params in rendered HTML (Pitfall C), rejects `<input name="...">` false positives
- `is_user_field(s: &FieldSchemaType) -> bool` — discriminates `FieldSchemaType::User` and `Array{items=="user"}`
- `extract_usernames_from_field(value: &serde_json::Value) -> Vec<String>` — handles single user object and array shapes; prefers `name` > `key` > `emailAddress`
- `collect_description_mentions(source_issue: &serde_json::Value) -> HashSet<String>` — unions raw wiki + rendered HTML scans (D-06)

### Task 2: Network Layer (8 tests)

Full `UserResolver::resolve_batch` implementation:

```rust
pub async fn resolve_batch(
    &self,
    source_issue: &serde_json::Value,
    mapping: &[FieldMappingRow],
) -> HashMap<String, Option<String>>
```

Algorithm (3 passes):
1. Collect unique identifiers from person-typed mapping rows + description mentions
2. Group by email domain (identifiers without email go to no-domain bucket)
3. ONE `fetch_users_by_domain` call per unique domain (TRAN-06 invariant); fallback `fetch_users_by_query` per username for no-email identifiers

Supporting functions:
```rust
async fn fetch_users_by_domain(&self, domain: &str) -> Result<Vec<serde_json::Value>, ()>
async fn fetch_users_by_query(&self, query: &str) -> Result<Vec<serde_json::Value>, ()>
fn extract_email_for_username(field_val: &serde_json::Value, username: &str) -> Option<String>
fn match_user_in_results(results: &[serde_json::Value], email: Option<&str>, username: &str) -> Option<String>
```

## HTTP Call Counts Verified by Tests

| Test | Scenario | Expected calls | Result |
|------|----------|---------------|--------|
| `resolve_batch_one_http_per_domain` | 3 users in 1 domain | 1 | PASS |
| `resolve_batch_two_domains_two_http` | 2 users in 2 domains | 2 | PASS |
| `resolve_batch_dedupes_repeated_usernames` | assignee=alice + reporter=alice | 1 | PASS |

## Privacy Mode (Pitfall 2)

`match_user_in_results` implements three-tier matching:
1. Exact `emailAddress` match — preferred
2. Zero emails in results + exactly one result → implicit match (privacy mode)
3. Single result + `displayName` case-insensitive match → fallback

Test `resolve_batch_privacy_mode_single_match_treated_high_confidence` verifies tier 2.

## Security / Threat Model Compliance

| Threat | Mitigation | Verified |
|--------|-----------|----------|
| T-18-10 DoS via huge description | `MAX_DESCRIPTION_SCAN_BYTES = 500 * 1024` | `scan_mention_bounded_to_500kb` test |
| T-18-11 Domain injection in URL | `urlencoding::encode(&query)` before format | Source review |
| T-18-12 Auth header leak | `UserResolver` does NOT derive `Debug` | Structural |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Clippy doc-lint violations in comments**
- **Found during:** Task 2 verification
- **Issue:** Module-level and function-level doc comments had lazy continuation lines that clippy `-D warnings` treats as errors; also missing backticks on acronyms (DoS, AuditDb)
- **Fix:** Reformatted doc comments with proper blank lines between paragraphs; wrapped acronyms in backticks; removed continuation indentation issues
- **Files modified:** `src-tauri/src/field_transform/user.rs`
- **Commit:** 9561d16 (included in Task 2 commit after fixing)

**2. [Rule 1 - Bug] Redundant closure in resolve_batch**
- **Found during:** Task 2 clippy check
- **Issue:** `.and_then(|e| e.clone())` flagged as redundant closure
- **Fix:** Replaced with `.and_then(std::clone::Clone::clone)`
- **Files modified:** `src-tauri/src/field_transform/user.rs`
- **Commit:** 9561d16

## Hand-off Note for Plan 05 (pipeline.rs)

`pipeline.rs` invokes `resolve_batch` in Phase 1, populates `TransformContext.user_map`, then Phase 2 transformers consume the map:

```rust
// Phase 1 — batch resolution
let user_map = ctx.user_resolver.resolve_batch(&source_issue, mapping).await;

// Phase 2 — per-row dispatch passes user_map via TransformContext
let ctx = TransformContext { ..., user_map: &user_map, ... };
```

The `user_map` value is `HashMap<String, Option<String>>` where `None` means "unresolvable" — Plan 05's person transformer must emit a `GapVariant::Person(UnresolvedPerson { ... })` for those entries.

## Test Results

```
running 20 tests
test field_transform::user::tests::scan_mention_extracts_simple_pattern ... ok
test field_transform::user::tests::scan_mention_extracts_multiple ... ok
test field_transform::user::tests::scan_mention_handles_dotted_username ... ok
test field_transform::user::tests::scan_mention_ignores_unclosed ... ok
test field_transform::user::tests::scan_mention_bounded_to_500kb ... ok
test field_transform::user::tests::scan_html_profile_link_extracts_name_param ... ok
test field_transform::user::tests::scan_html_profile_link_ignores_html_attribute_named_name ... ok
test field_transform::user::tests::is_user_field_recognises_single_user ... ok
test field_transform::user::tests::is_user_field_recognises_array_of_user ... ok
test field_transform::user::tests::extract_usernames_from_field_handles_single_user_object ... ok
test field_transform::user::tests::extract_usernames_from_field_handles_array_of_users ... ok
test field_transform::user::tests::collect_description_mentions_unions_raw_and_rendered ... ok
test field_transform::user::tests::resolve_batch_one_http_per_domain ... ok
test field_transform::user::tests::resolve_batch_two_domains_two_http ... ok
test field_transform::user::tests::resolve_batch_includes_description_mentions_in_count ... ok
test field_transform::user::tests::resolve_batch_empty_email_returns_unresolved ... ok
test field_transform::user::tests::resolve_batch_privacy_mode_single_match_treated_high_confidence ... ok
test field_transform::user::tests::resolve_batch_http_500_returns_none_for_that_domain ... ok
test field_transform::user::tests::resolve_batch_paginates_when_page_full ... ok
test field_transform::user::tests::resolve_batch_dedupes_repeated_usernames ... ok

test result: ok. 20 passed; 0 failed; 0 ignored; 0 measured; 95 filtered out
```

## Self-Check: PASSED

- [x] `src-tauri/src/field_transform/user.rs` exists and has 450+ lines
- [x] Commit `c50e0a0` (Task 1) verified in git log
- [x] Commit `9561d16` (Task 2) verified in git log
- [x] No `regex` dep in Cargo.toml
- [x] All 20 tests pass
- [x] `cargo clippy -p pmkar --lib -- -D warnings` exits 0 (0 errors)
