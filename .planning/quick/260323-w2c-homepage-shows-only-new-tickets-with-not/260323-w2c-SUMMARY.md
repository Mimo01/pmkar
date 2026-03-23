---
phase: quick
plan: 260323-w2c
subsystem: frontend/navigation
tags: [tabs, triage, i18n, filtering, detail-panel]
dependency_graph:
  requires: []
  provides: [3-tab-navigation, LinkedTicketsPage, triage-filtering]
  affects: [App.tsx, AppShell.tsx, TicketListPage.tsx, IgnoredTicketsPage.tsx, LinkedTicketsPage.tsx]
tech_stack:
  added: []
  patterns: [tab-union-type, triage-state-filter, split-pane-detail]
key_files:
  created:
    - src/features/tickets/LinkedTicketsPage.tsx
  modified:
    - src/App.tsx
    - src/components/ui/AppShell.tsx
    - src/features/tickets/TicketListPage.tsx
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - Tab type changed from 'tickets'|'ignored' to 'new'|'not-mine'|'linked' to reflect triage states accurately
  - LinkedTicketsPage shows copiedKey as a styled badge (not a button) -- display only, no action needed
  - All 3 tabs share the same split-pane detail panel pattern for ticket inspection
  - Detail panel only opens for tickets belonging to the current tab (scoped by triage state)
metrics:
  duration: ~5 minutes
  completed: 2026-03-23
  tasks_completed: 1
  tasks_total: 2
  files_modified: 7
---

# Phase Quick Plan 260323-w2c: Homepage 3-Tab Navigation Summary

**One-liner:** Redesigned 2-tab homepage (Tickets/Ignored) to 3-tab system (New/Not Mine/Already Linked) with triage-state-based filtering, clickable ticket rows, and TicketDetailPanel support on all tabs.

## What Was Built

The homepage navigation was redesigned from 2 tabs to 3 tabs that map directly to ticket triage states:

- **New tab** -- shows tickets where `state` is `'new'` or `'seen'` (excludes `'ignored'` and `'copied'`)
- **Not Mine tab** -- shows tickets where `state === 'ignored'`, clickable rows open TicketDetailPanel with both Restore and Copy actions
- **Already Linked tab** -- new LinkedTicketsPage showing tickets where `state === 'copied'`, with their `copiedKey` displayed as a badge, clickable rows open TicketDetailPanel (read-only copy state shown)

## Tasks Completed

### Task 1: Update tab type, routing, filters, and create LinkedTicketsPage

**Commit:** `79d46ac`

**Changes:**

1. **AppShell.tsx** -- Changed `AppShellProps` tab type union from `'tickets' | 'ignored'` to `'new' | 'not-mine' | 'linked'`. Updated `NAV_TABS` to 3 entries using `nav.new`, `nav.notMine`, `nav.linked` i18n keys.

2. **App.tsx** -- Changed `currentTab` useState type to `'new' | 'not-mine' | 'linked'` with default `'new'`. Imported `LinkedTicketsPage`. Updated render conditionals: `new` -> `TicketListPage`, `not-mine` -> `IgnoredTicketsPage`, `linked` -> `LinkedTicketsPage`.

3. **TicketListPage.tsx** -- Fixed `candidateTickets` filter to exclude both `'ignored'` and `'copied'` states (previously only excluded `'ignored'`). Also extended the detail-panel-close `useEffect` to fire when ticket becomes `'copied'` (in addition to `'ignored'`), so copying a ticket automatically closes the panel.

4. **LinkedTicketsPage.tsx** (new) -- Displays copied tickets sorted by `updated DESC`. Includes all standard table columns plus a "Linked As" column showing `triageMap[ticket.key]?.copiedKey` as a styled badge.

5. **en.json** -- Added `nav.new`, `nav.notMine`, `nav.linked`, and all `linked.*` keys.

6. **sk.json** -- Added all corresponding Slovak translations.

### Feedback fix: Add detail panel to Not Mine and Already Linked tabs

**Commit:** `07419f8`

**Changes:**

1. **IgnoredTicketsPage.tsx** -- Added split-pane layout with TicketDetailPanel. Table rows are now clickable (selecting a ticket opens the detail panel on the right). Selected row gets highlighted. Restore button uses `stopPropagation` to prevent triggering row selection. Detail panel scoped to ignored tickets only. The TicketDetailPanel already shows both "Undo Not Mine" and "Copy to Company Jira" buttons for ignored tickets.

2. **LinkedTicketsPage.tsx** -- Added same split-pane layout with TicketDetailPanel. Clickable rows, selected row highlight, detail panel scoped to copied tickets only. The TicketDetailPanel shows the "Copied -> [key]" badge for already-linked tickets (read-only state).

### Task 2: Human verification checkpoint

**Status:** Awaiting verification.

## Deviations from Plan

### Feedback-driven Changes

**1. [Rule 2 - Missing functionality] Added TicketDetailPanel to Not Mine and Already Linked tabs**
- **Found during:** Checkpoint feedback
- **Issue:** Plan did not include ticket detail/click support for IgnoredTicketsPage and LinkedTicketsPage
- **Fix:** Added split-pane layout, clickable rows, TicketDetailPanel rendering, and selection state to both pages
- **Files modified:** src/features/tickets/IgnoredTicketsPage.tsx, src/features/tickets/LinkedTicketsPage.tsx
- **Commit:** `07419f8`

## Known Stubs

None -- all pages read real data from `ticketStore` via `triageMap` and `tickets`. No hardcoded values.

## Self-Check

- [x] `src/features/tickets/LinkedTicketsPage.tsx` -- created with detail panel support
- [x] `src/features/tickets/IgnoredTicketsPage.tsx` -- updated with detail panel support
- [x] `src/App.tsx` -- modified with `'new' | 'not-mine' | 'linked'` union
- [x] `src/components/ui/AppShell.tsx` -- modified with 3-tab `NAV_TABS`
- [x] `src/features/tickets/TicketListPage.tsx` -- filter updated to exclude `'copied'`
- [x] `src/i18n/locales/en.json` -- `nav.new`, `nav.notMine`, `nav.linked`, `linked.*` keys added
- [x] `src/i18n/locales/sk.json` -- Slovak equivalents added
- [x] Commit `79d46ac` exists
- [x] Commit `07419f8` exists
- [x] TypeScript: zero errors in modified files

## Self-Check: PASSED
