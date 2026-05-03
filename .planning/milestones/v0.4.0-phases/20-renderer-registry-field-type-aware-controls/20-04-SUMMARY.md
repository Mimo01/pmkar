---
phase: 20-renderer-registry-field-type-aware-controls
plan: "04"
subsystem: field-renderers
tags: [react-19, virtualization, combobox, user-picker, multi-select, badge-chip, tdd]

requires:
  - phase: 20-02
    provides: VirtualizedCombobox<T> generic combobox base with onSearch + initialQuery
  - phase: 20-01
    provides: RendererProps unified prop bag, JiraComponent, JiraVersion types

provides:
  - UserPickerRenderer — async user search via onSearch + initialQuery (D-01, D-03)
  - MultiUserPickerRenderer — multi-user chips with isJiraUser type guard (D-02)
  - GroupPickerRenderer — static group single-select from allowedValues (D-07)
  - SingleSelectRenderer — static single-select from allowedValues (CTRL-03)
  - MultiSelectRenderer — multi-select chips with Badge variant=secondary (CTRL-03)
  - LabelsRenderer — multi-select chips with Badge variant=outline + free-text Enter-to-add (CTRL-03)
  - ComponentPickerRenderer — JiraComponent multi-select chips (CTRL-04)
  - VersionPickerRenderer — JiraVersion multi-select chips with archived indicator (CTRL-04)

affects: [20-05, 22]

tech-stack:
  added: []
  patterns:
    - "Thin VirtualizedCombobox wrapper pattern: all 8 pickers delegate to VirtualizedCombobox<T>"
    - "isJiraUser/isComponent/isVersion type guard pattern for value array filtering"
    - "ResizeObserver + layout mock pattern (offsetHeight/clientHeight=280px) for VirtualizedCombobox tests"
    - "Chip array above trigger pattern: chips rendered above VirtualizedCombobox for multi-pick"
    - "Badge variant=secondary for multi-select options, variant=outline for labels"

key-files:
  created:
    - src/features/field-renderers/renderers/UserPickerRenderer.tsx
    - src/features/field-renderers/renderers/MultiUserPickerRenderer.tsx
    - src/features/field-renderers/renderers/GroupPickerRenderer.tsx
    - src/features/field-renderers/renderers/SingleSelectRenderer.tsx
    - src/features/field-renderers/renderers/MultiSelectRenderer.tsx
    - src/features/field-renderers/renderers/LabelsRenderer.tsx
    - src/features/field-renderers/renderers/ComponentPickerRenderer.tsx
    - src/features/field-renderers/renderers/VersionPickerRenderer.tsx
    - src/features/field-renderers/__tests__/UserPickerRenderer.test.tsx
    - src/features/field-renderers/__tests__/MultiUserPickerRenderer.test.tsx
    - src/features/field-renderers/__tests__/SingleSelectRenderer.test.tsx
    - src/features/field-renderers/__tests__/MultiSelectRenderer.test.tsx
    - src/features/field-renderers/__tests__/LabelsRenderer.test.tsx
  modified: []

key-decisions:
  - "All 8 pickers wrap VirtualizedCombobox unconditionally (no branching on list size — D-07, D-08)"
  - "UserPicker/MultiUserPicker pass onSearch only; static pickers never receive onSearch (D-01 enforcement)"
  - "LabelsRenderer uses plain <input> + Enter-to-add alongside VirtualizedCombobox for suggestions — not just the combobox — to support free-text entry"
  - "ResizeObserver + layout mock replicated in each new test file (not shared) to keep test files self-contained"
  - "Removed @ts-expect-error from MultiUserPickerRenderer test — RendererProps.value is unknown so mixed arrays are valid TypeScript without suppression"

patterns-established:
  - "Picker wrapper pattern: isTypeGuard(value) + VirtualizedCombobox<TypedItem> with typed generic"
  - "Multi-pick chip strip: rendered ABOVE combobox trigger, uses remove-by-index pattern"
  - "De-duplication: accountId ?? name ?? displayName key for users; id ?? value/name for options"

requirements-completed: [CTRL-02, CTRL-03, CTRL-04]

duration: 5min
completed: 2026-04-28
---

# Phase 20 Plan 04: Picker Renderers Summary

**8 picker renderers as thin VirtualizedCombobox wrappers covering async user search (D-01/D-03), UnresolvedPerson filtering (D-02), and static allowedValues selection (D-07) — 18 passing tests across 5 test files.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-28T06:19:43Z
- **Completed:** 2026-04-28T06:24:25Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- 8 picker renderer files implemented (487 lines total), all wrapping VirtualizedCombobox<T>
- 18 new passing tests across 5 test files (zero `it.todo`, zero `it.skip`)
- CTRL-02 (user/multi-user/group), CTRL-03 (single/multi-select/labels), CTRL-04 (components/versions) requirements covered
- D-02 UnresolvedPerson filtering enforced via isJiraUser type guard with dedicated test assertion
- D-03 initialQuery auto-trigger verified by test; T-20-11 PII non-logging assertion included

## Picker File Summary

| File | Lines | Props Passed to VirtualizedCombobox | Notes |
|------|-------|-------------------------------------|-------|
| UserPickerRenderer.tsx | 49 | onSearch, initialQuery, items=[], value, renderItem | Async-only; filterFn returns true |
| MultiUserPickerRenderer.tsx | 84 | onSearch, items=[], value=null, renderItem | Chip strip above; isJiraUser guard |
| GroupPickerRenderer.tsx | 33 | items (from allowedValues), value, filterFn | Static only; no onSearch |
| SingleSelectRenderer.tsx | 38 | items (from allowedValues), value, filterFn | Single-select |
| MultiSelectRenderer.tsx | 74 | items (remaining after dedup), value=null | Chip strip; Badge variant=secondary |
| LabelsRenderer.tsx | 82 | items (remaining suggestions), value=null | Chip strip + plain input; Badge variant=outline |
| ComponentPickerRenderer.tsx | 63 | items (JiraComponent[]), value=null | Chip strip; Badge variant=secondary |
| VersionPickerRenderer.tsx | 64 | items (JiraVersion[]), value=null | Chip strip + archived label; Badge variant=secondary |

## Task Commits

| Task | Name | Commit | Tests |
|------|------|--------|-------|
| 1 | UserPickerRenderer + MultiUserPickerRenderer + GroupPickerRenderer | 92ddc1c | 9 passing (5 UserPicker + 4 MultiUserPicker) |
| 2 | SingleSelect + MultiSelect + Labels + Component + Version pickers | 67cbe00 | 9 passing (3 each) |

## Test Coverage

| Test File | Tests | Key Assertions |
|-----------|-------|----------------|
| UserPickerRenderer.test.tsx | 5 | displayName in trigger, initialQuery D-03, debounced search, onChange, PII non-logging |
| MultiUserPickerRenderer.test.tsx | 4 | chips rendered, chip remove onChange, UnresolvedPerson filtered (D-02), combobox visible |
| SingleSelectRenderer.test.tsx | 3 | allowedValues rendered, onChange with option object, value in trigger |
| MultiSelectRenderer.test.tsx | 3 | chips per value, onChange on add, onChange on remove |
| LabelsRenderer.test.tsx | 3 | outline chips, Enter-to-add free text, chip remove |

## Verification Results

- `grep -r "@tauri-apps/api/core" src/features/field-renderers/renderers/` → 0 results (D-01 enforced)
- `grep -r "dangerouslySetInnerHTML" src/features/field-renderers/` → 0 results (T-20-12/T-20-13 mitigated)
- `npx tsc --noEmit --skipLibCheck` → 0 errors from new files
- Full suite: 629 tests passing, 2 skipped, 25 todo (all pre-existing)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused @ts-expect-error directive from MultiUserPickerRenderer test**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** The plan included `// @ts-expect-error` on the mixed-array test case for D-02. Since `RendererProps.value` is typed `unknown`, TypeScript accepts any value — the directive was unused and caused a TS2578 error.
- **Fix:** Removed the `@ts-expect-error` comment; test still validates D-02 filtering behavior correctly.
- **Files modified:** `src/features/field-renderers/__tests__/MultiUserPickerRenderer.test.tsx`
- **Verification:** `npx tsc --noEmit --skipLibCheck` exits 0; test still passes.
- **Committed in:** 92ddc1c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** Minor TypeScript correctness fix; D-02 test coverage unaffected.

## Issues Encountered

None — both tasks executed cleanly on first run.

## Known Stubs

None. All 8 renderers are fully wired: they receive real props, apply type guards, and call onChange/onSearch correctly. No placeholder data flows to UI rendering.

## Threat Flags

No new threat surface beyond the plan's threat model (T-20-11 through T-20-15). Confirmed:
- T-20-11: No console.log of onSearch query params; verified by "does not log onSearch query params" test
- T-20-12: UserAvatar + JiraUser fields rendered as React text nodes; no dangerouslySetInnerHTML
- T-20-13: optLabel(), c.name, v.name rendered as text children of Badge; React JSX auto-escaping
- T-20-14: isJiraUser type guard enforced; "ignores UnresolvedPerson" test verifies D-02
- T-20-15: VirtualizedCombobox debounces at 300ms; inherited by UserPicker/MultiUserPicker

## Next Phase Readiness

- All 8 picker renderers ready for Plan 05 registry integration
- ComponentPickerRenderer and VersionPickerRenderer ready for registry dispatch
- UserPickerRenderer awaits Phase 22 injection of real Tauri onSearch (currently Phase 20 passes mock in tests)

---
*Phase: 20-renderer-registry-field-type-aware-controls*
*Completed: 2026-04-28*
