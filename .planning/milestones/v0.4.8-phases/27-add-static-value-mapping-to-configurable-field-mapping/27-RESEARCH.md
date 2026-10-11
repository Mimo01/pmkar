# Phase 27: Add static value mapping to configurable field mapping - Research

**Researched:** 2026-05-20
**Domain:** Rust SQLite migration + pipeline dispatch + React/TypeScript field mapping UI extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Static mappings are target-only — no source field is required. A static row picks a target field and stores a constant value; there is no source_field_id from the source Jira issue.

**D-02:** Static rows live in the existing `field_mapping` table. The current `source_field_id UNIQUE` PK is preserved by using a synthetic sentinel: `source_field_id = "__static__{target_field_id}"` (e.g., `__static__customfield_10050`). No schema migration to nullable source_field_id.

**D-03:** Static rows appear in the same `FieldMappingSection` list as source→target rows, but are visually distinct — the source field column shows a "Static" badge instead of a source field name.

**D-04:** A dedicated "Add static value" button in `FieldMappingSection` (separate from any existing "Add mapping" button). Clicking it inserts a new static row into the list.

**D-05:** Within the new static row, the user picks the target field first (via the same target combobox already used by `MappingRow`). Once a target is selected, the value widget appears inline.

**D-06:** Smart widget per field type — the value input adapts to the target field schema.

**D-07:** The value widget renders inline in the static row as a 4th column (after the "Static" transformer indicator). No separate panel or popover.

**D-08:** A new `"static"` transformer_kind branch in `apply_mapping` (pipeline.rs). When `transformer_kind == "static"`, the pipeline skips the source field lookup entirely and emits the stored `static_value` directly to the target field. The synthetic `source_field_id` sentinel is never passed to `source_issue.pointer()`.

**D-09:** The `static_value` is stored as a new `TEXT` column in the `field_mapping` table (`static_value TEXT` — nullable for non-static rows). The Rust `FieldMappingRow` struct gains an `Option<String> static_value` field.

**D-10:** No extra wiring needed for GapsSection. Gap resolution logic already checks actual field values (not mapping presence). Static values written by the pipeline to the fields map satisfy required-field gaps naturally.

### Claude's Discretion

- DB schema: synthetic `__static__{target_field_id}` sentinel preserves the existing UNIQUE PK with no migration (chosen over a separate table to keep one DB access path).
- Add flow: "Add static value" button inserts a new row; target field first, then value input appears (same progressive pattern as existing rows).
- Value widget placement: inline 4th column (target → [Static badge] → value input → delete).

### Deferred Ideas (OUT OF SCOPE)

- Static user field values — user fields (assignee/reporter) with a hardcoded accountId.
- Static priority mapping — priority already has a dedicated override in the copy preview panel.
- Per-issue-type static values — global static mapping only in Phase 27.
</user_constraints>

---

## Summary

Phase 27 extends the existing field mapping system with a new "static" transformer kind. The implementation touches four orthogonal layers that must be coordinated: the SQLite schema (add `static_value TEXT` column via migration), the Rust pipeline (new `"static"` branch in `apply_mapping`), the Rust/TypeScript data model bridge (`FieldMappingRow` struct and interface get `static_value`), and the React UI (new `StaticMappingRow` component, "Add static value" button, smart value widget).

The phase is self-contained: all extension points are identified in the CONTEXT.md canonical refs, all relevant patterns already exist in the codebase, and no new external packages are needed. The main implementation risk is pipeline dispatch ordering — the `"static"` branch must be checked before the existing `is_user_field`, `is_array_of`, `is_priority_row`, and identity fallback branches so it is never accidentally shadowed. The DB migration follows the established `migrate_mapping_audit_log_columns` PRAGMA-gate pattern.

The UI layer introduces a new component (`StaticMappingRow`) alongside the existing `MappingRow`. The smart value widget inside it selects its input type from the target field's `FieldSchemaType`: text input for scalar types, `VirtualizedCombobox` for single-select option/option-with-child (UI pre-serializes the `{"id":"..."}` write-shape), comma-separated text input for arrays (UI stores raw text — the pipeline splits and shapes per target items-type per D-06 amended). All strings must be added to `src/i18n/locales/en.json` and `src/i18n/locales/sk.json` before the component ships.

**Primary recommendation:** Implement in four sequenced layers — DB migration → Rust struct/pipeline → TypeScript types/commands → UI component — to keep each layer testable independently before the next depends on it.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Store static_value in DB | Database (SQLite / `field_mapping_db.rs`) | — | Schema and persistence live in `FieldMappingDb`; migration pattern established |
| Static branch in copy pipeline | API/Backend (`pipeline.rs`) | — | `apply_mapping` owns all transformer dispatch; static is a new arm |
| FieldMappingRow struct extension | API/Backend (`field_transform/mod.rs`) | Frontend (`types.ts`) | Struct is the source of truth; TS mirror must stay in sync |
| Static row UI & value widget | Frontend (React/TypeScript) | — | `FieldMappingSection` and new `StaticMappingRow` component |
| Tauri command passthrough | API/Backend (`commands.rs`) | — | `set_field_mapping` / `get_field_mapping` already delegate to `FieldMappingDb`; just need to pass new field through |
| i18n strings | Frontend (`src/i18n/locales/`) | — | New keys required in both EN and SK before component impl |

---

## Standard Stack

### Core (all already present — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rusqlite | existing | SQLite DDL migration (`ALTER TABLE ADD COLUMN`) | Established in `field_mapping_db.rs` |
| serde / serde_json | existing | Serialize/deserialize `FieldMappingRow` across Tauri boundary | Project-wide pattern |
| React + TypeScript | existing | `StaticMappingRow` component, smart value widget | Project UI stack |
| `VirtualizedCombobox` | existing | Target field combobox + option value combobox in static rows | Already used by `MappingRow`; reuse directly |
| `shadcn/ui Button`, `Tooltip` | existing | "Add static value" button, "Static" badge tooltip | UI spec calls for existing components only |
| `i18next` / `react-i18next` | existing | New i18n keys for static row copy | Project-wide i18n pattern |
| `vitest` + `@testing-library/react` | existing | Unit tests for `StaticMappingRow` | `MappingRow.test.tsx` is the direct template |

**No new packages required.** [VERIFIED: codebase grep]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sentinel `__static__{id}` in existing table (D-02) | Separate `static_field_mapping` table | Separate table would require a new DB access path and duplicate most of the CRUD surface; sentinel avoids schema duplication |
| Inline 4th-column value widget (D-07) | Popover/panel for value editing | Popover adds interaction complexity and breaks the grid scan pattern; inline keeps the UX consistent with transformer column |

---

## Package Legitimacy Audit

No external packages are installed in this phase. All dependencies are already present in the project.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Settings UI
  │
  ├─ FieldMappingSection
  │    ├─ "Add field mapping" button → MappingRow (source→target, existing)
  │    └─ "Add static value" button → StaticMappingRow (NEW)
  │         ├─ Col 1: "Static" badge (aria-label)
  │         ├─ Col 2: VirtualizedCombobox (target field picker)
  │         ├─ Col 3: SmartValueWidget (text|combobox|text-comma per schema type)
  │         └─ Col 4: Delete button
  │
  └─ Tauri invoke boundary
       ├─ set_field_mapping({ row: FieldMappingRow })   ← includes staticValue
       ├─ get_field_mapping() → FieldMappingRow[]       ← includes staticValue
       └─ delete_field_mapping({ sourceFieldId: "__static__{target}" })

Rust backend
  ├─ field_mapping_db.rs
  │    ├─ migrate_static_value_column()   ← NEW (ALTER TABLE ADD COLUMN IF NOT EXISTS)
  │    ├─ upsert_mapping_row()            ← updated to write static_value
  │    └─ get_all_mapping_rows()          ← updated to read static_value
  │
  ├─ field_transform/mod.rs
  │    └─ FieldMappingRow { ..., static_value: Option<String> }   ← NEW field
  │
  └─ field_transform/pipeline.rs
       └─ apply_mapping()
            └─ NEW: if row.transformer_kind == "static" {
                 emit row.static_value → fields[row.target_field_id]
                 continue   // skip source_issue.pointer() entirely
               }
```

### Recommended Project Structure

No new directories. New files go alongside existing peers:

```
src/features/field-mapping/
├── FieldMappingSection.tsx     # modified: add "Add static value" button + pendingStaticAdd state
├── MappingRow.tsx              # unchanged
├── StaticMappingRow.tsx        # NEW: static row component
├── StaticValueWidget.tsx       # NEW: smart value widget (extracted for testability)
├── transformerOptions.ts       # modified: add "static" to TransformerKind union
├── types.ts                    # modified: add staticValue?: string to FieldMappingRow
└── __tests__/
    ├── StaticMappingRow.test.tsx  # NEW
    └── StaticValueWidget.test.tsx # NEW (optional — widget logic is simple)

src-tauri/src/
├── field_transform/
│   ├── mod.rs                  # modified: add static_value field to FieldMappingRow
│   └── pipeline.rs             # modified: add "static" branch in apply_mapping
└── field_mapping_db.rs         # modified: migration + upsert + get updated

src/i18n/locales/
├── en.json                     # modified: 11 new keys
└── sk.json                     # modified: 11 new keys (SK translations)
```

### Pattern 1: DB Migration for New Nullable Column

**What:** Add `static_value TEXT` to `field_mapping` using the same PRAGMA-gate idiom as `migrate_mapping_audit_log_columns`.

**When to use:** Any time a new nullable column must be added to an existing SQLite table without breaking existing rows.

**Example:**
```rust
// Source: src-tauri/src/field_mapping_db.rs:migrate_mapping_audit_log_columns (existing pattern)
fn migrate_static_value_column(conn: &Connection) -> AppResult<()> {
    let existing: Vec<String> = conn
        .prepare("PRAGMA table_info(field_mapping)")?
        .query_map([], |r| r.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;
    if !existing.iter().any(|c| c == "static_value") {
        conn.execute_batch(
            "ALTER TABLE field_mapping ADD COLUMN static_value TEXT;",
        )?;
    }
    Ok(())
}
```

Call this from both `FieldMappingDb::open()` and `FieldMappingDb::open_in_memory()` after the existing `migrate_mapping_audit_log_columns` call.

### Pattern 2: Static Branch in pipeline.rs

**What:** New match arm that runs before all schema-type dispatch, skipping the `source_issue.pointer()` call entirely.

**When to use:** `row.transformer_kind == "static"`.

**Example:**
```rust
// Source: apply_mapping dispatch loop — insert BEFORE the description branch
for row in mapping {
    // NEW: static transformer — emit stored value directly, skip source lookup
    if row.transformer_kind == "static" {
        if let Some(ref val) = row.static_value {
            // Dispatch on row.target_schema (see ## Open Questions (RESOLVED) for the
            // self-consistent storage→write-shape contract):
            //   - Array<option>: split + trim + filter-non-empty → [{"id":"val"},...]
            //   - Array<string/...>: split + trim + filter-non-empty → ["val",...]
            //   - Option / OptionWithChild (single-select): UI pre-serializes
            //     JSON.stringify({"id":"..."}); pipeline parses and passes through
            //   - Everything else: serde_json::from_str fallback → Value::String
            let emitted = match &row.target_schema {
                FieldSchemaType::Array { items, .. } if items == "option" => {
                    let parts: Vec<Value> = val
                        .split(',')
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .map(|s| json!({ "id": s }))
                        .collect();
                    Value::Array(parts)
                }
                FieldSchemaType::Array { .. } => {
                    let parts: Vec<Value> = val
                        .split(',')
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .map(|s| Value::String(s.to_string()))
                        .collect();
                    Value::Array(parts)
                }
                FieldSchemaType::Option_ { .. } | FieldSchemaType::OptionWithChild { .. } => {
                    serde_json::from_str::<Value>(val)
                        .unwrap_or_else(|_| Value::String(val.clone()))
                }
                _ => {
                    serde_json::from_str::<Value>(val)
                        .unwrap_or_else(|_| Value::String(val.clone()))
                }
            };
            fields.insert(row.target_field_id.clone(), emitted);
        }
        // static_value is None → row is pending (no target yet) → skip silently
        continue;
    }

    // ... existing branches follow unchanged
```

**Storage format (RESOLVED — see ## Open Questions (RESOLVED) below) — split contract:** Single-select option fields use a *pre-serialized JSON pass-through* shape; array fields use *raw comma-separated text with pipeline splitting*. The pipeline dispatches on `row.target_schema` to choose between these two strategies. Concretely:

- **Option / option-with-child (single-select):** UI stores `JSON.stringify({ id: opt.id })`. Pipeline parses with `serde_json::from_str` and passes the parsed `{"id":"10001"}` Value through. (D-06)
- **Array of option (MultiSelect):** UI stores raw comma-separated text (e.g. `"10001, 10002"`). Pipeline splits on `,`, trims, filters empty, and maps each id to `json!({"id": id})` → emits `[{"id":"10001"},{"id":"10002"}]`. (D-06 amended)
- **Array of string (Labels) / array of other non-user items:** UI stores raw comma-separated text (e.g. `"bug, regression"`). Pipeline splits on `,`, trims, filters empty, and maps each part to `Value::String` → emits `["bug","regression"]`. (D-06 amended)
- **String / number / date / datetime / any:** UI stores raw text. Pipeline's `serde_json::from_str` either parses the text as JSON (handles pre-serialized inputs) or falls back to `Value::String(text)` — correct shape for Jira text/number/date scalars.
- **User / priority:** Disabled in the UI (D-06 exclusion). No storage shape needed.

The pipeline owns the array-splitting logic because (a) the UI cannot trivially round-trip a JSON-array-shaped string through a single comma-separated text input field, and (b) Jira's write-shape for array-of-option (`[{"id":"..."}]`) is structurally distinct from array-of-string (`["..."]`) — only the pipeline (with access to `row.target_schema`) knows which shape to construct.

### Pattern 3: StaticMappingRow Component

**What:** A sibling component to `MappingRow` that renders the 4-column static row layout.

**When to use:** When `row.transformerKind === 'static'` (i.e. `row.sourceFieldId.startsWith('__static__')`).

**Example (sketch):**
```tsx
// Source: derived from MappingRow.tsx pattern (existing)
export function StaticMappingRow({ row, targetFields, usedTargetFieldIds, onRowUpdate, onRowDelete }) {
  const targetField = targetFields.find(f => f.fieldId === row.targetFieldId) ?? null;
  const [feedback, setFeedback] = useState<'saved' | null>(null);

  async function handleTargetChange(newTarget: FieldSchema) {
    const sentinelId = `__static__${newTarget.fieldId}`;
    const updated: FieldMappingRow = {
      sourceFieldId: sentinelId,
      targetFieldId: newTarget.fieldId,
      transformerKind: 'static',
      sourceSchema: { type: 'any' },
      targetSchema: newTarget.schema,
      staticValue: undefined,
    };
    await invoke('set_field_mapping', { row: updated });
    onRowUpdate(updated);
  }

  async function handleValueChange(newValue: string) {
    const updated: FieldMappingRow = { ...row, staticValue: newValue };
    await invoke('set_field_mapping', { row: updated });
    onRowUpdate(updated);
    setFeedback('saved');
    setTimeout(() => setFeedback(null), 1500);
  }

  async function handleDelete() {
    await invoke('delete_field_mapping', { sourceFieldId: row.sourceFieldId });
    onRowDelete(row.sourceFieldId);
  }

  return (
    <div className="grid grid-cols-[35fr_35fr_20fr_10fr] gap-3 items-center min-h-[40px] py-2 border-b border-brand-border last:border-0">
      {/* Col 1: Static badge */}
      <StaticBadge />
      {/* Col 2: Target combobox */}
      <VirtualizedCombobox ... />
      {/* Col 3: Smart value widget (appears after target is selected) */}
      {targetField ? <StaticValueWidget field={targetField} value={row.staticValue} onChange={handleValueChange} /> : <span>—</span>}
      {/* Col 4: Delete + saved indicator */}
      ...
    </div>
  );
}
```

### Pattern 4: FieldMappingSection — "Add static value" Button

**What:** Add a second ghost button below the existing "Add field mapping" button, managing a `pendingStaticAdd` boolean state in parallel with the existing `pendingAdd`.

**When to use:** Adding the button and its pending state logic.

**Example:**
```tsx
// In FieldMappingSection — after existing "Add field mapping" Button:
<Button
  type="button"
  variant="ghost"
  size="sm"
  onClick={() => setPendingStaticAdd(true)}
  disabled={pendingStaticAdd || pendingAdd}
  className="w-full justify-start text-brand-muted hover:text-brand-text gap-1.5"
  aria-label="Add static value mapping"
>
  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
  <span>{t('settings.fieldMapping.addStaticRow')}</span>
</Button>
```

### Pattern 5: Smart Value Widget Dispatch

**What:** Inline component that selects its input type from `FieldSchemaType` and emits the storage form (pre-serialized JSON write-shape for option types) via its `onChange` callback.

**Dispatch table (from UI-SPEC.md):**
```typescript
// StaticValueWidget.tsx
function StaticValueWidget({ field, value, onChange }) {
  const schema = field.schema;

  // Option / single-select — STORES pre-serialized Jira write-shape
  if (schema.type === 'option' || schema.type === 'option-with-child') {
    const options = field.allowedValues ?? [];
    return (
      <VirtualizedCombobox
        items={options}
        // ...
        onChange={(opt) => onChange(JSON.stringify({ id: opt.id }))}
      />
    );
  }

  // Array of option (multi-select) — use comma-separated text per UI-SPEC note
  if (schema.type === 'array' && schema.items === 'option') {
    return <TextInput hint={t('settings.fieldMapping.staticMultiHint')} ... />;
  }

  // Labels (array of string)
  if (schema.type === 'array' && schema.items === 'string') {
    return <TextInput hint={t('settings.fieldMapping.staticMultiHint')} ... />;
  }

  // Excluded types
  if (schema.type === 'user' || (schema.type === 'array' && schema.items === 'user') || schema.type === 'priority') {
    return <input disabled placeholder={t('settings.fieldMapping.staticUnsupported')} />;
  }

  // Default: text input for string, number, date, datetime
  return <TextInput placeholder={t('settings.fieldMapping.staticValuePlaceholder')} ... />;
}
```

### Anti-Patterns to Avoid

- **Nullable source_field_id migration:** D-02 explicitly chose the sentinel approach. Do not change the column to be nullable — that would require a schema migration and affects the UNIQUE constraint logic.
- **5th column in the grid:** UI-SPEC is explicit that the transformer column is repurposed as the value column for static rows. Do not add a 5th `grid-cols` entry.
- **Calling `source_issue.pointer()` for static rows:** The pipeline `"static"` branch must `continue` immediately after emitting the value, before the source pointer lookup that all other branches do.
- **Storing the bare option id (e.g. `"10001"`) for option fields:** Per ## Open Questions (RESOLVED), the UI MUST store `JSON.stringify({ id: opt.id })`. Storing the bare id would cause `serde_json::from_str` to fall through to `Value::String("10001")`, producing a `"10001"` payload that Jira Cloud v3 rejects for option fields (which require `{"id":"10001"}`).
- **UI-side array splitting / serialization:** The UI must NOT call `.split(',')`, `JSON.stringify([...])`, or otherwise pre-shape array values. Per D-06 amended, array static_values are stored as raw comma-separated text and the Rust pipeline (Plan 27-02 Task 3) splits them into the correct JSON array shape based on `row.target_schema` (`[{"id":"..."}]` for array-of-option, `["..."]` for array-of-string). UI-side splitting would break round-trip rendering (the text input cannot reconstruct an array JSON string back into a comma-separated form) and would force the UI to know per-items-type write shapes that already belong to the backend.
- **Duplicate-target check breakage:** The existing duplicate guard in `apply_mapping` uses `seen_targets.insert(row.target_field_id)`. Static rows have real target field IDs, so they participate in this check correctly. No change needed — but verify the test covers a static row + normal row targeting the same field.
- **Drifted-row detection false positive:** `driftedSourceFieldIds` in `FieldMappingSection` uses `r.sourceFieldId` as the drift key. Since static rows have `sourceFieldId = "__static__{targetFieldId}"`, drift detection compares the target field ID against the target schema. Static rows will correctly appear as "drifted" if their target field disappears from the schema — no special case needed, but this should be verified.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Option dropdown for static values | Custom select component | `VirtualizedCombobox` (existing) | Already handles large lists, keyboard nav, accessibility |
| SQLite column existence check | Manual SQL inspection | PRAGMA table_info pattern (existing in `migrate_mapping_audit_log_columns`) | Proven idempotent, consistent with codebase |
| Auto-save on change | Custom debounce/flush | `invoke('set_field_mapping', { row })` on blur/change (existing `MappingRow` pattern) | 1500ms feedback flash pattern already implemented |
| i18n string management | Inline hardcoded strings | `useTranslation` + new keys in `en.json`/`sk.json` | Mandatory per project pattern; SK translation required |

---

## Runtime State Inventory

This is a feature addition phase, not a rename/refactor. No runtime state inventory required.

---

## Common Pitfalls

### Pitfall 1: Static branch placement in apply_mapping loop

**What goes wrong:** The `"static"` transformer_kind check is placed after the `is_user_field()` or `is_description_row()` checks. Since a static row's `source_schema` is `FieldSchemaType::Any` (no real source schema for a target-only row), `is_user_field(Any)` returns false and `is_description_row(Any)` returns false, so this pitfall is less dangerous than it first appears. However, the `source_issue.pointer()` call at the top of the loop body is the critical issue: for a static row, `source_field_id` is `"__static__customfield_10050"` — calling `pointer("/fields/__static__customfield_10050")` on the source issue will return `Value::Null`. The identity fallback will then emit nothing. The static branch MUST be checked before `source_issue.pointer()` is called, which means before the entire existing dispatch block.

**Why it happens:** The loop currently calls `source_issue.pointer(&path)` unconditionally at line 48 of pipeline.rs, before any schema checks. The static branch cannot simply be inserted after this call.

**How to avoid:** Check `transformer_kind == "static"` as the FIRST test in the loop body, before the `source_issue.pointer()` call. Use `continue` to skip the rest.

**Warning signs:** Static value not appearing in the copied issue's fields; no error, just silent omission.

### Pitfall 2: static_value not propagated through Tauri command boundary

**What goes wrong:** `FieldMappingRow` Rust struct gains `static_value: Option<String>` but `upsert_mapping_row` is not updated to include the new column in its INSERT/UPDATE statement. The value is serialized from the frontend, deserialized into the Rust struct, but then silently dropped at the DB write.

**Why it happens:** The INSERT in `upsert_mapping_row` lists columns explicitly — adding a struct field without updating the SQL leaves the column NULL always.

**How to avoid:** Update both the `INSERT` param list and the `ON CONFLICT DO UPDATE SET` clause to include `static_value = excluded.static_value`. Also update `get_all_mapping_rows` SELECT to read column index 5 (after the existing 5 columns).

**Warning signs:** Value widget shows correct value in UI but field is always NULL after page reload.

### Pitfall 3: used_target_field_ids includes static sentinel

**What goes wrong:** `usedTargetFieldIds` in `FieldMappingSection` collects all `targetFieldId` values. Static rows have real `targetFieldId` values (e.g. `"customfield_10050"`), which is correct — they should block a normal row from also targeting that field. But `sourceFieldId` for static rows is `"__static__customfield_10050"`. If any filter accidentally checks `sourceFieldId` for deduplication instead of `targetFieldId`, it will fail to block the correct field.

**Why it happens:** Confusion between the sentinel (sourceFieldId) and the actual target.

**How to avoid:** Always use `r.targetFieldId` for the `usedTargetFieldIds` set — this is already correct in the existing code and static rows share the same data shape.

### Pitfall 4: Drift detection for static rows

**What goes wrong:** Drift detection checks `!targetIds.has(r.targetFieldId)`. For static rows, `r.sourceFieldId` starts with `__static__`, which is NOT a real source field. `driftedSourceFieldIds` stores `r.sourceFieldId` values. The `MappingRow` component receives `isDrifted` based on this set and renders a `DriftWarning`. If `StaticMappingRow` also receives `isDrifted` and renders `DriftWarning`, the UX will be broken — static rows have no source field to warn about.

**Why it happens:** Drift warning was designed for source→target rows only.

**How to avoid:** In `FieldMappingSection`, only render a `StaticMappingRow` (not a `MappingRow`) for rows where `row.sourceFieldId.startsWith('__static__')`. Static rows can be drifted (if their target disappears), but the handling should be inline (row shown as stale, delete button highlighted) rather than `DriftWarning` component.

### Pitfall 5: SK translation missing

**What goes wrong:** EN keys are added to `en.json` but SK keys are omitted or use the EN fallback. The i18n system will log warnings and show EN text in SK mode, which is visible to the user.

**Why it happens:** Forgetting the second locale file.

**How to avoid:** Add all 11 new keys to both `src/i18n/locales/en.json` and `src/i18n/locales/sk.json` in the same task/commit. SK values must be proper Slovak translations (with diacritics), not placeholders.

### Pitfall 6: Static row included in duplicate-target guard race

**What goes wrong:** A static row targeting `customfield_10050` is inserted while a normal row also targeting `customfield_10050` exists. The partial unique index on `field_mapping(target_field_id) WHERE target_field_id != ''` will reject the INSERT with a UNIQUE constraint error. This is correct behavior, but the UI needs to respect `usedTargetFieldIds` to prevent the user from selecting an already-used target in the static row target combobox.

**Why it happens:** The combobox filter for the static row's target picker must respect `usedTargetFieldIds` the same way `MappingRow` does.

**How to avoid:** Pass `usedTargetFieldIds` to `StaticMappingRow` and filter the target combobox identically.

### Pitfall 7: Wrong write-shape for option / array-of-option fields

**What goes wrong:** Two distinct failure modes, both producing Jira Cloud v3 rejection:

1. *Single-select option:* The StaticValueWidget option branch calls `onChange(opt.id)` instead of `onChange(JSON.stringify({ id: opt.id }))`. The pipeline's single-option arm parses `"10001"` as a JSON string scalar (or falls through to `Value::String("10001")`), and Jira Cloud v3 rejects the field write because single-select option fields require an object shape `{"id":"10001"}`.

2. *Array-of-option:* The UI tries to "help" by either (a) calling `JSON.stringify([{id:"10001"}])` (pre-serializing a JSON array), or (b) calling `.split(',')` on user input and storing a JSON array string. The pipeline's array-of-option arm then sees a single string like `'[{"id":"10001"}]'`, tries to split it on `,`, trims `[{"id":"10001"}]` (no commas), wraps it as `[{"id":"[{\"id\":\"10001\"}]"}]` — completely wrong shape. The UI must store the RAW user text exactly as typed (e.g. `"10001, 10002"`) so the pipeline can split it correctly.

**Why it happens:** For (1), the option's `id` looks like a natural identifier to store; the pipeline's `from_str` fallback masks the bug for text fields, hiding the misuse for option fields until a real copy is attempted. For (2), well-meaning UI authors try to "make it easier" for the backend by pre-shaping the value — but D-06 amended explicitly assigns array splitting to the pipeline.

**How to avoid:**
- **Single-option:** UI MUST store `JSON.stringify({ id: opt.id })`. Acceptance criteria in Plan 27-04 Task 1 enforce a positive grep gate (`JSON.stringify({ id: opt.id })` present) and a negative grep gate (bare `onChange(opt.id)` absent).
- **Array branches:** UI MUST store the raw input string via `onChange(e.target.value)` — no `.split(',')`, no `JSON.stringify(...)`. Plan 27-04 Task 1 acceptance criteria enforce a positive grep gate (`onChange(e.target.value)` present in the array branch) and a negative gate against array-branch `.split(',')` / `JSON.stringify`. The Rust pipeline (Plan 27-02 Task 3) performs the split + shape construction.

---

## Code Examples

### Rust: FieldMappingRow struct update

```rust
// Source: src-tauri/src/field_transform/mod.rs (existing struct at line ~135)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldMappingRow {
    pub source_field_id: String,
    pub target_field_id: String,
    pub transformer_kind: String,
    pub source_schema: crate::field_discovery::FieldSchemaType,
    pub target_schema: crate::field_discovery::FieldSchemaType,
    // NEW — Phase 27:
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub static_value: Option<String>,
}
```

### Rust: upsert_mapping_row updated INSERT

```rust
// Source: src-tauri/src/field_mapping_db.rs — upsert_mapping_row
self.conn.execute(
    "INSERT INTO field_mapping
         (source_field_id, target_field_id, transformer_kind,
          source_schema_json, target_schema_json, static_value,
          created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
     ON CONFLICT(source_field_id) DO UPDATE SET
         target_field_id     = excluded.target_field_id,
         transformer_kind    = excluded.transformer_kind,
         source_schema_json  = excluded.source_schema_json,
         target_schema_json  = excluded.target_schema_json,
         static_value        = excluded.static_value,
         updated_at          = excluded.updated_at",
    params![
        row.source_field_id,
        row.target_field_id,
        row.transformer_kind,
        source_schema_json,
        target_schema_json,
        row.static_value,   // NEW
        now,
    ],
)?;
```

### Rust: get_all_mapping_rows updated SELECT

```rust
// Source: src-tauri/src/field_mapping_db.rs — get_all_mapping_rows
let mut stmt = self.conn.prepare(
    "SELECT source_field_id, target_field_id, transformer_kind,
            source_schema_json, target_schema_json, static_value
     FROM field_mapping
     ORDER BY id ASC",
)?;
let rows = stmt.query_map([], |row| {
    // ... existing cols 0-4 ...
    let static_value: Option<String> = row.get(5)?;  // NEW
    Ok((source_field_id, target_field_id, transformer_kind,
        source_schema_json, target_schema_json, static_value))  // NEW
})?;
// ... in the out.push():
out.push(FieldMappingRow {
    source_field_id,
    target_field_id,
    transformer_kind,
    source_schema,
    target_schema,
    static_value,   // NEW
});
```

### TypeScript: FieldMappingRow interface update

```typescript
// Source: src/features/field-mapping/types.ts
export interface FieldMappingRow {
  sourceFieldId: string;
  targetFieldId: string;
  transformerKind: TransformerKind;
  sourceSchema: FieldSchemaType;
  targetSchema: FieldSchemaType;
  staticValue?: string;  // NEW — Phase 27. Storage form depends on target schema (D-06 amended):
                         // - single-select option: pre-serialized JSON {"id":"..."} (UI emits JSON.stringify({ id: opt.id }))
                         // - array-of-option / array-of-string: raw comma-separated text (pipeline splits at copy time)
                         // - scalar (string/number/date/datetime): raw text (pipeline from_str fallback → Value::String)
}
```

### TypeScript: TransformerKind union update

```typescript
// Source: src/features/field-mapping/transformerOptions.ts
export type TransformerKind =
  | 'identity'
  | 'user'
  | 'user_name'
  | 'version'
  | 'component'
  | 'wiki_to_adf'
  | 'priority'
  | 'static';  // NEW
```

### Static row sentinel helpers

```typescript
// Utility helpers for StaticMappingRow — inline in the component or a shared util
const STATIC_PREFIX = '__static__';

/** True when this row was created by "Add static value" */
export function isStaticRow(row: FieldMappingRow): boolean {
  return row.sourceFieldId.startsWith(STATIC_PREFIX);
}

/** Derive the sentinel sourceFieldId for a given target field ID */
export function staticSentinelId(targetFieldId: string): string {
  return `${STATIC_PREFIX}${targetFieldId}`;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded transformer kinds | String-dispatched `transformer_kind` column | Phase 18/19 | Phase 27 adds `"static"` as a new arm — consistent with existing dispatch |
| No static/constant field writes | Static value mapping (Phase 27) | Phase 27 | Cloud-only target fields with no source counterpart can now receive a fixed default |

**No deprecated or outdated patterns encountered.** The project's existing migration pattern, sentinel pattern, and auto-save pattern are all current and in use.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Storage form for static_value depends on target schema, and the pipeline must dispatch on `row.target_schema` to construct the correct Jira write-shape | Architecture Patterns — Pattern 2 | **RESOLVED** in ## Open Questions (RESOLVED) below. Split contract: single-select option stores pre-serialized JSON (`JSON.stringify({ id: opt.id })`) and the pipeline passes through; array-of-option and array-of-string store raw comma-separated text and the pipeline splits + shapes per `row.target_schema` (`[{"id":"..."}]` or `["..."]`). Plan 27-02 Task 3 implements pipeline dispatch; Plan 27-04 Task 1 enforces UI storage via positive and negative grep gates. |
| A2 | `FieldSchemaType::Any` used as `source_schema` for static rows will not trigger `is_user_field()` or other source-schema guards in the pipeline | Common Pitfalls — Pitfall 1 | Verified by reading `is_user_field` in user.rs: it checks `source_schema` type variants; `Any` is not `User` or `Array{items:"user"}`. Safe. [VERIFIED: codebase grep] |

---

## Open Questions (RESOLVED)

1. **Write-shape for static_value storage — RESOLVED (split contract)**
   - What we know: Jira Cloud v3 write shapes — single-select option requires `{"id": "option_id"}`; array-of-option (MultiSelect) requires `[{"id":"id1"},{"id":"id2"}]`; array-of-string (Labels) requires `["val1","val2"]`; text/number/date/datetime accept raw scalar.
   - What was unclear: How should the UI store `staticValue` so the pipeline can emit the correct Jira write-shape for each target schema, given that staticValue is a single TEXT column in SQLite and must round-trip through a single edit widget per row?
   - **Resolved (2026-05-20, planner revision, amended by D-06):** The contract is split between UI and pipeline based on target schema. This is self-consistent and assigns each responsibility to the layer best equipped for it:
     - **UI pre-serializes** the single-select option write-shape because single-select uses a structured combobox that already exposes `opt.id`. The pipeline parses and passes through.
     - **Pipeline splits + shapes** array values because (a) the array text input cannot round-trip a JSON-array string through a comma-separated form, and (b) only the pipeline knows `row.target_schema.items` to choose between `[{"id":...}]` (option) and `["..."]` (string).
   - **Rationale:** A bare `opt.id` string (e.g. `"10001"`) for single-select options would parse via `serde_json::from_str` as a JSON string scalar, producing a `"10001"` payload that Jira Cloud v3 rejects (single-select requires an object shape `{"id":"10001"}`). Conversely, pre-serializing array shapes in the UI would force the UI to know per-items-type write shapes (which already live in the backend) and would break round-trip rendering — once stored as a JSON array string, the comma-separated text input cannot reconstruct the original user-facing form.
   - **Per-type storage shapes (authoritative):**
     - `option` / `option-with-child` (single-select) → UI stores `JSON.stringify({ id: opt.id })` → pipeline `serde_json::from_str` passes the parsed `{"id":"10001"}` Value through → emits `{"id":"10001"}` to Jira.
     - `array` of `option` (MultiSelect) → UI stores raw comma-separated text like `"10001, 10002"` → pipeline splits on `,`, trims, filters empty, maps each id to `json!({"id": id})` → emits `[{"id":"10001"},{"id":"10002"}]` to Jira.
     - `array` of `string` (Labels) / array of any other non-user items → UI stores raw comma-separated text like `"bug, regression"` → pipeline splits on `,`, trims, filters empty, maps each part to `Value::String` → emits `["bug","regression"]` to Jira.
     - `string` / `number` / `date` / `datetime` / `any` → UI stores raw text → pipeline `serde_json::from_str` either parses as JSON (for pre-serialized inputs) or falls back to `Value::String(text)` → Jira accepts as text/number/date scalar.
     - `user` / `priority` / `array` of `user` → disabled in the UI (D-06 exclusion); no storage shape needed.
   - **Enforcement:**
     - *Single-option write-shape:* Plan 27-04 Task 1 acceptance_criteria includes a positive grep gate (`JSON\.stringify\(\s*\{\s*id\s*:\s*opt\.id` present in the single-option branch) and a negative grep gate (bare `onChange(opt.id)` absent).
     - *Array raw-storage:* Plan 27-04 Task 1 acceptance_criteria includes a positive grep gate (`onChange(e.target.value)` present in the array branch) and a negative gate against array-branch `.split(',')` / `JSON.stringify` usage.
     - *Pipeline array splitting:* Plan 27-02 Task 3 acceptance_criteria includes grep gates for `FieldSchemaType::Array { items` dispatch and `items == "option"` detection, plus two new tests (`apply_mapping_static_array_of_option_splits_comma_separated_input` and `apply_mapping_static_array_of_string_splits_comma_separated_input`).
     - Pitfall 7 in this document captures the failure modes if any half of the contract is violated.

---

## Environment Availability

No external dependencies required for this phase. All tooling (Rust, Cargo, Node, Vitest) confirmed present from prior phases.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react (frontend) / Rust built-in `#[test]` (backend) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/features/field-mapping` |
| Full suite command | `npx vitest run && cargo test -p pmkar-lib` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATIC-DB-01 | `static_value` column added to `field_mapping` without breaking existing rows | unit (Rust) | `cargo test -p pmkar-lib field_mapping_db` | ❌ Wave 0 — add test in `field_mapping_db.rs` |
| STATIC-DB-02 | `upsert_mapping_row` writes and reads `static_value` round-trip | unit (Rust) | `cargo test -p pmkar-lib upsert_mapping_row` | ❌ Wave 0 |
| STATIC-PIPE-01 | `apply_mapping` with `transformer_kind="static"` emits `static_value` without reading source | unit (Rust) | `cargo test -p pmkar-lib pipeline` | ❌ Wave 0 |
| STATIC-PIPE-02 | Static row with `static_value=None` emits nothing (pending row) | unit (Rust) | `cargo test -p pmkar-lib pipeline` | ❌ Wave 0 |
| STATIC-UI-01 | "Add static value" button renders and adds a pending static row | unit (React) | `npx vitest run src/features/field-mapping/__tests__/StaticMappingRow` | ❌ Wave 0 |
| STATIC-UI-02 | Selecting a target field shows the correct smart value widget type | unit (React) | `npx vitest run src/features/field-mapping/__tests__/StaticValueWidget` | ❌ Wave 0 |
| STATIC-UI-03 | Value change calls `invoke('set_field_mapping')` and shows saved indicator | unit (React) | `npx vitest run src/features/field-mapping/__tests__/StaticMappingRow` | ❌ Wave 0 |
| STATIC-UI-04 | Delete button calls `invoke('delete_field_mapping', { sourceFieldId: '__static__...' })` | unit (React) | `npx vitest run src/features/field-mapping/__tests__/StaticMappingRow` | ❌ Wave 0 |
| STATIC-I18N-01 | All 11 new i18n keys present in `en.json` and `sk.json` | unit (integration) | `npx vitest run src/i18n/__tests__/translations` | ✅ (existing translations test — extend) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/features/field-mapping && cargo test -p pmkar-lib`
- **Per wave merge:** Full suite: `npx vitest run && cargo test -p pmkar-lib`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/features/field-mapping/__tests__/StaticMappingRow.test.tsx` — covers STATIC-UI-01, STATIC-UI-03, STATIC-UI-04
- [ ] `src/features/field-mapping/__tests__/StaticValueWidget.test.tsx` — covers STATIC-UI-02
- [ ] Rust tests in `field_mapping_db.rs` — covers STATIC-DB-01, STATIC-DB-02 (new `#[test]` functions alongside existing ones)
- [ ] Rust tests in `pipeline.rs` — covers STATIC-PIPE-01, STATIC-PIPE-02 (new `#[tokio::test]` functions)

---

## Security Domain

This phase writes user-configured static field values to a local SQLite database and emits them into Jira Cloud API calls. Relevant ASVS considerations:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes — static_value is user input stored and forwarded | Stored as TEXT; Jira Cloud API validates field types on write. No server-side parsing of the stored value beyond JSON parse fallback. The existing `params![]` binding in rusqlite prevents SQL injection. |
| V1 Architecture | Partial | Static value passes through the existing audit pipeline (`mapping_audit_log`); no special treatment needed. |
| V6 Cryptography | No | Static values are not credentials; no encryption needed. |
| V2/V3 Authentication/Session | No | No auth changes. |

**Threat:** A malicious static_value containing Jira API injection sequences. Mitigation: the value is sent as a JSON field value in the Jira API body, not interpolated into the URL or SQL. Jira Cloud validates field shapes server-side. No additional mitigation needed beyond the existing pattern.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src-tauri/src/field_mapping_db.rs` — migration pattern, upsert/get signatures, PRAGMA-gate idiom [VERIFIED: file read]
- Codebase: `src-tauri/src/field_transform/pipeline.rs` — dispatch loop structure, placement for static branch [VERIFIED: file read]
- Codebase: `src-tauri/src/field_transform/mod.rs` — `FieldMappingRow` struct definition [VERIFIED: file read]
- Codebase: `src/features/field-mapping/FieldMappingSection.tsx` — "Add row" button pattern, `pendingAdd` state, `usedTargetFieldIds` [VERIFIED: file read]
- Codebase: `src/features/field-mapping/MappingRow.tsx` — auto-save pattern, saved indicator, delete handler [VERIFIED: file read]
- Codebase: `src/features/field-mapping/transformerOptions.ts` — `TransformerKind` union, `getTransformerOptions` [VERIFIED: file read]
- Codebase: `src/features/field-mapping/types.ts` — `FieldMappingRow` TypeScript interface [VERIFIED: file read]
- Codebase: `src/features/field-mapping/__tests__/MappingRow.test.tsx` — test pattern (VirtualizedCombobox mock) [VERIFIED: file read]
- Phase context: `27-CONTEXT.md` — all locked decisions [VERIFIED: file read]
- Phase UI spec: `27-UI-SPEC.md` — component inventory, layout contract, smart widget table, i18n key contract [VERIFIED: file read]

### Secondary (MEDIUM confidence)
- Codebase: `src-tauri/src/field_discovery.rs` — `FieldSchemaType` variants (Option_, OptionWithChild, Array, Priority, User, Any) [VERIFIED: file read]
- Codebase: `src/i18n/locales/en.json`, `sk.json` — existing transformer keys and fieldMapping keys [VERIFIED: file read]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all patterns are from existing code read directly
- Architecture: HIGH — all six touch-points identified with file/line references
- Pitfalls: HIGH — derived from reading the actual dispatch loop and constraint logic
- UI contract: HIGH — UI-SPEC.md is approved and was read in full

**Research date:** 2026-05-20
**Open Questions resolved:** 2026-05-20 (planner revision — see Open Questions (RESOLVED) section; amended 2026-05-20 to reflect D-06 split contract: single-option pre-serialized in UI, array splitting in pipeline)
**Valid until:** 2026-06-20 (stable internal codebase; no external dependency drift risk)
