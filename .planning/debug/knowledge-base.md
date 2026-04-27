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

