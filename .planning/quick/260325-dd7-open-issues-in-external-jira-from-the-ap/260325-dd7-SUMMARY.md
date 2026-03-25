---
phase: quick
plan: 260325-dd7
subsystem: tickets/detail-views
tags: [ux, navigation, external-link, i18n]
dependency_graph:
  requires: []
  provides: [open-in-jira-button]
  affects: [TicketDetailPage, TicketDetailPanel]
tech_stack:
  added: []
  patterns: [tauri-invoke, lucide-react-icon, i18n-t]
key_files:
  created: []
  modified:
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/TicketDetailPanel.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - Button placed after ignore/unignore in TicketDetailPage (low-priority secondary action)
  - Button placed first in ml-auto action group in TicketDetailPanel (left-most = lowest priority)
metrics:
  duration: "~2 minutes"
  completed: "2026-03-25"
  tasks_completed: 1
  files_modified: 4
---

# Quick Task 260325-dd7: Open Issues in External Jira from the App — Summary

**One-liner:** ExternalLink button added to both detail views calling `open_external_url` with `{baseUrl}/browse/{issueKey}` via existing Tauri command.

## What Was Built

Both ticket detail views — the full-page `TicketDetailPage` and the side `TicketDetailPanel` — now display an "Open in Jira" button with an `ExternalLink` icon. Clicking it opens the source Jira issue in the user's default browser via the pre-existing `open_external_url` Tauri command. Translations are wired for English (`en.json`) and Slovak (`sk.json`).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add i18n keys and Open in Jira button to both detail views | 3f96925 | TicketDetailPage.tsx, TicketDetailPanel.tsx, en.json, sk.json |

## Key Changes

- **`src/features/tickets/TicketDetailPage.tsx`** — Added `ExternalLink` to lucide import; added `handleOpenInJira` handler; added button after the ignore/unignore block in the action buttons area
- **`src/features/tickets/TicketDetailPanel.tsx`** — Added `ExternalLink` lucide import; added `handleOpenInJira` handler; added button as the first item in the `ml-auto` action group (before ignore/copy buttons)
- **`src/i18n/locales/en.json`** — Added `"detail.openInJira": "Open in Jira"` after `detail.copied`
- **`src/i18n/locales/sk.json`** — Added `"detail.openInJira": "Otvoriť v Jira"` after `detail.copied`

## Verification

- TypeScript compilation: no errors in modified files (`npx tsc --noEmit` — one pre-existing unrelated test error in `TicketDetailPage.test.tsx` was present before this change and not introduced by it)
- Button invocation pattern: `invoke('open_external_url', { url: \`${baseUrl}/browse/${issueKey}\` })` — matches existing Tauri command signature

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/features/tickets/TicketDetailPage.tsx` — modified, commit 3f96925 confirmed
- `src/features/tickets/TicketDetailPanel.tsx` — modified, commit 3f96925 confirmed
- `src/i18n/locales/en.json` — `detail.openInJira` key present
- `src/i18n/locales/sk.json` — `detail.openInJira` key present
