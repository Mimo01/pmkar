---
phase: 18-v2-v3-translation-layer
plan: 04
subsystem: api
tags: [rust, adf, htmltoadf, identity-transformer, post-processor, wiki-markup, mention-resolution]

requires:
  - phase: 18-01
    provides: field_transform module scaffolding with stubs for wiki_to_adf.rs and identity.rs

provides:
  - wiki_to_adf::convert_and_postprocess — infallible HTML→ADF conversion with post-processor pass
  - wiki_to_adf::walk_adf_node_mut — recursive ADF tree walker with code-block exclusion guard
  - identity::transform_identity — per-FieldSchemaType write-shape stripping per Pitfall 4
  - Mention resolution D-04 (username→accountId mention node) and D-05 (None/missing→plain text)
  - Unsupported macro placeholder injection D-07 ({toc}, {anchor}, etc.)
  - Priority {id} and Option_ {value} write-shape correction (Pitfall 4)

affects:
  - 18-05-pipeline (dispatches Description→wiki_to_adf, scalar/option/priority→identity)
  - 18-02 (version/component resolvers) — these feed into pipeline alongside wiki_to_adf
  - 18-03 (user resolver) — user_map populated by phase 1 of apply_mapping, consumed by convert_and_postprocess

tech-stack:
  added: []
  patterns:
    - "Infallible transformer pattern: convert_and_postprocess returns Value (not Result), falls back to empty_doc on parse error"
    - "Two-pass ADF tree walker: recurse children first, then splice text→mention/placeholder at parent level"
    - "BuildHasher generic on HashMap parameters for clippy pedantic compliance"
    - "WalkContext Copy type passed by value to recursive walker"
    - "is_some_and() instead of map().unwrap_or(false) for Option bool predicates"

key-files:
  created: []
  modified:
    - src-tauri/src/field_transform/wiki_to_adf.rs
    - src-tauri/src/field_transform/identity.rs

key-decisions:
  - "WalkContext is pub(crate) not private — required because walk_adf_node_mut is pub(crate) and takes it as parameter"
  - "HashMap generalized over BuildHasher (S: BuildHasher) in all public/pub(crate) wiki_to_adf functions for clippy pedantic compliance"
  - "splice_macros_in_content_array takes &mut [Value] not &mut Vec<Value> (clippy: slice is sufficient since no insert/remove needed)"
  - "WalkContext passed by value (Copy type) not by reference — clippy recommends pass-by-value for 1-byte args"
  - "Mention expansion uses byte-level cursor scan to split text nodes — preserves UTF-8 safety via str::from_utf8 at extraction points"
  - "Doc comment for htmltoadf function uses backtick-quoted name to satisfy clippy::doc_markdown"

patterns-established:
  - "Pitfall F guard: codeBlock node sets in_code_context=true on WalkContext; inline code mark checked per text node in splice helpers"
  - "Pitfall 4 guard: strip_to_id/strip_to_value_or_id/strip_to_name build output Map explicitly with only allowed keys"
  - "D-05 fallback: user_map.get(username).and_then(|v| v.as_ref()) — None entry OR missing key both degrade to plain @username text"
  - "T-18-16 mitigation: zero logging calls in wiki_to_adf.rs (no tracing::, eprintln!, println!, log!)"

requirements-completed: [TRAN-02, TRAN-05]

duration: 25min
completed: 2026-04-27
---

# Phase 18 Plan 04: wiki_to_adf + identity Transformers Summary

**htmltoadf wrapper with ADF post-processor (mention resolution D-04/D-05, macro placeholders D-07, Pitfall F code-block guard) plus write-shape-correcting identity transformer (Priority→{id}, Option_→{value}, Pitfall 4)**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-27T14:35:00Z
- **Completed:** 2026-04-27T15:00:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `wiki_to_adf::convert_and_postprocess` — infallible HTML→ADF pipeline: htmltoadf first pass, then recursive tree walk that resolves `[~username]` mention patterns to Cloud `mention` ADF nodes (D-04) or degrades to `@username` plain text (D-05), and replaces unsupported wiki macros with `[Not converted: ...]` placeholders (D-07)
- Pitfall F code-block guard: `codeBlock` nodes and text nodes carrying `code` marks are excluded from all post-processor mutations; 2 dedicated tests verify this
- `identity::transform_identity` — single-point write-shape control for all non-special field types: Priority→`{id}`, Option_→`{value}` (fallback `{id}`), Array<option>→`[{value}, ...]`; returns `Null` for User/Any/Issuetype/OptionWithChild (pipeline routes those elsewhere)
- 23 tests pass total: 11 wiki_to_adf + 12 identity; clippy pedantic clean; no logging in wiki_to_adf (T-18-16 mitigated)

## Task Commits

1. **Task 1: wiki_to_adf::convert_and_postprocess + post-processor walk** - `f522b1c` (feat)
2. **Task 2: identity::transform_identity with per-FieldSchemaType write-shape correction** - `d6754a8` (feat)

## Files Created/Modified

- `src-tauri/src/field_transform/wiki_to_adf.rs` — 408 lines: `convert_and_postprocess`, `walk_adf_node_mut`, `splice_mentions_in_content_array`, `expand_mentions_in_text`, `splice_macros_in_content_array`, 11 tests
- `src-tauri/src/field_transform/identity.rs` — 226 lines: `transform_identity`, `strip_to_id`, `strip_to_value_or_id`, `strip_to_name`, 12 tests

## Key Function Signatures

```rust
// wiki_to_adf.rs
pub fn convert_and_postprocess<S: BuildHasher>(
    html: &str,
    user_map: &HashMap<String, Option<String>, S>,
) -> serde_json::Value

pub(crate) fn walk_adf_node_mut<S: BuildHasher>(
    node: &mut serde_json::Value,
    user_map: &HashMap<String, Option<String>, S>,
    ctx: WalkContext,  // Copy type, passed by value
)

// identity.rs
pub fn transform_identity(
    source_value: &Value,
    target_schema: &FieldSchemaType,
) -> Value
```

## UNSUPPORTED_MACROS list (wiki_to_adf.rs)

```rust
const UNSUPPORTED_MACROS: &[&str] = &[
    "{toc}", "{toc:", "{page-break}", "{anchor:", "{info}", "{note}", "{warning}",
];
```

## Per-FieldSchemaType Write-Shape Table (identity.rs)

| FieldSchemaType       | Input (read shape)              | Output (write shape)       |
|-----------------------|---------------------------------|----------------------------|
| String / Number / Date / Datetime | any Value          | clone unchanged            |
| Priority              | `{id, name, self, ...}`         | `{id}`                     |
| Option_               | `{id, value, self, ...}`        | `{value}` or `{id}`        |
| Array items="string"  | `["a", "b"]`                    | clone unchanged (labels)   |
| Array items="option"  | `[{id, value, ...}, ...]`       | `[{value}, ...]`           |
| Array items="group"   | `[{name, self}, ...]`           | `[{name}, ...]`            |
| Array items="user/version/component" | any          | `Null` (pipeline routes)   |
| User                  | any                             | `Null` (user.rs handles)   |
| OptionWithChild       | any                             | `Null` (Phase 20 handles)  |
| Issuetype             | any                             | `Null` (Phase 23 handles)  |
| Any                   | any                             | `Null` (unsupported)       |

## Decisions Made

- WalkContext is `pub(crate)` (not private) — required because `walk_adf_node_mut` which takes it as a parameter is `pub(crate)`; clippy `private_interfaces` warning would otherwise fail `-D warnings`
- HashMap generalized with `S: BuildHasher` in all public/crate-visible functions — clippy pedantic compliance
- `splice_macros_in_content_array` takes `&mut [Value]` not `&mut Vec<Value>` — clippy correctly identifies no insert/remove needed, slice suffices
- WalkContext passed by value (Copy) — clippy `trivially_copy_pass_by_ref` for 1-byte struct

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / Clippy Pedantic] Multiple clippy errors in wiki_to_adf.rs initial implementation**
- **Found during:** Task 1 (wiki_to_adf), first clippy run
- **Issues:**
  - `private_interfaces`: `WalkContext` struct was private but `walk_adf_node_mut` (pub(crate)) takes it as parameter
  - `missing_backticks_in_doc`: doc comment lines needed backtick-quoted identifiers
  - `map_unwrap_or`: `.map(...).unwrap_or(false)` → `.is_some_and(...)`
  - `trivially_copy_pass_by_ref`: `&WalkContext` → `WalkContext` (pass by value)
  - `HashMap` not generalized over `BuildHasher`
  - `&mut Vec<Value>` in `splice_macros_in_content_array` → `&mut [Value]`
  - Doc list indentation and `user_map` backtick formatting
- **Fix:** Addressed all 9 clippy errors in a single rewrite of wiki_to_adf.rs; tests still pass after fixes
- **Files modified:** `src-tauri/src/field_transform/wiki_to_adf.rs`
- **Committed in:** f522b1c (Task 1 commit, included in final version)

**2. [Rule 1 - Bug / Clippy Pedantic] Two clippy errors in identity.rs initial implementation**
- **Found during:** Task 2 (identity), clippy run
- **Issues:** Two doc comment identifiers (`wiki_to_adf.rs` and `OptionWithChild`) missing backticks
- **Fix:** Added backticks to both doc comment references
- **Files modified:** `src-tauri/src/field_transform/identity.rs`
- **Committed in:** d6754a8 (Task 2 commit, included in final version)

---

**Total deviations:** 2 auto-fixed (Rule 1 — clippy pedantic compliance)
**Impact on plan:** All fixes necessary for `-D warnings` build gate. No behavioral changes. No scope creep.

## Issues Encountered

None beyond the clippy fixes documented above.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Both files are pure in-memory transformers with no I/O.

T-18-16 (Information Disclosure — no logging of accountIds) verified: `grep -E 'tracing::|eprintln!|println!|log!' wiki_to_adf.rs` returns nothing.

T-18-17 (Tampering — identity strips read-only fields) verified: `strip_to_id`, `strip_to_value_or_id`, `strip_to_name` all build output Map by explicit insert of only the allowed key.

## Hand-off Note for Plan 05 (pipeline.rs)

`apply_mapping` pipeline dispatch should route:

- `transformer_kind = "wiki_to_adf"` → `wiki_to_adf::convert_and_postprocess(html, &ctx.user_map)`
- `transformer_kind = "identity"` with `FieldSchemaType::Priority` → `identity::transform_identity(v, schema)` → `{id}`
- `transformer_kind = "identity"` with `FieldSchemaType::Option_` → `identity::transform_identity(v, schema)` → `{value}`
- `transformer_kind = "identity"` with `FieldSchemaType::Array { items: "option" }` → `identity::transform_identity(v, schema)` → `[{value}, ...]`
- `transformer_kind = "identity"` with `FieldSchemaType::String/Number/Date/Datetime/Array{items:"string"}` → `identity::transform_identity(v, schema)` → passthrough
- `transformer_kind = "user"` → `user::resolve_user(...)` (Plan 18-03)
- `transformer_kind = "version"` → `version::VersionResolver` (Plan 18-02)
- `transformer_kind = "component"` → `component::ComponentResolver` (Plan 18-02)

## Next Phase Readiness

- `wiki_to_adf` and `identity` modules fully implemented and tested
- Plan 05 (pipeline.rs `apply_mapping`) can dispatch to both transformers via `transformer_kind` field on `FieldMappingRow`
- All 23 tests (11 wiki_to_adf + 12 identity) pass; clippy pedantic clean; compile gate green

---
*Phase: 18-v2-v3-translation-layer*
*Completed: 2026-04-27*
