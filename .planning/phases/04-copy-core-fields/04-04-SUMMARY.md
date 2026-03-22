---
phase: 04-copy-core-fields
plan: "04"
subsystem: ui
tags: [react, zustand, tauri, vitest, testing-library]

requires:
  - phase: 04-copy-core-fields
    plan: "02"
    provides: "copyStore (useCopyStore) with CopyPhase, CloudMeta, startPreview, confirmCopy, reset actions"
  - phase: 04-copy-core-fields
    plan: "03"
    provides: "CopyResultModal and result handling flow"

provides:
  - "CopyPreviewModal: full-screen side-by-side preview with editable status/priority/label fields"
  - "Copy to Company Jira button in TicketDetailPanel header with spinner state"
  - "TriageIndicator copiedKey badge — clickable link to target Jira key"
  - "TicketTable updated to pass copiedKey and cloudBaseUrl to TriageIndicator"
  - "11 CopyPreviewModal tests covering all COPY-01/COPY-08/COPY-09 acceptance criteria"

affects: [04-copy-core-fields, future-phases]

tech-stack:
  added: []
  patterns:
    - "Zustand store selector pattern — each useCopyStore call selects one field to minimize re-renders"
    - "Modal rendered inside component tree (TicketDetailPanel) but uses fixed positioning to overlay full screen"
    - "TriageEntry union type helper — getTriageState/getTriageCopiedKey functions handle backward compat with string triage maps"
    - "Test mock pattern — mutable currentStoreState variable changed per-test for store state overrides"

key-files:
  created:
    - src/features/tickets/CopyPreviewModal.tsx
    - (updated) src/features/tickets/CopyPreviewModal.test.tsx
  modified:
    - src/features/tickets/TicketDetailPanel.tsx
    - src/features/tickets/TriageIndicator.tsx
    - src/features/tickets/TicketTable.tsx

key-decisions:
  - "CopyPreviewModal renders null when phase is not previewing/copying — clean unmount rather than CSS hide"
  - "TriageIndicator accepts both Record<string,TriageState> and Record<string,TriageEntry> via helper functions for backward compatibility"
  - "Copy button placed in TicketDetailPanel header row alongside close button using flex justify-between"

patterns-established:
  - "Modal-inside-component: CopyPreviewModal lives inside TicketDetailPanel return but uses fixed inset-0 to overlay"
  - "Store state via per-selector hooks: each store field fetched with separate useCopyStore((s) => s.field) call"

requirements-completed: [COPY-01, COPY-08, COPY-09]

duration: 15min
completed: 2026-03-22
---

# Phase 04 Plan 04: Copy Preview Modal Summary

**Full-screen CopyPreviewModal with side-by-side source/target layout, editable status/priority/label fields, Copy button in TicketDetailPanel header, and TriageIndicator copiedKey badge with 11 passing tests**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-22T19:45:00Z
- **Completed:** 2026-03-22T20:01:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created CopyPreviewModal with two-column layout — source (read-only) on left, target (editable) on right
- Added "Copy to Company Jira" button to TicketDetailPanel header; spins during loading_preview phase
- Extended TriageIndicator to show clickable copied key badge linking to the target Jira issue
- Implemented 11 test cases covering source field rendering, target dropdowns, label checkboxes, Discard/Confirm actions, and status note

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CopyPreviewModal and add Copy button to TicketDetailPanel** - `c45f3c3` (feat)
2. **Task 2: Extend TriageIndicator with copied key badge and implement preview test stubs** - `5fb750a` (feat)

## Files Created/Modified

- `src/features/tickets/CopyPreviewModal.tsx` — Full-screen side-by-side copy preview modal (new)
- `src/features/tickets/CopyPreviewModal.test.tsx` — 11 tests covering all acceptance criteria (updated from stubs)
- `src/features/tickets/TicketDetailPanel.tsx` — Added Copy button, copyStore/connectionStore imports, CopyPreviewModal render
- `src/features/tickets/TriageIndicator.tsx` — Added copiedKey/cloudBaseUrl props, clickable badge in copied state
- `src/features/tickets/TicketTable.tsx` — Added getTriageState/getTriageCopiedKey helpers, pass copiedKey to TriageIndicator

## Decisions Made

- CopyPreviewModal renders `null` when `phase` is not `previewing` or `copying` — avoids keeping DOM elements mounted when not needed
- TicketTable accepts both `Record<string, TriageState>` and `Record<string, TriageEntry>` via helper functions rather than forcing an immediate migration of ticketStore types
- DescriptionRenderer is reused on both source left column and target right column (per D-05 spec) — same rendered HTML for both sides

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] TriageIndicator backward compatibility helper functions**
- **Found during:** Task 2 (updating TicketTable)
- **Issue:** ticketStore.ts uses `Record<string, TriageState>` (string) but plan called for passing `copiedKey` from `TriageEntry`. Changing ticketStore type would require updating all callers.
- **Fix:** Added `getTriageState` and `getTriageCopiedKey` helper functions in TicketTable that handle both string values and TriageEntry objects, preserving backward compatibility.
- **Files modified:** src/features/tickets/TicketTable.tsx
- **Verification:** TypeScript compiles cleanly, tests pass
- **Committed in:** 5fb750a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - backward compat type handling)
**Impact on plan:** Necessary to avoid breaking existing callers. No scope creep.

## Issues Encountered

- Test mock pattern: `vi.mocked(useCopyStore).mockImplementation` fails because the mock is a regular function, not a vi.fn. Solved by using a mutable `currentStoreState` variable that the mock closure reads, modified per-test in beforeEach.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CopyPreviewModal UI complete and tested — ready for Plan 05 (copy result handling and triage actions)
- TriageIndicator copiedKey badge wired — needs ticketStore to hydrate TriageEntry (with copiedKey) from backend in a future plan
- All Wave 3 UI components built; copy workflow UI is fully functional

---
*Phase: 04-copy-core-fields*
*Completed: 2026-03-22*
