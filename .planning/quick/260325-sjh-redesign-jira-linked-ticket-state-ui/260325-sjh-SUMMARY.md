---
phase: quick
plan: 260325-sjh
subsystem: tickets-ui
tags: [ui, redesign, jira-links, TicketDetailPanel]
dependency_graph:
  requires: []
  provides: [redesigned-copied-state-ui]
  affects: [TicketDetailPanel]
tech_stack:
  added: []
  patterns: [compact-badge-with-inline-links, lucide-icons]
key_files:
  created: []
  modified:
    - src/features/tickets/TicketDetailPanel.tsx
decisions:
  - "Used t('wizard.source.subtitle') as source link label — no sourceProjectName field exists in ConnectionMeta; translation 'Customer Jira Server' is accurate and no new key needed"
  - "Integrated green badge into the isCopied && copiedKey branch directly — separate standalone badge ternary removed"
metrics:
  duration: 5
  completed_date: "2026-03-25"
---

# Phase quick Plan 260325-sjh: Redesign Jira Linked Ticket State UI Summary

**One-liner:** Replaced two large Open-in-Jira buttons in the copied state with a compact green badge (CheckCircle2 + copied key) as primary element and two subtle dot-separated inline text links.

## Tasks Completed

| # | Task | Commit | Files Modified |
|---|------|--------|----------------|
| 1 | Redesign copied/linked state in TicketDetailPanel | 73aa8db | src/features/tickets/TicketDetailPanel.tsx |

## What Was Built

The `isCopied && triageEntry?.copiedKey` branch in TicketDetailPanel was redesigned:

**Before:** Two large bordered buttons ("Open in Source Jira" / "Open in Company Jira") plus a separate standalone green badge span showing "Copied → KEY".

**After:** One cohesive group:
1. Green badge (`bg-emerald-500/10 border border-emerald-500/20 text-emerald-400`) with `CheckCircle2` icon and "Copied → PROJ-13" text — primary visual element
2. A dot separator
3. Compact `text-xs` button "Customer Jira Server" opening source Jira (using `t('wizard.source.subtitle')`)
4. A dot separator
5. Compact `text-xs` button showing the copied key (e.g. "PROJ-13") opening cloud Jira

Non-copied states (single Open in Jira button, ignore/unignore button, copy button) are completely unchanged.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written with one minor adaptation: the plan referenced `sourceProjectName` as a variable, but no such field exists in `ConnectionMeta`. Used `t('wizard.source.subtitle')` ("Customer Jira Server") directly as the label, which is the accurate term for the source connection throughout the app.

## Verification

- `npx tsc --noEmit --skipLibCheck` passed with zero errors
- Copied state: green badge with checkmark + key as primary, two compact links with dots
- Non-copied states render identically to before

## Self-Check: PASSED

- src/features/tickets/TicketDetailPanel.tsx: FOUND
- Commit 73aa8db: FOUND
