---
phase: 18-v2-v3-translation-layer
reviewed: 2026-05-04T00:00:00Z
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
  critical: 0
  warning: 4
  info: 1
  total: 5
status: fixed
---

# Phase 18: Code Review Report

**Reviewed:** 2026-05-04T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This is a re-review of the Phase 18 v2-to-v3 translation pipeline. All findings from the prior review (2026-04-27) were verified against the current source: CR-01 (isolated mention drop), WR-02 (public resolver fields), WR-03 (dead `effective_in_code` variable), and the no-domain TRAN-06 docstring (old WR-01) are all confirmed fixed. One prior info item (macro placeholder whitespace, old IN-01) is still present in the current source.

Four new warnings and one carried-forward info item were found. None are crashes, but WR-03 (null user field silently skips gap emission) is a functional correctness bug that causes required-field gating in Phase 22 to silently miss null user fields.

---

## Warnings

### WR-01: Off-by-one in `scan_mention_patterns` — `[~` at the last two bytes of the scan boundary is missed

**File:** `src-tauri/src/field_transform/user.rs:225`

**Issue:** The outer loop condition is `while i + 2 < limit`. When `i == limit - 2`, the expression `i + 2 == limit` is not `< limit`, so the loop exits without inspecting `bytes[i]` and `bytes[i + 1]`. A `[~` pattern whose opening bracket falls exactly at position `limit - 2` is never detected.

For the default `MAX_DESCRIPTION_SCAN_BYTES = 512 * 1024`, this means a description that is exactly 512 KB and ends with `[~username]` will silently fail to add that username to the pre-scan set. The batch HTTP call is not made for it, `user_map` has no entry, and Phase 2 emits `@username` as plain text in ADF rather than a mention node. No panic; the output is silently wrong.

The identical structural bug exists in `expand_mentions_in_text` in `wiki_to_adf.rs:186` where the bound is `bytes.len()`. There the consequence is that a text node ending exactly with `[~` (and then nothing) is passed through unchanged, which is fine — but any text ending with `[~a]` where the `[` is at position `len - 4` still processes correctly because `len - 4 + 2 = len - 2 < len - 1`. The real miss in `expand_mentions_in_text` is when `[~` falls at position `len - 2` exactly (i.e., the text is literally `[~` with nothing else), which cannot form a valid pattern anyway. The `user.rs` boundary miss is the more practical concern.

**Fix:** Change the outer loop guard to `while i + 1 < limit` — this is the correct condition for safely reading both `bytes[i]` and `bytes[i + 1]`:

```rust
// user.rs:225 — was: while i + 2 < limit
while i + 1 < limit {
    if bytes[i] == b'[' && bytes[i + 1] == b'~' {
        // inner logic unchanged
    }
    i += 1;
}
```

---

### WR-02: `scan_html_profile_links` guard accepts `name=` at position 0 — inverted logic

**File:** `src-tauri/src/field_transform/user.rs:266`

**Issue:** The stated intent of the `preceding_ok` guard is to accept only URL query parameters (`?name=` or `&name=`) and reject bare HTML attributes (`name=`). The implementation is:

```rust
let preceding_ok = i == 0 || bytes[i - 1] == b'?' || bytes[i - 1] == b'&';
```

When `i == 0`, `preceding_ok` is unconditionally `true`. This is backwards: a string that opens directly with `name=jdoe` has no preceding character at all, yet the guard passes it. In practice, full rendered-HTML descriptions do not start with `name=`, so this is not currently exploitable. However, if this function is ever called with a substring (e.g., an extracted `href` attribute value), the false positive is reachable and would add an incorrect username to the pre-scan set, causing a spurious HTTP call and potentially a false `user_map` entry.

**Fix:** Remove the `i == 0` special case — a bare opening position is not a URL query parameter context:

```rust
// was:
let preceding_ok = i == 0 || bytes[i - 1] == b'?' || bytes[i - 1] == b'&';
// fix:
let preceding_ok = i > 0 && (bytes[i - 1] == b'?' || bytes[i - 1] == b'&');
```

---

### WR-03: Null/missing single-user field returns with no gap — Phase 22 required-field gate is bypassed

**File:** `src-tauri/src/field_transform/pipeline.rs:214-219`

**Issue:** In `dispatch_user`, the single-user path detects an empty username and executes a bare `return`:

```rust
if username.is_empty() {
    // Field is null/missing — emit a gap so Phase 22 prompts the user.
    // Only emit if target requires it. Phase 18 doesn't read required-ness;
    // emit regardless and let Phase 22 filter via target schema.
    return;   // ← comment says "emit a gap"; code does not
}
```

The comment explicitly says "emit a gap" but the code contradicts it. If a source issue has `"assignee": null` and `assignee` is mapped, Phase 22 never receives a `GapVariant::Person` for it. Phase 22 cannot prompt the user to select one before the issue is created. Two failure modes follow:

1. If `assignee` is required on the target project, the Cloud issue creation request will be rejected by Jira with a validation error surfaced as a generic `AppError::Http`, not a user-friendly gap message.
2. If `assignee` is optional, the issue is silently created without an assignee, which may be the correct behavior — but it bypasses the Phase 22 UI that is designed to let the user confirm this.

**Fix:** Emit the gap as the comment states:

```rust
if username.is_empty() {
    gaps.push(GapVariant::Person(UnresolvedPerson {
        target_field_id: row.target_field_id.clone(),
        source_username: None,
        source_key: key,
        source_email: email,
    }));
    return;
}
```

---

### WR-04: `transformer_kind` is unchecked for user-typed fields — unknown values fall through silently to wrong path

**File:** `src-tauri/src/field_transform/pipeline.rs:67-71`

**Issue:** For user-typed source fields, the dispatch logic only special-cases `"user_name"`. Every other value falls through to `dispatch_user` (the accountId-lookup path), including values that are unrecognised:

```rust
if row.transformer_kind == "user_name" {
    dispatch_user_name(row, &src_val, &mut fields);
} else {
    // Catches "user", "auto", "" — and also any typo or future kind not yet handled.
    dispatch_user(row, &src_val, ctx, &mut fields, &mut gaps);
}
```

A mapping row with `transformer_kind = "user_name "` (trailing space), or any future kind (e.g., `"user_display"`) added to the database before the pipeline is updated, silently performs a full accountId lookup and writes `{"accountId": "..."}` into a text-typed target field. No error, log, or gap is emitted. The `transformer_kind` string comes from the database (`field_mapping_db`), making this sensitive to schema drift.

**Fix:** Enumerate known kinds explicitly:

```rust
match row.transformer_kind.as_str() {
    "user_name" => dispatch_user_name(row, &src_val, &mut fields),
    "user" | "auto" | "" => dispatch_user(row, &src_val, ctx, &mut fields, &mut gaps),
    other => {
        // Unknown kind: log and fall back rather than silently using the wrong path.
        eprintln!(
            "field_transform: unknown transformer_kind {:?} for user field {:?}",
            other, row.source_field_id
        );
        dispatch_user(row, &src_val, ctx, &mut fields, &mut gaps);
    }
}
```

---

## Info

### IN-01: Macro placeholder includes untrimmed surrounding whitespace (carried forward from prior review)

**File:** `src-tauri/src/field_transform/wiki_to_adf.rs:269-275`

**Issue:** `splice_macros_in_content_array` uses `text.trim()` at line 261 to match unsupported macro prefixes, but then retrieves the original untrimmed text at line 270 to build the placeholder string. A text node containing `" {toc} "` (with surrounding whitespace) matches because the trimmed form starts with `{toc}`, but the resulting placeholder is `"[Not converted:  {toc} ]"` with the original whitespace preserved inside the brackets.

This was flagged in the prior review (old IN-01) and remains unfixed.

**Fix:** Use the trimmed value in the placeholder:

```rust
let original = node
    .get("text")
    .and_then(|x| x.as_str())
    .unwrap_or("")
    .trim()         // add .trim() here
    .to_string();
node["text"] = serde_json::Value::String(format!("[Not converted: {original}]"));
```

---

_Reviewed: 2026-05-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
