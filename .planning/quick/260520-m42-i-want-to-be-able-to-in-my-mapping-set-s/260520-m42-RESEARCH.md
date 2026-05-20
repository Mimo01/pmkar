# Quick Task 260520-m42 — Static Value Support for `issuetype` Field — Research

**Researched:** 2026-05-20
**Domain:** Field mapping — extending static value widget for `issuetype` schema type
**Confidence:** HIGH

---

## Task Summary

User wants to set a static value for the `issuetype` field in mapping settings. Scope locked to `issuetype` only for now. Value picker should be a standard dropdown populated from Jira's known issue types. Static value should override the IssueTypeChooser at copy time (standard static interaction).

---

## Current State (Phase 27 complete)

Phase 27 shipped a complete static value mapping infrastructure with:
- DB column `static_value TEXT` in `field_mapping` table
- Pipeline `"static"` transformer branch in `apply_mapping` ([src-tauri/src/field_transform/pipeline.rs:47-87](src-tauri/src/field_transform/pipeline.rs))
- `StaticMappingRow` and `StaticValueWidget` components ([src/features/field-mapping/](src/features/field-mapping/))
- Smart per-schema-type dispatch: option / option-with-child use VirtualizedCombobox storing `{"id","value"}` JSON; arrays use comma-separated text; user/priority disabled

**The gap:** `StaticValueWidget` falls through to the **default plain text input** for `issuetype` because the dispatch table doesn't handle `schema.type === 'issuetype'`. Source of fall-through: [src/features/field-mapping/StaticValueWidget.tsx:107-117](src/features/field-mapping/StaticValueWidget.tsx).

---

## How `issuetype` Differs From Existing Static-Supported Types

| Aspect | Single-select `option` | `issuetype` |
|--------|------------------------|-------------|
| Where allowed values come from | `field.allowedValues` (in createmeta per-issuetype response) | NOT in createmeta `fields` — fetched separately via `/rest/api/3/issue/createmeta/{key}/issuetypes` (no field-level `allowedValues`) |
| Where allowed values live in app | `field.allowedValues` (already on FieldSchema) | `schemaCacheStore.prewarmedIssueTypes[projectKey]` — array of `IssueTypeRef` objects |
| Item shape | `{ id, value }` | `IssueTypeRef = { id, name, description?, iconUrl? }` |
| Jira write-shape | `{"id":"..."}` | `{"id":"..."}` (same) |
| Whether field is currently in `targetFields` list | Yes (e.g., `customfield_10006`) | **NO** — `issuetype` is NOT in createmeta `fields[]`; it's the path parameter itself |

**This is the critical structural difference:** A user cannot today even select `issuetype` as the target field in the static row's target combobox, because `targetFields` (from `schemaCacheStore.cache[target|PROJ|issueTypeId].fields`) does not include `issuetype` at all. Real Jira `/rest/api/3/field` DOES include an entry `{ id:"issuetype", name:"Issue Type", schema:{ type:"issuetype", system:"issuetype" } }`, but the field-mapping section uses createmeta-per-issuetype as its target list (see [FieldMappingSection.tsx:75-79](src/features/field-mapping/FieldMappingSection.tsx)), and createmeta does not echo issuetype back. [VERIFIED: codebase read of fixtures.rs:1984-2050 and FieldMappingSection.tsx:60-82]

---

## Critical Interaction Risk — IssueTypeChooser Overrides Static `issuetype`

`commands.rs:1757-1765` builds `create_fields` by unconditionally inserting `issuetype` from `args.target_issue_type_id` (set by the IssueTypeChooser at copy time):

```rust
let mut create_fields = resolved.fields.clone();  // resolved.fields may contain a static issuetype
create_fields.insert("project".to_string(), json!({ "key": target_project_key }));
create_fields.insert(                                // ← this overwrites the static value
    "issuetype".to_string(),
    json!({ "id": args.target_issue_type_id }),
);
```

The user's clarification says **"standard interaction (static overrides dynamic)"** — meaning a static mapping for `issuetype` should win. But today the commands.rs unconditional insert silently wins instead. Two implementation paths:

**Path A — Static wins (matches user intent verbatim):** Change [commands.rs:1758-1765](src-tauri/src/commands.rs) to use `.entry().or_insert(...)` so the create-fields insert only fires when no static mapping already set `issuetype`. Side effect: the IssueTypeChooser's value becomes irrelevant for that copy. Frontend may need to disable the chooser (or annotate it "overridden by static mapping") to avoid user confusion.

**Path B — Dynamic wins (user clarification was inaccurate):** Leave commands.rs unchanged. Static issuetype mapping renders in settings but is silently overridden on every copy. This contradicts the user's "static overrides dynamic" statement and likely produces a surprising UX.

**Recommendation: Path A.** The user's clarification is explicit. Note that Path A means the `issuetype` static mapping completely bypasses the per-copy chooser — which is the whole point ("I want to set a default once and not re-pick it every copy"). The chooser UI should reflect this when a static mapping for issuetype is active.

---

## What Needs to Change

### 1. Add issuetype field to target list — `FieldMappingSection.tsx`
The target combobox in `StaticMappingRow` filters from `targetFields` (createmeta result). Since createmeta does not echo `issuetype`, we must inject a synthetic `FieldSchema` entry into the target list specifically for the static-row target combobox:

```tsx
// In FieldMappingSection useSchemaArrays or computed nearby
const targetFieldsWithIssuetype = useMemo(() => {
  if (targetFields.length === 0) return targetFields;
  const hasIssuetype = targetFields.some((f) => f.fieldId === 'issuetype');
  if (hasIssuetype) return targetFields;
  return [
    ...targetFields,
    {
      fieldId: 'issuetype',
      name: 'Issue Type',           // i18n: settings.fieldMapping.issuetypeFieldName
      required: true,
      schema: { type: 'issuetype' as const },
      allowedValues: undefined,     // sourced from prewarmedIssueTypes inside the widget
    } satisfies FieldSchema,
  ];
}, [targetFields]);
```

Only pass this augmented list to `StaticMappingRow` — not to `MappingRow` (issuetype is not a normal source→target mapping target; the source-field path lookup `/fields/issuetype` is already handled by the existing copy flow and would conflict).

### 2. Add `issuetype` branch to `StaticValueWidget.tsx`
After the existing `option / option-with-child` branch, add:

```tsx
if (schema.type === 'issuetype') {
  const issueTypes = useSchemaCacheStore(
    (s) => s.prewarmedIssueTypes[useConnectionStore.getState().targetProjectKey ?? ''] ?? [],
  );
  // Parse existing JSON value to find selected IssueTypeRef
  let selectedId: string | null = null;
  if (value) {
    try { selectedId = (JSON.parse(value) as { id?: string }).id ?? null; }
    catch { selectedId = null; }
  }
  const selected = selectedId ? issueTypes.find((it) => it.id === selectedId) ?? null : null;

  return (
    <div className="[&_button]:min-h-9">
      <VirtualizedCombobox<IssueTypeRef>
        items={issueTypes}
        value={selected}
        onChange={(it) => onChange(JSON.stringify({ id: it.id, name: it.name }))}
        displayLabel={(it) => it.name}
        filterFn={(it, q) => it.name.toLowerCase().includes(q.toLowerCase())}
        placeholder={t('settings.fieldMapping.staticIssuetypePlaceholder')}
        ariaLabel={`${field.name} static value`}
      />
    </div>
  );
}
```

**Store shape:** `JSON.stringify({ id, name })` — matches the precedent from commit `5d22c31` ({id, value} for option fields, where value is the human-readable label). The pipeline `serde_json::from_str` passes the object through unchanged (already supported by Phase 27's default match arm in pipeline.rs:80-81 since `FieldSchemaType::Issuetype` is not Array nor Option).

**Watch out:** A bare `JSON.stringify({ id })` (id only) would technically work for Jira (Jira accepts `{"id":"10001"}` for issuetype), but storing `{ id, name }` allows the static label to display the human name when re-rendering the static row settings UI.

### 3. Pipeline — no change needed (mostly)
The existing default branch in pipeline.rs:80-81 (`_ => serde_json::from_str::<Value>(val).unwrap_or_else(...)`) already handles `FieldSchemaType::Issuetype` correctly: it parses the stored `{"id":"10001","name":"Bug"}` JSON and passes it through. Jira Cloud accepts both `{"id":"10001"}` and `{"id":"10001","name":"Bug"}` shapes (id is authoritative; extra fields ignored). [VERIFIED: codebase read of pipeline.rs:80-81]

**However** — the Phase 27 default arm parses raw text as JSON OR falls back to `Value::String`. For issuetype where we always store a JSON object, the parse will always succeed. No new pipeline branch needed.

### 4. commands.rs override-aware insert (Path A)
```rust
let mut create_fields = resolved.fields.clone();
create_fields.insert("project".to_string(), json!({ "key": target_project_key }));
// Static mapping wins — only set issuetype from args if not already set by a static mapping
create_fields.entry("issuetype".to_string())
    .or_insert_with(|| json!({ "id": args.target_issue_type_id }));
```

This is a one-line behavioral change. Test that:
- Without static mapping: `args.target_issue_type_id` is used (existing behavior preserved)
- With static mapping: `resolved.fields["issuetype"]` survives; `args.target_issue_type_id` ignored

### 5. UI hint — IssueTypeChooser overridden state (optional, recommended)
When a static mapping for `issuetype` exists, the IssueTypeChooser in CopyPreviewModal should either:
- Disable + show a "Set by static mapping: <Bug>" caption, OR
- Hide entirely with a one-line "Issue type set by static mapping" note

This avoids the surprise of the user seeing the chooser, picking "Story", and getting "Bug" anyway. Reading the mapping rows in copyStore.startPreview is straightforward — it already loads `mapping_rows`.

### 6. i18n keys (2 new keys, EN + SK)
- `settings.fieldMapping.issuetypeFieldName`: "Issue Type" / "Typ issue"
- `settings.fieldMapping.staticIssuetypePlaceholder`: "Pick an issue type" / "Vyberte typ issue"

(Phase 27's existing `staticOptionPlaceholder` "Pick a value" is too generic to reuse — issuetype deserves its own key for translation precision.)

---

## File Touch List

| File | Change | Notes |
|------|--------|-------|
| `src/features/field-mapping/StaticValueWidget.tsx` | Add `issuetype` branch (uses `useSchemaCacheStore`) | After option / option-with-child branch; before array branch |
| `src/features/field-mapping/FieldMappingSection.tsx` | Inject synthetic `issuetype` FieldSchema into the `targetFields` list passed to `StaticMappingRow` only | Do NOT pass to `MappingRow` |
| `src/features/field-mapping/__tests__/StaticValueWidget.test.tsx` | Add test for issuetype branch — render with `prewarmedIssueTypes` mocked | Mirror the existing option-branch test |
| `src-tauri/src/commands.rs` | Change `create_fields.insert("issuetype", ...)` to `.entry().or_insert_with(...)` | Single-line behavior change, line 1762 |
| `src-tauri/src/field_transform/pipeline.rs` | (Optional) Add explicit comment that `FieldSchemaType::Issuetype` is handled by the default JSON-parse arm | Documentation only |
| `src/i18n/locales/en.json` | Add 2 keys | `issuetypeFieldName`, `staticIssuetypePlaceholder` |
| `src/i18n/locales/sk.json` | Add same 2 keys with Slovak translations | Use diacritics |
| `src/features/tickets/IssueTypeChooser.tsx` | (Optional UX polish) Show "set by static mapping" state | Requires reading mappingRows from copyStore or invoke get_field_mapping |

---

## Code Examples (verified patterns from this codebase)

### Reading prewarmedIssueTypes inside a widget
```tsx
// Source: IssueTypeChooser.tsx:45
const issueTypes = useSchemaCacheStore((s) => s.prewarmedIssueTypes[projectKey]) ?? [];
```

### VirtualizedCombobox with IssueTypeRef (already used)
```tsx
// Source: IssueTypeChooser.tsx:72-84
<VirtualizedCombobox<IssueTypeRef>
  items={issueTypes}
  value={selected}
  onChange={(it) => onChange(it.id)}
  displayLabel={(it) => it.name}
  filterFn={(it, q) => it.name.toLowerCase().includes(q.toLowerCase())}
  placeholder={...}
  ariaLabel={...}
/>
```

### Storing {id, value/name} for option types (precedent)
```tsx
// Source: StaticValueWidget.tsx:46 (Phase 27 commit 5d22c31)
onChange={(opt) => onChange(JSON.stringify({ id: opt.id, value: opt.value }))}
```

For issuetype, the equivalent is `JSON.stringify({ id: it.id, name: it.name })` (IssueTypeRef uses `name`, not `value`).

---

## Common Pitfalls

### Pitfall 1 — IssueTypeChooser silently overrides static value
**What goes wrong:** User configures static `issuetype = Bug`, opens copy preview, IssueTypeChooser still shows whatever auto-match picked (e.g., Task), user clicks Copy, the issue is created as Task despite the static mapping.
**Why:** `commands.rs:1762-1765` unconditionally overwrites the issuetype field.
**Fix:** Use `.entry().or_insert_with(...)` so static mapping wins. Also reflect the overridden state in IssueTypeChooser UI.

### Pitfall 2 — Forgetting prewarmedIssueTypes may be empty
**What goes wrong:** Static row's issuetype combobox shows no options because the user navigated to Settings directly without going through CopyPreview first.
**Why:** `prewarmedIssueTypes[targetProjectKey]` is only populated by `preWarm` (in `startPreview` or `FieldMappingSection`'s mount effect).
**Fix:** `FieldMappingSection.tsx:188-216` already calls `preWarm(targetProjectKey)` on mount if not warmed — the widget will see populated data by the time it renders. Add an empty-state placeholder ("Loading issue types…" / "No issue types available") just in case.

### Pitfall 3 — Showing issuetype in non-static MappingRow target combobox
**What goes wrong:** The synthetic issuetype FieldSchema leaks into the regular MappingRow's target combobox. A user picks `summary → issuetype` as a normal mapping; the pipeline tries `source_issue.pointer("/fields/summary")` → returns the summary string → `identity::transform_identity` on `Issuetype` schema returns `Value::Null` (Phase 18 identity.rs:63 already returns Null for Issuetype). No write happens, but the row pollutes the UI.
**Fix:** Inject the synthetic issuetype field ONLY into the props passed to `StaticMappingRow`, not into `MappingRow`. Keep two separate `targetFields` arrays at the FieldMappingSection level.

### Pitfall 4 — Bare ID storage breaks label rendering after reload
**What goes wrong:** Storing `JSON.stringify({ id })` only (no `name`) means re-rendering the static row in settings shows "10001" instead of "Bug" — the widget can recover the IssueTypeRef from prewarmedIssueTypes IF the list is populated, but if the user is offline or prewarmedIssueTypes is empty, the label is lost.
**Fix:** Store `{ id, name }` so the human-readable label is durable across cache misses. Matches commit 5d22c31 precedent.

### Pitfall 5 — i18n keys translated as empty strings
**What goes wrong:** SK locale entry left empty or copy-pasted from EN.
**Fix:** Both keys need real Slovak translations with diacritics. Project convention.

---

## Don't Hand-Roll

| Problem | Use Existing |
|---------|--------------|
| Issuetype dropdown | `VirtualizedCombobox<IssueTypeRef>` from IssueTypeChooser pattern |
| Loading issue types | `useSchemaCacheStore.prewarmedIssueTypes[projectKey]` — already populated by FieldMappingSection mount effect |
| Static value persistence | Existing `set_field_mapping` Tauri command — no new command needed |
| Pipeline write-shape | Existing default arm in pipeline.rs:80-81 handles `Issuetype` correctly via JSON pass-through |

---

## Test Plan (per project convention)

| Test | File | Type |
|------|------|------|
| StaticValueWidget renders VirtualizedCombobox for `schema.type === 'issuetype'` | `__tests__/StaticValueWidget.test.tsx` | unit (Vitest) |
| Selecting an issue type calls onChange with `JSON.stringify({ id, name })` | same | unit |
| `commands.rs` create flow uses static mapping issuetype when present, args fallback when absent | `src-tauri/src/copy_pipeline.rs` or commands tests | unit (cargo test) |
| Synthetic issuetype field appears in StaticMappingRow target combobox only | `__tests__/FieldMappingSection.test.tsx` (extend) | unit |

Quick run: `npx vitest run src/features/field-mapping && cargo test -p pmkar-lib`.

---

## Assumptions / Open Questions

| # | Item | Risk if Wrong |
|---|------|---------------|
| A1 | User's "standard interaction (static overrides dynamic)" means static `issuetype` must beat the IssueTypeChooser's value at copy time. [USER STATED] | If wrong: static mapping is silently ignored and feature looks broken |
| A2 | IssueTypeChooser UI does NOT need to be hidden when a static mapping exists — a caption/disabled state is enough. **Confirm with user.** | If wrong: minor UX polish needed but not blocking |
| A3 | Storing `{ id, name }` (with human-readable name) is preferred over bare `{ id }`. Matches commit `5d22c31` precedent for option fields. | If wrong: settings re-render shows bare ID after reload |
| A4 | The synthetic `issuetype` FieldSchema should only appear in the StaticMappingRow target picker, not the regular MappingRow. | If wrong: confusing duplicate paths for issuetype mapping |

---

## Estimated Scope

- **3 small files modified** (StaticValueWidget, FieldMappingSection, commands.rs)
- **1 test file modified** (StaticValueWidget.test.tsx) + 1 optional (FieldMappingSection.test.tsx)
- **2 i18n keys** added to en.json + sk.json
- **Optional:** 1 file modified (IssueTypeChooser.tsx) for UX polish

This is a 1-2 hour quick task. No new packages, no schema migration, no Tauri command additions.

---

## Sources

### Primary (HIGH confidence)
- [src/features/field-mapping/StaticValueWidget.tsx](src/features/field-mapping/StaticValueWidget.tsx) — current dispatch table, default-branch fall-through for issuetype [VERIFIED: file read]
- [src/features/field-mapping/StaticMappingRow.tsx](src/features/field-mapping/StaticMappingRow.tsx) — target combobox consumes `targetFields` array [VERIFIED: file read]
- [src/features/field-mapping/FieldMappingSection.tsx](src/features/field-mapping/FieldMappingSection.tsx) — `targetFields` source and `prewarmedIssueTypes` lookup [VERIFIED: file read]
- [src/features/tickets/IssueTypeChooser.tsx](src/features/tickets/IssueTypeChooser.tsx) — VirtualizedCombobox<IssueTypeRef> pattern, prewarmedIssueTypes selector [VERIFIED: file read]
- [src/stores/schemaCacheStore.ts](src/stores/schemaCacheStore.ts) — `prewarmedIssueTypes` shape, `IssueTypeRef[]` keyed by projectKey [VERIFIED: file read]
- [src-tauri/src/commands.rs:1753-1766](src-tauri/src/commands.rs) — unconditional `issuetype` field override in copy_ticket_v2 [VERIFIED: file read]
- [src-tauri/src/field_transform/pipeline.rs:47-87](src-tauri/src/field_transform/pipeline.rs) — Phase 27 static branch with default JSON-parse arm covering Issuetype [VERIFIED: file read]
- [src-tauri/src/field_discovery.rs:106](src-tauri/src/field_discovery.rs) — `FieldSchemaType::Issuetype` variant exists [VERIFIED: file read]
- [src-tauri/src/field_transform/identity.rs:63](src-tauri/src/field_transform/identity.rs) — Issuetype returns Null in identity transform (Phase 18 — confirms it's not handled there) [VERIFIED: file read]
- git commit `5d22c31` — precedent for storing `{id, value}` in static option fields [VERIFIED: git log]
- [.planning/phases/27-add-static-value-mapping-to-configurable-field-mapping/27-RESEARCH.md](.planning/phases/27-add-static-value-mapping-to-configurable-field-mapping/27-RESEARCH.md) — Phase 27 architecture context [VERIFIED: file read]
