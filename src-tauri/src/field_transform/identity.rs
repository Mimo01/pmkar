//! Phase 18 — identity.rs: passthrough + write-shape correction for symmetric
//! field types (TRAN-01..04 fall back here for non-special types).
//!
//! Per Pitfall 4 (read-shape ≠ write-shape), this module STRIPS read-only fields
//! before passing values to Cloud:
//!
//! - Priority:    `{id, name, self, ...}` → `{id}`
//! - `Option_`:   `{id, value, self, ...}` → `{value}` (fallback to `{id}` if no value)
//! - `Array<option>`: each element stripped per above
//!
//! Phase 18 does NOT handle:
//!
//! - User / Array<user> (delegated to user.rs / pipeline batched lookup)
//! - Array<version> (delegated to version.rs)
//! - Array<component> (delegated to component.rs)
//! - String { system: "description" } (delegated to `wiki_to_adf.rs`)
//! - `OptionWithChild` (cascade — Phase 20 owns the renderer)
//! - Issuetype (Phase 23 owns the target POST shape)

use crate::field_discovery::FieldSchemaType;
use serde_json::{json, Map, Value};

/// Returns the source value passed straight through, OR a write-shape-corrected
/// version when the schema requires it (e.g., priority `{id, name}` → `{id}`).
///
/// Returns `Value::Null` for unsupported types (`Any`, `Issuetype`, `User`,
/// `OptionWithChild`) — the pipeline routes those elsewhere.
pub fn transform_identity(source_value: &Value, target_schema: &FieldSchemaType) -> Value {
    if source_value.is_null() {
        return Value::Null;
    }
    match target_schema {
        FieldSchemaType::String { .. }
        | FieldSchemaType::Number { .. }
        | FieldSchemaType::Date { .. }
        | FieldSchemaType::Datetime { .. } => source_value.clone(),

        FieldSchemaType::Priority => strip_to_id(source_value),

        FieldSchemaType::Option_ { .. } => strip_to_value_or_id(source_value),

        FieldSchemaType::Array { items, .. } => match items.as_str() {
            // List of strings (labels, etc.) — pass through.
            "string" => source_value.clone(),
            // Multi-select — strip each element to {value} (Pitfall 4).
            "option" => match source_value.as_array() {
                Some(arr) => Value::Array(arr.iter().map(strip_to_value_or_id).collect()),
                None => Value::Null,
            },
            // group: pass {name} write shape.
            "group" => match source_value.as_array() {
                Some(arr) => Value::Array(arr.iter().map(strip_to_name).collect()),
                None => Value::Null,
            },
            // user / version / component → these are NOT identity fields; pipeline
            // routes them to user.rs / version.rs / component.rs. Defensive return.
            _ => Value::Null,
        },

        // Phase 18 does not touch these — pipeline routes elsewhere or skips.
        FieldSchemaType::User { .. }
        | FieldSchemaType::OptionWithChild { .. }
        | FieldSchemaType::Issuetype
        | FieldSchemaType::Any => Value::Null,
    }
}

/// Reduce `{id, name, self, ...}` to `{id}`. Returns `Null` if no `id` key.
fn strip_to_id(v: &Value) -> Value {
    let Some(obj) = v.as_object() else {
        return Value::Null;
    };
    let Some(id) = obj.get("id").and_then(|x| x.as_str()) else {
        return Value::Null;
    };
    let mut m = Map::new();
    m.insert("id".into(), json!(id));
    Value::Object(m)
}

/// Reduce select-option `{id, value, self, ...}` to `{value}` (preferred) or
/// `{id}` (fallback). This is the Cloud write shape per Pitfall 4.
fn strip_to_value_or_id(v: &Value) -> Value {
    let Some(obj) = v.as_object() else {
        return Value::Null;
    };
    if let Some(value) = obj.get("value").and_then(|x| x.as_str()) {
        let mut m = Map::new();
        m.insert("value".into(), json!(value));
        return Value::Object(m);
    }
    if let Some(id) = obj.get("id").and_then(|x| x.as_str()) {
        let mut m = Map::new();
        m.insert("id".into(), json!(id));
        return Value::Object(m);
    }
    Value::Null
}

/// Reduce a group-picker entry `{name, self}` to `{name}`.
fn strip_to_name(v: &Value) -> Value {
    let Some(obj) = v.as_object() else {
        return Value::Null;
    };
    let Some(name) = obj.get("name").and_then(|x| x.as_str()) else {
        return Value::Null;
    };
    let mut m = Map::new();
    m.insert("name".into(), json!(name));
    Value::Object(m)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s_str() -> FieldSchemaType {
        FieldSchemaType::String {
            system: None,
            custom: None,
            custom_id: None,
        }
    }
    fn s_num() -> FieldSchemaType {
        FieldSchemaType::Number {
            system: None,
            custom: None,
            custom_id: None,
        }
    }
    fn s_date() -> FieldSchemaType {
        FieldSchemaType::Date {
            system: None,
            custom: None,
            custom_id: None,
        }
    }
    fn s_datetime() -> FieldSchemaType {
        FieldSchemaType::Datetime {
            system: None,
            custom: None,
            custom_id: None,
        }
    }
    fn s_arr_string() -> FieldSchemaType {
        FieldSchemaType::Array {
            items: "string".into(),
            system: None,
            custom: None,
            custom_id: None,
        }
    }
    fn s_arr_option() -> FieldSchemaType {
        FieldSchemaType::Array {
            items: "option".into(),
            system: None,
            custom: None,
            custom_id: None,
        }
    }
    fn s_option() -> FieldSchemaType {
        FieldSchemaType::Option_ {
            system: None,
            custom: None,
            custom_id: None,
        }
    }

    #[test]
    fn text_passthrough() {
        assert_eq!(
            transform_identity(&json!("hello"), &s_str()),
            json!("hello")
        );
    }

    #[test]
    fn number_passthrough() {
        assert_eq!(transform_identity(&json!(3.14), &s_num()), json!(3.14));
    }

    #[test]
    fn date_passthrough() {
        assert_eq!(
            transform_identity(&json!("2026-04-27"), &s_date()),
            json!("2026-04-27")
        );
    }

    #[test]
    fn datetime_passthrough() {
        let v = json!("2026-04-27T10:00:00.000+0200");
        assert_eq!(transform_identity(&v, &s_datetime()), v);
    }

    #[test]
    fn labels_array_passthrough() {
        let v = json!(["a", "b"]);
        assert_eq!(transform_identity(&v, &s_arr_string()), v);
    }

    #[test]
    fn priority_strips_to_id_only_pitfall_4() {
        let v = json!({"id":"3","name":"Medium","self":"http://example/3"});
        assert_eq!(
            transform_identity(&v, &FieldSchemaType::Priority),
            json!({"id":"3"})
        );
    }

    #[test]
    fn option_strips_to_value_only_pitfall_4() {
        let v = json!({"id":"100","value":"High","self":"http://example/100"});
        assert_eq!(transform_identity(&v, &s_option()), json!({"value":"High"}));
    }

    #[test]
    fn array_of_option_strips_to_value_only_pitfall_4() {
        let v = json!([{"id":"1","value":"A"},{"id":"2","value":"B"}]);
        assert_eq!(
            transform_identity(&v, &s_arr_option()),
            json!([{"value":"A"},{"value":"B"}])
        );
    }

    #[test]
    fn option_with_id_only_falls_back_to_id() {
        let v = json!({"id":"100"});
        assert_eq!(transform_identity(&v, &s_option()), json!({"id":"100"}));
    }

    #[test]
    fn any_returns_null() {
        assert_eq!(
            transform_identity(&json!({"foo":"bar"}), &FieldSchemaType::Any),
            Value::Null
        );
    }

    #[test]
    fn null_input_returns_null() {
        assert_eq!(transform_identity(&Value::Null, &s_str()), Value::Null);
    }

    #[test]
    fn issuetype_returns_null_phase_18_does_not_handle() {
        assert_eq!(
            transform_identity(&json!({"id":"1","name":"Bug"}), &FieldSchemaType::Issuetype),
            Value::Null
        );
    }
}
