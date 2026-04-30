---
slug: fetched-tasks-wrong-project
status: resolved
trigger: "In the fetched list of tasks I see a some tasks that are not from the selected source project"
created: 2026-04-29
updated: 2026-04-29
resolved_at: 2026-04-29
---

# Debug Session: fetched-tasks-wrong-project

## Symptoms

- expected: Only issues from the selected source project (matching project key prefix) appear in the source ticket list
- actual: Some rows in the list have a project key prefix that differs from the selected source project (foreign-project tasks leak in)
- location: TicketListPage (source ticket list — the picker for copy/link operations); same JQL is reused by the background poll engine
- error_messages: none reported
- timeline: Recent regression — surfaced after commit `2dd76f1` redesigned the JQL presets
- reproduction: Select a source project in Settings, set the "Mine" preset, fetch the ticket list, observe rows whose key prefix (e.g. `ABC-123`) does not match the selected project (`XYZ`)

## Current Focus

hypothesis: "buildJql (frontend) and build_poll_jql (backend) construct JQL clauses (assignee/comment/description/watchedIssues/text) that match across all projects without scoping to the configured sourceProjectKey."
test: "Inspect git history, JQL builders, and the connection store sourceProjectKey wiring."
expecting: "No `project = X` clause in any preset path."
next_action: "Apply project-scoping fix to both buildJql and build_poll_jql; pass sourceProjectKey through the manual-fetch path; pull source_project_key from app_config in the poll engine."
reasoning_checkpoint: "confirmed at hypothesis stage (auto mode)"
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-04-29
  finding: "Frontend `src/features/tickets/TicketListPage.tsx::buildJql` produces JQL like `(assignee = me OR comment ~ me OR description ~ me OR issueKey in watchedIssues()) ORDER BY updated DESC`. No project scope clause anywhere."
- timestamp: 2026-04-29
  finding: "Backend `src-tauri/src/poll_engine.rs::build_poll_jql` mirrors the same logic for auto-poll. Same lack of project scope."
- timestamp: 2026-04-29
  finding: "`src/features/connections/connectionStore.ts` has `sourceProjectKey` / `sourceProjectName` state, set by `ProjectSelector` in SettingsPage and persisted via `set_project_config`. The Source connection card label even reads `sourceProjectName`, confirming user intent that this scopes the source ticket list."
- timestamp: 2026-04-29
  finding: "`git log -S sourceProjectKey -- src/features/tickets/` shows zero references. So `sourceProjectKey` was never threaded into the fetch path — the previous illusion of correct behavior came from the old `assignee in (...)` JQL implicitly scoping to projects where the user is assigned."
- timestamp: 2026-04-29
  finding: "Recent commit `2dd76f1` (feat 260429-mjq) redesigned presets: 'mine' now includes `comment ~ me`, `description ~ me`, and `issueKey in watchedIssues()` which broadly match across projects. This made the missing project scope visible as a regression."
- timestamp: 2026-04-29
  finding: "Backend `fetch_tickets` in `src-tauri/src/commands.rs` takes JQL as-is from the frontend; it does not enforce any project filter."

## Eliminated

- "Pagination commit `d2e6d04` introduces wrong-project tickets" — the commit only adds a `startAt` loop, it does not relax the JQL.

## Resolution

root_cause: "The JQL builders (frontend `buildJql` and backend `build_poll_jql`) never scoped queries to the configured `sourceProjectKey`. The previous default preset (`assignee = me`) only happened to look project-correct because users tend to be assigned tickets in their own project. When commit `2dd76f1` broadened 'mine' to include `comment ~ me`, `description ~ me`, and `issueKey in watchedIssues()`, foreign-project tickets where the user was mentioned or watching began appearing in the source list."

fix: |
  Both JQL builders now wrap the OR'd people clause with `project = "<key>" AND (...)` whenever a source project is configured.

  - `src/features/tickets/TicketListPage.tsx::buildJql` — added a `sourceProjectKey: string | null` parameter; threaded `useConnectionStore.getState().sourceProjectKey` through `handleFetch`. `custom` preset is intentionally NOT wrapped (the user controls raw JQL).
  - `src-tauri/src/poll_engine.rs::build_poll_jql` — added a `source_project_key: Option<&str>` parameter and a `wrap_with_project()` helper. `extract_poll_params` now pulls the source project key from `triage_db.get_project_keys()` and passes it through a new `PollParams` struct.
  - Empty-string project keys are treated as "no project" defensively, so we never emit `project = ""`.
  - `custom` preset is left untouched in both paths.

verification: |
  - Backend: `cargo test --lib poll_engine` — 12 tests pass, including 5 new project-scope regression tests (`test_build_poll_jql_mine_no_project`, `test_build_poll_jql_mine_with_project_scope`, `test_build_poll_jql_all_watched_with_project_scope`, `test_build_poll_jql_custom_not_wrapped`, `test_build_poll_jql_empty_project_key_treated_as_none`).
  - Backend: full `cargo test` suite — 194 lib unit tests + all integration suites pass.
  - Frontend: `npx vitest run` for `TicketListPage*.test.tsx` — 17 tests pass, including 3 new regression tests in `TicketListPage.projectScope.test.tsx` (mine wrapped, no-project unchanged, custom untouched).
  - Frontend: full `npx vitest run` — same 9 pre-existing failures as on `main` (in `CopyPreviewModal.test.tsx` and `SettingsPage.test.tsx`); all other 748 tests pass. Verified by `git stash` + re-run.
  - `npx tsc --noEmit` — clean.
  - `cargo clippy --lib` — no errors in `poll_engine.rs`. Pre-existing errors in `copy_pipeline.rs`, `field_mapping_db.rs`, `field_transform/pipeline.rs` are unchanged from `main`.

files_changed:
  - src/features/tickets/TicketListPage.tsx
  - src-tauri/src/poll_engine.rs
  - src/features/tickets/__tests__/TicketListPage.projectScope.test.tsx (new)
