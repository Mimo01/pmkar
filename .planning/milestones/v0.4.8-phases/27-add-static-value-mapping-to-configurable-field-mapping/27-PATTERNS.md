# Phase 27: Add static value mapping to configurable field mapping - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 12 new/modified files
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src-tauri/src/field_mapping_db.rs` | service/db | CRUD | self (existing migration pattern within file) | exact |
| `src-tauri/src/field_transform/mod.rs` | model | transform | self (existing FieldMappingRow struct) | exact |
| `src-tauri/src/field_transform/pipeline.rs` | service | transform/event-driven | self (existing apply_mapping dispatch loop) | exact |
| `src/features/field-mapping/types.ts` | model | transform | self (existing FieldMappingRow interface) | exact |
| `src/features/field-mapping/transformerOptions.ts` | utility | transform | self (existing TransformerKind union + getTransformerOptions) | exact |
| `src/features/field-mapping/FieldMappingSection.tsx` | component | request-response | self (existing pendingAdd state + handleAddRow) | exact |
| `src/features/field-mapping/StaticMappingRow.tsx` (NEW) | component | request-response | `src/features/field-mapping/MappingRow.tsx` | exact |
| `src/features/field-mapping/StaticValueWidget.tsx` (NEW) | component | request-response | `src/features/field-mapping/MappingRow.tsx` (transformer combobox column) | role-match |
| `src/features/field-mapping/__tests__/StaticMappingRow.test.tsx` (NEW) | test | request-response | `src/features/field-mapping/__tests__/MappingRow.test.tsx` | exact |
| `src/features/field-mapping/__tests__/StaticValueWidget.test.tsx` (NEW) | test | request-response | `src/features/field-mapping/__tests__/MappingRow.test.tsx` | role-match |
| `src/i18n/locales/en.json` | config | transform | self (existing `settings.fieldMapping.*` key block) | exact |
| `src/i18n/locales/sk.json` | config | transform | self (existing `settings.fieldMapping.*` key block) | exact |

---

## Pattern Assignments

### `src-tauri/src/field_mapping_db.rs` (modified — DB migration + upsert + get)

**Analog:** self — `migrate_mapping_audit_log_columns` function (lines 125–155) and `upsert_mapping_row` (lines 453–478) and `get_all_mapping_rows` (lines 484–533)

**Migration pattern — PRAGMA gate** (lines 125–155):
```rust
fn migrate_mapping_audit_log_columns(conn: &Connection) -> AppResult<()> {
    let existing: Vec<String> = conn
        .prepare("PRAGMA table_info(mapping_audit_log)")?
        .query_map([], |r| r.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;
    let has = |name: &str| existing.iter().any(|c| c == name);
    if !has("transformer_kind") {
        conn.execute_batch(
            "ALTER TABLE mapping_audit_log ADD COLUMN transformer_kind TEXT NOT NULL DEFAULT '';",
        )?;
    }
    // ... further columns follow same pattern
    Ok(())
}
```

Copy this exact pattern for `migrate_static_value_column`:
- Change `"mapping_audit_log"` to `"field_mapping"`
- Check for `"static_value"` instead of `"transformer_kind"`
- `ALTER TABLE field_mapping ADD COLUMN static_value TEXT;` (nullable, no DEFAULT)
- Call the new migration from both `open()` (line 280) and `open_in_memory()` (line 296) immediately after `migrate_mapping_audit_log_columns(&conn)?;`

**Upsert pattern** (lines 453–478):
```rust
pub fn upsert_mapping_row(&self, row: &FieldMappingRow) -> AppResult<()> {
    let source_schema_json = serde_json::to_string(&row.source_schema)?;
    let target_schema_json = serde_json::to_string(&row.target_schema)?;
    let now = Utc::now().to_rfc3339();
    self.conn.execute(
        "INSERT INTO field_mapping
             (source_field_id, target_field_id, transformer_kind,
              source_schema_json, target_schema_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
         ON CONFLICT(source_field_id) DO UPDATE SET
             target_field_id     = excluded.target_field_id,
             transformer_kind    = excluded.transformer_kind,
             source_schema_json  = excluded.source_schema_json,
             target_schema_json  = excluded.target_schema_json,
             updated_at          = excluded.updated_at",
        params![
            row.source_field_id,
            row.target_field_id,
            row.transformer_kind,
            source_schema_json,
            target_schema_json,
            now,
        ],
    )?;
    Ok(())
}
```

Extend the column list to add `static_value` as `?6` (shifting `created_at`/`updated_at` to `?7`), add `static_value = excluded.static_value` to the `DO UPDATE SET` block, and append `row.static_value` to the `params![]` binding before `now`.

**SELECT pattern** (lines 484–533):
```rust
pub fn get_all_mapping_rows(&self) -> AppResult<Vec<FieldMappingRow>> {
    let mut stmt = self.conn.prepare(
        "SELECT source_field_id, target_field_id, transformer_kind,
                source_schema_json, target_schema_json
         FROM field_mapping
         ORDER BY id ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        let source_field_id: String = row.get(0)?;
        // ...
        let target_schema_json: Option<String> = row.get(4)?;
        Ok((source_field_id, target_field_id, transformer_kind, source_schema_json, target_schema_json))
    })?;
    let mut out: Vec<FieldMappingRow> = Vec::new();
    for r in rows {
        // ... schema parse + fallback to FieldSchemaType::Any ...
        out.push(FieldMappingRow {
            source_field_id,
            target_field_id,
            transformer_kind,
            source_schema,
            target_schema,
        });
    }
    Ok(out)
}
```

Add `static_value` as column index 5 in the SELECT and `row.get(5)?` in the closure. Add `static_value` to the pushed `FieldMappingRow`.

**Test pattern** (lines 951–991, existing `upsert_mapping_row_replaces_existing` test):
```rust
#[test]
fn upsert_mapping_row_replaces_existing() {
    use crate::field_transform::FieldMappingRow;
    let db = FieldMappingDb::open_in_memory().expect("open in memory");
    let row = FieldMappingRow {
        source_field_id: "description".into(),
        target_field_id: "description".into(),
        transformer_kind: "identity".into(),
        source_schema: FieldSchemaType::Any,
        target_schema: FieldSchemaType::Any,
    };
    db.upsert_mapping_row(&row).expect("upsert");
    // ...
}
```

New tests for Phase 27 follow this same structure. Add `static_value: Some("test".into())` to the `FieldMappingRow` and assert it round-trips via `get_all_mapping_rows`.

---

### `src-tauri/src/field_transform/mod.rs` (modified — FieldMappingRow struct)

**Analog:** self — `FieldMappingRow` struct (lines 135–143)

**Struct pattern** (lines 135–143):
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldMappingRow {
    pub source_field_id: String,
    pub target_field_id: String,
    pub transformer_kind: String, // "identity" | "user" | ...
    pub source_schema: crate::field_discovery::FieldSchemaType,
    pub target_schema: crate::field_discovery::FieldSchemaType,
}
```

Add `static_value` after `target_schema`:
```rust
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub static_value: Option<String>,
```

The `#[serde(default)]` ensures deserialization of existing rows (which have no `staticValue` key) does not fail. The `skip_serializing_if` keeps the Tauri response payload small for non-static rows.

Pattern for nullable optional fields already established by `UnresolvedPerson` (lines 39–44):
```rust
#[serde(skip_serializing_if = "Option::is_none")]
pub source_username: Option<String>,
```

---

### `src-tauri/src/field_transform/pipeline.rs` (modified — apply_mapping static branch)

**Analog:** self — dispatch loop (lines 46–112)

**Dispatch loop structure** (lines 46–112):
```rust
for row in mapping {
    let path = format!("/fields/{}", row.source_field_id);
    let src_val = source_issue.pointer(&path).cloned().unwrap_or(Value::Null);

    // Description check — FIRST in loop
    if is_description_row(&row.source_schema) { ... continue; }

    // User check
    if is_user_field(&row.source_schema) { ... continue; }

    // Array<version>
    if is_array_of(&row.source_schema, "version") { ... continue; }

    // Array<component>
    if is_array_of(&row.source_schema, "component") { ... continue; }

    // Priority — skip
    if is_priority_row(&row.target_schema) { continue; }

    // Identity fallback
    let v = identity::transform_identity(&src_val, &row.target_schema);
    if !v.is_null() { fields.insert(row.target_field_id.clone(), v); }
}
```

Insert the static branch as the VERY FIRST check inside the loop body — BEFORE the `source_issue.pointer()` call (line 47–48). The static branch must `continue` without ever calling `pointer()`:

```rust
for row in mapping {
    // NEW — Phase 27: static branch MUST come before source_issue.pointer()
    if row.transformer_kind == "static" {
        if let Some(ref val) = row.static_value {
            match serde_json::from_str::<Value>(val) {
                Ok(parsed) => { fields.insert(row.target_field_id.clone(), parsed); }
                Err(_) => { fields.insert(row.target_field_id.clone(), Value::String(val.clone())); }
            }
        }
        // static_value is None → pending row → skip silently
        continue;
    }

    // Existing: source pointer (only reached for non-static rows)
    let path = format!("/fields/{}", row.source_field_id);
    let src_val = source_issue.pointer(&path).cloned().unwrap_or(Value::Null);
    // ... rest of existing dispatch unchanged
```

**Test pattern** (lines 440–452 — existing `apply_mapping_returns_resolved_fields_for_text_only_mapping`):
```rust
#[tokio::test]
async fn apply_mapping_returns_resolved_fields_for_text_only_mapping() {
    let issue = json!({"fields":{"summary":"Hello"}});
    let mapping = vec![row("summary", "summary", s_str_summary())];
    let (u, v, c) = make_resolvers();
    let map = HashMap::new();
    let client = reqwest::Client::new();
    let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
    let out = apply_mapping(&issue, &mapping, &ctx)
        .await
        .expect("apply_mapping ok");
    assert_eq!(out.fields.get("summary"), Some(&json!("Hello")));
    assert!(out.gaps.is_empty());
}
```

New static tests follow the same `#[tokio::test] async fn` structure. Use the `row_with_kind` helper (lines 389–403) to construct a row with `transformer_kind: "static"` and set `static_value` directly on the struct after construction.

---

### `src/features/field-mapping/types.ts` (modified — FieldMappingRow interface)

**Analog:** self — lines 12–20

**Current interface** (lines 12–20):
```typescript
export interface FieldMappingRow {
  sourceFieldId: string;
  /** Empty string `""` is the dismissed-suggestion sentinel (CONTEXT.md D-07). */
  targetFieldId: string;
  /** One of the TransformerKind literals. */
  transformerKind: TransformerKind;
  sourceSchema: FieldSchemaType;
  targetSchema: FieldSchemaType;
}
```

Add `staticValue?: string` after `targetSchema`. The `?` makes the field optional so all existing code constructing `FieldMappingRow` without `staticValue` continues to compile. This mirrors how `source_username?: Option<String>` fields use `#[serde(default)]` on the Rust side — the TypeScript optional mirrors that default.

For option / option-with-child fields, the UI MUST store the pre-serialized Jira Cloud v3 write-shape (`JSON.stringify({ id: opt.id })`) in this field, NOT the bare option id — see 27-RESEARCH.md ## Open Questions (RESOLVED) and Pitfall 7.

---

### `src/features/field-mapping/transformerOptions.ts` (modified — TransformerKind union)

**Analog:** self — lines 1–16

**TransformerKind union** (lines 3–10):
```typescript
export type TransformerKind =
  | 'identity'
  | 'user'
  | 'user_name'
  | 'version'
  | 'component'
  | 'wiki_to_adf'
  | 'priority';
```

Add `| 'static'` as the last member. No change to `getTransformerOptions` dispatch — static rows do not use the transformer combobox. The `TransformerKind` union extension is the only change needed in this file; no new `makeOptions` entry is required because `StaticMappingRow` does not render a transformer combobox.

---

### `src/features/field-mapping/FieldMappingSection.tsx` (modified — "Add static value" button)

**Analog:** self — `pendingAdd` state + `handleAddRow` + "Add field mapping" Button (lines 182–184, 242–244, 367–378)

**pendingAdd state pattern** (line 182–184):
```typescript
const [pendingAdd, setPendingAdd] = useState(false);
const [loadError, setLoadError] = useState(false);
```

Add `const [pendingStaticAdd, setPendingStaticAdd] = useState(false);` in parallel.

**handleAddRow pattern** (lines 242–244):
```typescript
function handleAddRow() {
  setPendingAdd(true);
}
```

Add a parallel handler:
```typescript
function handleAddStaticRow() {
  setPendingStaticAdd(true);
}
```

**"Add field mapping" Button pattern** (lines 367–378):
```tsx
<Button
  type="button"
  variant="ghost"
  size="sm"
  onClick={handleAddRow}
  disabled={pendingAdd}
  className="mt-3 w-full justify-start text-brand-muted hover:text-brand-text gap-1.5"
>
  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
  <span>{t('settings.fieldMapping.addRow')}</span>
</Button>
```

Add the static button immediately below this block, using the same variant/size/className. The `disabled` prop must guard against both `pendingAdd` and `pendingStaticAdd`:
```tsx
<Button
  type="button"
  variant="ghost"
  size="sm"
  onClick={handleAddStaticRow}
  disabled={pendingStaticAdd || pendingAdd}
  className="w-full justify-start text-brand-muted hover:text-brand-text gap-1.5"
  aria-label="Add static value mapping"
>
  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
  <span>{t('settings.fieldMapping.addStaticRow')}</span>
</Button>
```

**Row rendering — discriminate static vs normal rows** (lines 316–328):

The existing `mappingRows.map((row) => ...)` renders all rows as `MappingRow`. Phase 27 must branch:
```tsx
{mappingRows.map((row) =>
  row.sourceFieldId.startsWith('__static__') ? (
    <StaticMappingRow
      key={row.sourceFieldId}
      row={row}
      targetFields={targetFields}
      usedTargetFieldIds={usedTargetFieldIds}
      onRowUpdate={updateRow}
      onRowDelete={deleteRow}
    />
  ) : (
    <MappingRow
      key={row.sourceFieldId}
      row={row}
      sourceName={sourceFields.find((f) => f.fieldId === row.sourceFieldId)?.name}
      targetFields={targetFields}
      usedTargetFieldIds={usedTargetFieldIds}
      isDrifted={driftedSourceFieldIds.has(row.sourceFieldId)}
      onRowUpdate={updateRow}
      onRowDelete={deleteRow}
    />
  )
)}
```

**Inline pending static row** — rendered inside the `pendingStaticAdd` block in parallel to the existing `pendingAdd` block (lines 331–363). The pending static row renders `StaticMappingRow` with an empty `row` whose `sourceFieldId` is `'__static__'` (no target yet). When the user selects a target, `StaticMappingRow.handleTargetChange` calls `invoke('set_field_mapping', { row })` and `updateRow(newRow)`, then `setPendingStaticAdd(false)`.

---

### `src/features/field-mapping/StaticMappingRow.tsx` (NEW)

**Analog:** `src/features/field-mapping/MappingRow.tsx` (lines 1–176)

**Imports pattern** (MappingRow.tsx lines 1–11):
```typescript
import { invoke } from '@tauri-apps/api/core';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';
import { cn } from '@/lib/utils';
import type { FieldSchema } from '@/types/fieldSchema';
import { DriftWarning } from './DriftWarning';
import { getTransformerOptions, type TransformerOption } from './transformerOptions';
import type { FieldMappingRow } from './types';
```

`StaticMappingRow` omits `DriftWarning`, `getTransformerOptions`, `TransformerOption`, `cn`. It adds `StaticValueWidget` import. Replace `DriftWarning` imports with the new component.

**Props interface** — mirrors `MappingRowProps` (lines 13–21) minus `isDrifted` and `sourceName`:
```typescript
export interface StaticMappingRowProps {
  row: FieldMappingRow;
  targetFields: FieldSchema[];
  usedTargetFieldIds: Set<string>;
  onRowUpdate: (row: FieldMappingRow) => void;
  onRowDelete: (sourceFieldId: string) => void;
}
```

**Auto-save pattern** (MappingRow.tsx lines 52–68 and 71–80):
```typescript
async function handleTargetChange(newTarget: FieldSchema) {
  const updated: FieldMappingRow = {
    sourceFieldId: row.sourceFieldId,
    targetFieldId: newTarget.fieldId,
    transformerKind:
      getTransformerOptions(newTarget.schema, t, row.sourceSchema)[0]?.value ?? 'identity',
    sourceSchema: row.sourceSchema,
    targetSchema: newTarget.schema,
  };
  try {
    await invoke('set_field_mapping', { row: updated });
    onRowUpdate(updated);
    setFeedback('saved');
    setTimeout(() => setFeedback(null), 1500);
  } catch {
    toast.error(t('settings.fieldMapping.saveError'));
  }
}
```

For `StaticMappingRow`, `handleTargetChange` builds the sentinel `sourceFieldId = '__static__' + newTarget.fieldId` and sets `transformerKind: 'static'`:
```typescript
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
  try {
    await invoke('set_field_mapping', { row: updated });
    onRowUpdate(updated);
  } catch {
    toast.error(t('settings.fieldMapping.saveError'));
  }
}
```

For `handleValueChange`, follow the `handleTransformerChange` pattern (lines 71–80) — spread `...row`, update `staticValue`, call invoke, setFeedback:
```typescript
async function handleValueChange(newValue: string) {
  const updated: FieldMappingRow = { ...row, staticValue: newValue };
  try {
    await invoke('set_field_mapping', { row: updated });
    onRowUpdate(updated);
    setFeedback('saved');
    setTimeout(() => setFeedback(null), 1500);
  } catch {
    toast.error(t('settings.fieldMapping.saveError'));
  }
}
```

`newValue` is the storage form produced by `StaticValueWidget` — pre-serialized JSON write-shape for option types, raw text otherwise. `StaticMappingRow` does NOT post-process it.

**Delete pattern** (MappingRow.tsx lines 83–89):
```typescript
async function handleDelete() {
  try {
    await invoke('delete_field_mapping', { sourceFieldId: row.sourceFieldId });
    onRowDelete(row.sourceFieldId);
  } catch {
    toast.error(t('settings.fieldMapping.deleteError'));
  }
}
```

Copy verbatim — `row.sourceFieldId` will be the sentinel `__static__customfield_10050`.

**Grid layout pattern** (MappingRow.tsx lines 93–96):
```tsx
<div
  className={cn(
    'grid grid-cols-[35fr_35fr_20fr_10fr] gap-3 items-center min-h-[40px] py-2 border-b border-brand-border last:border-0',
    isDrifted && 'border-l-2 border-l-amber-500 pl-2',
  )}
>
```

`StaticMappingRow` uses the same grid class without the `isDrifted` conditional:
```tsx
<div className="grid grid-cols-[35fr_35fr_20fr_10fr] gap-3 items-center min-h-[40px] py-2 border-b border-brand-border last:border-0">
```

**Saved indicator + delete button pattern** (MappingRow.tsx lines 158–173):
```tsx
<div className="flex items-center justify-end gap-1">
  {feedback === 'saved' && (
    <span aria-live="polite" className="flex items-center gap-1 text-xs text-green-600">
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{t('settings.fieldMapping.saved')}</span>
    </span>
  )}
  <button
    type="button"
    onClick={handleDelete}
    aria-label={t('settings.fieldMapping.deleteStaticAriaLabel', { field: targetField?.name ?? row.targetFieldId })}
    className="flex items-center justify-center h-9 w-9 rounded hover:bg-brand-surface-hover text-brand-muted hover:text-destructive transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
  >
    <X className="h-3.5 w-3.5" aria-hidden="true" />
  </button>
</div>
```

The `aria-label` uses the dedicated `settings.fieldMapping.deleteStaticAriaLabel` key for cleaner copy (Plan 27-03 Task 2 ships this key in both en.json and sk.json).

**Target combobox — availableTargetFields filter** (MappingRow.tsx lines 43–45):
```typescript
const availableTargetFields = targetFields.filter(
  (f) => !usedTargetFieldIds.has(f.fieldId) || f.fieldId === row.targetFieldId,
);
```

Copy verbatim for `StaticMappingRow` — same deduplication logic applies.

---

### `src/features/field-mapping/StaticValueWidget.tsx` (NEW)

**Analog:** `src/features/field-mapping/MappingRow.tsx` — transformer combobox column (lines 137–155) for the VirtualizedCombobox pattern; no direct analog for the text input variant

**Imports pattern:**
```typescript
import { useTranslation } from 'react-i18next';
import { VirtualizedCombobox } from '@/features/field-renderers/components/VirtualizedCombobox';
import type { FieldSchema } from '@/types/fieldSchema';
```

**VirtualizedCombobox usage pattern** (MappingRow.tsx lines 137–155):
```tsx
<div className="[&_button]:min-h-9">
  <VirtualizedCombobox<TransformerOption>
    items={transformerItems}
    value={currentTransformer}
    onChange={handleTransformerChange}
    displayLabel={(o) => o.label}
    filterFn={(o, q) => o.label.toLowerCase().includes(q.toLowerCase())}
    placeholder={t('settings.fieldMapping.transformerPlaceholder')}
    ariaLabel={`${row.sourceFieldId} transformer`}
    align="end"
    itemHeight={52}
    renderItem={(o) => (
      <div className="py-0.5">
        <span className="text-sm">{o.label}</span>
        <span className="block text-xs text-muted-foreground">{o.description}</span>
      </div>
    )}
  />
</div>
```

For the `option` / `option-with-child` widget in `StaticValueWidget`, reuse this pattern with `items={field.allowedValues ?? []}` where each allowed value is a `serde_json::Value`-shaped object `{id, value}`. The `displayLabel` reads `item.value` (the human name); **`onChange` calls `onChange(JSON.stringify({ id: item.id }))` to store the pre-serialized Jira Cloud v3 write-shape** (NOT the bare id) — see 27-RESEARCH.md ## Open Questions (RESOLVED) for the authoritative decision and Pitfall 7 for the failure mode if this is violated.

**Dispatch table implementation:**
```typescript
export interface StaticValueWidgetProps {
  field: FieldSchema;
  value: string | undefined;
  onChange: (newValue: string) => void;
}

export function StaticValueWidget({ field, value, onChange }: StaticValueWidgetProps) {
  const { t } = useTranslation();
  const schema = field.schema;

  // Option / single-select — stores pre-serialized JSON write-shape per RESEARCH.md
  if (schema.type === 'option' || schema.type === 'option-with-child') {
    // Parse the existing value (if any) to find the currently-selected item.
    // Legacy bare-id values fall back to null selection without throwing.
    // onChange handler stores JSON.stringify({ id: opt.id }) — NOT opt.id.
  }

  // Array of option (multi-select) and Labels (array of string) — comma-separated text
  if (schema.type === 'array') {
    // Text input with comma hint
  }

  // Excluded: user, priority — render disabled input
  if (schema.type === 'user' || schema.type === 'priority') {
    return <input disabled placeholder={t('settings.fieldMapping.staticUnsupported')} />;
  }

  // Default: plain text input for string, number, date, datetime
  return (
    <input
      type="text"
      className="min-h-9 w-full rounded border border-brand-border bg-background px-3 py-1 text-sm"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => onChange(e.target.value)}
      placeholder={t('settings.fieldMapping.staticValuePlaceholder')}
    />
  );
}
```

---

### `src/features/field-mapping/__tests__/StaticMappingRow.test.tsx` (NEW)

**Analog:** `src/features/field-mapping/__tests__/MappingRow.test.tsx` (lines 1–252) — copy entire file structure

**Module-level mocks** (lines 1–49):
```typescript
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import type { FieldSchema } from '../../../types/fieldSchema';
import { MappingRow } from '../MappingRow';
import type { FieldMappingRow } from '../types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/features/field-renderers/components/VirtualizedCombobox', () => ({
  VirtualizedCombobox: <T,>({
    items, value, onChange, displayLabel, placeholder, ariaLabel,
  }: { ... }) => (
    <select
      aria-label={ariaLabel ?? placeholder ?? 'combobox'}
      value={value ? displayLabel(value) : ''}
      onChange={(e) => {
        const selected = items.find((i) => displayLabel(i) === e.target.value);
        if (selected) onChange(selected);
      }}
    >
      ...
    </select>
  ),
}));
```

Copy the full `VirtualizedCombobox` mock verbatim (lines 13–45) — it is the established pattern for all field-mapping tests.

**Base row fixture for static rows:**
```typescript
const baseStaticRow: FieldMappingRow = {
  sourceFieldId: '__static__customfield_10050',
  targetFieldId: 'customfield_10050',
  transformerKind: 'static',
  sourceSchema: { type: 'any' },
  targetSchema: { type: 'option' },
  staticValue: JSON.stringify({ id: '10001' }),  // pre-serialized Jira write-shape
};
```

**Test structure** (STATIC-UI-01, STATIC-UI-03, STATIC-UI-04) — follow the same `describe('StaticMappingRow', () => { it(...) })` pattern as lines 82–252:
- STATIC-UI-01: "Add static value button renders and inserts pending row" — test in `FieldMappingSection` integration test or a simple render test of the section
- STATIC-UI-03: `fireEvent.change` on value input → `waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('set_field_mapping', ...))`
- STATIC-UI-04: `fireEvent.click(deleteBtn)` → `waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('delete_field_mapping', { sourceFieldId: '__static__customfield_10050' }))`

---

### `src/features/field-mapping/__tests__/StaticValueWidget.test.tsx` (NEW)

**Analog:** `src/features/field-mapping/__tests__/MappingRow.test.tsx` — test structure; no direct widget test analog

Copy the same `vi.mock` blocks and `renderWithI18n` import. Focus on STATIC-UI-02: given a `FieldSchema` with `schema.type === 'option'`, the widget renders a VirtualizedCombobox (mocked as `<select>`) AND its `onChange` emits `JSON.stringify({ id: '10001' })` (NOT the bare `'10001'` id); given `schema.type === 'string'`, it renders an `<input type="text">`.

---

### `src/i18n/locales/en.json` (modified — new fieldMapping + transformer.static keys)

**Analog:** self — existing `settings.fieldMapping.*` block (lines ~410–438 in the actual file) and `settings.transformer.*` block

**Existing key pattern:**
```json
"settings.fieldMapping.addRow": "Add field mapping",
"settings.fieldMapping.saved": "Saved",
"settings.fieldMapping.saveError": "Failed to save mapping. Try again.",
"settings.fieldMapping.deleteAriaLabel": "Remove mapping for {{field}}",
```

**New keys (authoritative — 11 total per UI-SPEC.md i18n Key Contract and Plan 27-03 Task 2):**

Place the 9 `settings.fieldMapping.*` keys immediately after the last existing `settings.fieldMapping.*` entry. Place the 2 `settings.transformer.static.*` keys near the existing `settings.transformer.*` block.

```json
"settings.fieldMapping.addStaticRow": "Add static value",
"settings.fieldMapping.staticBadge": "Static",
"settings.fieldMapping.staticBadgeTooltip": "This field is always set to a fixed value, regardless of the source ticket.",
"settings.fieldMapping.staticTargetPlaceholder": "Pick a target field",
"settings.fieldMapping.staticValuePlaceholder": "Enter value",
"settings.fieldMapping.staticOptionPlaceholder": "Pick a value",
"settings.fieldMapping.staticMultiHint": "Separate values with commas",
"settings.fieldMapping.staticUnsupported": "Not supported in this phase",
"settings.fieldMapping.deleteStaticAriaLabel": "Remove static mapping for {{field}}",
"settings.transformer.static.label": "Static",
"settings.transformer.static.description": "Always writes a fixed value to this field"
```

Add all 11 keys in the same task/commit. Both `en.json` and `sk.json` must be updated together (Pitfall 5).

---

### `src/i18n/locales/sk.json` (modified — SK translations)

**Analog:** self — same `settings.fieldMapping.*` and `settings.transformer.*` block pattern as en.json

All 11 new keys must have proper Slovak translations with diacritics. Follow the same JSON key order as en.json. Example entry style from existing sk.json:
```json
"settings.fieldMapping.addRow": "Pridať mapovanie polí",
"settings.fieldMapping.saved": "Uložené",
```

**SK values (authoritative — 11 total per Plan 27-03 Task 2):**

```json
"settings.fieldMapping.addStaticRow": "Pridať statickú hodnotu",
"settings.fieldMapping.staticBadge": "Statická",
"settings.fieldMapping.staticBadgeTooltip": "Toto pole je vždy nastavené na pevnú hodnotu bez ohľadu na zdrojový tiket.",
"settings.fieldMapping.staticTargetPlaceholder": "Vyberte cieľové pole",
"settings.fieldMapping.staticValuePlaceholder": "Zadajte hodnotu",
"settings.fieldMapping.staticOptionPlaceholder": "Vyberte hodnotu",
"settings.fieldMapping.staticMultiHint": "Hodnoty oddeľte čiarkami",
"settings.fieldMapping.staticUnsupported": "V tejto fáze nie je podporované",
"settings.fieldMapping.deleteStaticAriaLabel": "Odstrániť statické mapovanie pre {{field}}",
"settings.transformer.static.label": "Statická",
"settings.transformer.static.description": "Vždy zapíše pevnú hodnotu do tohto poľa"
```

---

## Shared Patterns

### Auto-save with 1500ms feedback flash
**Source:** `src/features/field-mapping/MappingRow.tsx` lines 33, 64–65, 75–76
**Apply to:** `StaticMappingRow.tsx` for both target change and value change handlers
```typescript
const [feedback, setFeedback] = useState<'saved' | null>(null);
// ...
setFeedback('saved');
setTimeout(() => setFeedback(null), 1500);
```

### Invoke pattern (set/delete)
**Source:** `src/features/field-mapping/MappingRow.tsx` lines 62–63, 85–86
**Apply to:** `StaticMappingRow.tsx`
```typescript
await invoke('set_field_mapping', { row: updated });
await invoke('delete_field_mapping', { sourceFieldId: row.sourceFieldId });
```

### Toast error on invoke failure
**Source:** `src/features/field-mapping/MappingRow.tsx` lines 66, 79, 88
**Apply to:** `StaticMappingRow.tsx` — all three handlers
```typescript
} catch {
  toast.error(t('settings.fieldMapping.saveError'));
}
```

### VirtualizedCombobox props shape
**Source:** `src/features/field-mapping/MappingRow.tsx` lines 118–133 (target combobox)
**Apply to:** `StaticMappingRow.tsx` target column, `StaticValueWidget.tsx` option-type column
```tsx
<VirtualizedCombobox<FieldSchema>
  items={availableTargetFields}
  value={targetField}
  onChange={handleTargetChange}
  displayLabel={(f) => f.name}
  filterFn={(f, q) => f.name.toLowerCase().includes(q.toLowerCase())}
  placeholder={t('settings.fieldMapping.targetPlaceholder')}
  ariaLabel={`${row.sourceFieldId} target`}
  renderItem={(f) => (
    <span className="flex items-center justify-between w-full">
      <span className="truncate">{f.name}</span>
      <span className="text-xs text-muted-foreground ml-2">{f.schema.type}</span>
    </span>
  )}
/>
```

### PRAGMA-gate migration
**Source:** `src-tauri/src/field_mapping_db.rs` lines 125–155 (`migrate_mapping_audit_log_columns`)
**Apply to:** new `migrate_static_value_column` function in `field_mapping_db.rs`
- Query `PRAGMA table_info(field_mapping)` — collect column names
- Check `existing.iter().any(|c| c == "static_value")`
- `conn.execute_batch("ALTER TABLE field_mapping ADD COLUMN static_value TEXT;")?;`

### Serde optional field pattern
**Source:** `src-tauri/src/field_transform/mod.rs` lines 39–44 (`UnresolvedPerson` optional fields)
**Apply to:** `static_value` field on `FieldMappingRow`
```rust
#[serde(default, skip_serializing_if = "Option::is_none")]
pub static_value: Option<String>,
```

### tokio::test async pipeline test
**Source:** `src-tauri/src/field_transform/pipeline.rs` lines 440–452
**Apply to:** new static pipeline tests (STATIC-PIPE-01, STATIC-PIPE-02)
```rust
#[tokio::test]
async fn test_name() {
    let issue = json!({"fields":{}});
    let mapping = vec![/* FieldMappingRow with transformer_kind: "static" */];
    let (u, v, c) = make_resolvers();
    let map = HashMap::new();
    let client = reqwest::Client::new();
    let ctx = ctx_with_map(&client, &u, &v, &c, &map, "MYPROJ", "http://127.0.0.1:1");
    let out = apply_mapping(&issue, &mapping, &ctx).await.expect("ok");
    // assert fields / gaps
}
```

---

## No Analog Found

All files have direct analogs in the codebase. No file requires falling back to RESEARCH.md patterns — all patterns are present in the existing source files.

---

## Metadata

**Analog search scope:** `src/features/field-mapping/`, `src-tauri/src/field_transform/`, `src-tauri/src/field_mapping_db.rs`, `src/i18n/locales/`
**Files scanned:** 8 source files read in full
**Pattern extraction date:** 2026-05-20
