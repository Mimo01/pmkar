---
phase: 18-v2-v3-translation-layer
reviewed: 2026-04-27T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src-tauri/src/field_transform/mod.rs
  - src-tauri/src/field_transform/pipeline.rs
  - src-tauri/src/field_transform/user.rs
  - src-tauri/src/field_transform/version.rs
  - src-tauri/src/field_transform/component.rs
  - src-tauri/src/field_transform/wiki_to_adf.rs
  - src-tauri/src/field_transform/identity.rs
  - src-tauri/src/lib.rs
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-04-27
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The Phase 18 pipeline implements a two-phase v2→v3 field translation layer. The overall design is sound — the gap/error distinction is correct, the caching pattern is safe, and the user batching (TRAN-06) is correctly implemented for the domain-based path. One correctness bug was found in `wiki_to_adf.rs` that causes a mention to be silently dropped when a text node consists of exactly one `[~username]` pattern with no surrounding text. Three quality warnings relate to: a per-username HTTP call in the no-domain fallback path, overly permissive public fields on resolver structs, and a dead computed variable that creates misleading code. Two info items cover a whitespace artifact in macro placeholders and missing test coverage for the identified edge case.

---

## Critical Issues

### CR-01: Single isolated `[~username]` mention is silently dropped, never becomes a mention node

**File:** `src-tauri/src/field_transform/wiki_to_adf.rs:137-144`

**Issue:** `splice_mentions_in_content_array` assumes `replacement.len() == 1` always means "a single plain text node with no mention found." It then tries to extract `replacement[0]["text"]` and rewrite the original node in-place. However, `expand_mentions_in_text` can return a vec of length 1 containing a **mention node** (not a text node) when the entire text is exactly `[~username]` with no prefix or trailing text. In that case `replacement[0].get("text")` returns `None`, the `if let Some(s)` arm is skipped, `i` is incremented, and the original text node `{"type":"text","text":"[~alice]"}` remains in the content array unchanged. The mention is never inserted.

Concrete trace for `text = "[~alice]"`:
- `expand_mentions_in_text` emits `[mention_node]` (len 1, no prefix, no trailing)
- `replacement.len() == 1` enters the in-place rewrite branch
- `replacement[0].get("text")` → `None` (mention nodes have no `text` key)
- Original node left as-is; `i` incremented

This affects any paragraph in the source issue where the entire paragraph content is a bare mention — for example, a description line consisting solely of `[~jdoe]`. It produces incorrect ADF: the Cloud issue will show the raw wiki text instead of a mention pill.

**Fix:** Change the condition to route the single-node case through the same splice path when the single replacement node is not a text node:

```rust
// Before
if replacement.len() == 1 {
    if let Some(s) = replacement[0].get("text").and_then(|x| x.as_str()) {
        content[i]["text"] = serde_json::Value::String(s.to_string());
    }
    i += 1;
} else {
    // splice path ...
}

// After
let only_text_node = replacement.len() == 1
    && replacement[0].get("type").and_then(|t| t.as_str()) == Some("text");
if only_text_node {
    if let Some(s) = replacement[0].get("text").and_then(|x| x.as_str()) {
        content[i]["text"] = serde_json::Value::String(s.to_string());
    }
    i += 1;
} else {
    // existing splice path (handles 0-length, single mention, multiple nodes)
    let original_marks = content[i].get("marks").cloned();
    let mut to_insert: Vec<serde_json::Value> = replacement
        .into_iter()
        .map(|mut n| {
            if n.get("type").and_then(|t| t.as_str()) == Some("text") {
                if let Some(m) = original_marks.clone() {
                    n["marks"] = m;
                }
            }
            n
        })
        .collect();
    content.remove(i);
    let n = to_insert.len();
    for node in to_insert.drain(..).rev() {
        content.insert(i, node);
    }
    i += n;
}
```

---

## Warnings

### WR-01: `no_domain` fallback makes one HTTP call per username, violating TRAN-06 spirit

**File:** `src-tauri/src/field_transform/user.rs:87-93`

**Issue:** The module docstring at lines 3–4 declares: "TRAN-06 invariant: ONE HTTP `/user/search` per unique email domain." The domain-based path (step 4) correctly batches all same-domain users into one HTTP call. However, the `no_domain` fallback (step 5, lines 87–93) calls `fetch_users_by_query(&username)` inside a `for username in no_domain` loop — one HTTP call **per username**. If a description contains five `[~mention]` patterns for users who have no associated email address (description-only mentions are common), five sequential HTTP calls are issued. The existing test at line 604 only exercises one description mention, masking this behavior. The comment on line 87 says "rare; description-only mentions" but descriptions with multiple mentions are not rare.

**Fix:** Group no-domain usernames into a single batch query, or query all in one call and match by `displayName`. A pragmatic short-term fix is to issue a single `/user/search?query=<first_username>` and attempt cross-matching, or document the N-call behavior explicitly and remove the TRAN-06 claim from the module docstring:

```rust
// Option A: remove TRAN-06 claim from module docstring, add explicit note:
//! Note: usernames without an email address (description-only mentions) each
//! incur a separate HTTP call; TRAN-06 applies only to the domain-based path.

// Option B: batch no-domain users into a single query by name (less accurate but fewer calls):
let all_names = no_domain.join(" ");
if !all_names.is_empty() {
    let users = self.fetch_users_by_query(&all_names).await.unwrap_or_default();
    for username in &no_domain {
        let acct = match_user_in_results(&users, None, username);
        out.insert(username.clone(), acct);
    }
}
```

---

### WR-02: Public fields on resolver structs expose mutable credential strings

**File:** `src-tauri/src/field_transform/user.rs:23-25`, `version.rs:15-18`, `component.rs:13-16`

**Issue:** `UserResolver`, `VersionResolver`, and `ComponentResolver` expose `cloud_auth`, `cloud_base_url`, and `cache` as `pub` struct fields. This means any code holding a reference can overwrite the credential string or swap the base URL after construction — for example `resolver.cloud_auth = "Basic ATTACKER".to_string()`. While this is Tauri internal code and not a network-facing API, in-process mutation of auth credentials creates an audit gap: the auth token used during a session could be silently changed by any module that gains access to the resolver instance.

The `cache` field being `pub` also allows callers to inject arbitrary pre-populated cache entries, bypassing HTTP entirely.

**Fix:** Make fields `pub(crate)` or `pub(super)` (sufficient for the test helpers that access them), and expose read-only accessors if needed:

```rust
pub struct VersionResolver {
    pub(crate) client: reqwest::Client,
    pub(crate) cloud_auth: String,
    pub(crate) cloud_base_url: String,
    pub(crate) cache: SessionVersionCache,
}
```

---

### WR-03: `effective_in_code` is a dead variable — inline-code suppression logic is split confusingly

**File:** `src-tauri/src/field_transform/wiki_to_adf.rs:80-102`

**Issue:** `effective_in_code` is computed at line 80 (`ctx.in_code_context || inline_code`) and then immediately discarded at line 102 (`let _ = effective_in_code`). It is never used in any branch condition. The actual suppression of mention/macro splicing for inline-code text nodes is handled inside `splice_mentions_in_content_array` (lines 120–129), which independently rechecks for the `code` mark on each text node. The `effective_in_code` variable gives the false impression that inline-code suppression is handled at the walker level, which misleads future maintainers into believing the guard is in place at the `walk_adf_node_mut` level when it is not.

This split is not a correctness bug today — the splice function's own check prevents mention injection into inline-code text. However, if a future developer removes the check from `splice_mentions_in_content_array` under the belief that `effective_in_code` covers it, mentions would be injected into inline code.

**Fix:** Remove the dead variable entirely and add a clarifying comment at the splice call site:

```rust
// Remove lines 80-102 dead variable computation:
// let inline_code = ...;
// let effective_in_code = ctx.in_code_context || inline_code;
// let _ = effective_in_code;

// At the splice call site, add:
// Note: splice_mentions_in_content_array independently skips text nodes that
// carry a `code` mark (Pitfall F). No additional gating is needed here.
if !next_ctx.in_code_context {
    splice_mentions_in_content_array(content, user_map);
    splice_macros_in_content_array(content);
}
```

---

## Info

### IN-01: Macro placeholder includes surrounding whitespace from trimmed match

**File:** `src-tauri/src/field_transform/wiki_to_adf.rs:253-263`

**Issue:** `splice_macros_in_content_array` uses `text.trim()` (line 253) to check if the text starts with an unsupported macro, but then uses the untrimmed `original` (line 262) in the placeholder string. A text node with value `" {toc} "` (padded by whitespace) matches (trimmed starts with `{toc}`), but the resulting placeholder is `"[Not converted:  {toc} ]"` with the surrounding spaces included. This may look odd in the rendered issue.

**Fix:** Use the trimmed value in the placeholder:

```rust
let original_trimmed = node.get("text").and_then(|x| x.as_str()).unwrap_or("").trim();
node["text"] = serde_json::Value::String(format!("[Not converted: {original_trimmed}]"));
```

---

### IN-02: Missing test for isolated mention pattern (the CR-01 regression case)

**File:** `src-tauri/src/field_transform/wiki_to_adf.rs` (test section)

**Issue:** All existing mention tests use surrounding text (e.g., `"Hi [~jdoe]"`, `"Hi [~alice] and [~bob]"`). There is no test for a text node whose entire content is a bare `[~username]` — the exact case that triggers the CR-01 bug. After fixing CR-01, a regression test should be added:

```rust
#[test]
fn isolated_mention_no_surrounding_text_becomes_mention_node() {
    let mut m = HashMap::new();
    m.insert("alice".into(), Some("AID-A".into()));
    // Synthetic ADF: paragraph containing ONLY "[~alice]" as text content.
    let mut adf = serde_json::json!({
        "version": 1, "type": "doc", "content": [
            { "type": "paragraph", "content": [
                { "type": "text", "text": "[~alice]" }
            ]}
        ]
    });
    walk_adf_node_mut(&mut adf, &m, WalkContext::default());
    let inner = adf["content"][0]["content"].as_array().unwrap();
    let has_mention = inner.iter().any(|n| n["type"] == "mention" && n["attrs"]["id"] == "AID-A");
    assert!(has_mention, "isolated mention should be replaced with mention node: {adf:?}");
    let has_raw_text = inner.iter().any(|n| n["type"] == "text"
        && n.get("text").and_then(|t| t.as_str()) == Some("[~alice]"));
    assert!(!has_raw_text, "raw mention text should not remain after conversion");
}
```

---

_Reviewed: 2026-04-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
