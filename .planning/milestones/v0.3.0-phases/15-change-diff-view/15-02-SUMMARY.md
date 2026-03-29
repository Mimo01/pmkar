---
phase: 15-change-diff-view
plan: 02
subsystem: frontend
tags: [react, zustand, tauri, i18n, change-tracking, diff-view]

# Dependency graph
requires:
  - phase: 15-change-diff-view
    plan: 01
    provides: get_unseen_change_keys, get_ticket_changes, mark_changes_seen Tauri commands
provides:
  - ChangesTab component with field-level diff table (loading/error/empty/data states)
  - unseenChanges Zustand slice with hydrateUnseenChanges/setUnseenChange/clearUnseenChange
  - Blue dot indicator on TicketCard with Tooltip
  - Changes tab (6th) in TicketDetailPanel with Badge and auto-switch
  - TicketListPage hydrates unseen state on mount via get_unseen_change_keys
  - Full i18n coverage in en.json and sk.json
affects: [visual change tracking UX, CHNG-01, CHNG-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - HistoryTab pattern cloned for ChangesTab (useState null → useEffect fetch → states)
    - LONG_TEXT_FIELDS Set guard for description diff suppression (D-09)
    - getState() inside useEffect to read unseenChanges without adding to dep array (D-06)
    - Mark-as-read after data fetch, not before — avoids race condition (D-10)

key-files:
  created:
    - src/features/tickets/tabs/ChangesTab.tsx
  modified:
    - src/features/tickets/ticketStore.ts
    - src/features/tickets/TicketCard.tsx
    - src/features/tickets/TicketDetailPanel.tsx
    - src/features/tickets/TicketListPage.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json

key-decisions:
  - "getState() used inside useEffect to read unseenChanges — avoids adding it to the dependency array so auto-switch fires only on ticket open (D-06)"
  - "mark_changes_seen called after data fetch, not before — prevents showing empty state if Tauri command fails (D-10)"
  - "LONG_TEXT_FIELDS Set guards description field — shows 'Description changed' text instead of potentially large inline diff (D-09)"
  - "setUnseenChange not called in poll-complete listener — no poll-complete Tauri event exists yet in frontend; hydration-on-mount is the current integration point"

requirements-completed: [CHNG-01, CHNG-02]

# Metrics
duration: 10min
completed: 2026-03-29
---

# Phase 15 Plan 02: Change Diff View — Frontend Summary

**Frontend change tracking UI: blue dot on TicketCard, ChangesTab diff table, auto-switch behavior, Zustand unseenChanges slice, and full i18n coverage in EN/SK**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-29T00:44:00Z
- **Completed:** 2026-03-29T00:46:00Z
- **Tasks:** 2 (+ checkpoint task 3 pending human verification)
- **Files modified:** 6, created: 1

## Accomplishments

- Added `unseenChanges: Record<string, string[]>` slice to ticketStore with three actions: `hydrateUnseenChanges`, `setUnseenChange`, `clearUnseenChange`
- Created `ChangesTab.tsx` following the HistoryTab pattern exactly — null → loading → error/empty/data states with field-level diff table
- LONG_TEXT_FIELDS Set guards description field to show "Description changed" instead of inline diff (D-09)
- Mark-as-read (`mark_changes_seen` + `clearUnseenChange`) happens after data fetch to avoid empty-state race (D-10)
- TicketCard now renders a blue dot (`bg-blue-500 dark:bg-blue-400`) with Tooltip for tickets with unseen changes
- TicketDetailPanel has 6th Changes tab with Badge showing count, auto-switches to Changes tab on open when unseen changes exist
- TicketListPage mounts hydrate via `get_unseen_change_keys` added to existing Promise.all
- All i18n keys added to en.json and sk.json (detail.tab.changes, detail.changes.*, tickets.card.unseenChanges, tickets.card.changeTooltip)

## Task Commits

1. **Task 1: Add unseenChanges store slice, ChangesTab component, and i18n keys** - `f418390` (feat)
2. **Task 2: Wire TicketCard dot, TicketDetailPanel Changes tab, and TicketListPage hydration** - `a48496d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/features/tickets/tabs/ChangesTab.tsx` - NEW: field-level diff table component with LONG_TEXT_FIELDS guard and mark-as-read lifecycle
- `src/features/tickets/ticketStore.ts` - Added unseenChanges slice with 3 new actions after hydrateFetchConfig
- `src/features/tickets/TicketCard.tsx` - Added blue dot indicator with TooltipProvider/Tooltip/TooltipContent, useTicketStore selector
- `src/features/tickets/TicketDetailPanel.tsx` - Added Changes tab (6th), Badge, auto-switch useEffect, TabId widened, ChangesTab rendered
- `src/features/tickets/TicketListPage.tsx` - Added get_unseen_change_keys to mount Promise.all hydration
- `src/i18n/locales/en.json` - Added 8 new keys: detail.tab.changes*, detail.changes.*, tickets.card.unseenChanges, tickets.card.changeTooltip
- `src/i18n/locales/sk.json` - Added 8 corresponding Slovak translations

## Decisions Made

- `getState()` used inside useEffect to read unseenChanges without adding to dep array — ensures auto-switch fires only on ticket open, not on subsequent store updates (D-06)
- `mark_changes_seen` called after data arrives, not before — avoids showing empty state if the Tauri command fails mid-way (D-10)
- LONG_TEXT_FIELDS Set contains only `description` — avoids showing potentially megabyte-scale old/new values inline (D-09)
- No poll-complete listener added — no Tauri poll-complete event is emitted to the frontend yet; hydration via `get_unseen_change_keys` on mount covers the D-11 persistence requirement (SQLite survives restart)

## Deviations from Plan

### Deviation 1: Missing poll-complete listener

**Found during:** Task 2
**Issue:** The plan's context referenced a poll-complete listener in TicketListPage (lines 150-167), but the actual file has no such listener — the feature does not exist in the codebase yet.
**Fix:** Added `get_unseen_change_keys` hydration to the existing mount `Promise.all` only. Skipped the poll-complete `setUnseenChange` loop since there is no event to listen for.
**Impact:** Unseen changes from polls during the current session will not immediately show dots until the app is restarted. The SQLite persistence (D-11) ensures changes are visible on next app start. When a poll-complete Tauri event is added, the `setUnseenChange` loop can be wired in.
**Tracking:** Deferred to the plan that adds the poll-complete Tauri event emission.

## Known Stubs

None — all data flows are wired. The `unseenChanges` state hydrates from SQLite on mount via `get_unseen_change_keys`.

## Next Phase Readiness

- Frontend UI complete: dot, tooltip, Changes tab, diff table, auto-switch, mark-as-read
- Task 3 (checkpoint:human-verify) requires visual inspection via `cargo tauri dev`
- No blockers for verification.

---
*Phase: 15-change-diff-view*
*Completed: 2026-03-29*

## Self-Check: PASSED

- FOUND: src/features/tickets/tabs/ChangesTab.tsx
- FOUND: src/features/tickets/ticketStore.ts
- FOUND: src/features/tickets/TicketCard.tsx
- FOUND: src/features/tickets/TicketDetailPanel.tsx
- FOUND: src/features/tickets/TicketListPage.tsx
- FOUND: .planning/phases/15-change-diff-view/15-02-SUMMARY.md
- FOUND: f418390 (feat(15-02): add unseenChanges store slice, ChangesTab, and i18n keys)
- FOUND: a48496d (feat(15-02): wire TicketCard dot, TicketDetailPanel Changes tab, and TicketListPage hydration)
