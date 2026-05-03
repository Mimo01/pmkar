---
phase: 22-copy-preview-override-panel
plan: "02"
subsystem: ui
tags: [issue-type-chooser, virtualized-combobox, schema-cache, phase-22, copy-preview]

requires:
  - phase: 22-copy-preview-override-panel
    plan: "01"
    provides: copyStore with targetIssueTypeId, schemaCacheStore.prewarmedIssueTypes populated by startPreview

provides:
  - IssueTypeChooser presentational component with stable controlled-component contract
  - isDefaulted three-state logic for D-06 defaulted-notice behavior
  - 8 unit tests covering all behavioral scenarios

affects:
  - 22-04 (CopyPreviewPage integration wires IssueTypeChooser with value/onChange/loading props)

tech-stack:
  added: []
  patterns:
    - "VirtualizedCombobox<IssueTypeRef> with [&_button]:min-h-9 compactness wrapper (MappingRow.tsx pattern)"
    - "isDefaulted three-state: visible=no-match-in-list; hidden=current-matches-source; hidden=user-picked-non-match-with-match-available"
    - "loading prop shows Loader2 spinner overlaid absolutely inside wrapper div (right-8 top-1/2)"
    - "useSchemaCacheStore selector reads prewarmedIssueTypes[projectKey] ?? [] — read-only, no mutations"

key-files:
  created:
    - src/features/tickets/IssueTypeChooser.tsx
    - src/features/tickets/__tests__/IssueTypeChooser.test.tsx
  modified: []

key-decisions:
  - "isDefaulted logic corrected from Task 1 draft: notice fires when NO match exists in list (true fallback), NOT when match exists — matches D-06 semantic"
  - "Loader2 spinner overlaid as absolute-positioned span inside wrapper (not passed to VirtualizedCombobox.loading) so it appears over the compact min-h-9 trigger without affecting combobox internal layout"
  - "No i18n keys added in this plan — Plan 04 owns en.json/sk.json translation parity step; missing keys surface as key strings at runtime (acceptable)"
  - "No Tauri imports in IssueTypeChooser.tsx — D-01 isolation enforced; component only reads Zustand store"

requirements-completed: [OVRD-01, OVRD-02]

duration: 2min
completed: 2026-04-28
---

# Phase 22 Plan 02: IssueTypeChooser Component Summary

**VirtualizedCombobox-based issue-type chooser with corrected D-06 isDefaulted three-state logic, inline Loader2 spinner on schema reload, and 8 passing unit tests — no Tauri imports (D-01 isolation)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-28T12:02:21Z
- **Completed:** 2026-04-28T12:04:26Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created `src/features/tickets/IssueTypeChooser.tsx` — fully controlled presentational component
- D-03: `VirtualizedCombobox<IssueTypeRef>` wrapped in `[&_button]:min-h-9` compactness div (MappingRow.tsx pattern)
- D-04: Reads `schemaCacheStore.prewarmedIssueTypes[projectKey]` — no mutations, parent owns pre-warm
- D-05: No default-selection logic — chooser only renders the `value` prop (copyStore owns defaults from Plan 01)
- D-06: Corrected `isDefaulted` three-state logic (see below)
- Loading state: `Loader2` overlaid as `absolute` span inside wrapper when `loading={true}`
- D-01 gate: zero `@tauri-apps/api/core` imports
- All 8 unit tests pass

## Final `IssueTypeChooserProps` Signature

```typescript
export interface IssueTypeChooserProps {
  projectKey: string;
  sourceIssueTypeName: string;
  value: string | null;          // currently-selected issue-type id
  onChange: (issueTypeId: string) => void;
  loading?: boolean;             // schema is loading for the selected type
  disabled?: boolean;
}
```

## Corrected `isDefaulted` Three-State Logic (D-06)

```typescript
const isDefaulted = useMemo(() => {
  if (!selected || !sourceIssueTypeName) return false;
  const src = sourceIssueTypeName.toLowerCase();
  // State 1: selected name matches source → NOT defaulted (hide notice)
  if (selected.name.toLowerCase() === src) return false;
  // State 2: list contains a source-name match but user picked something else
  //          → manual pick, NOT defaulted (hide notice)
  const listHasMatch = issueTypes.some((it) => it.name.toLowerCase() === src);
  if (listHasMatch) return false;
  // State 3: selected ≠ source AND no match in list → fell back to first → DEFAULTED (show notice)
  return true;
}, [selected, sourceIssueTypeName, issueTypes]);
```

**Examples:**
- `sourceIssueTypeName='Story'`, list=`[{name:'Task'}]`, value=`'Task'` → **notice visible** (no Story in list, fell back)
- `sourceIssueTypeName='task'`, list=`[{name:'Task'}]`, value=`'Task'` → **notice hidden** (case-insensitive match)
- `sourceIssueTypeName='Task'`, list=`[{name:'Task'},{name:'Bug'}]`, value=`'Bug'` → **notice hidden** (user actively chose Bug while Task was available)

**Key correction from Task 1 draft:** The initial draft had `return hasMatch` (notice when match exists), but D-06 requires notice when the chooser *fell back* because no match existed (`return !listHasMatch`). Task 2 action block identified this and the corrected logic was applied directly in the written file.

## Task Commits

1. **Task 1: Create IssueTypeChooser component** — `d5ccc43` (feat)
2. **Task 2: Add IssueTypeChooser unit tests** — `b8afa25` (test)

## Files Created

- `src/features/tickets/IssueTypeChooser.tsx` — Presentational chooser component (119 lines)
- `src/features/tickets/__tests__/IssueTypeChooser.test.tsx` — Unit tests (184 lines)

## Test Counts

- **Total tests:** 8
- **All passing:** Yes
- **Test scenarios:**
  1. Renders selected issue-type name in trigger
  2. Shows defaulted notice when source name has no match in the list
  3. Hides defaulted notice when selected matches source name (case-insensitive)
  4. Hides defaulted notice when user manually picked non-matching item but match exists in list
  5. Renders Loader2 spinner when `loading=true`
  6. Hides Loader2 when `loading=false`
  7. Disables combobox when no issue types are available
  8. Calls `onChange` with the issue-type id (string), not the object

## D-01 Isolation Confirmation

```bash
$ grep -c "@tauri-apps/api/core" src/features/tickets/IssueTypeChooser.tsx
0
```

No Tauri commands invoked from this component. The chooser only reads `schemaCacheStore.prewarmedIssueTypes` and fires the `onChange(id)` callback — no cross-process calls.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Applied corrected isDefaulted logic directly (not the Task 1 draft)**
- **Found during:** Task 2 analysis (plan itself identified the bug in Task 2 action block)
- **Issue:** Task 1's draft `isDefaulted` had `return hasMatch` which inverts the intended semantic — the notice should appear when there is NO match (true fallback case), not when a match exists
- **Fix:** Applied the corrected logic from Task 2's action block directly when writing Task 1's file: `return true` (when `!listHasMatch && selected.name !== src`)
- **Files modified:** `src/features/tickets/IssueTypeChooser.tsx`
- **Impact:** Correct D-06 behavior; all 8 tests pass with this logic

---

**Total deviations:** 1 auto-fixed (pre-identified in plan)
**Impact on plan:** No scope change — the plan itself caught and corrected the logic in the Task 2 action block.

## Known Stubs

None — all props wired to real store reads and controlled-component callbacks. No placeholder values.

## Threat Flags

No new threat surface introduced. Component is read-only vs. schemaCacheStore; no new network endpoints, auth paths, or file access patterns. T-22-06 (XSS via sourceTypeName) mitigated by React JSX escaping in `{t(...)}` interpolation — no `dangerouslySetInnerHTML` used.

## Self-Check: PASSED

- `src/features/tickets/IssueTypeChooser.tsx` — FOUND
- `src/features/tickets/__tests__/IssueTypeChooser.test.tsx` — FOUND
- Commit `d5ccc43` — FOUND (feat task 1)
- Commit `b8afa25` — FOUND (test task 2)
- `npx tsc --noEmit` — exits 0 (only pre-existing unrelated error in connectionStore.probe.test.ts)
- All 8 tests pass
