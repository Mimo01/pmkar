//! Phase 18: pure Rust v2→v3 field translation pipeline.
//!
//! This module owns the contracts that every downstream plan implements against:
//!   - `ResolvedFields`  — the pipeline output: target-fields map + typed gaps (D-01)
//!   - `GapVariant`      — discriminated union over Unresolved* (kind=person|version|component)
//!   - `UnresolvedPerson` / `UnresolvedVersion` / `UnresolvedComponent` (D-01/D-02/D-10)
//!   - `TransformContext` — dependency carrier passed to every transformer
//!   - `TransformError`  — INFRASTRUCTURE failures only (HTTP, JSON parse, lock poisoning).
//!     Business gaps go in `ResolvedFields.gaps`, NEVER as Err.
//!
//! Phase 19 will add `FieldMappingRow` to `field_mapping_db.rs`. Until then, Phase 18
//! pipeline tests construct `FieldMappingRow` instances inline (see pipeline.rs tests).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

pub mod component;
pub mod identity;
pub mod pipeline;
pub mod user;
pub mod version;
pub mod wiki_to_adf;

pub use component::ComponentResolver;
pub use pipeline::apply_mapping;
pub use user::UserResolver;
pub use version::VersionResolver;

// ─── Typed gap variants (D-01, D-02, D-03, D-10) ────────────────────────────

/// Source person could not be resolved to a Cloud `accountId`. Carries the full
/// source identity payload so Phase 22's person picker can pre-fill the search
/// field and surface "Could not auto-match — please search manually" (D-02).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UnresolvedPerson {
    pub target_field_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UnresolvedVersion {
    pub target_field_id: String,
    pub source_name: String,
    pub target_project_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UnresolvedComponent {
    pub target_field_id: String,
    pub source_name: String,
    pub target_project_key: String,
}

/// Discriminated union over the three gap types. `kind` is the discriminant.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum GapVariant {
    Person(UnresolvedPerson),
    Version(UnresolvedVersion),
    Component(UnresolvedComponent),
}

// ─── Pipeline output (D-01) ──────────────────────────────────────────────────

/// Output of `apply_mapping`. `fields` is ready to embed under `"fields"` in a
/// Cloud `POST /rest/api/3/issue` body; `gaps` is consumed by Phase 22 for
/// required-field gating UI. `apply_mapping` ALWAYS returns `ResolvedFields` —
/// never `Err` for business-logic gaps.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ResolvedFields {
    /// Target-side field map. Keys are target field IDs (e.g. `"assignee"`,
    /// `"customfield_10001"`). Values are write-shape JSON (NEVER read-shape).
    pub fields: serde_json::Map<String, serde_json::Value>,
    /// Typed gaps Phase 22 surfaces as required-field gating UI.
    pub gaps: Vec<GapVariant>,
}

// ─── Infrastructure errors (distinct from business gaps) ─────────────────────

/// `TransformError` is for INFRASTRUCTURE failures only — HTTP transport, JSON
/// parse, lock poisoning. Use `GapVariant` for expected business outcomes
/// (unresolvable user/version/component).
#[derive(Debug, thiserror::Error)]
pub enum TransformError {
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("Internal error: {0}")]
    Internal(String),
    #[error("Serialization error: {0}")]
    Serialization(String),
    #[error("Duplicate target field id in mapping: {0}")]
    DuplicateTargetField(String),
}

impl From<crate::error::AppError> for TransformError {
    fn from(e: crate::error::AppError) -> Self {
        match e {
            crate::error::AppError::Http(m) => TransformError::Http(m),
            crate::error::AppError::Serialization(m) => TransformError::Serialization(m),
            other => TransformError::Internal(other.to_string()),
        }
    }
}

// ─── Dependency carrier (Pattern 6 in 18-RESEARCH.md) ────────────────────────

/// Shared resources passed to every transformer. Created once per `apply_mapping`
/// call; threaded through Phase 1 (batch) and Phase 2 (per-row dispatch).
pub struct TransformContext<'a> {
    pub client: &'a reqwest::Client,
    pub cloud_auth: &'a str,
    pub cloud_base_url: &'a str,
    pub target_project_key: &'a str,
    pub user_resolver: &'a UserResolver,
    pub version_resolver: &'a VersionResolver,
    pub component_resolver: &'a ComponentResolver,
    /// Pre-built map: source username → target accountId (or None if unresolvable).
    /// Populated by Phase 1 of `apply_mapping` BEFORE Phase 2 dispatch.
    pub user_map: &'a HashMap<String, Option<String>>,
}

// ─── Phase 18 will add FieldMappingRow inline in pipeline tests until Phase 19 ──

/// Stub of the saved-mapping row Phase 19 will own. Phase 18 uses this shape in
/// pipeline tests; Phase 19 moves the canonical definition to `field_mapping_db.rs`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldMappingRow {
    pub source_field_id: String,
    pub target_field_id: String,
    pub transformer_kind: String, // "identity" | "user" | "user_name" | "version" | "component" | "wiki_to_adf" | "priority" | "static"
    pub source_schema: crate::field_discovery::FieldSchemaType,
    pub target_schema: crate::field_discovery::FieldSchemaType,
    /// Phase 27: constant value emitted to the target field when `transformer_kind` == `"static"`.
    /// Absent for non-static rows (wire name: `staticValue`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub static_value: Option<String>,
}

// Stub session caches — Plans 02 (version/component) populate these fully.
pub type SessionVersionCache = Arc<Mutex<HashMap<String, Vec<serde_json::Value>>>>;
pub type SessionComponentCache = Arc<Mutex<HashMap<String, Vec<serde_json::Value>>>>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolved_fields_default_empty() {
        let r = ResolvedFields::default();
        assert!(r.fields.is_empty());
        assert!(r.gaps.is_empty());
    }

    #[test]
    fn gap_variant_serializes_with_kind_tag() {
        let g = GapVariant::Person(UnresolvedPerson {
            target_field_id: "assignee".into(),
            source_username: Some("jdoe".into()),
            source_key: None,
            source_email: None,
        });
        let v = serde_json::to_value(&g).unwrap();
        assert_eq!(v.get("kind").and_then(|x| x.as_str()), Some("person"));
        assert_eq!(
            v.get("targetFieldId").and_then(|x| x.as_str()),
            Some("assignee")
        );
        assert_eq!(
            v.get("sourceUsername").and_then(|x| x.as_str()),
            Some("jdoe")
        );
    }

    #[test]
    fn unresolved_person_carries_source_identity() {
        let p = UnresolvedPerson {
            target_field_id: "reporter".into(),
            source_username: Some("alice".into()),
            source_key: Some("JIRAUSER10100".into()),
            source_email: Some("alice@example.com".into()),
        };
        let s = serde_json::to_string(&p).unwrap();
        let back: UnresolvedPerson = serde_json::from_str(&s).unwrap();
        assert_eq!(p, back);
    }

    #[test]
    fn transform_error_distinct_from_gaps() {
        // GapVariant is not Err; TransformError is. Compile-time + runtime check.
        let _g = GapVariant::Version(UnresolvedVersion {
            target_field_id: "fixVersions".into(),
            source_name: "1.0".into(),
            target_project_key: "MYPROJ".into(),
        });
        let _e = TransformError::Http("oops".into());
    }
}
