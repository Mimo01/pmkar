//! Phase 18 — `wiki_to_adf.rs`: htmltoadf wrapper + ADF post-processor for
//! mention resolution (D-04/D-05/D-06) and unsupported-macro placeholders
//! (D-07). Stub in Plan 01; real impl in Plan 04.

use std::collections::HashMap;
use std::hash::BuildHasher;

/// Converts source HTML (already image-URL-rewritten by the caller — D-08) to
/// ADF, then runs a post-processor pass that:
///   - Replaces `[~username]` text with Cloud `mention` ADF nodes (D-04);
///     unresolvable mentions degrade to plain `@username` text (D-05).
///   - Replaces unhandled wiki macros (`{toc}`, `{anchor}`, etc.) with
///     `[Not converted: {macro}]` annotated placeholders (D-07).
///
/// `user_map` is the pre-built batched lookup result from Phase 1 of `apply_mapping`.
pub fn convert_and_postprocess<S: BuildHasher>(
    _html: &str,
    _user_map: &HashMap<String, Option<String>, S>,
) -> serde_json::Value {
    // Plan 04 replaces with real htmltoadf wrap + post-processor walk.
    serde_json::json!({ "version": 1, "type": "doc", "content": [] })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wiki_to_adf_stub_returns_empty_doc() {
        let v = convert_and_postprocess("", &HashMap::new());
        assert_eq!(v["type"], "doc");
        assert_eq!(v["version"], 1);
    }
}
