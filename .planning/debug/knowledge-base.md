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

