---
phase: 06-triage-and-audit
plan: 01
subsystem: ui
tags: [tauri, react, zustand, sqlite, audit, triage]

# Dependency graph
requires:
  - phase: 05-copy-attachments-and-comments
    provides: "TriageEntry types, ticketStore with triageMap and selectTicket"
provides:
  - "get_audit_count Tauri command returning i64 from SQLite audit.db"
  - "AuditEntry TypeScript interface in types.ts"
  - "AppShell with Tickets/Ignored nav tabs and footer API call count"
  - "App.tsx multi-view routing: tickets, ignored, settings, audit log"
  - "TicketListPage filtering candidateTickets excluding ignored state"
  - "Detail panel auto-close when selected ticket becomes ignored"
  - "IgnoredTicketsPage and AuditLogPage placeholder components"
affects: [06-02, 06-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional nav rendering: AppShell renders nav/footer only when callbacks provided (onTabChange, onAuditClick)"
    - "Derived filtered list: candidateTickets = tickets.filter(state !== ignored)"
    - "useEffect auto-close: watch triageMap for state changes that affect selectedTicketKey"

key-files:
  created:
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/features/tickets/AuditLogPage.tsx
  modified:
    - src-tauri/src/commands.rs
    - src-tauri/src/main.rs
    - src/features/tickets/types.ts
    - src/components/ui/AppShell.tsx
    - src/App.tsx
    - src/features/tickets/TicketListPage.tsx

key-decisions:
  - "AppShell nav/footer gated on callbacks (onTabChange, onAuditClick) — backward-compatible: wizard and settings views don't pass these and render without tabs"
  - "IgnoredTicketsPage and AuditLogPage created as placeholders — Plan 02 and 03 will implement full content"
  - "height calc updated to 113px (49 header + 36 nav + 28 footer) to prevent layout overflow"

patterns-established:
  - "Conditional AppShell features: pass optional callbacks to enable nav tabs and footer without breaking existing views"
  - "Candidate ticket filtering at TicketListPage level, not in ticketStore — keeps store state intact for ignored list"

requirements-completed: [TRIA-01]

# Metrics
duration: 10min
completed: 2026-03-23
---

# Phase 6 Plan 01: Triage and Audit Infrastructure Summary

**Phase 6 navigation skeleton: AppShell Tickets/Ignored tabs + API call footer, App.tsx multi-view routing, and TicketListPage ignore filter with auto-closing detail panel**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-23T00:40:31Z
- **Completed:** 2026-03-23T00:50:00Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Added `get_audit_count` Tauri command to query SQLite audit row count, registered in invoke_handler
- Added `AuditEntry` TypeScript interface with camelCase fields matching Tauri's serde serialization
- AppShell now renders Tickets/Ignored nav tabs and a footer status bar showing API call count (both gated on optional callbacks for backward compatibility)
- App.tsx now manages `currentTab`, `showAuditLog`, and `auditCount` state, routing between all Phase 6 views
- TicketListPage filters `candidateTickets` excluding ignored tickets and auto-closes the detail panel when the selected ticket gets ignored

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend get_audit_count command + AuditEntry TS type** - `dce2b0f` (feat)
2. **Task 2: AppShell nav tabs + footer, App.tsx routing, TicketListPage ignore filter** - `caea962` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src-tauri/src/commands.rs` - Added `get_audit_count` command using `db.count()`
- `src-tauri/src/main.rs` - Registered `get_audit_count` in invoke_handler
- `src/features/tickets/types.ts` - Added `AuditEntry` interface (Phase 6 audit types)
- `src/components/ui/AppShell.tsx` - Added nav tabs, footer status bar, extended AppShellProps
- `src/App.tsx` - Added currentTab/showAuditLog/auditCount state, get_audit_count invoke, multi-view routing
- `src/features/tickets/TicketListPage.tsx` - Added candidateTickets filter, auto-close effect, updated height calc
- `src/features/tickets/IgnoredTicketsPage.tsx` - Created placeholder (Plan 02 will implement)
- `src/features/tickets/AuditLogPage.tsx` - Created placeholder (Plan 03 will implement)

## Decisions Made
- AppShell nav and footer gated on optional callbacks (`onTabChange`, `onAuditClick`) — wizard and settings views don't pass these, so they continue rendering without nav tabs unchanged
- Placeholder pages created for IgnoredTicketsPage and AuditLogPage so App.tsx compiles; full implementation deferred to Plans 02 and 03
- Height calculation updated from `calc(100vh-49px)` to `calc(100vh-113px)` to account for nav bar (36px) and footer (28px)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

- `src/features/tickets/IgnoredTicketsPage.tsx` — Placeholder rendering "Ignored tickets placeholder". Will be replaced in Plan 02.
- `src/features/tickets/AuditLogPage.tsx` — Placeholder rendering "Close audit log placeholder" button. Will be replaced in Plan 03.

These stubs are intentional scaffolding; they prevent the plan's goal (navigation skeleton) from being unachievable. Plans 02 and 03 are the designated implementation plans.

## Next Phase Readiness
- Plan 02 (ignored list view) can now import IgnoredTicketsPage and implement it — App.tsx routing is already wired
- Plan 03 (audit log viewer) can now import AuditLogPage and implement it — App.tsx routing is already wired
- AppShell nav tab active state wiring is complete; tab switching works
- get_audit_count is available for refreshing after audit log interactions

---
*Phase: 06-triage-and-audit*
*Completed: 2026-03-23*
