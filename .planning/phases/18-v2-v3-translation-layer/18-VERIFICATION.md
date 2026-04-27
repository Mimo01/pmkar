---
phase: 18-v2-v3-translation-layer
verified: 2026-04-27T16:00:00Z
status: human_needed
score: 7/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Verify TRAN-05 scope for links/blockquotes/hard-breaks: open a source Jira ticket containing wiki markup with hyperlinks, blockquotes, and hard-breaks. Run the pipeline and confirm the produced ADF document either (a) contains correct link marks and blockquote nodes (inherited from htmltoadf), or (b) degrades to placeholder text where htmltoadf does not handle them."
    expected: "The ADF output contains hyperlinks as inline marks on text nodes, blockquotes as blockquote ADF nodes, and hard-breaks as hardBreak ADF nodes — OR those elements degrade gracefully to plain text. No panic. No data loss."
    why_human: "ROADMAP SC3 says the post-processor wraps htmltoadf coverage gaps for links, blockquotes, and hard-breaks. The implementation handles only mentions (D-04/D-05) and macro placeholders (D-07) in the post-processor. Whether htmltoadf itself handles links/blockquotes/hard-breaks correctly (making the post-processor unnecessary for them) cannot be verified by grep — it requires running the pipeline with representative input and inspecting the ADF output. mediaSingle is explicitly deferred to Phase 23 per CONTEXT.md."
---

# Phase 18: v2→v3 Translation Layer Verification Report

**Phase Goal:** Implement the field_transform/ submodule — a complete v2→v3 translation layer with typed gap variants, batch user resolution, ADF conversion, and a two-phase pipeline that dispatches all field types. All 5 plans complete.
**Verified:** 2026-04-27T16:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Given source user fields (assignee, reporter, custom user arrays), the pipeline resolves each unique user to a Cloud accountId in a single batched lookup pass per email domain | VERIFIED | `apply_mapping_round_trip_four_custom_fields` test asserts `user_search_counter == 1` for 1 domain; `resolve_batch_one_http_per_domain` proves 3 users → 1 HTTP call; `resolve_batch_two_domains_two_http` proves 2 domains → 2 calls |
| 2 | Given source fixVersions/versions/components by name, the pipeline produces target POST body with correct Cloud IDs looked up against /versions and /components endpoints | VERIFIED | Tests `apply_mapping_version_resolves_to_id`, `apply_mapping_component_resolves_to_id`, and `apply_mapping_array_of_versions_partial_resolution` all pass. Real HTTP to mock axum server verified. |
| 3 | Given source description with wiki markup, the produced ADF document includes mention nodes (post-processor resolves [~username] and wraps htmltoadf gaps) | PARTIAL — see human verification | Mention resolution (D-04/D-05) VERIFIED via 11 tests. Macro placeholders (D-07) VERIFIED. Code-block guard Pitfall F VERIFIED. Links/blockquotes/hard-breaks: htmltoadf handles these natively but no Phase 18 test exercises them. mediaSingle explicitly deferred to Phase 23 per CONTEXT.md decision. |
| 4 | Round-trip integration tests for ≥4 custom-field types (number, multi-select, user, date) pass against mock fixtures exhibiting read-shape vs write-shape asymmetry | VERIFIED | `apply_mapping_round_trip_four_custom_fields` exercises 8 field types: number, multi-select, user, date, description (ADF with mention), Array<version>, Array<component>, priority. All write-shape assertions pass. |
| 5 | Typed gap variants (UnresolvedPerson, UnresolvedVersion, UnresolvedComponent) are emitted in ResolvedFields.gaps, never as Err | VERIFIED | 3 gap-emission tests pass in pipeline.rs (unresolvable assignee → UnresolvedPerson; unresolvable version → UnresolvedVersion; partial array resolution). GapVariant serializes with kind tag per serde(tag="kind"). |
| 6 | Batch user resolution pre-scans description for [~username] patterns via hand-written scanner without adding regex crate dep | VERIFIED | `grep -n 'use regex'` returns nothing in user.rs. `MAX_DESCRIPTION_SCAN_BYTES = 500 * 1024` present (5 occurrences). `scan_mention_bounded_to_500kb` test passes. 12 helper-layer tests pass in user.rs. |
| 7 | Identity transformer strips read-only fields per Pitfall 4 (Priority→{id}, Option_→{value}) and returns Null for unsupported types | VERIFIED | All 12 identity tests pass. `priority_strips_to_id_only_pitfall_4` and `option_strips_to_value_only_pitfall_4` directly verified. `any_returns_null` and `issuetype_returns_null_phase_18_does_not_handle` verified. |
| 8 | All 5 plans complete: scaffolding + version/component resolvers + user resolver + wiki_to_adf + identity + pipeline | VERIFIED | 71 tests passing, 0 failing. Build clean (0 error lines). Clippy exits 0. All 7 files exist with substantive implementations (231–743 lines). |

**Score:** 7/8 truths fully verified (SC3 partially verified — mentions confirmed, links/blockquotes/hard-breaks require human spot-check)

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|-------------|--------|---------|
| `src-tauri/src/field_transform/mod.rs` | — | 196 | VERIFIED | ResolvedFields, GapVariant, all 3 Unresolved* structs, TransformContext (no Debug derive T-18-03), TransformError, FieldMappingRow, SessionVersionCache, SessionComponentCache all present |
| `src-tauri/src/field_transform/pipeline.rs` | 350 | 699 | VERIFIED | apply_mapping, dispatch_user, dispatch_version_array, dispatch_component_array, is_description_row, wiki_to_adf::convert_and_postprocess wired, identity::transform_identity wired, 12 tests |
| `src-tauri/src/field_transform/user.rs` | 250 | 743 | VERIFIED | resolve_batch, scan_mention_patterns, scan_html_profile_links, is_user_field, extract_usernames_from_field, collect_description_mentions, fetch_users_by_domain, match_user_in_results; 20 tests |
| `src-tauri/src/field_transform/version.rs` | 150 | 231 | VERIFIED | resolve_name (async, cache-first, case-insensitive, urlencoding, 50-page bound); 6 tests |
| `src-tauri/src/field_transform/component.rs` | 150 | 225 | VERIFIED | Mirror of version.rs for /components; 6 tests |
| `src-tauri/src/field_transform/wiki_to_adf.rs` | 250 | 400 | VERIFIED | convert_and_postprocess (infallible), walk_adf_node_mut, splice_mentions, splice_macros, Pitfall F code-block guard; 11 tests |
| `src-tauri/src/field_transform/identity.rs` | 120 | 226 | VERIFIED | transform_identity, strip_to_id, strip_to_value_or_id, strip_to_name; 12 tests |
| `src-tauri/src/lib.rs` | — | — | VERIFIED | `pub mod field_transform;` present, alphabetically between field_mapping_db and fixtures |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src-tauri/src/lib.rs` | `src-tauri/src/field_transform/mod.rs` | `pub mod field_transform;` | VERIFIED | grep returns 1; alphabetical placement between field_mapping_db and fixtures confirmed |
| `pipeline.rs::apply_mapping` | `user.rs::UserResolver::resolve_batch` | ctx.user_resolver.resolve_batch (called by caller, user_map in ctx) | VERIFIED | Pattern present 5 times in pipeline.rs. Contract: caller runs Phase 1 before apply_mapping |
| `pipeline.rs::dispatch` | `wiki_to_adf::convert_and_postprocess` | Called for String{system:"description"} rows | VERIFIED | `wiki_to_adf::convert_and_postprocess` appears 1 time in non-test pipeline.rs |
| `pipeline.rs::dispatch` | `identity::transform_identity` | Fallback for all symmetric types | VERIFIED | `identity::transform_identity` appears 1 time in non-test pipeline.rs |
| `version.rs` | `/rest/api/3/project/{key}/versions` | reqwest GET with Basic auth + urlencoding::encode | VERIFIED | `eq_ignore_ascii_case` present (1), `urlencoding::encode` present (1), 2 lock scopes |
| `component.rs` | `/rest/api/3/project/{key}/components` | reqwest GET with Basic auth + urlencoding::encode | VERIFIED | Mirror of version.rs; same patterns confirmed |
| `user.rs` | `/rest/api/3/user/search` | `fetch_users_by_domain` paginated GET | VERIFIED | `resolve_batch_one_http_per_domain` test with counter proves single HTTP per domain |
| `wiki_to_adf.rs` | `htmltoadf::convert_html_str_to_adf_str` | First-pass HTML→ADF conversion | VERIFIED | `htmltoadf::convert_html_str_to_adf_str` appears 2 times in wiki_to_adf.rs |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `pipeline.rs::apply_mapping` | `fields: Map<String, Value>` | Per-row dispatch from source_issue JSON + resolver responses | Yes — integration tests assert 8 field-type write shapes from mock HTTP responses | FLOWING |
| `user.rs::resolve_batch` | `out: HashMap<String, Option<String>>` | Cloud /user/search HTTP + match_user_in_results | Yes — 8 network-layer tests including counter assertions against live axum mock | FLOWING |
| `version.rs::resolve_name` | `versions: Vec<Value>` (cache) | Cloud /project/{key}/versions HTTP | Yes — cache_hit_skips_second_http test proves real HTTP and caching | FLOWING |
| `wiki_to_adf.rs::convert_and_postprocess` | `adf: serde_json::Value` | htmltoadf::convert_html_str_to_adf_str + post-processor walk | Yes — `mention_pattern_resolves_to_mention_node` checks actual ADF tree structure | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 71 field_transform tests pass | `cargo test -p pmkar --lib field_transform` | 71 passed; 0 failed; finished in 0.04s | PASS |
| Build clean | `cargo build --lib` (grep error count) | 0 errors | PASS |
| Clippy clean | `cargo clippy --lib -- -D warnings` | 0 errors | PASS |
| GapVariant serializes with `kind` tag | `grep -c 'tag = "kind"' mod.rs` | 1 | PASS |
| No regex dep in user.rs | `grep -n 'use regex'` returns exit 1 | no matches | PASS |
| 500 KB DoS bound enforced | `grep -c 'MAX_DESCRIPTION_SCAN_BYTES\|500 \* 1024' user.rs` | 5 | PASS |
| lib.rs alphabetical placement | `grep -A1 'pub mod field_mapping_db;' lib.rs` | `pub mod field_transform;` on next line | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|---------|
| TRAN-01 | 18-01, 18-03, 18-05 | Server name/key → Cloud accountId for person fields | SATISFIED | dispatch_user emits {accountId}, resolve_batch batches; tests pass |
| TRAN-02 | 18-01, 18-04 | Wiki markup → ADF for text and multi-line text fields | SATISFIED | convert_and_postprocess wraps htmltoadf, mention nodes, macro placeholders; 11 tests pass |
| TRAN-03 | 18-01, 18-02, 18-05 | Source version names → Cloud version IDs by name lookup | SATISFIED | VersionResolver.resolve_name, case-insensitive, cached; 6 tests + pipeline integration test pass |
| TRAN-04 | 18-01, 18-02, 18-05 | Source component names → Cloud component IDs | SATISFIED | ComponentResolver mirrors VersionResolver; 6 tests + integration pass |
| TRAN-05 | 18-01, 18-04 | Fill htmltoadf coverage gaps (links, blockquotes, mentions, hard-break, mediaSingle) | PARTIAL — human verification needed | Mentions (D-04/D-05) and macro placeholders (D-07) VERIFIED. Links/blockquotes/hard-breaks: htmltoadf handles natively; no explicit post-processor path for them exists and no test covers them. mediaSingle explicitly deferred to Phase 23 per CONTEXT.md. |
| TRAN-06 | 18-01, 18-03, 18-05 | Batch user lookups in single pass to avoid N×M HTTP calls | SATISFIED | Counter-based tests in both user.rs (resolve_batch_one_http_per_domain) and pipeline.rs (apply_mapping_user_resolver_called_exactly_once, apply_mapping_round_trip_four_custom_fields) prove exactly 1 HTTP call per domain |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TODO/FIXME/PLACEHOLDER/stub bodies in any implementation file | — | None |

### Human Verification Required

#### 1. TRAN-05 links/blockquotes/hard-breaks coverage

**Test:** Take a source Jira Server v2 ticket description containing:
- A hyperlink: `[Atlassian|https://atlassian.com]` (wiki markup) or `<a href="...">text</a>` (HTML)
- A blockquote: `{quote}Some quoted text{quote}` or `<blockquote>...</blockquote>`
- A hard-break: a line break in wiki markup or `<br/>` in HTML

Pass the rendered HTML through `convert_and_postprocess("...", &HashMap::new())` and inspect the output JSON.

**Expected:** The ADF output contains:
- Links as `{ "type": "text", "marks": [{ "type": "link", "attrs": { "href": "..." } }] }` nodes (ADF inline link mark), OR
- If htmltoadf does not output link marks, links degrade to plain text without panic
- Blockquotes as `{ "type": "blockquote", "content": [...] }` nodes, OR graceful plain-text degradation
- Hard-breaks as `{ "type": "hardBreak" }` nodes, OR ignored without data corruption

**Why human:** ROADMAP SC3 states the post-processor "wraps htmltoadf's documented coverage gaps" for these node types. The Phase 18 implementation handles only mentions and macro placeholders in its post-processor; links/blockquotes/hard-breaks either pass through htmltoadf or are silently dropped. The CONTEXT.md explicitly deferred mediaSingle to Phase 23. Whether htmltoadf itself handles the remaining types correctly is a runtime question that cannot be verified by static code inspection. This needs a developer to run the pipeline with representative wiki/HTML input and inspect the ADF output.

---

### Gaps Summary

No hard blockers identified. The single human-verification item concerns TRAN-05's coverage of links, blockquotes, and hard-breaks — these node types are not explicitly handled by the Phase 18 post-processor and no test exercises them. The implementation relies on htmltoadf's inherent capabilities for those types. Since the CONTEXT.md explicitly narrowed Phase 18's scope (mediaSingle deferred to Phase 23), and the plan's own must_haves for TRAN-05 specified only mentions and macro placeholders, this is a scope-boundary question requiring human judgment: either confirm htmltoadf handles links/blockquotes natively and the ROADMAP SC3 is met, or document that those gap-fills require a follow-up plan.

All other phase goals — typed gap variants, batch user resolution, cached version/component resolution, write-shape correction, two-phase pipeline, and round-trip tests for ≥4 custom field types — are fully implemented, tested (71 passing tests), and verified against the actual codebase.

---

_Verified: 2026-04-27T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
