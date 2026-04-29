---
quick_id: 260429-mjq
slug: jql-preset-mine-all-watched
description: Modify JQL presets to Mine / All watched / Custom with all_watched as default
date: 2026-04-29
status: complete
---

# Quick Task 260429-mjq: JQL Preset Redesign

## Goal
Replace the 4 JQL presets (assigned, mentioned, all_watched, custom) with 3 cleaner presets:
- **Mine**: assignee = me OR comment ~ me OR description ~ me OR watching
- **All watched**: Mine criteria + watched users (assignee, comment, description)
- **Custom**: user-written JQL (unchanged)
- Default: All watched

## Tasks

### T1: Update JQL type and frontend build logic
- `src/features/tickets/types.ts` — new JqlPreset type
- `src/features/tickets/TicketListPage.tsx` — new buildJql function
- `src/features/tickets/ticketStore.ts` — change default to all_watched

### T2: Update Settings UI and translations
- `src/features/connections/SettingsPage.tsx` — PRESET_OPTIONS, handleResetJql
- `src/i18n/locales/en.json` — new preset.mine key
- `src/i18n/locales/sk.json` — Slovak translation

### T3: Update Rust backend
- `src-tauri/src/poll_engine.rs` — new build_poll_jql logic
- `src-tauri/src/triage_db.rs` — change DB default

### T4: Update tests
- All test files using jqlPreset: 'assigned' or 'mentioned'
