---
phase: 03-ticket-fetch-and-review
plan: 02
subsystem: data-layer
tags: [typescript, zustand, jira-api, state-management]

# Dependency graph
requires:
  - phase: 02-connection-setup
    provides: Zustand store pattern (useConnectionStore), TypeScript type conventions
provides:
  - JiraTicket, JiraTicketDetail, FetchConfig, TriageState types for all ticket UI components
  - useTicketStore Zustand store for ticket list, triage, fetch status, and config state
affects: [03-03, 03-04, 03-05, 04-ticket-copy]

# Tech tracking
tech-stack:
  added: []
  patterns: [ticket-type-hierarchy, dual-api-union-types, triage-state-machine, newCount-derived-state]

key-files:
  created:
    - src/features/tickets/types.ts
    - src/features/tickets/ticketStore.ts
  modified: []

key-decisions:
  - "Dual API body types: string|Record<string,unknown> for v2/v3 description and comment bodies"
  - "JiraTicket (list) vs JiraTicketDetail (full) separation for fetch efficiency"
  - "newCount derived on every triageMap mutation for badge display"

patterns-established:
  - "Ticket type hierarchy: lightweight JiraTicket for lists, full JiraTicketDetail for detail panel"
  - "Triage state flow: new -> seen -> ignored|copied via store actions"
  - "Hydration pattern: hydrateFetchConfig/hydrateTriageMap for SQLite -> store sync"

requirements-completed: [FETCH-01, FETCH-02, FETCH-03, FETCH-11, FETCH-12]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 3 Plan 02: Ticket Types & Store Summary

**TypeScript types for all Jira ticket shapes (list + detail) and Zustand store with triage state machine and fetch config management**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T16:27:07Z
- **Completed:** 2026-03-22T16:29:07Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Defined complete TypeScript type system for Jira ticket data covering both Server v2 and Cloud v3 API shapes
- Created Zustand ticket store with ticket list, triage map, fetch status, selected ticket, and fetch config state
- Established hydration pattern for SQLite-to-store sync (hydrateTriageMap, hydrateFetchConfig)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TypeScript types for ticket data** - `890d2f2` (feat)
2. **Task 2: Create Zustand ticket store** - `e4d8f68` (feat)

## Files Created/Modified
- `src/features/tickets/types.ts` - All Jira data types: JiraTicket, JiraTicketDetail, FetchConfig, TriageState, JiraUser, JiraComment, JiraAttachment, JiraWorklog, ChangelogEntry, and supporting interfaces
- `src/features/tickets/ticketStore.ts` - Zustand store with ticket list, triage map, fetch status/error, selected key, JQL config, and all mutation actions

## Decisions Made
- Dual API body types: `string | Record<string, unknown>` for description/comment body fields to support both Jira Server v2 (wiki markup strings) and Cloud v3 (ADF objects)
- Separated JiraTicket (lightweight, list view) from JiraTicketDetail (full fields) for fetch efficiency
- newCount is derived on every triageMap mutation rather than stored independently, ensuring consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Types and store are ready for Plans 03-05 to build UI components against
- TicketListPage, TicketDetailPanel, and FetchConfigSection can import from these modules
- Tauri command integration (Plan 03) will use FetchTicketsResult type for fetch_tickets response

---
*Phase: 03-ticket-fetch-and-review*
*Completed: 2026-03-22*
