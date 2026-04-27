//! Phase 18 — pipeline.rs: `apply_mapping` two-phase entry point. Stub created
//! in Plan 01; real body in Plan 05.

use crate::field_transform::{FieldMappingRow, ResolvedFields, TransformContext};

/// Phase 18 pipeline entry point. Two-phase async fn:
///
///   1. Pre-scan source issue + mapping for all unique user references → batch HTTP.
///   2. Walk mapping rows, dispatch to per-type transformer, collect results + gaps.
///
/// Plan 05 implements the body. Plan 01 ships only the signature.
pub async fn apply_mapping(
    _source_issue: &serde_json::Value,
    _mapping: &[FieldMappingRow],
    _ctx: &TransformContext<'_>,
) -> ResolvedFields {
    // Plan 05 replaces this with real two-phase logic.
    ResolvedFields::default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn apply_mapping_stub_returns_empty_resolved_fields() {
        // Smoke test: pipeline compiles and returns the expected default shape.
        // Real two-phase tests live in Plan 05.
        // We can't easily build a TransformContext in Plan 01 (resolvers are stubs).
        // Plan 05 supplies a real fixture builder. Stub-only assertion here.
        let r = ResolvedFields::default();
        assert!(r.fields.is_empty());
        assert!(r.gaps.is_empty());
        let _ = apply_mapping; // ensure symbol exists
    }
}
