---
phase: quick-260429-nhs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/field_mapping_db.rs
  - src/features/field-mapping/FieldMappingSection.tsx
autonomous: true
requirements: [NHS-01, NHS-02]

must_haves:
  truths:
    - "Copying a ticket applies description, labels, priority, assignee, and reporter to the target"
    - "Accepting a suggestion in field mapping settings persists the mapping to the DB"
    - "Dismissing a suggestion in field mapping settings persists the dismissed sentinel to the DB"
    - "Existing DB rows with NULL schema JSON are updated to proper schema types on next open"
  artifacts:
    - path: "src-tauri/src/field_mapping_db.rs"
      provides: "seed_defaults_if_empty with proper schema JSON + NULL migration UPDATE"
    - path: "src/features/field-mapping/FieldMappingSection.tsx"
      provides: "handleAcceptSuggestion and handleDismissSuggestion persist via invoke"
  key_links:
    - from: "seed_defaults_if_empty"
      to: "pipeline.rs dispatcher"
      via: "source_schema stored as typed JSON, not NULL → Any"
      pattern: "source_schema_json.*type.*user|string|array|priority"
    - from: "handleAcceptSuggestion"
      to: "set_field_mapping Tauri command"
      via: "invoke call alongside updateRow"
      pattern: "invoke.*set_field_mapping"
---

<objective>
Fix two bugs that cause field mappings to not apply during story copy:

1. **Rust — NULL schema bug:** `seed_defaults_if_empty` inserts the 5 system field defaults with `source_schema_json = NULL` and `target_schema_json = NULL`. When read back, NULL deserializes to `FieldSchemaType::Any`. In `pipeline.rs`, `transform_identity(src_val, Any)` returns `Value::Null`, and `is_user_field(Any)` / `is_description_row(Any)` return false — so description, labels, priority, assignee, and reporter are all silently skipped. Fix: store proper schema JSON strings for the 5 defaults, and add an UPDATE migration to fix any existing rows already in production DBs.

2. **TypeScript — missing DB persist:** `handleAcceptSuggestion` and `handleDismissSuggestion` only call `updateRow(newRow)` (local Zustand state) but never `invoke('set_field_mapping', { row: newRow })`. The accepted/dismissed mapping is lost on app restart. Fix: add the invoke call in both handlers, matching the pattern in `handleSelectNewSource`.

Purpose: Field mappings must survive the full pipeline — from settings UI through DB persistence through copy pipeline dispatch.
Output: Fixed field_mapping_db.rs + FieldMappingSection.tsx with regression tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/pmkar/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/pmkar/.planning/STATE.md
</context>

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From src-tauri/src/field_discovery.rs:
```rust
// FieldSchemaType serde: #[serde(tag = "type", rename_all = "kebab-case")]
// Serialized forms needed for seed defaults:
// description  → {"type":"string","system":"description"}
// labels       → {"type":"array","items":"string"}
// priority     → {"type":"priority"}
// assignee     → {"type":"user","system":"assignee"}
// reporter     → {"type":"user","system":"reporter"}

pub enum FieldSchemaType {
    String { system: Option<String>, custom: Option<String>, custom_id: Option<u64> },
    Array { items: String, system: Option<String>, custom: Option<String>, custom_id: Option<u64> },
    User { system: Option<String>, custom: Option<String>, custom_id: Option<u64> },
    Priority,
    Any,  // catch-all — transform_identity returns Null for Any
    // ...other variants
}
```

From src-tauri/src/field_transform/pipeline.rs (dispatcher logic):
```rust
// is_description_row: matches String { system: Some("description") }
// is_user_field (user.rs): matches User { .. } OR Array { items: "user", .. }
// is_array_of(s, "version"): Array { items: "version" }
// Everything else → identity::transform_identity(&src_val, &row.target_schema)
// identity returns Null for Any → field silently dropped from copy payload
```

From src/features/field-mapping/FieldMappingSection.tsx (reference persist pattern):
```typescript
// handleSelectNewSource — the correct pattern for persisting a row:
async function handleSelectNewSource(sf: FieldSchema) {
  const newRow: FieldMappingRow = { ... };
  try {
    await invoke('set_field_mapping', { row: newRow });
    updateRow(newRow);
    setPendingAdd(false);
  } catch {
    toast.error(t('settings.fieldMapping.saveError'));
  }
}

// handleAcceptSuggestion — MISSING invoke (Bug 2):
function handleAcceptSuggestion(sourceFieldId: string, target: FieldSchema) {
  const newRow: FieldMappingRow = { ... };
  updateRow(newRow);  // ← only local state, never hits DB
}

// handleDismissSuggestion — MISSING invoke (Bug 2, same issue):
function handleDismissSuggestion(sourceFieldId: string) {
  const dismissedRow: FieldMappingRow = { ... };
  updateRow(dismissedRow);  // ← only local state, never hits DB
}
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fix seed_defaults_if_empty with typed schema JSON + NULL migration</name>
  <files>src-tauri/src/field_mapping_db.rs</files>
  <behavior>
    - After fix: `get_all_mapping_rows()` on a fresh DB returns rows where description has source_schema = String { system: Some("description") } and target_schema = String { system: Some("description") }
    - After fix: assignee and reporter rows have source_schema = User { system: Some("assignee"|"reporter") }
    - After fix: priority row has source_schema = FieldSchemaType::Priority and target_schema = FieldSchemaType::Priority
    - After fix: labels row has source_schema = Array { items: "string" } and target_schema = Array { items: "string" }
    - Migration: an existing DB with 5 NULL-schema rows gets them updated to typed schemas on next open (UPDATE WHERE source_schema_json IS NULL)
    - Existing test `get_returns_rows_in_insertion_order` continues to pass
    - Existing test `seed_inserts_five_defaults_on_empty_table` continues to pass
  </behavior>
  <action>
In `seed_defaults_if_empty`, replace the 5 NULL inserts with typed schema JSON strings.

The 5 defaults become a `[(&str, &str, &str, &str, &str); 5]` tuple of (src_id, tgt_id, kind, src_schema_json, tgt_schema_json):

```
("description", "description", "wiki_to_adf",
 r#"{"type":"string","system":"description"}"#,
 r#"{"type":"string","system":"description"}"#),

("labels", "labels", "identity",
 r#"{"type":"array","items":"string"}"#,
 r#"{"type":"array","items":"string"}"#),

("priority", "priority", "priority",
 r#"{"type":"priority"}"#,
 r#"{"type":"priority"}"#),

("assignee", "assignee", "user",
 r#"{"type":"user","system":"assignee"}"#,
 r#"{"type":"user","system":"assignee"}"#),

("reporter", "reporter", "user",
 r#"{"type":"user","system":"reporter"}"#,
 r#"{"type":"user","system":"reporter"}"#),
```

Change INSERT to use `?4` / `?5` for src_schema_json and tgt_schema_json (non-NULL). Update the loop accordingly.

Also add a NULL migration step that runs BEFORE `seed_defaults_if_empty`. Add a const `UPDATE_NULL_SCHEMA_DEFAULTS` and call it in both `open()` and `open_in_memory()` immediately before the seed call:

```sql
UPDATE field_mapping
SET
  source_schema_json = CASE source_field_id
    WHEN 'description' THEN '{"type":"string","system":"description"}'
    WHEN 'labels'       THEN '{"type":"array","items":"string"}'
    WHEN 'priority'     THEN '{"type":"priority"}'
    WHEN 'assignee'     THEN '{"type":"user","system":"assignee"}'
    WHEN 'reporter'     THEN '{"type":"user","system":"reporter"}'
    ELSE source_schema_json
  END,
  target_schema_json = CASE source_field_id
    WHEN 'description' THEN '{"type":"string","system":"description"}'
    WHEN 'labels'       THEN '{"type":"array","items":"string"}'
    WHEN 'priority'     THEN '{"type":"priority"}'
    WHEN 'assignee'     THEN '{"type":"user","system":"assignee"}'
    WHEN 'reporter'     THEN '{"type":"user","system":"reporter"}'
    ELSE target_schema_json
  END
WHERE (source_schema_json IS NULL OR target_schema_json IS NULL)
  AND source_field_id IN ('description','labels','priority','assignee','reporter');
```

Add two new tests in the `#[cfg(test)]` block:

1. `seed_defaults_have_correct_source_schemas` — call `get_all_mapping_rows()` on a fresh in-memory DB and assert each of the 5 rows has the exact `source_schema` variant (not `FieldSchemaType::Any`):
   - description: `FieldSchemaType::String { system: Some("description"), .. }`
   - labels: `FieldSchemaType::Array { items: "string", .. }`
   - priority: `FieldSchemaType::Priority`
   - assignee: `FieldSchemaType::User { system: Some("assignee"), .. }`
   - reporter: `FieldSchemaType::User { system: Some("reporter"), .. }`

2. `null_schema_migration_updates_existing_rows` — manually insert a row with `source_schema_json = NULL` and `target_schema_json = NULL` for `source_field_id = 'priority'`, then call `update_null_schema_defaults(&conn)` (extract the migration as a pub(crate) function for testability), then call `get_all_mapping_rows()` and assert the priority row now has `source_schema = FieldSchemaType::Priority`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/pmkar && cargo test -p pmkar-lib field_mapping_db 2>&1 | tail -20</automated>
  </verify>
  <done>All field_mapping_db tests pass including two new schema tests; cargo test -p pmkar-lib compiles without warnings (excluding pre-existing); priority/assignee/reporter/description/labels default rows return typed FieldSchemaType variants (not Any) from get_all_mapping_rows()</done>
</task>

<task type="auto">
  <name>Task 2: Fix handleAcceptSuggestion and handleDismissSuggestion to persist via invoke</name>
  <files>src/features/field-mapping/FieldMappingSection.tsx</files>
  <action>
Convert both handlers from synchronous functions to async and add the `invoke('set_field_mapping', { row: newRow })` call before `updateRow`, matching the `handleSelectNewSource` pattern exactly.

**handleAcceptSuggestion** (line ~267): Change `function` to `async function`. Before `updateRow(newRow)`, add:
```typescript
try {
  await invoke('set_field_mapping', { row: newRow });
  updateRow(newRow);
} catch {
  toast.error(t('settings.fieldMapping.saveError'));
}
```
Remove the bare `updateRow(newRow)` that was there before.

**handleDismissSuggestion** (line ~279): Same pattern. Change to `async function`. Wrap with try/catch, call `await invoke('set_field_mapping', { row: dismissedRow })` first, then `updateRow(dismissedRow)` on success. On catch, show `toast.error(t('settings.fieldMapping.saveError'))`.

No other changes to this file. `handleSelectNewSource` already has the correct pattern and is the reference — do not modify it.

The `invoke` import is already at line 1 of the file. `toast` and `t` are already in scope.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/pmkar && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20</automated>
  </verify>
  <done>TypeScript compiles without errors; both handleAcceptSuggestion and handleDismissSuggestion are async and call invoke('set_field_mapping') before updateRow; pattern matches handleSelectNewSource</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| DB → pipeline | Seed rows read back as FieldSchemaType::Any bypass all type-specific dispatchers |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-NHS-01 | Tampering | seed_defaults_if_empty | mitigate | Store schema JSON as typed strings, not NULL; add NULL migration UPDATE so existing rows are repaired |
| T-NHS-02 | Tampering | handleAcceptSuggestion | mitigate | Add invoke persist call; mapping lost on restart without it |
</threat_model>

<verification>
1. `cargo test -p pmkar-lib field_mapping_db` — all tests pass including two new schema assertion tests
2. `npx tsc --noEmit` — no TypeScript errors
3. Manual spot-check: open app, go to Field Mapping settings, accept a suggestion, restart app — row should still be present
4. Manual spot-check: copy a ticket — description/priority/assignee/reporter fields should appear in the copy result
</verification>

<success_criteria>
- `seed_inserts_five_defaults_on_empty_table` still passes (count = 5)
- New test `seed_defaults_have_correct_source_schemas` passes (no Any variant in defaults)
- New test `null_schema_migration_updates_existing_rows` passes (migration fixes existing NULLs)
- TypeScript compiles clean
- Both suggestion handlers are async and persist to DB via invoke before updating Zustand state
</success_criteria>

<output>
After completion, create `.planning/quick/260429-nhs-fix-field-mappings-not-applied-on-copy/260429-nhs-SUMMARY.md`
</output>
