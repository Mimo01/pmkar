---
phase: quick
plan: 260323-w2c
subsystem: frontend/navigation
tags: [tabs, triage, i18n, filtering]
dependency_graph:
  requires: []
  provides: [3-tab-navigation, LinkedTicketsPage, triage-filtering]
  affects: [App.tsx, AppShell.tsx, TicketListPage.tsx]
tech_stack:
  added: []
  patterns: [tab-union-type, triage-state-filter]
key_files:
  created:
    - src/features/tickets/LinkedTicketsPage.tsx
  modified:
    - src/App.tsx
    - src/components/ui/AppShell.tsx
    - src/features/tickets/TicketListPage.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - Tab type changed from 'tickets'|'ignored' to 'new'|'not-mine'|'linked' to reflect triage states accurately
  - LinkedTicketsPage shows copiedKey as a styled badge (not a button) — display only, no action needed
metrics:
  duration: ~2 minutes
  completed: 2026-03-23
  tasks_completed: 1
  tasks_total: 2
  files_modified: 6
---

# Phase Quick Plan 260323-w2c: Homepage 3-Tab Navigation Summary

**One-liner:** Redesigned 2-tab homepage (Tickets/Ignored) to 3-tab system (New/Not Mine/Already Linked) with triage-state-based filtering and a new LinkedTicketsPage component.

## What Was Built

The homepage navigation was redesigned from 2 tabs to 3 tabs that map directly to ticket triage states:

- **New tab** — shows tickets where `state` is `'new'` or `'seen'` (excludes `'ignored'` and `'copied'`)
- **Not Mine tab** — shows tickets where `state === 'ignored'` (existing IgnoredTicketsPage, renamed in nav)
- **Already Linked tab** — new LinkedTicketsPage showing tickets where `state === 'copied'`, with their `copiedKey` displayed as a badge

## Tasks Completed

### Task 1: Update tab type, routing, filters, and create LinkedTicketsPage

**Commit:** `79d46ac`

**Changes:**

1. **AppShell.tsx** — Changed `AppShellProps` tab type union from `'tickets' | 'ignored'` to `'new' | 'not-mine' | 'linked'`. Updated `NAV_TABS` to 3 entries using `nav.new`, `nav.notMine`, `nav.linked` i18n keys.

2. **App.tsx** — Changed `currentTab` useState type to `'new' | 'not-mine' | 'linked'` with default `'new'`. Imported `LinkedTicketsPage`. Updated render conditionals: `new` → `TicketListPage`, `not-mine` → `IgnoredTicketsPage`, `linked` → `LinkedTicketsPage`.

3. **TicketListPage.tsx** — Fixed `candidateTickets` filter to exclude both `'ignored'` and `'copied'` states (previously only excluded `'ignored'`). Also extended the detail-panel-close `useEffect` to fire when ticket becomes `'copied'` (in addition to `'ignored'`), so copying a ticket automatically closes the panel.

4. **LinkedTicketsPage.tsx** (new) — Displays copied tickets sorted by `updated DESC`. Includes all standard table columns plus a "Linked As" column showing `triageMap[ticket.key]?.copiedKey` as a styled badge.

5. **en.json** — Added `nav.new`, `nav.notMine`, `nav.linked`, and all `linked.*` keys.

6. **sk.json** — Added all corresponding Slovak translations.

### Task 2: Human verification checkpoint

**Status:** Awaiting verification — see checkpoint message below.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — LinkedTicketsPage reads real data from `ticketStore` via `triageMap` and `tickets`. No hardcoded values.

## Self-Check

- [x] `src/features/tickets/LinkedTicketsPage.tsx` — created
- [x] `src/App.tsx` — modified with `'new' | 'not-mine' | 'linked'` union
- [x] `src/components/ui/AppShell.tsx` — modified with 3-tab `NAV_TABS`
- [x] `src/features/tickets/TicketListPage.tsx` — filter updated to exclude `'copied'`
- [x] `src/i18n/locales/en.json` — `nav.new`, `nav.notMine`, `nav.linked`, `linked.*` keys added
- [x] `src/i18n/locales/sk.json` — Slovak equivalents added
- [x] Commit `79d46ac` exists
- [x] TypeScript: zero errors in modified files (`npx tsc --noEmit` shows only pre-existing errors in unrelated files)

## Self-Check: PASSED
