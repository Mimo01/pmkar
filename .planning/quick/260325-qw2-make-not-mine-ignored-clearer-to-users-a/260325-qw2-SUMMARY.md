---
phase: quick-260325-qw2
plan: 01
subsystem: ui, i18n, backend
tags: [ux, i18n, sqlite, zustand, tauri]
dependencies:
  requires: []
  provides: [dismissed-tab-rename, project-name-labels, project-name-persistence]
  affects: [IgnoredTicketsPage, TicketDetailPage, TicketDetailPanel, CopyPreviewPage, CopyResultPage, CopyResultModal, SettingsPage, connectionStore, triage_db, commands]
tech-stack:
  added: []
  patterns: [i18n-interpolation, zustand-store-extension, sqlite-migration]
key-files:
  created: []
  modified:
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
    - src/features/tickets/IgnoredTicketsPage.tsx
    - src/features/connections/connectionStore.ts
    - src/features/connections/SettingsPage.tsx
    - src/features/connections/SummaryStep.tsx
    - src/features/tickets/TicketDetailPage.tsx
    - src/features/tickets/TicketDetailPanel.tsx
    - src/features/tickets/CopyPreviewPage.tsx
    - src/features/tickets/CopyResultModal.tsx
    - src/features/tickets/CopyResultPage.tsx
    - src/features/tickets/copyStore.ts
    - src-tauri/src/triage_db.rs
    - src-tauri/src/commands.rs
decisions:
  - Chose session-only state (useState) for info card visibility — no need to persist dismiss across sessions
  - Used generic fallback strings from wizard.source/destination.subtitle for project names when not selected
  - Kept all `ignored.*` i18n key names unchanged (code identifiers) while updating their values
  - Added name fields to set_project_config as new parameters (backward compatible with optional defaults)
metrics:
  duration: 15 min
  completed: 2026-03-25
  tasks: 2
  files: 14
---

# Phase quick-260325-qw2 Plan 01: Dismiss UX Rename and Project Name Labels Summary

**One-liner:** Renamed "Not Mine" tab and dismiss flow to "Dismissed" language across English and Slovak, added a dismissable info card, and wired project names from DB through connectionStore to all "Open in / Copy to" buttons.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Rename Not Mine to Dismissed and add info card | 94ad322 | en.json, sk.json, IgnoredTicketsPage.tsx |
| 2 | Store and display project names across the app | 0707ea4 | triage_db.rs, commands.rs, connectionStore.ts, SettingsPage.tsx, SummaryStep.tsx, TicketDetailPage.tsx, TicketDetailPanel.tsx, CopyPreviewPage.tsx, CopyResultModal.tsx, CopyResultPage.tsx, copyStore.ts, en.json, sk.json |

## What Was Built

### Task 1: Dismiss Rename

- `nav.notMine` → "Dismissed" (EN) / "Zamietnuté" (SK)
- `detail.ignore` → "Dismiss" (EN) / "Zamietnuť" (SK)
- `ignored.confirm.*` keys updated to use "Dismiss" language
- `ignored.heading/empty.*` keys updated
- New `dismissed.infoCard` key added in both locales
- `IgnoredTicketsPage.tsx`: dismissable info card with `Info` icon appears when there are dismissed tickets; closes on X click (session-only, no persistence)

### Task 2: Project Name Storage and Display

**Backend:**
- `triage_db.rs`: added `source_project_name` and `target_project_name` columns via ALTER TABLE migrations; `get_project_keys` returns 4-tuple; added `set_source_project_name` / `set_target_project_name` methods
- `commands.rs`: `ProjectConfig` struct extended with name fields; `set_project_config` accepts `source_project_name` and `target_project_name` parameters

**Frontend Store:**
- `connectionStore.ts`: added `sourceProjectName` / `targetProjectName` state, setters, updated `loadProjectConfig` to read names, updated `saveProjectConfig` to accept and pass names

**SettingsPage:**
- `ProjectSelector.onSelect` signature changed to `(key: string | null, name: string | null) => void`
- "All Projects" passes `(null, null)`; project items pass `(p.key, p.name)`
- Source and target connection cards pass project name to label interpolation

**Translation interpolation:**
- `detail.copy` → "Copy to {{name}}"
- `detail.openInSourceJira` → "Open in {{name}}"
- `detail.openInCompanyJira` → "Open in {{name}}"
- `copy.preview.confirm` → "Copy to {{name}}"
- `copy.result.openInJira` → "Open in {{name}}"
- `copy.progress.copyingFields` → "Creating ticket in {{name}}"
- `settings.sourceLabel` → "Source ({{name}})"
- `settings.destLabel` → "Destination ({{name}})"
- Same for sk.json equivalents

**Fallback:** When `sourceProjectName` / `targetProjectName` is null, falls back to `wizard.source.subtitle` ("Customer Jira Server") / `wizard.destination.subtitle` ("Company Jira Cloud")

**copyStore error:** Removed hardcoded "Company Jira" from error message; now generic "destination connection"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Updated CopyResultModal.tsx and CopyResultPage.tsx**
- Found during: Task 2 — searching for `copy.result.openInJira` usage
- Issue: Plan listed specific files but didn't mention CopyResultModal and CopyResultPage which also render `copy.result.openInJira`
- Fix: Added `useConnectionStore` import and `targetProjectName` selector to both files, passed name interpolation
- Files modified: `CopyResultModal.tsx`, `CopyResultPage.tsx`
- Commit: 0707ea4

**2. [Rule 2 - Missing functionality] Updated SummaryStep.tsx**
- Found during: Task 2 — grepping for `settings.sourceLabel` usage
- Issue: SummaryStep also uses these keys, now require `{{name}}` interpolation
- Fix: Added fallback strings from wizard subtitle keys
- Files modified: `SummaryStep.tsx`
- Commit: 0707ea4

## Known Stubs

None — all data is wired from DB through store to UI.

## Test Status

Pre-existing failures: 23 tests across 7 files (unrelated to this task — CopyPreviewModal TypeError, AuditLogPage color class mismatch, etc.)

My changes introduced: 0 new test failures (verified by comparing before/after test counts).

## Self-Check: PASSED

Commits verified:
- 94ad322: FOUND
- 0707ea4: FOUND

Key files verified:
- src/i18n/locales/en.json: FOUND
- src/i18n/locales/sk.json: FOUND
- src/features/tickets/IgnoredTicketsPage.tsx: FOUND
- src/features/connections/connectionStore.ts: FOUND
- src-tauri/src/triage_db.rs: FOUND
- src-tauri/src/commands.rs: FOUND
