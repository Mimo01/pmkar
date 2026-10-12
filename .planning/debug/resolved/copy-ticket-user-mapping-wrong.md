---
name: copy-ticket-user-mapping-wrong
status: resolved
trigger: "When copying a ticket, the users on the target jira seem to be populated by users from the source, not the target jira"
created: 2026-05-20
updated: 2026-05-20
---

## Symptoms

- **Expected:** User dropdowns show target Jira users when copying a ticket to another Jira instance
- **Actual:** Source Jira users are shown in the user search dropdowns instead of target Jira users
- **Errors:** No visible errors in UI or console
- **Timeline:** Unclear if ever worked correctly
- **Repro:**
  1. Open copy ticket modal
  2. User mapping doesn't find anything (no match between source and target users)
  3. When searching in user fields, source Jira users appear instead of target Jira users
  4. After copy completes, user fields are not filled in the resulting ticket

## Current Focus

hypothesis: "The user search/lookup during copy is using the source Jira connection/credentials instead of the target Jira connection"
test: "Confirmed by code inspection"
expecting: "searchUsersForPicker should call a cloud-authenticated command, not search_jira_users_by_domain which uses server PAT"
next_action: "apply fix"
reasoning_checkpoint: "The Rust command search_jira_users_by_domain always uses get_server_pat() for auth — it is hardwired to the source Jira Server. The frontend passes sourceBaseUrl to it. Both bugs compound: wrong base URL AND wrong auth. A new Rust command search_cloud_users_by_domain is needed, using get_cloud_credentials() and the /rest/api/3/user/search Cloud API endpoint (already implemented in UserResolver::fetch_users_by_domain). Alternatively, call the existing resolve_users_preview command with a synthetic UserEntry."

## Evidence

- timestamp: 2026-05-20T00:00:00Z
  file: src/features/tickets/CopyPreviewPage.tsx
  lines: 626-650
  note: "searchUsersForPicker calls invoke('search_jira_users_by_domain', { baseUrl: sourceBaseUrl, domain }) — uses sourceBaseUrl (wrong base URL)"

- timestamp: 2026-05-20T00:00:00Z
  file: src/features/tickets/CopyPreviewModal.tsx
  lines: 120-139
  note: "Same bug — searchUsersForPicker calls invoke('search_jira_users_by_domain', { baseUrl: sourceBaseUrl, domain }) — duplicate of page version"

- timestamp: 2026-05-20T00:00:00Z
  file: src-tauri/src/commands.rs
  lines: 1137-1194
  note: "search_jira_users_by_domain always calls get_server_pat() for auth. The base_url parameter only affects the URL endpoint; auth is always the server Bearer token. No matter what base_url the frontend passes, this command searches the Jira Server, never Cloud."

- timestamp: 2026-05-20T00:00:00Z
  file: src-tauri/src/commands.rs
  lines: 1225-1305
  note: "resolve_users_preview uses get_cloud_credentials() and UserResolver which calls /rest/api/3/user/search. This is the correct Cloud search path."

- timestamp: 2026-05-20T00:00:00Z
  file: src-tauri/src/field_transform/user.rs
  lines: 121-154
  note: "UserResolver::fetch_users_by_domain paginates /rest/api/3/user/search?query=@domain with Cloud Basic auth. This is the correct API for Cloud user search."

## Eliminated

- Frontend passing wrong cloudBaseUrl variable: not the sole issue — the Rust command ignores the credential arg and always uses server PAT regardless
- UI rendering issue: eliminated — users shown are real source-Jira users returned by the command

## Resolution

root_cause: "searchUsersForPicker in both CopyPreviewPage and CopyPreviewModal invokes search_jira_users_by_domain, a Rust command that is hardwired to use the server PAT (source Jira) for authentication, regardless of the base_url argument. The frontend also incorrectly passes sourceBaseUrl instead of cloudBaseUrl. The result is that user picker searches hit the source Jira Server instead of the target Cloud Jira."
fix: "Add a new Tauri command search_cloud_users_by_query that uses get_cloud_credentials() and the Cloud REST API v3 (/rest/api/3/user/search?query=...). Update searchUsersForPicker in both CopyPreviewPage.tsx and CopyPreviewModal.tsx to call this new command instead of search_jira_users_by_domain."
verification: "Open copy ticket modal, type in an assignee user picker, confirm Cloud users appear (not Server users)"
files_changed:
  - src-tauri/src/commands.rs
  - src-tauri/src/main.rs
  - src/features/tickets/CopyPreviewPage.tsx
  - src/features/tickets/CopyPreviewModal.tsx
