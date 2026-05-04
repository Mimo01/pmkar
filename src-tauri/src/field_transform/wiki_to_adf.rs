//! Phase 18 — `wiki_to_adf.rs`: htmltoadf wrapper + ADF post-processor
//! (TRAN-02, TRAN-05, D-04/D-05/D-06/D-07).
//!
//! Pipeline: HTML/wiki text → `htmltoadf::convert_html_str_to_adf_str` → ADF Value.
//! Post-processor walks the ADF tree to:
//!
//! - Replace `[~username]` text fragments with Cloud `mention` ADF nodes (D-04).
//!   Unresolvable usernames degrade to plain `@username` text (D-05).
//! - Replace unhandled wiki macros (`{toc}`, `{anchor}`, etc.) with annotated
//!   `[Not converted: …]` placeholder paragraphs (D-07).
//! - LEAVE text inside `codeBlock` nodes and `code` marks untouched (Pitfall F).

use std::collections::HashMap;
use std::hash::BuildHasher;

/// Macros we treat as "no ADF equivalent — surface as placeholder text".
/// Conservative list; expand as field-test reveals more.
const UNSUPPORTED_MACROS: &[&str] = &[
    "{toc}",
    "{toc:",
    "{page-break}",
    "{anchor:",
    "{info}",
    "{note}",
    "{warning}",
];

/// Converts source HTML to ADF and runs a post-processor pass.
///
/// Image URLs must be rewritten by the caller before passing `html` here (D-08).
pub fn convert_and_postprocess<S: BuildHasher>(
    html: &str,
    user_map: &HashMap<String, Option<String>, S>,
) -> serde_json::Value {
    // Step 1: htmltoadf pass. Empty input → empty doc immediately.
    if html.is_empty() {
        return empty_doc();
    }
    let adf_str = htmltoadf::convert_html_str_to_adf_str(html.to_string());
    let mut adf: serde_json::Value = serde_json::from_str(&adf_str).unwrap_or_else(|_| empty_doc());

    // Step 2: post-processor walk.
    walk_adf_node_mut(&mut adf, user_map, WalkContext::default());
    adf
}

fn empty_doc() -> serde_json::Value {
    serde_json::json!({ "version": 1, "type": "doc", "content": [] })
}

/// Walk context threaded through the recursive ADF walker.
#[derive(Default, Clone, Copy)]
pub(crate) struct WalkContext {
    /// True when we're inside a `codeBlock` node OR a text node carrying a `code` mark.
    /// Mention rewriting and macro placeholder injection are SUPPRESSED in this state.
    in_code_context: bool,
}

/// Recursively walks a node. Type-dispatches on the `type` discriminant.
///
/// `pub(crate)` so unit tests can build synthetic ADF and exercise the walker
/// without going through htmltoadf.
pub(crate) fn walk_adf_node_mut<S: BuildHasher>(
    node: &mut serde_json::Value,
    user_map: &HashMap<String, Option<String>, S>,
    ctx: WalkContext,
) {
    let kind = node
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Determine whether this node enters a code context.
    let mut next_ctx = ctx;
    if kind == "codeBlock" {
        next_ctx.in_code_context = true;
    }

    // Recurse into `content` first — child nodes get the propagated `next_ctx`.
    if let Some(content) = node.get_mut("content").and_then(|c| c.as_array_mut()) {
        // Use index-based walking so we can in-place mutate AND splice arrays.
        let mut i = 0;
        while i < content.len() {
            walk_adf_node_mut(&mut content[i], user_map, next_ctx);
            i += 1;
        }

        // Second pass: splice text nodes containing `[~user]` into [text, mention, text, …]
        // chains. Skip if the parent enters code context (Pitfall F applies).
        // Note: splice_mentions_in_content_array independently skips text nodes
        // that carry a `code` mark (Pitfall F). No additional gating is needed here.
        if !next_ctx.in_code_context {
            splice_mentions_in_content_array(content, user_map);
            splice_macros_in_content_array(content);
        }
    }
}

/// Walks a content array, replacing each text node containing one or more
/// `[~username]` patterns with a sequence of [text(prefix), mention, text(rest), …].
/// Unresolvable usernames are emitted as plain `@username` text (D-05).
fn splice_mentions_in_content_array<S: BuildHasher>(
    content: &mut Vec<serde_json::Value>,
    user_map: &HashMap<String, Option<String>, S>,
) {
    let mut i = 0;
    while i < content.len() {
        let is_text = content[i].get("type").and_then(|t| t.as_str()) == Some("text");
        if !is_text {
            i += 1;
            continue;
        }
        // Skip text nodes carrying a `code` mark (Pitfall F).
        let has_code_mark = content[i]
            .get("marks")
            .and_then(|m| m.as_array())
            .is_some_and(|arr| {
                arr.iter()
                    .any(|m| m.get("type").and_then(|t| t.as_str()) == Some("code"))
            });
        if has_code_mark {
            i += 1;
            continue;
        }
        let text = content[i]
            .get("text")
            .and_then(|x| x.as_str())
            .unwrap_or("");
        if !text.contains("[~") {
            i += 1;
            continue;
        }
        let replacement = expand_mentions_in_text(text, user_map);
        // Only use the in-place rewrite when the single result is a plain text
        // node. If it's a mention node (whole text was "[~username]" with no
        // prefix or suffix), fall through to the splice path so the original
        // text node is removed and the mention node is inserted correctly.
        let only_text_node = replacement.len() == 1
            && replacement[0].get("type").and_then(|t| t.as_str()) == Some("text");
        if only_text_node {
            // Single text node, no mention found. Rewrite text in-place (handles
            // the case where pattern was malformed and got passed through unchanged).
            if let Some(s) = replacement[0].get("text").and_then(|x| x.as_str()) {
                content[i]["text"] = serde_json::Value::String(s.to_string());
            }
            i += 1;
        } else {
            // Splice: remove original, insert replacement nodes.
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
    }
}

/// Splits `text` at each `[~username]` pattern. Each pattern emits either:
///
/// - a `mention` node `{type:"mention", attrs:{id, text:"@<username>"}}` (D-04), OR
/// - a plain `text` node containing `@<username>` (D-05) when `user_map` has None / missing.
///
/// Surrounding text fragments are emitted as plain `text` nodes.
fn expand_mentions_in_text<S: BuildHasher>(
    text: &str,
    user_map: &HashMap<String, Option<String>, S>,
) -> Vec<serde_json::Value> {
    let mut out: Vec<serde_json::Value> = Vec::new();
    let bytes = text.as_bytes();
    let mut cursor = 0;
    let mut i = 0;
    while i + 2 < bytes.len() {
        if bytes[i] == b'[' && bytes[i + 1] == b'~' {
            let start = i + 2;
            let mut j = start;
            while j < bytes.len() {
                let c = bytes[j];
                let ok = c.is_ascii_alphanumeric() || c == b'.' || c == b'-' || c == b'_';
                if ok {
                    j += 1;
                } else {
                    break;
                }
            }
            // Allow non-ASCII char extension for unicode usernames: scan until `]`.
            // (Tolerant — extends beyond ASCII alnum if needed for utf-8 safe slicing.)
            while j < bytes.len() && bytes[j] != b']' && bytes[j] != b' ' && bytes[j] != b'\t' {
                j += 1;
            }
            if j < bytes.len() && bytes[j] == b']' && j > start {
                // Emit prefix text (if any).
                if cursor < i {
                    let prefix = std::str::from_utf8(&bytes[cursor..i]).unwrap_or("");
                    if !prefix.is_empty() {
                        out.push(serde_json::json!({"type":"text","text":prefix}));
                    }
                }
                let username = std::str::from_utf8(&bytes[start..j]).unwrap_or("");
                let display = format!("@{username}");
                match user_map.get(username).and_then(|v| v.as_ref()) {
                    Some(account_id) => {
                        out.push(serde_json::json!({
                            "type": "mention",
                            "attrs": { "id": account_id.as_str(), "text": display.as_str() }
                        }));
                    }
                    None => {
                        // D-05 fallback: plain text "@username".
                        out.push(serde_json::json!({"type":"text","text":display}));
                    }
                }
                cursor = j + 1;
                i = j + 1;
                continue;
            }
        }
        i += 1;
    }
    // Trailing text.
    if cursor < bytes.len() {
        if let Ok(rest) = std::str::from_utf8(&bytes[cursor..]) {
            if !rest.is_empty() {
                out.push(serde_json::json!({"type":"text","text":rest}));
            }
        }
    }
    if out.is_empty() {
        // No mentions, no surrounding text — return original wrapped as one text node.
        out.push(serde_json::json!({"type":"text","text":text}));
    }
    out
}

/// Replaces text nodes whose entire text matches an unsupported wiki macro
/// (e.g., `{toc}`) with `[Not converted: {macro}]` placeholder text.
///
/// Skipped in code context (caller must gate on `in_code_context`).
fn splice_macros_in_content_array(content: &mut [serde_json::Value]) {
    for node in content.iter_mut() {
        if node.get("type").and_then(|t| t.as_str()) != Some("text") {
            continue;
        }
        let text = node
            .get("text")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .trim();
        let mut should_replace = false;
        for prefix in UNSUPPORTED_MACROS {
            if text.starts_with(prefix) {
                should_replace = true;
                break;
            }
        }
        if should_replace {
            let original = node
                .get("text")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            node["text"] = serde_json::Value::String(format!("[Not converted: {original}]"));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn returns_valid_adf_doc_for_simple_html() {
        let v = convert_and_postprocess("<p>hello</p>", &HashMap::new());
        assert_eq!(v["type"], "doc");
        assert_eq!(v["version"], 1);
        assert!(v["content"].is_array());
    }

    #[test]
    fn empty_html_returns_empty_doc() {
        let v = convert_and_postprocess("", &HashMap::new());
        assert_eq!(v, empty_doc());
    }

    #[test]
    fn malformed_html_falls_back_to_empty_doc() {
        // htmltoadf is robust; we can't directly force a parse error.
        // But empty-doc guarantee means even unusual inputs produce a doc with
        // type="doc" — never None / Err / panic.
        let v = convert_and_postprocess("\u{0}", &HashMap::new());
        assert_eq!(v["type"], "doc");
    }

    #[test]
    fn mention_pattern_resolves_to_mention_node() {
        let mut m = HashMap::new();
        m.insert("jdoe".into(), Some("AID-A".into()));
        let v = convert_and_postprocess("<p>Hi [~jdoe]</p>", &m);
        // Walk content[0].content for a mention node with id == "AID-A".
        let para = &v["content"][0];
        assert_eq!(para["type"], "paragraph");
        let inner = para["content"].as_array().expect("paragraph content");
        let has_mention = inner.iter().any(|n| {
            n["type"] == "mention" && n["attrs"]["id"] == "AID-A" && n["attrs"]["text"] == "@jdoe"
        });
        assert!(
            has_mention,
            "ADF tree did not contain expected mention node: {v:?}"
        );
    }

    #[test]
    fn unresolvable_mention_degrades_to_plain_text() {
        let mut m = HashMap::new();
        m.insert("ghost".into(), None);
        let v = convert_and_postprocess("<p>Hi [~ghost]</p>", &m);
        let s = serde_json::to_string(&v).unwrap();
        assert!(s.contains("@ghost"));
        assert!(
            !s.contains("\"type\":\"mention\""),
            "should NOT contain mention"
        );
    }

    #[test]
    fn mention_user_not_in_map_degrades_to_plain_text() {
        let v = convert_and_postprocess("<p>[~unknown]</p>", &HashMap::new());
        let s = serde_json::to_string(&v).unwrap();
        assert!(s.contains("@unknown"));
        assert!(!s.contains("\"type\":\"mention\""));
    }

    #[test]
    fn unsupported_macro_becomes_placeholder() {
        let v = convert_and_postprocess("<p>{toc}</p>", &HashMap::new());
        let s = serde_json::to_string(&v).unwrap();
        assert!(
            s.contains("[Not converted: {toc}]"),
            "expected placeholder, got: {s}"
        );
    }

    #[test]
    fn code_block_brackets_left_alone_pitfall_f() {
        // Build a synthetic ADF document with a codeBlock containing [~jdoe].
        let mut adf = json!({
            "version": 1, "type": "doc", "content": [
                { "type": "codeBlock", "content": [
                    { "type": "text", "text": "let pat = [~jdoe];" }
                ] },
                { "type": "paragraph", "content": [
                    { "type": "text", "text": "Mention [~jdoe] outside code" }
                ] }
            ]
        });
        let mut m = HashMap::new();
        m.insert("jdoe".into(), Some("AID-A".into()));
        walk_adf_node_mut(&mut adf, &m, WalkContext::default());
        // Code block text MUST be unchanged.
        assert_eq!(
            adf["content"][0]["content"][0]["text"],
            "let pat = [~jdoe];"
        );
        // Outside code block: a mention node must have been spliced in.
        let outer_para = adf["content"][1]["content"].as_array().unwrap();
        let has_mention = outer_para.iter().any(|n| n["type"] == "mention");
        assert!(has_mention);
    }

    #[test]
    fn code_mark_inline_brackets_left_alone_pitfall_f() {
        let mut adf = json!({
            "version": 1, "type": "doc", "content": [
                { "type": "paragraph", "content": [
                    { "type": "text", "text": "[~jdoe]", "marks": [{ "type": "code" }] }
                ] }
            ]
        });
        let mut m = HashMap::new();
        m.insert("jdoe".into(), Some("AID-A".into()));
        walk_adf_node_mut(&mut adf, &m, WalkContext::default());
        // Inline-code text untouched.
        assert_eq!(adf["content"][0]["content"][0]["text"], "[~jdoe]");
        let s = serde_json::to_string(&adf).unwrap();
        assert!(!s.contains("\"type\":\"mention\""));
    }

    #[test]
    fn multiple_mentions_in_one_paragraph() {
        let mut m = HashMap::new();
        m.insert("alice".into(), Some("AID-A".into()));
        m.insert("bob".into(), Some("AID-B".into()));
        let v = convert_and_postprocess("<p>Hi [~alice] and [~bob]</p>", &m);
        let s = serde_json::to_string(&v).unwrap();
        assert!(s.contains("AID-A"));
        assert!(s.contains("AID-B"));
        // Two mention nodes total.
        let count = s.matches("\"type\":\"mention\"").count();
        assert_eq!(count, 2);
    }

    #[test]
    fn mention_text_preserves_unicode() {
        let mut m = HashMap::new();
        m.insert("jdoe-čž".into(), Some("AID-X".into()));
        // Build a synthetic ADF directly — htmltoadf may HTML-escape unicode.
        let mut adf = json!({
            "version": 1, "type": "doc", "content": [
                { "type": "paragraph", "content": [
                    { "type": "text", "text": "Hi [~jdoe-čž]" }
                ] }
            ]
        });
        walk_adf_node_mut(&mut adf, &m, WalkContext::default());
        let s = serde_json::to_string(&adf).unwrap();
        assert!(s.contains("@jdoe-čž") || s.contains("@jdoe-\\u010d\\u017e"));
    }
}
