---
status: root_cause_found
trigger: "When copying a story, some fields are not mapped according to the setup mapping and are left empty"
created: 2026-04-29
updated: 2026-04-29
---

# Debug Session: copy-fields-not-mapped

## Symptoms

- expected: Every field with a source→target mapping configured in field mapping settings should be pre-populated with the mapped value when copying a story
- actual: No mappings are applied at all — every field that should be pre-filled is empty after copy
- scope: Any copy with mappings configured (all projects/boards affected)
- timeline: Unsure — may never have worked
- reproduction: Configure source→target field mappings in settings, then copy any story, observe all mapped fields are empty

## Current Focus

hypothesis: "The 5 default seed mapping rows (description, labels, priority, assignee, reporter) all have NULL source_schema_json and target_schema_json in the DB. On load they deserialize to FieldSchemaType::Any. In pipeline.rs, the dispatcher checks source_schema — Any matches none of the special branches (description, user, version, component), falls to identity::transform_identity with target_schema=Any, which explicitly returns Value::Null. All 5 defaults silently produce nothing. Additionally, handleAcceptSuggestion in FieldMappingSection.tsx never calls invoke('set_field_mapping') — so suggestion-accepted rows are only in local Zustand state and lost on navigation."
test: ""
expecting: ""
next_action: "Fix: (1) in pipeline.rs, add transformer_kind fallback so rows with Any schema can still dispatch based on transformer_kind string; OR update seed_defaults_if_empty to supply proper schema JSON for the 5 known system fields. (2) Fix handleAcceptSuggestion to persist to DB."
reasoning_checkpoint: "The transformer_kind column is stored in DB but completely ignored by apply_mapping — dispatch is purely schema-type-driven. Rows with NULL schema (Any) always fall to identity->Null. Two independent bugs together explain why no mappings ever apply."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-04-29T00:00:00Z
  file: src-tauri/src/field_mapping_db.rs
  note: "seed_defaults_if_empty inserts 5 rows (description, labels, priority, assignee, reporter) with source_schema_json=NULL and target_schema_json=NULL (line 112-119)"

- timestamp: 2026-04-29T00:01:00Z
  file: src-tauri/src/field_mapping_db.rs
  note: "get_all_mapping_rows() deserializes NULL schema columns as FieldSchemaType::Any (line 357)"

- timestamp: 2026-04-29T00:02:00Z
  file: src-tauri/src/field_transform/pipeline.rs
  note: "apply_mapping dispatches purely on source_schema type: is_description_row(Any)=false, is_user_field(Any)=false, is_array_of(Any,*)=false — falls to identity::transform_identity(src_val, Any) which returns Null. transformer_kind is never consulted."

- timestamp: 2026-04-29T00:03:00Z
  file: src-tauri/src/field_transform/identity.rs
  note: "transform_identity: FieldSchemaType::Any => Value::Null (line 64). All 5 default rows silently produce nothing."

- timestamp: 2026-04-29T00:04:00Z
  file: src/features/field-mapping/FieldMappingSection.tsx
  note: "handleAcceptSuggestion (line 267-277) calls updateRow(newRow) — local state only — but never calls invoke('set_field_mapping', { row: newRow }). Suggestion-accepted rows are NOT persisted to DB."

## Eliminated

- Frontend invoke call site (copyStore.ts:confirmCopy) — correctly passes overrideValues and sourceKey to copy_ticket_v2
- apply_mapping pipeline logic for non-Any schemas — correctly dispatches by type for user, version, component, string
- DB persistence layer for manually typed target changes — handleTargetChange correctly calls invoke('set_field_mapping')

## Resolution

root_cause: "Two independent bugs: (1) All 5 seeded default mapping rows have NULL schema JSON, deserializing to FieldSchemaType::Any, which causes pipeline.rs to route every row through identity::transform_identity(_, Any) = Null — silently skipping all. (2) handleAcceptSuggestion in FieldMappingSection.tsx never calls invoke('set_field_mapping') so suggestion-accepted rows are never persisted."
fix: "Fix (1) by updating seed_defaults_if_empty to store proper schema JSON for the 5 known system fields (description→String{system:description}, labels→Array{items:string}, priority→Priority, assignee→User, reporter→User). Fix (2) by adding invoke('set_field_mapping', { row: newRow }) in handleAcceptSuggestion before updateRow."
