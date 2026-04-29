---
quick_id: 260429-mjq
status: complete
date: 2026-04-29
---

# Summary: JQL Preset Redesign

Replaced 4 JQL presets with 3 cleaner ones. Default changed to "All watched".

## Changes

**Frontend:**
- `types.ts`: `JqlPreset = 'mine' | 'all_watched' | 'custom'`
- `TicketListPage.tsx`: `buildJql` now builds `(assignee = me OR comment ~ me OR description ~ me OR issueKey in watchedIssues())` for Mine; adds watched users' clauses for All watched
- `ticketStore.ts`: default preset changed from `'assigned'` to `'all_watched'`
- `SettingsPage.tsx`: PRESET_OPTIONS now has 3 entries (mine, all_watched, custom); handleResetJql defaults to all_watched
- `en.json` / `sk.json`: `preset.mine = "Mine"` / `"Moje"`, `preset.allWatched = "All watched"` / `"Všetky sledované"`

**Rust:**
- `poll_engine.rs`: `build_mine_clauses()` helper + updated `build_poll_jql` for mine/all_watched/legacy presets
- `triage_db.rs`: DB `DEFAULT 'all_watched'`

**Tests:** Updated all test files using `jqlPreset: 'assigned'` → `'mine'`

## Notes
- Legacy `assigned`/`mentioned` DB values fall through to mine behavior at runtime (backward compat)
- `issueKey in watchedIssues()` requires Jira 7+ / Cloud
