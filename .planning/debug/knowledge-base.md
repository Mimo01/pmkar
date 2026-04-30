# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## watched-users-domain-pagination — Domain user search returned only first page of results
- **Date:** 2026-04-01
- **Error patterns:** domain, user search, only 16 results, incomplete results, pagination, maxResults, startAt
- **Root cause:** search_jira_users_by_domain made a single Jira Cloud API call with maxResults=50 and no startAt pagination loop, returning only the first page of results.
- **Fix:** Replaced single API call with a startAt pagination loop that fetches 50 users per page until a page returns fewer than 50 results.
- **Files changed:** src-tauri/src/commands.rs
---

## jira-fetch-pagination-50-cap — Manual fetch and auto-poll silently capped at 50 tickets
- **Date:** 2026-04-27
- **Error patterns:** manual fetch, auto-poll, only 50 tickets, incomplete results, pagination, maxResults, startAt, /rest/api/2/search, body["total"] vs body["issues"].len()
- **Root cause:** Both `fetch_tickets` (`src-tauri/src/commands.rs`) and `search_tickets` (`src-tauri/src/jira_client.rs`) hit `/rest/api/2/search` with `maxResults=50` and no `startAt` loop. `body["total"]` was read but never compared against `body["issues"].len()`, so any matching set with >50 issues was silently truncated.
- **Fix:** Added a `startAt` pagination loop in both code paths, iterating until `all_issues.len() >= total` with a `MAX_PAGINATION_ITEMS = 1000` upper bound. When the cap is hit, the function returns `(issues, truncated=true)`. `fetch_tickets` propagates `truncated` to the frontend via `FetchTicketsResult`; `TicketListPage` renders a warning banner. `poll_engine`'s watermark guarantee is preserved because `search_tickets` returns `Err` on any page failure (not a partial vec) — so `MIN(last_checked_at)` only advances when all pages succeed.
- **Files changed:** src-tauri/src/jira_client.rs, src-tauri/src/commands.rs, src-tauri/src/poll_engine.rs, src-tauri/src/mock_server.rs, src-tauri/tests/pagination.rs, src/features/tickets/{types.ts, ticketStore.ts, TicketListPage.tsx}, src/features/tickets/__tests__/TicketListPage.truncationWarning.test.tsx, src/i18n/locales/{en,sk}.json
---

## fetched-tasks-wrong-project — Source ticket list leaked tickets from other projects
- **Date:** 2026-04-29
- **Error patterns:** wrong project, foreign project, project key prefix, ABC vs XYZ, source project ignored, mine preset, all_watched preset, comment ~ me, description ~ me, watchedIssues, source ticket list, project filter
- **Root cause:** Neither the frontend `buildJql` (`src/features/tickets/TicketListPage.tsx`) nor the backend `build_poll_jql` (`src-tauri/src/poll_engine.rs`) scoped queries to the configured `sourceProjectKey`. The pre-redesign default preset (`assignee = me`) only happened to look project-correct because users tend to be assigned tickets in their own project. After commit `2dd76f1` broadened "mine" to include `comment ~ me`, `description ~ me`, and `issueKey in watchedIssues()`, foreign-project tickets where the user was mentioned or watching began appearing in the source list.
- **Fix:** Both JQL builders now wrap the OR'd people clause with `project = "<key>" AND (...)` whenever a source project is configured. `custom` preset is intentionally NOT wrapped (the user controls raw JQL). Empty-string project keys are treated as "no project" defensively. Frontend `handleFetch` threads `sourceProjectKey` from `useConnectionStore`; the poll engine pulls `source_project_key` from `triage_db.get_project_keys()` via a new `PollParams` struct.
- **Files changed:** src/features/tickets/TicketListPage.tsx, src-tauri/src/poll_engine.rs, src/features/tickets/__tests__/TicketListPage.projectScope.test.tsx (new)
---
## copy-400-and-logs-crash — Audit log page blanked + copy 400 hidden
- **Date:** 2026-04-29
- **Error patterns:** audit log crash, debug logs page blanks, "Something went wrong" ErrorBoundary, copy returned 400, Issue creation returned status 400, no detail, hidden Jira error, Objects are not valid as a React child, parseHeaders, AuditLogPage
- **Root cause:** Two compounding issues. (1) `AuditLogPage` rendered `{parsed[key]}` directly, where `parsed` came from `parseHeaders` with an unsafe `Record<string,string>` cast — any non-string header value crashed React, and the outer `ErrorBoundary` blanked the entire page. (2) `copy_ticket_v2` in `commands.rs` discarded the response body of failed create-issue calls, so the user only saw `"Issue creation returned status 400"` with no Jira diagnostic. The two issues compounded: the user could not read the 400 body because the log viewer crashed.
- **Fix:** (1) Hardened `AuditLogPage` with a `toDisplayString` coercion helper, widened `parseHeaders` to `Record<string, unknown>`, added a per-row try/catch in `renderExpandedRow`, defensively coerced non-array invoke results to `[]`, and added an `entry.id ?? row-${idx}` key fallback. (2) Added `format_create_failure_detail(status, body)` helper that compacts JSON or truncates raw text and embeds Jira's actual error message inline in `CopyStepResult.detail` — the user now sees the full Jira error in the result modal without opening the audit log.
- **Files changed:** src/features/tickets/AuditLogPage.tsx, src/features/tickets/AuditLogPage.test.tsx, src-tauri/src/commands.rs
---
