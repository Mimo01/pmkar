---
slug: watchlist-domain-user-subset
status: resolved
trigger: When searching for users to watch by company domain, only a subset of users is shown. User wants to see all users at once.
created: 2026-04-29
updated: 2026-04-29
---

## Symptoms

- expected: All users from a company domain appear in the watchlist dialog search results
- actual: Results are paginated/capped — only a handful of users shown (no way to load more)
- location: Watch list / watchlist dialog (the dialog/panel where users are added to a watch list)
- scale: 50+ users exist under a domain, only a handful shown
- error_messages: none reported
- timeline: unknown
- reproduction: Search for users by company domain in the watchlist dialog

## Current Focus

hypothesis: "Jira Cloud /rest/api/3/user/search?query=@domain filters by email visibility — only returns users whose email is publicly visible. Most managed-account users have email set to private, so they are excluded. Fix: switch to /rest/api/3/users/search (all active users) and filter client-side by email domain."
test: ""
expecting: ""
next_action: implement fix — change search_jira_users_by_domain to use /rest/api/3/users/search with startAt pagination, filter results client-side for emailAddress containing @domain

## Evidence

- timestamp: 2026-04-29T00:00:00Z
  source: src-tauri/src/commands.rs:1109-1160
  finding: search_jira_users_by_domain uses /rest/api/3/user/search?query=%40domain — this endpoint only returns users whose email visibility is not restricted. Pagination loop is correct (startAt/maxResults/50 per page) but the query itself is the problem.

- timestamp: 2026-04-29T00:00:00Z
  source: git log
  finding: Commit 11e0817 previously fixed single-page cap ("as few as 16 users") by adding pagination loop. Pagination is now in place, so the remaining subset issue is caused by the API query, not missing pagination.

- timestamp: 2026-04-29T00:00:00Z
  source: Atlassian Cloud API behavior
  finding: /rest/api/3/user/search with query=@domain only matches users with visible emails (Atlassian account privacy). /rest/api/3/users/search (plural, no query) returns all active browsable users regardless of email visibility, supports startAt pagination, and emailAddress is returned for accounts where the caller has permission. This is the correct endpoint for listing all domain users.

- timestamp: 2026-04-29T00:00:00Z
  source: src/features/connections/SettingsPage.tsx:449
  finding: Frontend passes `domain` to search_jira_users_by_domain. Results are rendered without any frontend cap — all returned users are displayed. Frontend is not the bottleneck.

## Eliminated

- Frontend truncation: SettingsPage renders all domainResults with no slice/cap
- Pagination loop bug: Loop correctly uses startAt, breaks on page_len < PAGE_SIZE (50)
- URL encoding: urlencoding::encode correctly encodes @ as %40, Jira does substring match
- Safety cap: No MAX_RESULTS-style truncation on all_users in the domain search command

## Resolution

root_cause: "Jira Cloud /rest/api/3/user/search?query=%40domain filters users by email visibility. The majority of managed Atlassian Cloud users have email set to private and do not appear in this query. Only the handful with public emails are returned, regardless of how many users have that email domain."
fix: "Replace /rest/api/3/user/search?query=@domain with /rest/api/3/users/search (no query, paginated) in search_jira_users_by_domain, then filter the returned users client-side to those whose emailAddress contains @domain. Update mock server v3::search_users to handle the /users/search route shape."
verification: "cargo check clean; mock server email filter added; frontend passes baseUrl and guards on serverConn"
files_changed:
  - src-tauri/src/commands.rs
  - src/features/connections/SettingsPage.tsx
  - src-tauri/src/mock_server.rs
