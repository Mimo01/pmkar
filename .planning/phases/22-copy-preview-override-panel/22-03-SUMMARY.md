---
phase: 22-copy-preview-override-panel
plan: "03"
subsystem: ui
tags: [copy-preview, gaps-section, required-field-gating, phase-22]

requires:
  - phase: 22-copy-preview-override-panel
    plan: "01"
    provides: copyStore resolvedTargetFields + overrideValues + setOverrideValue contract
  - phase: 21-field-mapping-editor
    provides: FieldMappingRow with empty-string dismissed-sentinel (D-07)
  - phase: 20-field-renderer-registry
    provides: getRenderer(schema) dispatcher + RendererProps contract

provides:
  - computeGapFields(resolvedTargetFields, mappingRows) pure function (4 exclusion rules)
  - GapsSection controlled component (amber header, per-row getRenderer dispatch, Map field callback)
  - GapsSectionProps interface

affects:
  - 22-04 (CopyPreviewPage imports both to wire gap detection + gap rendering)

tech-stack:
  added: []
  patterns:
    - "computeGapFields: Set-based O(n) filter matching FieldMappingSection driftedSourceFieldIds pattern"
    - "GapsSection: returns null when gapFields empty — absence of section is the no-gap signal"
    - "isUserSchema guard in GapRow: checks schema.type==='user' OR schema.type==='array' && items==='user'"

key-files:
  created:
    - src/features/tickets/computeGapFields.ts
    - src/features/tickets/GapsSection.tsx
    - src/features/tickets/__tests__/computeGapFields.test.ts
    - src/features/tickets/__tests__/GapsSection.test.tsx
  modified: []

key-decisions:
  - "computeGapFields is a pure function (no React, no store) — easy to unit test, safe to call in render"
  - "Empty-string targetFieldId (Phase 21 D-07 dismissed-sentinel) explicitly excluded from Set of covered fields — if (row.targetFieldId && row.targetFieldId !== '')"
  - "GapsSection passes onSearchUsers only to user-type rows via isUserSchema() — avoids passing unnecessary prop to non-user renderers"
  - "onMapLink is a callback prop, not navigation — GapsSection never navigates or closes modals (D-08)"
  - "No @tauri-apps/api/core import in GapsSection — presentation component, D-01 isolation maintained"

requirements-completed: [OVRD-04, OVRD-05]

duration: 3min
completed: 2026-04-28
---

# Phase 22 Plan 03: computeGapFields + GapsSection Summary

**Pure gap-detection function and amber-bordered required-gap UI component with renderer-registry-dispatched typed controls and Map field callback — 17 tests (8+9) all passing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-28T12:02:17Z
- **Completed:** 2026-04-28T12:05:17Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments

### Task 1: computeGapFields pure function

`computeGapFields(resolvedTargetFields, mappingRows)` returns `FieldSchema[]` of fields that are:
1. `required === true` (required by createmeta)
2. `hasDefaultValue !== true` (no server-side default)
3. Not covered by any non-empty `targetFieldId` in mappingRows (empty-string is dismissed-sentinel per Phase 21 D-07)
4. Not `fieldId === 'summary'` (summary has a dedicated Phase 22 D-01 input)

Output preserves input order. Pure function — no React, no store reads.

### Task 2: GapsSection component

`GapsSection` renders:
- An amber-bordered section (`border-amber-500 bg-amber-500/5`) with `AlertTriangle` icon and "Required fields with no mapping" header
- One `GapRow` per gap field, each containing:
  - Field label with required asterisk
  - `getRenderer(field.schema)` dispatched control (same registry as `DynamicTargetForm`)
  - "Map field" ghost button invoking parent `onMapLink` callback
- Returns `null` when `gapFields.length === 0`
- `role="region"` with `aria-label` for screen-reader accessibility
- `onSearchUsers` forwarded to user-type rows only (via `isUserSchema` guard)

## Final Signatures

```typescript
// computeGapFields.ts
export function computeGapFields(
  resolvedTargetFields: FieldSchema[],
  mappingRows: FieldMappingRow[],
): FieldSchema[]

// GapsSection.tsx
export interface GapsSectionProps {
  gapFields: FieldSchema[];
  overrideValues: Record<string, unknown>;
  onOverrideChange: (fieldId: string, value: unknown) => void;
  onMapLink: () => void;
  onSearchUsers?: (q: string) => Promise<JiraUser[]>;
}

export function GapsSection(props: GapsSectionProps): React.ReactElement | null
```

## Test Counts

- `computeGapFields.test.ts`: 8 tests
- `GapsSection.test.tsx`: 9 tests
- **Total: 17 tests, all passing**

## Task Commits

1. **Task 1: computeGapFields pure function and unit tests** — `f325216` (feat)
2. **Task 2: GapsSection component with amber section, renderer dispatch, and Map link** — `25ef56f` (feat)

## Files Created

- `src/features/tickets/computeGapFields.ts` — Pure gap-detection function (4 exclusion rules)
- `src/features/tickets/GapsSection.tsx` — Amber-bordered required-gap UI component
- `src/features/tickets/__tests__/computeGapFields.test.ts` — 8 unit tests
- `src/features/tickets/__tests__/GapsSection.test.tsx` — 9 component tests

## No Tauri Import (D-01 Isolation)

`grep -c "@tauri-apps/api/core" GapsSection.tsx` = 0
`grep -c "@tauri-apps/api/core" computeGapFields.ts` = 0

D-01 isolation maintained: GapsSection is a pure presentation component. All Tauri invocations stay in Plan 04's CopyPreviewPage.

## Deviations from Plan

None — plan executed exactly as written.

The test count for GapsSection is 9 (not 8 as the plan's `<behavior>` section listed) because the plan's `<action>` code block included a 9th test case ("reads existing overrideValues for renderer value prop") that was not listed in the `<behavior>` bullet points. All 9 tests are valid and passing.

## Known Stubs

None — `computeGapFields` is fully functional logic; `GapsSection` renders real renderer-dispatched controls. No placeholder values or hardcoded data.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. Component receives data from parent props only. `field.name` rendered as JSX text node (React escapes by default — T-22-12 mitigated). No `dangerouslySetInnerHTML` used.

## Self-Check: PASSED

- `src/features/tickets/computeGapFields.ts` — FOUND
- `src/features/tickets/GapsSection.tsx` — FOUND
- `src/features/tickets/__tests__/computeGapFields.test.ts` — FOUND
- `src/features/tickets/__tests__/GapsSection.test.tsx` — FOUND
- Task 1 commit `f325216` — FOUND
- Task 2 commit `25ef56f` — FOUND
- All 17 tests passing — VERIFIED
- `npx tsc --noEmit` exits 0 (only pre-existing unrelated error in connectionStore.probe.test.ts) — VERIFIED
