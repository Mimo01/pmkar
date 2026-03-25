---
phase: 04-copy-core-fields
plan: 02
subsystem: ui
tags: [typescript, zustand, tauri, testing, vitest]

requires:
  - phase: 04-copy-core-fields-01
    provides: "copyStore types and Wave 0 test scaffolds from this plan"

provides:
  - "CopyPhase, CopyStepResult, CopyTicketResult, CloudMeta, TriageEntry TypeScript types in types.ts"
  - "useCopyStore Zustand store managing idle->loading_preview->previewing->copying->result lifecycle"
  - "Wave 0 test scaffolds for CopyPreviewModal and CopyResultModal with requirement-tagged stubs"

affects: [04-copy-core-fields-03, 04-copy-core-fields-04, 04-copy-core-fields-05]

tech-stack:
  added: []
  patterns:
    - "CopyPhase state machine pattern for multi-step async workflows"
    - "Wave 0 test scaffolding — it.todo stubs tagged with requirement IDs before component exists"
    - "Unused parameter prefix convention (_sourceBaseUrl) for TypeScript strict mode"

key-files:
  created:
    - src/features/tickets/copyStore.ts
    - src/features/tickets/CopyPreviewModal.test.tsx
    - src/features/tickets/CopyResultModal.test.tsx
  modified:
    - src/features/tickets/types.ts

key-decisions:
  - "sourceBaseUrl parameter in startPreview prefixed with _ to satisfy TS strict mode — it is retained in the signature for future use but not currently consumed"
  - "Status field is informational only — Jira Cloud v3 does not support setting status during issue creation; copy_ticket command does not send it"

patterns-established:
  - "Wave 0 test scaffold pattern: create test file with it.todo stubs before the component exists, tagged with requirement IDs"
  - "CopyPhase as union type for discriminated state machine transitions"

requirements-completed: [COPY-01, COPY-08]

duration: 12min
completed: 2026-03-22
---

# Phase 4 Plan 02: Copy Types and Store Summary

**Zustand copyStore with 5-phase state machine (idle->loading_preview->previewing->copying->result) using Tauri invoke for fetch_cloud_meta and copy_ticket, plus Wave 0 test scaffolds for CopyPreviewModal and CopyResultModal**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-22T20:32:00Z
- **Completed:** 2026-03-22T20:44:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended `types.ts` with 5 copy pipeline types: CopyPhase, CopyStepResult, CopyTicketResult, CloudMeta, TriageEntry
- Created `copyStore.ts` implementing full copy lifecycle state machine with startPreview, confirmCopy, toggleLabel, setTargetStatus, setTargetPriorityId, and reset actions
- Created Wave 0 test scaffolds for CopyPreviewModal (9 stubs) and CopyResultModal (6 stubs), all tagged with requirement IDs

## Task Commits

Each task was committed atomically:

1. **Task 1: Add copy-related types to types.ts and create copyStore.ts** - `881ec7e` (feat)
2. **Task 2: Create Wave 0 test scaffolds for CopyPreviewModal and CopyResultModal** - `5689a6c` (test)

## Files Created/Modified

- `src/features/tickets/types.ts` - Appended CopyPhase, CopyStepResult, CopyTicketResult, CloudMeta, TriageEntry types
- `src/features/tickets/copyStore.ts` - New Zustand store managing copy state machine with Tauri invoke integration
- `src/features/tickets/CopyPreviewModal.test.tsx` - Wave 0 scaffold with 9 requirement-tagged it.todo stubs
- `src/features/tickets/CopyResultModal.test.tsx` - Wave 0 scaffold with 6 requirement-tagged it.todo stubs

## Decisions Made

- Status field is informational only in the copy preview — Jira Cloud v3 does not support setting status at issue creation time; the copy_ticket command will not send status to the API
- `sourceBaseUrl` parameter in `startPreview` prefixed with `_` to satisfy TypeScript strict mode; retained in signature for API consistency with `confirmCopy`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unused parameter causing TypeScript error**
- **Found during:** Task 1 (copyStore.ts creation)
- **Issue:** `sourceBaseUrl` in `startPreview` was declared in the interface but not consumed in the function body (only `cloudBaseUrl` is needed to call `fetch_cloud_meta`), causing TS6133 error
- **Fix:** Prefixed with `_` (`_sourceBaseUrl`) — parameter retained in signature as the public API expects it for symmetry with `confirmCopy`
- **Files modified:** src/features/tickets/copyStore.ts
- **Verification:** `npx tsc --noEmit` shows no errors in copyStore.ts
- **Committed in:** `881ec7e` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug/TypeScript error)
**Impact on plan:** Minor fix for TypeScript strict mode compliance. No scope creep.

## Issues Encountered

None — plan executed cleanly. Pre-existing TypeScript errors in `SettingsPage.tsx` and `test-setup.ts` are out of scope for this plan.

## User Setup Required

None - no external service configuration required.

## Known Stubs

- `CopyPreviewModal.test.tsx`: All 9 test cases are `it.todo` — the component (`CopyPreviewModal`) does not yet exist. These will be implemented in Plan 04.
- `CopyResultModal.test.tsx`: All 6 test cases are `it.todo` — the component (`CopyResultModal`) does not yet exist. These will be implemented in Plan 05.

These stubs are intentional Wave 0 scaffolds. Plans 04 and 05 will wire the implementations.

## Next Phase Readiness

- All copy pipeline types are importable from `types.ts`
- `useCopyStore` is ready for use in Plans 03-05
- Wave 0 test targets exist for Plans 04 and 05 to implement
- No blockers for downstream plans

---
*Phase: 04-copy-core-fields*
*Completed: 2026-03-22*
