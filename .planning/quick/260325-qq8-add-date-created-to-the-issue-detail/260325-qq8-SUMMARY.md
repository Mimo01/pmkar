---
phase: quick-260325-qq8
plan: "01"
subsystem: tickets/detail
tags: [ui, i18n, ticket-detail, dates]
dependency_graph:
  requires: []
  provides: [created-date-in-detail-header]
  affects: [TicketDetailPage]
tech_stack:
  added: []
  patterns: [formatDate utility, conditional rendering]
key_files:
  created: []
  modified:
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/types.ts
decisions:
  - "created field added as optional to JiraTicketDetail.fields type — Rust backend may or may not include it; optional guards against missing data gracefully"
  - "tickets.card.created i18n key already existed with {{time}} parameter (added by 260325-kxt); reused existing key"
metrics:
  duration: "4 min"
  completed: "2026-03-25"
  tasks_completed: 1
  files_modified: 2
---

# Quick Task 260325-qq8: Add Created Date to Issue Detail Header Summary

**One-liner:** Added "Created {date} · Updated {relative time}" line to issue detail header using formatDate utility and existing i18n keys.

## What Was Done

The issue detail page header previously only showed "Updated X ago". This task added the creation date so users can see when an issue was originally created at a glance.

The header now displays: `Created 25 March 2026 · Updated 2 days ago`

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add created date to issue detail header | 8565605 | TicketDetailPage.tsx, types.ts |

## Changes Made

### src/features/tickets/TicketDetailPage.tsx
- Added `formatDate` to the import from `../../lib/format`
- Updated the header `<p>` tag to conditionally show created date before the updated time, separated by a centered dot
- Guarded on `detail.fields.created` being defined (optional field)

### src/features/tickets/types.ts
- Added `created?: string; // ISO 8601` to `JiraTicketDetail.fields` interface (it was already present on `JiraTicket.fields` but missing from the detail type)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added missing `created` field to JiraTicketDetail.fields type**
- **Found during:** Task 1 — TypeScript compilation failed
- **Issue:** `JiraTicketDetail.fields` did not declare `created`, causing TS2339 error. The field was present on `JiraTicket.fields` (list view) but omitted from the detail type.
- **Fix:** Added `created?: string; // ISO 8601` to `JiraTicketDetail.fields` interface; used optional rendering in the component to handle absence gracefully.
- **Files modified:** src/features/tickets/types.ts
- **Commit:** 8565605

**2. [Rule 2 - Note] i18n keys already existed**
- The plan specified adding `tickets.card.created` to both en.json and sk.json. These keys were already present (added by quick task 260325-kxt). The existing keys use `{{time}}` as the interpolation variable. The component was implemented to match the existing key shape.

## Known Stubs

None.

## Self-Check: PASSED
