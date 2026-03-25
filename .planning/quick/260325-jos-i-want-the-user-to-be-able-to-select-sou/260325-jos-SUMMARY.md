---
phase: quick-260325-jos
plan: 01
subsystem: project-selection
tags: [project-config, settings, copy-flow, rust, react, i18n]
dependency_graph:
  requires: []
  provides: [project-selection-ui, project-persistence, copy-ticket-project-param]
  affects: [SettingsPage, CopyPreviewModal, copyStore, connectionStore, triage_db, commands]
tech_stack:
  added: []
  patterns: [zustand-store-extension, tauri-command, sqlite-alter-migration, react-inline-component]
key_files:
  created: []
  modified:
    - src-tauri/src/triage_db.rs
    - src-tauri/src/commands.rs
    - src-tauri/src/mock_server.rs
    - src-tauri/src/main.rs
    - src/features/connections/connectionStore.ts
    - src/features/connections/SettingsPage.tsx
    - src/features/tickets/copyStore.ts
    - src/features/tickets/CopyPreviewModal.tsx
    - src/i18n/locales/en.json
    - src/i18n/locales/sk.json
decisions:
  - "fetch_cloud_meta statuses endpoint uses stored target_project_key with MYPROJ fallback — avoids breaking status display before user selects a project"
  - "ProjectSelector inline component in SettingsPage — minimal surface area, no separate file needed"
  - "saveProjectConfig called on each select change (not debounced) — project selection is rare, no UX concern"
metrics:
  duration: 8 min
  completed: 2026-03-25
  tasks: 2
  files: 10
---

# Quick Task 260325-jos Summary

**One-liner:** User-selectable source/target Jira projects persisted in SQLite, replacing hardcoded MYPROJ with per-user project selection in Settings and Copy Preview.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Backend — project persistence, fetch_projects commands, copy_ticket param | 382a831 | triage_db.rs, commands.rs, mock_server.rs, main.rs |
| 2 | Frontend — project selectors in Settings and Copy Preview, store wiring, i18n | ca77e72 | connectionStore.ts, SettingsPage.tsx, copyStore.ts, CopyPreviewModal.tsx, en.json, sk.json |
| - | Fix — fetch_cloud_meta MYPROJ replaced with stored target_project_key | 55e532c | commands.rs |

## What Was Built

### Backend (Task 1)

**triage_db.rs:**
- Added `ALTER_APP_CONFIG_ADD_SOURCE_PROJECT` and `ALTER_APP_CONFIG_ADD_TARGET_PROJECT` migration constants
- Both ALTERs run with `let _ =` (silent failure if columns exist) in both `open()` and `open_in_memory()`
- Added `get_project_keys() -> (Option<String>, Option<String>)`
- Added `set_source_project_key(key: Option<&str>)` and `set_target_project_key(key: Option<&str>)`

**commands.rs:**
- Added `JiraProject { key, name }` and `ProjectConfig { source_project_key, target_project_key }` structs
- Added `fetch_server_projects` command: calls `GET /rest/api/2/project` with Server PAT
- Added `fetch_cloud_projects` command: calls `GET /rest/api/3/project` with Cloud Basic auth
- Added `get_project_config` and `set_project_config` commands backed by triage_db
- Modified `copy_ticket`: added `target_project_key: String` parameter; replaced both hardcoded `"MYPROJ"` references (issue creation + sub-task creation)
- Modified `fetch_cloud_meta`: replaced MYPROJ in statuses fetch with stored `target_project_key` (fallback to "MYPROJ" when not configured)

**mock_server.rs:**
- Added `v2::get_projects()` returning 3 fake Server projects (CUSTPROJ, SUPPORT, PLATFORM)
- Added `v3::get_projects()` returning 3 fake Cloud projects (MYPROJ, DEVOPS, INFRA)
- Registered `/rest/api/2/project` and `/rest/api/3/project` GET routes in their respective routers

**main.rs:** Registered 4 new commands in `invoke_handler`.

### Frontend (Task 2)

**connectionStore.ts:**
- Added `sourceProjectKey: string | null` and `targetProjectKey: string | null` state fields
- Added `setSourceProjectKey`, `setTargetProjectKey` setters
- Added `loadProjectConfig()` action: invokes `get_project_config`, hydrates store
- Added `saveProjectConfig(source, target)` action: invokes `set_project_config`

**SettingsPage.tsx:**
- Added inline `ProjectSelector` component: fetches projects from Jira API on mount, renders styled `<select>` with loading/error states
- Source section: `ProjectSelector connectionType="server"` rendered after `ConnectionCard` (only when serverConn exists)
- Destination section: `ProjectSelector connectionType="cloud"` rendered after `ConnectionCard` (only when cloudConn exists)
- `loadProjectConfig()` called in `useEffect` on mount to hydrate project keys from DB

**copyStore.ts:**
- Added `targetProjectKey: string` field (default `''`) to state and `initialState`
- Added `setTargetProjectKey` setter
- `startPreview`: seeds `targetProjectKey` from `connectionStore.getState().targetProjectKey`
- `confirmCopy`: passes `targetProjectKey` in `copy_ticket` invoke call

**CopyPreviewModal.tsx:**
- Loads cloud projects via `fetch_cloud_projects` invoke when phase transitions to `'previewing'`
- Target panel: added project dropdown above Summary, pre-filled from `targetProjectKey`, editable per-ticket

**i18n:** Added 7 keys in both en.json and sk.json (`settings.project.*`, `copy.targetProject`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] fetch_cloud_meta also had hardcoded MYPROJ**
- **Found during:** Post-task verification scan
- **Issue:** `fetch_cloud_meta` called `GET /rest/api/3/project/MYPROJ/statuses` — plan mentioned only the two instances in `copy_ticket` (lines 1017 and 1672) but this was a third MYPROJ that would break status loading for users whose project key differs
- **Fix:** Read `target_project_key` from triage_db in `fetch_cloud_meta`, falls back to "MYPROJ" if not configured
- **Files modified:** src-tauri/src/commands.rs
- **Commit:** 55e532c

## Known Stubs

None. All dropdowns are wired to live Jira API endpoints (mocked in dev). Project selections persist to SQLite and survive app restarts. The `targetProjectKey` flows end-to-end into `copy_ticket`.

## Self-Check: PASSED

Files created/modified:
- src-tauri/src/triage_db.rs — FOUND
- src-tauri/src/commands.rs — FOUND
- src-tauri/src/mock_server.rs — FOUND
- src-tauri/src/main.rs — FOUND
- src/features/connections/connectionStore.ts — FOUND
- src/features/connections/SettingsPage.tsx — FOUND
- src/features/tickets/copyStore.ts — FOUND
- src/features/tickets/CopyPreviewModal.tsx — FOUND
- src/i18n/locales/en.json — FOUND
- src/i18n/locales/sk.json — FOUND

Commits:
- 382a831 — FOUND
- ca77e72 — FOUND
- 55e532c — FOUND
