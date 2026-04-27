//! Phase 17: Field discovery types + (Plan 04) HTTP fetchers + Tauri commands.
//!
//! This module owns:
//!   - `FieldSchemaType` — serde-tagged discriminated union over Atlassian schema.type values
//!   - `FieldSchema` — one row of a /field or /createmeta response
//!   - `CreatemetaResponse` — paginated createmeta wrapper
//!   - `IssueTypeRef` — entry in /createmeta/{key}/issuetypes
//!   - `FieldSide` — 'source' | 'target' discriminant for the cache key
//!
//! Plan 04 will add: `discover_v2_fields`, `discover_v3_fields`,
//! `fetch_all_createmeta_fields`, `fetch_createmeta_issuetypes`, `probe_createmeta`,
//! plus the Tauri commands in `commands.rs` that delegate here.

use serde::{Deserialize, Serialize};

/// Side discriminant for the schema cache key. Mirrors the `SQLite` `CHECK`
/// constraint `side IN ('source','target')`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldSide {
    Source,
    Target,
}

impl FieldSide {
    pub fn as_str(&self) -> &'static str {
        match self {
            FieldSide::Source => "source",
            FieldSide::Target => "target",
        }
    }
}

/// Polymorphic Jira `schema` object. The serde tag is `type`; unknown variants
/// fall through to `Any` rather than failing deserialization (Pitfall A).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum FieldSchemaType {
    String {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Number {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Date {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Datetime {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    User {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Array {
        items: String, // "option" | "string" | "user" | "component" | "version" | "group"
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    #[serde(rename = "option")]
    Option_ {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    #[serde(rename = "option-with-child")]
    OptionWithChild {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        system: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        custom: Option<String>,
        #[serde(default, rename = "customId", skip_serializing_if = "Option::is_none")]
        custom_id: Option<u64>,
    },
    Issuetype,
    Priority,
    /// Catch-all for any future Atlassian schema.type not yet handled here.
    /// Renderers must treat this as a read-only "Unsupported type" pill.
    #[serde(other)]
    Any,
}

/// One row in a /field or paginated /createmeta response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldSchema {
    pub field_id: String,
    pub name: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_default_value: Option<bool>,
    pub schema: FieldSchemaType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allowed_values: Option<Vec<serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operations: Option<Vec<String>>,
}

/// Paginated wrapper returned by /rest/api/3/issue/createmeta/{key}/issuetypes/{id}.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatemetaResponse {
    pub start_at: u64,
    pub max_results: u64,
    pub total: u64,
    pub fields: Vec<FieldSchema>,
}

/// Issue-type entry in /createmeta/{key}/issuetypes (used by pre-warm + Phase 22 chooser).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTypeRef {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
}

/// Issue-type list page wrapper (mirrors createmeta paginated shape).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTypesResponse {
    pub start_at: u64,
    pub max_results: u64,
    pub total: u64,
    pub issue_types: Vec<IssueTypeRef>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn round_trip(v: serde_json::Value) -> FieldSchemaType {
        let parsed: FieldSchemaType = serde_json::from_value(v.clone())
            .unwrap_or_else(|e| panic!("deserialize failed for {v}: {e}"));
        parsed
    }

    #[test]
    fn serde_round_trip_string() {
        let parsed = round_trip(json!({"type": "string", "system": "summary"}));
        assert!(matches!(parsed, FieldSchemaType::String { ref system, .. } if system.as_deref() == Some("summary")));
    }

    #[test]
    fn serde_round_trip_number_with_custom() {
        let parsed = round_trip(json!({
            "type": "number",
            "custom": "com.atlassian.jira.plugin.system.customfieldtypes:float",
            "customId": 10001
        }));
        match parsed {
            FieldSchemaType::Number { custom, custom_id, .. } => {
                assert_eq!(custom.as_deref(), Some("com.atlassian.jira.plugin.system.customfieldtypes:float"));
                assert_eq!(custom_id, Some(10001));
            }
            _ => panic!("expected Number variant"),
        }
    }

    #[test]
    fn serde_round_trip_date() {
        let parsed = round_trip(json!({"type": "date"}));
        assert!(matches!(parsed, FieldSchemaType::Date { .. }));
    }

    #[test]
    fn serde_round_trip_datetime() {
        let parsed = round_trip(json!({"type": "datetime"}));
        assert!(matches!(parsed, FieldSchemaType::Datetime { .. }));
    }

    #[test]
    fn serde_round_trip_user() {
        let parsed = round_trip(json!({"type": "user", "system": "assignee"}));
        assert!(matches!(parsed, FieldSchemaType::User { ref system, .. } if system.as_deref() == Some("assignee")));
    }

    #[test]
    fn serde_round_trip_multiselect_array() {
        let parsed = round_trip(json!({
            "type": "array",
            "items": "option",
            "custom": "com.atlassian.jira.plugin.system.customfieldtypes:multiselect",
            "customId": 10004
        }));
        match parsed {
            FieldSchemaType::Array { items, custom_id, .. } => {
                assert_eq!(items, "option");
                assert_eq!(custom_id, Some(10004));
            }
            _ => panic!("expected Array variant"),
        }
    }

    #[test]
    fn serde_round_trip_option() {
        let parsed = round_trip(json!({"type": "option", "custom": "...:select"}));
        assert!(matches!(parsed, FieldSchemaType::Option_ { .. }));
    }

    #[test]
    fn serde_round_trip_cascading() {
        let parsed = round_trip(json!({
            "type": "option-with-child",
            "custom": "com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect",
            "customId": 10005
        }));
        assert!(matches!(parsed, FieldSchemaType::OptionWithChild { .. }));
    }

    #[test]
    fn serde_round_trip_issuetype() {
        let parsed = round_trip(json!({"type": "issuetype"}));
        assert!(matches!(parsed, FieldSchemaType::Issuetype));
    }

    #[test]
    fn serde_round_trip_priority() {
        let parsed = round_trip(json!({"type": "priority", "system": "priority"}));
        assert!(matches!(parsed, FieldSchemaType::Priority));
    }

    #[test]
    fn serde_unknown_type_falls_through_to_any() {
        // Pitfall A: never panic on unknown schema.type
        let parsed = round_trip(json!({"type": "watches"}));
        assert!(matches!(parsed, FieldSchemaType::Any));
        let parsed2 = round_trip(json!({"type": "timetracking"}));
        assert!(matches!(parsed2, FieldSchemaType::Any));
    }

    #[test]
    fn field_schema_full_row_parses() {
        let row: FieldSchema = serde_json::from_value(json!({
            "fieldId": "customfield_10001",
            "key": "customfield_10001",
            "name": "Story Points",
            "required": false,
            "hasDefaultValue": false,
            "operations": ["set"],
            "schema": {
                "type": "number",
                "custom": "com.atlassian.jira.plugin.system.customfieldtypes:float",
                "customId": 10001
            }
        })).unwrap();
        assert_eq!(row.field_id, "customfield_10001");
        assert!(matches!(row.schema, FieldSchemaType::Number { .. }));
    }

    #[test]
    fn createmeta_response_parses_paginated_wrapper() {
        let resp: CreatemetaResponse = serde_json::from_value(json!({
            "startAt": 0,
            "maxResults": 5,
            "total": 7,
            "fields": []
        })).unwrap();
        assert_eq!(resp.start_at, 0);
        assert_eq!(resp.max_results, 5);
        assert_eq!(resp.total, 7);
    }

    #[test]
    fn issue_type_ref_parses() {
        let it: IssueTypeRef = serde_json::from_value(json!({
            "id": "10001",
            "name": "Bug",
            "description": "A defect",
            "iconUrl": "https://example.com/bug.png"
        })).unwrap();
        assert_eq!(it.id, "10001");
        assert_eq!(it.name, "Bug");
    }

    #[test]
    fn field_side_serializes_lowercase() {
        assert_eq!(serde_json::to_value(FieldSide::Source).unwrap(), json!("source"));
        assert_eq!(serde_json::to_value(FieldSide::Target).unwrap(), json!("target"));
    }

    #[test]
    fn field_side_as_str() {
        assert_eq!(FieldSide::Source.as_str(), "source");
        assert_eq!(FieldSide::Target.as_str(), "target");
    }
}
