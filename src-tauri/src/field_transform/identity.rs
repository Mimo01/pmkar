//! Phase 18 — identity.rs: passthrough transforms for symmetric field types
//! (text, labels arrays, dates, numbers, priority by id). Stub in Plan 01;
//! real impl in Plan 04.

use crate::field_discovery::FieldSchemaType;
use serde_json::Value;

/// Returns the source value passed straight through, OR a write-shape-corrected
/// version when the schema requires it (e.g., priority `{id, name}` → `{id}`).
/// Plan 04 implements the per-variant write-shape logic.
pub fn transform_identity(source_value: &Value, _target_schema: &FieldSchemaType) -> Value {
    source_value.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn identity_stub_passes_text_through() {
        let v = json!("hello");
        let out = transform_identity(&v, &FieldSchemaType::String { system: None, custom: None, custom_id: None });
        assert_eq!(out, v);
    }
}
