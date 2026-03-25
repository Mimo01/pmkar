---
phase: quick
plan: 260325-sxj
subsystem: tickets
tags: [ux, triage, dismissed, copy-button]
dependency_graph:
  requires: []
  provides: [dismissed-ticket-no-copy-button]
  affects: [TicketDetailPage, TicketDetailPanel]
tech_stack:
  added: []
  patterns: [isIgnored state guard on render]
key_files:
  created: []
  modified:
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/TicketDetailPanel.tsx
decisions:
  - No new state needed — isIgnored already derived from triageEntry?.state === 'ignored' in both files
metrics:
  duration: 3 min
  completed: "2026-03-25"
---

# Quick 260325-sxj: Hide Copy Button on Dismissed Tickets Summary

**One-liner:** Added `!isIgnored` guard to copy button render conditions in both ticket detail views so dismissed tickets no longer offer the copy action.

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Hide copy button on dismissed tickets in both detail views | b68ed1c | TicketDetailPage.tsx, TicketDetailPanel.tsx |

## Changes Made

### TicketDetailPage.tsx
- Line 215: `{!isCopied && (` → `{!isCopied && !isIgnored && (`
- Copy Button is now hidden when the ticket is dismissed (ignored state)

### TicketDetailPanel.tsx
- Line 262: `{isCopied ? null : (` → `{isCopied || isIgnored ? null : (`
- Copy button in the side panel is also hidden when the ticket is dismissed

## Behaviour After Change

| Ticket State | Copy Button | Dismiss/Undismiss Button | Open in Jira |
|---|---|---|---|
| New / unseen | Visible | Dismiss button | Visible |
| Dismissed (ignored) | Hidden | Undismiss button | Visible |
| Copied | Hidden (linked badge shown) | Hidden | Visible |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- src/features/tickets/TicketDetailPage.tsx — modified, guard added at line 215
- src/features/tickets/TicketDetailPanel.tsx — modified, guard added at line 262
- Commit b68ed1c exists
- TypeScript compiled without errors
