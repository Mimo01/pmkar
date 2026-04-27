---
slug: jira-fetch-pagination-50-cap
status: resolved
trigger: |
  The pmkar Jira fetch pipeline silently truncates results at 50 tickets in both code paths.
  Manual fetch (src-tauri/src/commands.rs:686 fetch_tickets, URL built at line 698-700) and
  auto-poll (src-tauri/src/jira_client.rs search_tickets) hit /rest/api/2/search with
  maxResults=50 and NO startAt pagination loop. body["total"] is captured at commands.rs:722
  but never compared against body["issues"].len(). Anything beyond 50 is dropped — no warning,
  no error, no log.
created: 2026-04-27
updated: 2026-04-27
---

# Debug Session: jira-fetch-pagination-50-cap

## Symptoms

- **Expected:** All matching tickets are fetched from Jira (regardless of how many match the JQL or watch set).
- **Actual:** Both manual fetch and auto-poll silently cap results at 50 tickets. No warning, error, or log entry surfaces the truncation.
- **Error messages:** None — failure is silent. `body["total"]` is captured at `commands.rs:722` but never compared to `body["issues"].len()`.
- **Timeline:** Pre-existing defect — both `fetch_tickets` (`src-tauri/src/commands.rs:686`, URL built lines 698-700) and `search_tickets` (`src-tauri/src/jira_client.rs`) were authored without a `startAt` pagination loop. Surfaced now because users have JQL/watch sets returning >50 hits.
- **Reproduction:** Configure a JQL or watch set that returns >50 hits in the source Jira. Click manual fetch in the UI. Count visible tickets — capped at 50 even though the API response shows `total > 50`.

## Known patterns to consider

A previously resolved session (`watched-users-domain-pagination`, 2026-04-01, see `.planning/debug/knowledge-base.md`) hit the same shape: a Jira Cloud `/rest/api/2/search` call with `maxResults=50` and no `startAt` loop, returning only the first page. Fix added a pagination loop iterating until `all_results.len() >= total`. This session likely needs the same shape applied to two code paths.

## Fix shape (proposed by reporter)

- Add a `startAt` loop in both `fetch_tickets` (`src-tauri/src/commands.rs:686`) and `search_tickets` (`src-tauri/src/jira_client.rs`).
- Iterate until `all_issues.len() >= total`, with a hard upper bound (e.g. 1000) to prevent runaway loops on hostile responses.
- Surface a warning to the frontend if the upper bound is hit.
- Add regression tests in both Rust (`cargo test`) and TS (`vitest`) that mock a >50-result response and assert all results are fetched.

## Watch out for

- The `triage_map` update logic at `commands.rs:725-749` must still see all issues across pages.
- The watermark advancement in `poll_engine.rs` must not break on multi-page fetches — only fully-successful (all pages fetched) results should advance the watermark.

## Current Focus

- **hypothesis:** Both `fetch_tickets` and `search_tickets` issue a single `/rest/api/2/search` call with `maxResults=50` and no `startAt` loop, so any matching set with >50 issues is truncated to the first page. `body["total"]` is read but never used to detect the truncation.
- **test:** Inspect both call sites; confirm absence of pagination loop and absence of total-vs-len comparison; mock a Jira response with `total=120, issues=[50 items]` and confirm only 50 reach the caller.
- **expecting:** Both code paths return only the first page; no warning is emitted; downstream `triage_map` and watermark logic operate on the truncated set.
- **next_action:** apply pagination fix to both code paths and add regression tests.

## Evidence

- timestamp: 2026-04-27 — `src-tauri/src/commands.rs:686-767` `fetch_tickets`: URL built at lines 698-700 hardcodes `maxResults=50` with NO `startAt` parameter. The response body is fetched once (line 716-719). `body["issues"]` is extracted at 721 and `body["total"]` at 722, but no comparison or loop occurs. Triage updates at lines 724-749 iterate over the truncated `issues` array. Returns single-page result at 762-766. **Defect confirmed.**
- timestamp: 2026-04-27 — `src-tauri/src/jira_client.rs:23-55` `search_tickets`: URL built at lines 30-32 hardcodes `maxResults=50` with NO `startAt`. Response body fetched once (49-52). `body["issues"]` returned directly without inspecting `total`. **Defect confirmed.**
- timestamp: 2026-04-27 — `src-tauri/src/poll_engine.rs:160-166`: calls `search_tickets`, returns early on `Err`. Watermark is `MIN(last_checked_at)` across stored snapshots — implicitly advanced via `store_snapshot` in `process_tickets`. As long as `search_tickets` returns an `Err` (not a partial vec) when any page fails, the watermark guarantee holds: tickets that weren't refreshed retain their older `last_checked_at`, keeping the MIN watermark back. **Watermark guardrail preserved.**
- timestamp: 2026-04-27 — `src-tauri/src/mock_server.rs:56-74` `make_search_response` ignores `startAt`/`maxResults` query params and returns all matching issues with `startAt: 0, maxResults: 50`. Need to extend to support pagination for tests.

## Eliminated

(none — diagnosis was already pre-confirmed by reporter; investigation confirmed it cleanly)

## Resolution

- **root_cause:** Both `fetch_tickets` (`src-tauri/src/commands.rs:686`) and `search_tickets` (`src-tauri/src/jira_client.rs:23`) issue a single `GET /rest/api/2/search?...&maxResults=50` request with no `startAt` parameter and no comparison between `body["total"]` and `body["issues"].len()`. Any result set larger than the page size (50) is silently truncated to the first page. Same shape as the prior `watched-users-domain-pagination` session.
- **fix:** Added a shared `MAX_PAGINATION_ITEMS` upper bound and pagination loop helpers. (1) `search_tickets` now iterates with `startAt += page_size` until either `issues.len() >= total` or the upper bound is hit, returning `(Vec<Value>, bool truncated)`. (2) `fetch_tickets` does the same, returns `truncated` to the frontend via `FetchTicketsResult`. (3) Frontend `FetchTicketsResult` type and `TicketListPage` render a warning banner when `truncated == true`. (4) Mock server extended to honour `startAt`/`maxResults` for deterministic regression tests. (5) Regression tests added in Rust (`tests/pagination.rs`) and TS (`TicketListPage.truncationWarning.test.tsx`).
- **fix_applied:** yes
- **specialist_hint:** rust
