---
status: resolved
trigger: "watched-users-domain-pagination — domain search only returns 16 results, suspected pagination problem"
created: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — search_jira_users_by_domain makes a single API call with maxResults=50 and no pagination loop. The actual 16-result cap is likely the Jira Cloud API's default when maxResults is specified without a startAt loop. No pagination is implemented in either search_jira_users or search_jira_users_by_domain.
test: N/A — root cause confirmed by reading the code
expecting: Fix: implement startAt pagination loop in search_jira_users_by_domain (and add maxResults to search_jira_users for the single-user Server flow)
next_action: Implement paginated fetch loop in search_jira_users_by_domain in commands.rs

## Symptoms

expected: All users from the domain should load (could be dozens or hundreds)
actual: Only 16 results are returned — not all users from the domain
errors: No error messages — it just returns incomplete results
reproduction: Enter a company domain in the watched users section. Check both single-adding and company/domain-adding flows.
started: Unknown — may have always been this way

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-04-01T00:00:00Z
  checked: src-tauri/src/commands.rs search_jira_users_by_domain (line 1048-1080)
  found: Single API call to /rest/api/3/user/search?query=@{domain}&maxResults=50. No startAt param. No pagination loop. Returns after first page only.
  implication: Any domain with more than the server's default page size returns truncated results. Jira Cloud default page size for user search can be as low as 10-50.

- timestamp: 2026-04-01T00:00:00Z
  checked: src-tauri/src/commands.rs search_jira_users (line 1015-1043)
  found: Single call to /rest/api/2/user/search?username={query} — no maxResults param at all, no pagination. Server default applies (often 50).
  implication: Single-user search on Server also truncated, though for a name query this usually returns few results so it's less of a problem in practice.

- timestamp: 2026-04-01T00:00:00Z
  checked: src/features/connections/SettingsPage.tsx line 418
  found: Frontend calls invoke('search_jira_users_by_domain', { domain: clean }) and uses whatever array comes back — no client-side pagination, entirely trusts backend.
  implication: Fix must be backend-only (commands.rs).

- timestamp: 2026-04-01T00:00:00Z
  checked: get_cloud_credentials vs get_server_pat usage
  found: search_jira_users_by_domain uses get_cloud_credentials (cloud/target connection). search_jira_users uses get_server_pat + caller-supplied baseUrl (server/source connection).
  implication: Connection routing is correct per the existing design (domain search is cloud-only). The additional_context note about "should load from source" refers to the single-user flow which already uses serverConn.baseUrl.

## Resolution

root_cause: search_jira_users_by_domain makes a single Jira Cloud API call with maxResults=50 and no pagination loop. Jira Cloud API for user/search uses cursor-based or startAt pagination; without iterating through pages, only the first page (often 16-50 results) is returned.
fix: Replaced the single-shot API call in search_jira_users_by_domain with a startAt pagination loop. Each iteration fetches up to 50 users; the loop stops when a page returns fewer than 50 results (last page). All pages are accumulated and returned as one flat Vec.
verification: cargo build passes clean. User confirmed fix works end-to-end — domain search now returns all users.
files_changed: [src-tauri/src/commands.rs]
