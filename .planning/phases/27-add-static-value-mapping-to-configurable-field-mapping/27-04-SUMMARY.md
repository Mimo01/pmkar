---
phase: 27-add-static-value-mapping-to-configurable-field-mapping
plan: "04"
subsystem: field-mapping/ui
tags: [typescript, react, ui, wave-3, static-mapping, field-mapping]
status: complete

requires:
  - phase: 27-add-static-value-mapping-to-configurable-field-mapping
    plan: "01"
    provides: Wave 0 React tests (STATIC-UI-01..04) for StaticValueWidget and StaticMappingRow
  - phase: 27-add-static-value-mapping-to-configurable-field-mapping
    plan: "02"
    provides: Rust static branch in pipeline, static_value column in field_mapping table
  - phase: 27-add-static-value-mapping-to-configurable-field-mapping
    plan: "03"
    provides: FieldMappingRow.staticValue? field, TransformerKind 'static', 11 i18n keys

provides:
  - "StaticValueWidget: smart value input dispatching by target FieldSchemaType"
  - "StaticMappingRow: static row component with Static badge, target combobox, value widget, delete"
  - "FieldMappingSection: Add static value button, pending static row, __static__ row discrimination"
  - "All 4 Wave 0 React tests green (STATIC-UI-01..04)"

affects:
  - "Settings → Copying → Field Mapping — adds 'Add static value' ghost button"
  - "Users can now create static field mappings with per-schema-type value widgets"

tech-stack:
  added: []
  patterns:
    - "Pre-serialized JSON write-shape storage for option fields: onChange(JSON.stringify({ id: opt.id, value: opt.value })) — value included so SingleSelectRenderer.optLabel can display label without allowedValues lookup"
    - "Raw comma-separated text storage for array fields: pipeline splits at copy time"
    - "Row discrimination via sourceFieldId.startsWith('__static__') in render map"
    - "Auto-save pattern with 1500ms Saved flash (matches MappingRow)"

key-files:
  created:
    - src/features/field-mapping/StaticValueWidget.tsx
    - src/features/field-mapping/StaticMappingRow.tsx
  modified:
    - src/features/field-mapping/FieldMappingSection.tsx
    - src/features/field-mapping/__tests__/StaticMappingRow.test.tsx
    - src/features/field-mapping/__tests__/FieldMappingSection.test.tsx

key-decisions:
  - "StaticValueWidget option branch stores pre-serialized JSON write-shape {\"id\":\"...\"} for Jira Cloud v3 pass-through — NOT bare id"
  - "StaticValueWidget array branch stores raw comma-separated text; Rust pipeline (Plan 02 Task 3) splits"
  - "StaticMappingRow receives newValue from StaticValueWidget as-is; no post-processing"
  - "Pending static row renders StaticMappingRow with empty row and clears pendingStaticAdd on target selection"
  - "Badge span uses role='img' + aria-label to satisfy biome a11y/useAriaPropsSupportedByRole rule"

metrics:
  duration: ~5min
  completed: 2026-05-20T12:51:24Z
---

# Phase 27 Plan 04: Static Value UI Components Summary

**StaticValueWidget, StaticMappingRow, and FieldMappingSection wiring shipped. Human verification passed. Post-checkpoint fixes: option fields now store {id,value} so copy modal shows label not ID; static label restyled to match combobox buttons; renamed "Static" → "Static value".**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-20T12:46:04Z
- **Completed (partial):** 2026-05-20T12:51:24Z (paused at Task 4 checkpoint)
- **Tasks completed:** 3 / 4
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

### Task 1: StaticValueWidget (STATIC-UI-02)
- Created `src/features/field-mapping/StaticValueWidget.tsx` with full schema-type dispatch:
  - `option` / `option-with-child`: VirtualizedCombobox over `field.allowedValues`; `onChange` stores `JSON.stringify({ id: opt.id })` (pre-serialized Jira Cloud v3 write-shape)
  - `array` (non-user): plain text input; stores raw comma-separated text (pipeline splits); `staticMultiHint` shown below input; user-array renders disabled
  - `user` / `priority`: disabled input with `staticUnsupported` placeholder
  - Default (`string`, `number`, `date`, `datetime`, `any`): plain text input
- All 4 StaticValueWidget tests pass

### Task 2: StaticMappingRow (STATIC-UI-03, STATIC-UI-04)
- Created `src/features/field-mapping/StaticMappingRow.tsx`:
  - 4-column grid layout matching MappingRow (`grid-cols-[35fr_35fr_20fr_10fr]`)
  - Col 1: Static badge with Tooltip (`text-brand bg-brand/10 border-brand/30`, `role="img"`)
  - Col 2: VirtualizedCombobox for target; `handleTargetChange` builds `__static__{fieldId}` sentinel
  - Col 3: StaticValueWidget when target selected; em-dash placeholder otherwise
  - Col 4: 1500ms Saved flash + delete button
  - All handlers wrapped in try/catch with toast.error on failure
- All 3 StaticMappingRow tests pass

### Task 3: FieldMappingSection wiring (STATIC-UI-01)
- Added `StaticMappingRow` import
- Added `pendingStaticAdd` state + `handleAddStaticRow` handler
- Row map discriminates by `row.sourceFieldId.startsWith('__static__')` → StaticMappingRow vs MappingRow
- Pending static row rendered below pendingAdd block; `onRowUpdate` clears `pendingStaticAdd`
- "Add static value" ghost button added below "Add field mapping" with correct aria-label
- Empty-state condition updated to `!pendingStaticAdd`
- All 25 field-mapping tests pass (STATIC-UI-01..04 + existing tests)

## Task Commits

1. **Task 1: StaticValueWidget** - `e0bd21c` (feat)
2. **Task 2: StaticMappingRow + test fixes** - `d460841` (feat)
3. **Task 3: FieldMappingSection wiring** - `0cd9fed` (feat)

## Files Created/Modified

- `src/features/field-mapping/StaticValueWidget.tsx` — Created: smart value widget, schema-type dispatch
- `src/features/field-mapping/StaticMappingRow.tsx` — Created: static row component
- `src/features/field-mapping/FieldMappingSection.tsx` — Modified: static row wiring
- `src/features/field-mapping/__tests__/StaticMappingRow.test.tsx` — Modified: test bug fixes (Rule 1)
- `src/features/field-mapping/__tests__/FieldMappingSection.test.tsx` — Modified: trailing blank line (biome fix)

## Verification Results

- `npx vitest run src/features/field-mapping`: **25/25 PASS** (STATIC-UI-01..04 + existing)
- `npx tsc --noEmit`: Only pre-existing error in CopyPreviewPage.test.tsx (unrelated to this plan)
- `npx biome check src/features/field-mapping`: **PASS** (no errors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 3 bugs in Wave 0 test StaticMappingRow.test.tsx**
- **Found during:** Task 2 verification
- **Issue 1:** Test expected `staticValue: '10002'` (bare id), but the plan mandates and the implementation stores `JSON.stringify({ id: '10002' })` = `'{"id":"10002"}'` (pre-serialized JSON write-shape). Test was authored before the RESEARCH.md clarification that JSON write-shape is required for Jira Cloud v3.
- **Issue 2:** Delete button aria-label regex `/Delete static mapping for Priority Level/i` did not match the EN i18n value "Remove static mapping for {{field}}" established by Plan 03.
- **Issue 3:** `getByRole('combobox')` was ambiguous — the rendered row has BOTH a target combobox AND a value widget combobox (since `baseStaticRow` has a target selected). Fixed to `getAllByRole('combobox').length >= 1`.
- **Fix:** Updated test expectations to match the correct implementation contract:
  - `staticValue: JSON.stringify({ id: '10002' })`
  - regex `/Remove static mapping for Priority Level/i`
  - `getAllByRole('combobox').length >= 1`
- **Files modified:** `src/features/field-mapping/__tests__/StaticMappingRow.test.tsx`
- **Commit:** `d460841`

**2. [Rule 2 - Missing critical] Added role="img" to Static badge span**
- **Found during:** Task 3 biome check
- **Issue:** Biome `a11y/useAriaPropsSupportedByRole` rule: `aria-label` is not valid on a generic `<span>`. Per the UI-SPEC accessibility contract, the badge must have `aria-label="Static mapping — no source field"`.
- **Fix:** Added `role="img"` to the badge `<span>` to make `aria-label` semantically valid.
- **Files modified:** `src/features/field-mapping/StaticMappingRow.tsx`
- **Commit:** `0cd9fed`

**3. [Rule 1 - Bug] Fixed trailing blank line in FieldMappingSection.test.tsx**
- **Found during:** Task 3 biome check
- **Issue:** A spurious blank line before the closing `})` of a `describe` block caused a biome formatter error.
- **Fix:** Removed the extra blank line.
- **Files modified:** `src/features/field-mapping/__tests__/FieldMappingSection.test.tsx`
- **Commit:** `0cd9fed`

**4. [Rule 3 - Blocking] Organized imports in StaticMappingRow.tsx to satisfy biome**
- **Found during:** Task 3 biome check
- **Issue:** Biome `organizeImports` rule required `@/components/ui/tooltip` before `@/features/field-renderers/...`, and `StaticValueWidget` before `type { FieldMappingRow }`.
- **Fix:** Reordered imports per biome's canonical sort.
- **Files modified:** `src/features/field-mapping/StaticMappingRow.tsx`, `src/features/field-mapping/__tests__/StaticMappingRow.test.tsx`
- **Commit:** `0cd9fed`

## Human Verify — PASSED (2026-05-20)

Task 4 human verify passed. Two bugs found and fixed during verification:

**Fix 1: Option fields showed ID instead of label in copy modal** (`5d22c31`)
- `StaticValueWidget` stored `{id}` only; `SingleSelectRenderer.optLabel` falls back to `id` when `value` absent
- Fix: store `{id, value}` — `optLabel` now returns the label string directly

**Fix 2: Static label didn't match combobox buttons visually** (`5d22c31`)
- Badge was a small colored chip; other row cells are full-width outline buttons
- Fix: replaced with `div` styled to match (`border-input bg-background min-h-9 px-3 text-sm text-muted-foreground`)
- Also renamed "Static" → "Static value" (EN + SK)

## Known Stubs

None — all components are fully wired. The pending static row uses `{ type: 'any' }` for `sourceSchema` and `targetSchema` as expected (correct sentinel state before a target is selected).

## Threat Flags

No new threat surface introduced beyond what was analyzed in the plan's `<threat_model>`. The `role="img"` fix to the badge span is a purely accessibility-semantic change with no security impact.

## Self-Check

- [x] `src/features/field-mapping/StaticValueWidget.tsx` exists and contains `export function StaticValueWidget`
- [x] `src/features/field-mapping/StaticMappingRow.tsx` exists and contains `export function StaticMappingRow`
- [x] `src/features/field-mapping/FieldMappingSection.tsx` contains `pendingStaticAdd`, `handleAddStaticRow`, `row.sourceFieldId.startsWith('__static__')`
- [x] Commits `e0bd21c`, `d460841`, `0cd9fed` exist in git log
- [x] All 25 field-mapping tests pass

## Self-Check: PASSED
