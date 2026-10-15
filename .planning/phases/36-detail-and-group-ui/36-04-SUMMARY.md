---
phase: 36-detail-and-group-ui
plan: 04
subsystem: ui
tags: [react, triage, detail-panel, focus-management]
requires: [36-01, 36-02]
provides:
  - TicketDetailPanel wired to useTriageDetailActions and RememberedLinkHint
affects: [tickets detail panel]
key-files:
  modified:
    - src/features/tickets/TicketDetailPanel.tsx
    - src/features/tickets/TicketDetailPanel.test.tsx
requirements-completed: [RTRI-01, RTRI-04, RLNK-03]
duration: ~10min
completed: 2026-10-15
---

# Phase 36 Plan 04: Detail Panel Deny / Restore Link Summary

Detail panel now uses the shared triage hook: labelled Deny for Linked tickets, "Restore link to KEY" (or Copy) primary plus Restore for Denied tickets, a visible "Previously linked to KEY" hint, and post-action focus with the close button as fallback.

## Tasks
1. Wire panel to hook, Deny, Restore link, Restore, hint, tests - commit 15560c0
2. Regression run (`vitest src/features/tickets src/i18n`: 671 passed; biome: 0 errors, only pre-existing warnings) - no code changes

## Deviations from Plan
None. Plan executed as written. Panel keeps raw Tailwind buttons; the load-time close-button focus effect is unchanged. The worktree base was reset to d8d4087 at startup per the branch check.

## Follow-ups
- Locale keys `detail.ignored` / `detail.ignored.tooltip` are now unreferenced in the panel; removal deferred (locale files owned by Plan 01).

## Known Stubs
None.

## Self-Check: PASSED
