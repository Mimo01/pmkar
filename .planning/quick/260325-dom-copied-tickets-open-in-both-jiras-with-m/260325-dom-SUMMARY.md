---
phase: quick
plan: 260325-dom
subsystem: tickets/ui
tags: [jira-links, ticket-detail, i18n, buttons]
dependency_graph:
  requires: []
  provides: [dual-jira-buttons-copied-tickets]
  affects: [TicketDetailPage, TicketDetailPanel]
tech_stack:
  added: []
  patterns: [conditional-rendering, tauri-invoke]
key_files:
  created: []
  modified:
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/TicketDetailPanel.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - Buttons placed in same location within each file's layout as before (no structural moves)
  - Used py-1.5 / rounded-md (slightly larger than Panel's original py-1 / rounded) for visual consistency between the two views
metrics:
  duration: ~2 minutes
  completed: 2026-03-25
  tasks_completed: 2
  files_modified: 4
---

# Quick Task 260325-dom: Dual Jira Open Buttons for Copied Tickets

**One-liner:** Added prominent dual "Open in Source Jira" / "Open in Company Jira" buttons for copied tickets in both TicketDetailPage and TicketDetailPanel, with consistent outlined button styling replacing muted text-link style.

## What Was Built

For tickets that have been copied (state = 'copied' with a copiedKey), both detail views now show two clearly labeled buttons:

- **Open in Source Jira** — opens `baseUrl/browse/issueKey` (the original customer Jira)
- **Open in Company Jira** — opens `cloudBaseUrl/browse/copiedKey` (the copied ticket in company Jira)

For non-copied tickets, a single prominent "Open in Jira" button is shown (same styling, one button).

All buttons use the outlined prominent style:
```
px-3 py-1.5 rounded-md text-sm font-medium border border-brand-border bg-brand-surface hover:bg-brand-surface-hover hover:border-brand-text/30 text-brand-text transition-colors duration-150 flex items-center gap-1.5
```

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add translation keys for source/target Jira distinction | c8c786b | en.json, sk.json |
| 2 | Update TicketDetailPage and TicketDetailPanel with prominent dual buttons | 64352e3 | TicketDetailPage.tsx, TicketDetailPanel.tsx |

## Verification

- `npx tsc --noEmit` passes for production source files (pre-existing test file type error unrelated to this change)
- Both files contain `handleOpenInCloudJira` (definition + usage)
- Both translation keys present in en.json and sk.json
- Dual buttons conditional on `isCopied && triageEntry?.copiedKey`

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/features/tickets/TicketDetailPage.tsx` - FOUND
- `src/features/tickets/TicketDetailPanel.tsx` - FOUND
- `src/i18n/locales/en.json` - FOUND (openInSourceJira, openInCompanyJira)
- `src/i18n/locales/sk.json` - FOUND (openInSourceJira, openInCompanyJira)
- Commit c8c786b - FOUND
- Commit 64352e3 - FOUND
