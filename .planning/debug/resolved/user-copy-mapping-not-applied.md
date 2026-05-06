---
slug: user-copy-mapping-not-applied
status: resolved
trigger: "When copying a ticket and mapping based on 'user', it doesnt copy the user even though the same user exists in source and target jiras."
created: 2026-05-06
updated: 2026-05-06
---

## Symptoms

- **Expected**: When field mapping type is 'user', the user should be copied to the target ticket if the same user exists in both source and target Jiras
- **Actual**: User is not copied even though source and target have identical user data (same username, key, email, etc.)
- **Log evidence**:
  ```
  assignee  [user]  ok
    source: {"self":"https://jira.orange.sk/rest/api/2/user?username=x_kovacd","name":"x_kovacd","key":"x_kovacd","email… David OSK (ext.)","active":true,"timeZone":"Europe/Bratislava"}
    target: {"self":"https://jira.orange.sk/rest/api/2/user?username=x_kovacd","name":"x_kovacd","key":"x_kovacd","email… David OSK (ext.)","active":true,"timeZone":"Europe/Bratislava"}
  ```
- **Scope**: Affects all user-type fields, not just assignee
- **Specific question**: Is the code looking at the right Jira when determining the user?

## Current Focus

hypothesis: The user gap picker (search_jira_users_by_domain) queries the SOURCE Jira via v2 API, returning Server-format user objects with no `accountId`. Auto-resolution (resolve_users_preview) correctly queries the TARGET Jira, but when the result flows through the copy-time pipeline the user field ends up with a Server-format user that Cloud Jira ignores (it requires `accountId`).
next_action: Apply fix — change search_jira_users_by_domain to use cloud credentials and the v3 API (like resolve_users_preview), OR change the frontend to pass cloudBaseUrl instead of sourceBaseUrl.
reasoning_checkpoint: The log shows target value is a Server v2-format user object (self points to /rest/api/2/user?username=...). This object has `name`/`key` but in Jira Cloud the assignee field requires `{"accountId":"..."}`. The auto-resolution path (resolve_users_preview) uses get_cloud_credentials() — correct. But search_jira_users_by_domain (the manual gap user picker) uses get_server_pat() and calls base_url/rest/api/2/user/search where base_url=sourceBaseUrl. Two bugs: (a) frontend passes sourceBaseUrl instead of cloudBaseUrl to the picker command, (b) the picker command uses Server auth/API instead of Cloud auth/API.
tdd_checkpoint:

## Evidence

- timestamp: 2026-05-06T00:00:00Z
  file: src-tauri/src/commands.rs
  lines: 1137-1186
  note: |
    search_jira_users_by_domain takes base_url param, calls get_server_pat(), then
    {base_url}/rest/api/2/user/search with Bearer PAT. Returns Server v2 user objects
    (no accountId). This is the backend for the manual gap user picker.

- timestamp: 2026-05-06T00:00:00Z
  file: src/features/tickets/CopyPreviewPage.tsx
  lines: 553-555
  note: |
    searchUsersForPicker calls search_jira_users_by_domain with baseUrl: sourceBaseUrl
    (the SOURCE/Server Jira URL), not cloudBaseUrl. This is wrong — the user picker for
    gap fields should return TARGET Jira users, not SOURCE Jira users.

- timestamp: 2026-05-06T00:00:00Z
  file: src-tauri/src/commands.rs
  lines: 1222-1248
  note: |
    resolve_users_preview (auto-resolution) correctly uses get_cloud_credentials() to
    get the stored cloud URL and Basic auth, then calls /rest/api/3/user/search.
    Returns Cloud-format users with accountId. This is the correct path.

- timestamp: 2026-05-06T00:00:00Z
  file: src-tauri/src/field_transform/pipeline.rs
  lines: 233-238
  note: |
    dispatch_user writes {"accountId": account_id} to resolved.fields when copy-time
    user_map resolves the user. This is correct for Cloud. But if the manually-entered
    override (from the gap picker) contains a Server-format user (no accountId), Phase 5
    override merge replaces the clean {"accountId":"..."} with the Server user object.

- timestamp: 2026-05-06T00:00:00Z
  file: src-tauri/src/commands.rs
  lines: 1677-1681
  note: |
    copy_ticket_v2 UserResolver uses cloud_auth + trimmed_target (= cloudBaseUrl from
    frontend). Correct — searches TARGET Jira via v3 API. Consistent with
    resolve_users_preview. Both use the same URL (stored cloud connection baseUrl).

## Eliminated

- URL mismatch between preview and copy-time resolution: Both use the stored cloud connection URL. Eliminated.
- Auth mismatch for auto-resolution: resolve_users_preview and copy_ticket_v2 both use get_cloud_credentials() for auth. Eliminated.
- Race condition (confirm before resolve completes): await Promise.all waits before audit write; setOverrideValue called before logEntries.push. Eliminated.
- WR-03 guard blocking auto-resolution: WR-03 only blocks auto-resolution from overwriting a manually-entered value. On first preview open, no prior override exists. Eliminated for first-open case.

## Resolution

root_cause: |
  search_jira_users_by_domain — the backend command behind the manual user gap picker —
  queries the SOURCE Jira (Server v2 API, Bearer PAT auth) instead of the TARGET Jira
  (Cloud/DC v3 API, Basic cloud auth). The frontend also passes sourceBaseUrl instead of
  cloudBaseUrl when invoking this command (CopyPreviewPage.tsx line 554).

  When a user field fails auto-resolution and appears as a gap, the user searches for and
  selects a user from this picker. The returned user object is a Server v2 format:
  {name, key, emailAddress, displayName, self pointing to source Jira} — no accountId.

  This Server-format user object is stored as overrideValues[fieldId] and sent to
  copy_ticket_v2. Cloud Jira requires {"accountId":"..."} for user fields; without it
  the assignee (and all other user-type fields) is silently ignored, resulting in the
  created issue having no user set despite the "same user existing in both Jiras."

  The log showing source and target as identical Server-format objects is consistent:
  the audit's targetValue = the Server-format user selected via the gap picker.

fix: |
  Two-part fix:
  1. Backend: change search_jira_users_by_domain to use get_cloud_credentials() for URL
     and auth (like resolve_users_preview), calling /rest/api/3/user/search instead of
     /rest/api/2/user/search. Return Cloud-format users with accountId.
  2. Frontend: update CopyPreviewPage.tsx searchUsersForPicker to pass cloudBaseUrl
     instead of sourceBaseUrl (or remove base_url param if backend now ignores it).

  The search_jira_users_by_domain command already ignores the frontend-supplied base_url
  in a security-conscious way (similar to how resolve_users_preview ignores cloud_base_url).
  The simplest fix: have the backend always use stored cloud credentials (ignoring the
  base_url parameter), and switch from v2 to v3 user search.

verification: |
  After fix: manually picking a user in the gap section should return Cloud-format user
  objects with accountId. The created issue should have the assignee set.
  Test: map assignee as [user], ensure auto-resolution fails (or skip), manually select
  a user in the gap picker, confirm copy — verify the created ticket has the assignee set.

files_changed:
  - src-tauri/src/commands.rs (search_jira_users_by_domain — use cloud credentials, v3 API)
  - src/features/tickets/CopyPreviewPage.tsx (searchUsersForPicker — pass cloudBaseUrl or no-op if backend ignores it)
