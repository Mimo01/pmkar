---
phase: 22-copy-preview-override-panel
plan: "01"
subsystem: ui
tags: [zustand, copy-store, override-state, schema-cache, issue-type, phase-22]

requires:
  - phase: 17-field-discovery-mock-schema-fidelity
    provides: schemaCacheStore with preWarm, loadSchema, prewarmedIssueTypes, cache
  - phase: 22-copy-preview-override-panel
    provides: 22-CONTEXT.md with D-11/D-12/D-13 decisions

provides:
  - copyStore extended with targetIssueTypeId, overrideValues, resolvedTargetFields state
  - setTargetIssueTypeId async action (loads schema + refreshes resolvedTargetFields)
  - setOverrideValue, clearOverrides, setResolvedTargetFields actions
  - startPreview pre-warm + default issue-type selection (case-insensitive name match)
  - reset() clears override state (OVRD-06 enforced via initialState)
  - issuetype optional field added to JiraTicketDetail for source name access

affects:
  - 22-02 (IssueTypeChooser reads targetIssueTypeId, setTargetIssueTypeId from copyStore)
  - 22-03 (GapsSection reads resolvedTargetFields, setOverrideValue)
  - 22-04 (CopyPreviewPage integration reads full override state)

tech-stack:
  added: []
  patterns:
    - "setTargetIssueTypeId is async — awaits loadSchema before refreshing resolvedTargetFields, keeping the two fields in sync"
    - "Pre-warm block inside startPreview is in its own try/catch for graceful degradation (D-04)"
    - "initialState pattern: Phase 22 zero-values in const initialState ensure reset() clears all override fields automatically"

key-files:
  created: []
  modified:
    - src/features/tickets/copyStore.ts
    - src/features/tickets/types.ts
    - src/features/tickets/__tests__/copyStore.test.ts

key-decisions:
  - "setTargetIssueTypeId is async because it must await loadSchema before setting resolvedTargetFields — callers always get a consistent (id, fields) pair after the promise resolves"
  - "issuetype added as optional field to JiraTicketDetail.fields (not in types.ts before) — required to access source issue type name for case-insensitive default selection (D-05)"
  - "Pre-warm block uses its own inner try/catch so fetch_cloud_meta failures still surface correctly; schema pre-warm failures are logged but do not block preview UX (D-04)"
  - "schemaCacheStore mock placed at file scope in test file so all describe blocks share it — existing tests not broken because mock returns shape compatible with prior usage (targetProjectKey: 'PROJ')"

patterns-established:
  - "Phase 22 override fields pattern: state + initialState entry + action in same copyStore.ts extending existing Zustand store"
  - "TDD in test file: vi.mock at file top before import so hoisting works correctly"

requirements-completed: [OVRD-01, OVRD-02, OVRD-03, OVRD-06]

duration: 14min
completed: 2026-04-28
---

# Phase 22 Plan 01: copyStore Override + Issue-Type State Summary

**Zustand copyStore extended with D-11 override state contract (targetIssueTypeId, overrideValues, resolvedTargetFields), schema-reactive setTargetIssueTypeId, and startPreview pre-warm + case-insensitive default selection — 33 tests all passing**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-28T11:44:49Z
- **Completed:** 2026-04-28T11:58:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extended `CopyState` interface with three Phase 22 fields and four new actions (D-11)
- `setTargetIssueTypeId` is async — awaits `loadSchema` then refreshes `resolvedTargetFields` atomically (OVRD-02)
- `startPreview` now pre-warms target issue types via `schemaCacheStore.preWarm`, picks default by case-insensitive name match against source issue type, and loads target schema for the default type (D-04, D-05)
- `reset()` automatically clears all override fields because `initialState` includes them (OVRD-06)
- Added `issuetype?: { id?: string; name: string }` to `JiraTicketDetail.fields` to support source type name access
- 10 new test cases in `copyStore.test.ts` covering all new behaviors; all 33 tests (23 existing + 10 new) pass

## Task Commits

1. **Task 1: Extend copyStore with override state, schema-aware setTargetIssueTypeId, and clearOverrides** - `e13f4ad` (feat)
2. **Task 2: Add copyStore tests covering override state, setTargetIssueTypeId, and startPreview default-selection** - `a5d5e72` (test)

## Files Created/Modified

- `src/features/tickets/copyStore.ts` — Extended CopyState interface, initialState, startPreview, new actions
- `src/features/tickets/types.ts` — Added `issuetype?: { id?: string; name: string }` to `JiraTicketDetail.fields`
- `src/features/tickets/__tests__/copyStore.test.ts` — Added schemaCacheStore + connectionStore mocks, Phase 22 describe block with 10 tests

## New CopyState Fields and Actions (TypeScript signatures)

```typescript
// Fields (D-11)
targetIssueTypeId: string | null;
overrideValues: Record<string, unknown>;
resolvedTargetFields: FieldSchema[];

// Actions (D-11)
setTargetIssueTypeId: (id: string) => Promise<void>;  // async: awaits loadSchema
setResolvedTargetFields: (fields: FieldSchema[]) => void;
setOverrideValue: (fieldId: string, v: unknown) => void;
clearOverrides: () => void;
```

## Rationale for Async `setTargetIssueTypeId`

`setTargetIssueTypeId` must be async because it orchestrates two sequential side effects:
1. Call `schemaCacheStore.loadSchema('target', projectKey, id)` to populate the cache
2. Read back `cache[schemaCacheKey('target', projectKey, id)]?.fields` and store in `resolvedTargetFields`

If it were synchronous, the `resolvedTargetFields` read would race the pending `loadSchema` promise, producing stale or empty fields. Making it `Promise<void>` ensures `targetIssueTypeId` and `resolvedTargetFields` are always consistent when the promise resolves — downstream consumers (IssueTypeChooser, GapsSection) can safely depend on both fields being in sync.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `issuetype` field to `JiraTicketDetail.fields`**
- **Found during:** Task 1 (implementing `startPreview` pre-warm block)
- **Issue:** `ticket.fields.issuetype` is accessed in the plan's code block for case-insensitive name matching, but `issuetype` was not present in `JiraTicketDetail.fields` in `src/features/tickets/types.ts`. Without it, TypeScript would error and the source type name could not be retrieved.
- **Fix:** Added `issuetype?: { id?: string; name: string }` to `JiraTicketDetail.fields` as an optional field, exactly as specified in the plan's NOTE on step 4.
- **Files modified:** `src/features/tickets/types.ts`
- **Verification:** `npx tsc --noEmit` exits 0 (only pre-existing unrelated error remains)
- **Committed in:** e13f4ad (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The plan's NOTE anticipated this — the fix follows the plan's explicit instruction to add the optional field if missing. No scope creep.

## Issues Encountered

- Pre-existing TypeScript error in `src/features/connections/__tests__/connectionStore.probe.test.ts` (`afterEach` imported but not used) — confirmed pre-existing via `git stash` verification, not caused by our changes, out of scope.

## Test Counts

- **Total tests in copyStore.test.ts:** 33 (23 pre-existing + 10 new Phase 22 tests)
- **All tests pass:** Yes

## Known Stubs

None — all new state fields and actions are fully implemented with real logic. No placeholder values, no TODO comments.

## Next Phase Readiness

- Phase 22 Plan 02 (IssueTypeChooser) can now read `targetIssueTypeId` and call `setTargetIssueTypeId` from `useCopyStore`
- Phase 22 Plan 03 (GapsSection) can now read `resolvedTargetFields` and call `setOverrideValue`/`clearOverrides`
- Phase 22 Plan 04 (CopyPreviewPage integration) has a stable store contract to wire against
- D-12 honored: `confirmCopy` still calls `copy_ticket` with existing payload — Phase 23 owns the cutover
- D-13 honored: legacy fields (`targetStatus`, `targetPriorityId`, `targetLabels`, etc.) untouched

---
*Phase: 22-copy-preview-override-panel*
*Completed: 2026-04-28*
