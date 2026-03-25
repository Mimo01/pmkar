---
phase: quick-260325-kl9
plan: 01
subsystem: ui
tags: [badge, audit-log, status-codes, i18n, tailwind]

requires: []
provides:
  - Color-coded HTTP status badge rendering in AuditLogPage
  - renderStatusBadge helper with 2xx/3xx/4xx/5xx/null coverage
affects: [audit-log, AuditLogPage]

tech-stack:
  added: []
  patterns: [variant="outline" Badge with custom tinted className, matching methodColor pattern]

key-files:
  created: []
  modified:
    - src/features/tickets/AuditLogPage.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json

key-decisions:
  - "renderStatusBadge uses variant=outline Badge with custom className overrides for tinted backgrounds, matching existing methodColor badge pattern"
  - "null statusCode renders translated 'Error' text badge (not em-dash) to distinguish network failures from HTTP errors"
  - "4xx uses lighter red (bg-red-500/15 text-red-400), 5xx uses deeper red (bg-red-500/20 text-red-300) for visual severity differentiation"

requirements-completed: [QUICK-KL9]

duration: 5min
completed: 2026-03-25
---

# Quick Task 260325-kl9: Failed Logs in Audit Log Summary

**Color-coded HTTP status Badge components in audit log table: green (2xx), amber (3xx), red (4xx/5xx), and translated "Error" badge for network failures (null status)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-25T14:48:00Z
- **Completed:** 2026-03-25T14:53:00Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Replaced plain numeric status code text with styled Badge components using variant="outline" and tinted background classNames
- Added `renderStatusBadge(code, t)` helper covering all 5 cases: 2xx (emerald), 3xx (amber), 4xx (red), 5xx (deeper red), null (error badge with i18n text)
- Removed now-unused `statusColor` function
- Widened status column from w-16 to w-20 in both skeleton thead and populated table thead
- Added `audit.status.error` translation key to en.json ("Error") and sk.json ("Chyba")
- All 10 existing AuditLogPage tests pass unchanged

## Task Commits

1. **Task 1: Replace status text with styled Badge components in AuditLogPage** - `26955ea` (feat)

## Files Created/Modified

- `src/features/tickets/AuditLogPage.tsx` - Added renderStatusBadge helper, replaced status td, removed statusColor, widened status column
- `src/i18n/locales/en.json` - Added audit.status.error: "Error"
- `src/i18n/locales/sk.json` - Added audit.status.error: "Chyba"

## Decisions Made

- Used `variant="outline"` Badge with custom className overrides (same pattern as method badges) rather than custom Badge variants — avoids modifying shared badge.tsx component
- null status code shows translated "Error" string (not em-dash or numeric) — makes network failures visually distinct and clearly labeled
- 4xx (client error) uses lighter red (`text-red-400`) vs 5xx (server error) uses deeper red (`text-red-300`) for subtle severity distinction within the red family

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Audit log now clearly distinguishes failure types at a glance
- Badge pattern is consistent with methodColor approach — no new patterns introduced
- No blockers

---
*Phase: quick-260325-kl9*
*Completed: 2026-03-25*
