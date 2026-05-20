# Phase 27: Add static value mapping to configurable field mapping - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the Settings → Copying → Field Mapping editor to support a new "static" transformer kind. A static mapping is a target-only assignment: the user picks a target field and configures a constant value that is always written to that field when copying, regardless of (and without) any source field value. This enables cloud-only target fields with no source counterpart to receive a project-specific default on every copy.

</domain>

<decisions>
## Implementation Decisions

### Mapping Trigger Model
- **D-01:** Static mappings are **target-only** — no source field is required. A static row picks a target field and stores a constant value; there is no source_field_id from the source Jira issue.
- **D-02:** Static rows live in the existing `field_mapping` table. The current `source_field_id UNIQUE` PK is preserved by using a synthetic sentinel: `source_field_id = "__static__{target_field_id}"` (e.g., `__static__customfield_10050`). No schema migration to nullable source_field_id.
- **D-03:** Static rows appear in the same `FieldMappingSection` list as source→target rows, but are **visually distinct** — the source field column shows a "Static" badge instead of a source field name.

### Add Row UX
- **D-04:** A dedicated **"Add static value"** button in `FieldMappingSection` (separate from any existing "Add mapping" button). Clicking it inserts a new static row into the list.
- **D-05:** Within the new static row, the user **picks the target field first** (via the same target combobox already used by `MappingRow`). Once a target is selected, the value widget appears inline.

### Value Authoring
- **D-06:** **Smart widget per field type** — the value input adapts to the target field schema:
  - `string`, `number`, `date`, `datetime` → text input
  - `option` (SingleSelect), `option-with-child` → single dropdown from `allowed_values` (pulled from `field_schema_cache`)
  - `array` of `option` (MultiSelect) → multi-select dropdown from `allowed_values`
  - `array` of `string` (Labels) → comma-separated text input; pipeline splits + trims to produce a JSON string array
  - User fields (`user`, `array` of `user`) → **excluded from Phase 27**
  - Priority → **excluded from Phase 27** (already has dedicated override mechanism in copy preview panel)
- **D-07:** The value widget renders **inline** in the static row as a 4th column (after the "Static" transformer indicator). No separate panel or popover.

### Pipeline Dispatch
- **D-08:** A new `"static"` transformer_kind branch in `apply_mapping` (pipeline.rs). When `transformer_kind == "static"`, the pipeline skips the source field lookup entirely and emits the stored `static_value` directly to the target field. The synthetic `source_field_id` sentinel is never passed to `source_issue.pointer()`.
- **D-09:** The `static_value` is stored as a **new `TEXT` column** in the `field_mapping` table (`static_value TEXT` — nullable for non-static rows). The Rust `FieldMappingRow` struct gains an `Option<String> static_value` field.

### GapsSection Integration
- **D-10:** No extra wiring needed. Gap resolution logic already checks actual field values (not mapping presence). Static values written by the pipeline to the fields map satisfy required-field gaps naturally.

### Claude's Discretion
- DB schema: synthetic `__static__{target_field_id}` sentinel preserves the existing UNIQUE PK with no migration (chosen over a separate table to keep one DB access path).
- Add flow: "Add static value" button inserts a new row; target field first, then value input appears (same progressive pattern as existing rows).
- Value widget placement: inline 4th column (target → [Static badge] → value input → delete).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data Model
- `src/features/field-mapping/types.ts` — `FieldMappingRow` TypeScript mirror; must add `staticValue?: string` field
- `src-tauri/src/field_transform/mod.rs` — Rust `FieldMappingRow` struct (line ~135); must add `static_value: Option<String>`
- `src-tauri/src/field_mapping_db.rs` — `field_mapping` table DDL, `upsert_mapping_row`, `get_all_mapping_rows`; must add `static_value TEXT` column + migration

### Pipeline
- `src-tauri/src/field_transform/pipeline.rs` — `apply_mapping` two-phase entry; new `"static"` branch needed before the identity fallback (line ~105)
- `src-tauri/src/field_transform/mod.rs` — `FieldMappingRow` and transformer kinds comment (line ~140)

### UI — Mapping Editor
- `src/features/field-mapping/MappingRow.tsx` — existing row component; static row variant (or extended props) for the 4th-column value widget
- `src/features/field-mapping/FieldMappingSection.tsx` — orchestrator; add "Add static value" button
- `src/features/field-mapping/transformerOptions.ts` — `TransformerKind` union; add `"static"` literal; `getTransformerOptions` must include `STATIC` for target-only rows
- `src/features/field-mapping/types.ts` — `FieldMappingRow` TS type

### Field Schema (for allowed_values in smart widget)
- `src-tauri/src/field_mapping_db.rs` — `get_cached_schemas()` — used to fetch allowed_values for option fields at edit time
- `src-tauri/src/field_discovery.rs` — `FieldSchemaType` variants: `Option`, `OptionWithChild`, `Array` — drive widget type selection

### Copy Preview (read-only — confirm no changes needed)
- `src/features/tickets/computeGapFields.ts` — gap detection; no changes needed (D-10)
- `src/features/tickets/CopyPreviewPage.tsx` — GapsSection; no changes needed (D-10)

### Phase Specification
- `.planning/ROADMAP.md` Phase 27 — phase boundary reference

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `VirtualizedCombobox` (`src/features/field-renderers/components/VirtualizedCombobox.tsx`) — used by MappingRow for target field selection; reuse for the option/select value dropdown in static rows
- `field_schema_cache` data (via `get_cached_schemas` Tauri command) — already cached allowed_values for option fields; drives the smart widget dropdown
- `getTransformerOptions()` in `transformerOptions.ts` — already dispatches by field schema type; extend to include `"static"` for all non-user, non-priority types
- Existing `MappingRow` auto-save pattern (`invoke('set_field_mapping', { row })`) — same pattern for saving static row changes

### Established Patterns
- Synthetic sentinel pattern: `target_field_id = ""` is already used as the dismissed-suggestion sentinel; `__static__{id}` follows the same convention for static source_field_id
- DB migration: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pattern used by `migrate_mapping_audit_log_columns` — use same pattern for `static_value` column
- `transformer_kind` string dispatch in pipeline.rs — match arms by string; `"static"` is a new arm before the identity fallback
- `FieldMappingRow` already carries `Option<String>` fields would follow the pattern of other optional schema columns (see `source_schema_json` / `target_schema_json` nullable handling)

### Integration Points
- `FieldMappingSection` orchestrates the row list + the "add row" flow; new "Add static value" button + static row insertion connects here
- `set_field_mapping` / `get_field_mappings` Tauri commands in `commands.rs` — need to pass `static_value` through the command boundary
- `apply_mapping` called by `copy_ticket_v2` — the static branch must be transparent to callers

</code_context>

<specifics>
## Specific Ideas

- Static rows in the list: "Static" badge in the source column (replacing the source field name). Visual distinction without a separate sub-section.
- Labels (array of string): comma-separated text input — pipeline: `value.split(',').map(|s| s.trim()).filter(|s| !s.is_empty())` → JSON array.
- Priority and user fields are explicitly excluded from Phase 27. If they come up during planning, redirect to a follow-up phase.
- GapsSection: no changes. Static values are applied server-side by the pipeline before gap detection runs client-side; existing "value present" check is sufficient.

</specifics>

<deferred>
## Deferred Ideas

- **Static user field values** — user fields (assignee/reporter) with a hardcoded accountId. Complex: accountIds are Cloud-instance-specific, hard for user to configure. Follow-up phase.
- **Static priority mapping** — priority already has a dedicated override in the copy preview panel; making it also configurable as a static value in Settings could be revisited if users request it.
- **Per-issue-type static values** — global static mapping (one setting for all copies) is Phase 27 scope; per-issue-type static values would be a significant extension.

</deferred>

---

*Phase: 27-add-static-value-mapping-to-configurable-field-mapping*
*Context gathered: 2026-05-20*
