---
phase: 35-shared-triage-actions
plan: 02
subsystem: tickets/triage
tags: [triage, refactor, tests]
requires: [denyTicket, restoreTicket, markHandled]
provides: [single-writer triage call sites]
affects: [TicketDetailPage, TicketDetailPanel]
key-files:
  modified:
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/TicketDetailPanel.tsx
    - src/features/tickets/__tests__/TicketDetailPage.test.tsx
    - src/features/tickets/TicketDetailPanel.test.tsx
decisions:
  - Handler names and JSX bindings unchanged; only bodies delegate to triageActions
metrics:
  tasks: 2
  completed: 2026-10-15
requirements: [LINT-01, RTRI-02]
---

# Phase 35 Plan 02: Migrate Detail Views to Shared Triage Module Summary

TicketDetailPage and TicketDetailPanel now delegate Dismiss, Restore, Mark as Handled and Unhandle to the shared triageActions module, so the remembered Cloud key survives every detail-view transition and Dismiss makes no Jira call.

## What was built
- Replaced eight inline handlers (invoke plus hydrateTriageMap with `copiedKey: null`) with `void denyTicket/restoreTicket/markHandled(issueKey)`.
- Six new component tests (3 per file, real module, no mocking of triageActions): Dismiss -> `{ignored, CLD-9}` with only `set_triage_state` and no `relink_ticket`/`copy_*`; Mark as Handled -> `{handled, CLD-9}`; restore from Ignored -> `{seen, CLD-9}`.
- Static gates pass: zero `copiedKey: null` in production code outside types.ts; `set_triage_state` appears only in triageActions.ts and TicketListPage.tsx.
- Full suite 1670 passing; lint has only pre-existing warnings.

## Deviations from Plan
None in code. Task 2 was committed as a separate test commit after the Task 1 migration (tests pass against the migrated code, so no failing-RED commit was needed).

## Commits
- 54b1a78: feat(35-02): route detail triage handlers through shared module
- c90d937: test(35-02): detail triage handlers preserve remembered key

## Deferred
- TicketListPage `handleSelectTicket` persists 'seen' unconditionally via `set_triage_state` (research Pitfall 4 / A2); out of scope for Phase 35.

## Known Stubs
None.

## Self-Check: PASSED
