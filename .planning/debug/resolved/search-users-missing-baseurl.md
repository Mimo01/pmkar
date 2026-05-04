---
status: resolved
trigger: "[Error] [CopyPreviewPage] search_jira_users_by_domain failed: – \"invalid args `baseUrl` for command `search_jira_users_by_domain`: command search_jira_users_by_domain missing required key baseUrl\" searchUsersForPicker (CopyPreviewPage.tsx:89)"
created: 2026-05-03
updated: 2026-05-03
---

## Symptoms

- expected: search_jira_users_by_domain should be called with correct baseUrl to return matching users (user unsure of exact expected behavior)
- actual: Tauri command fails with "command search_jira_users_by_domain missing required key baseUrl"
- error: invalid args `baseUrl` for command `search_jira_users_by_domain`: command search_jira_users_by_domain missing required key baseUrl
- call_site: CopyPreviewPage.tsx:89 in searchUsersForPicker
- timeline: unknown (user unsure)
- repro: open Copy Preview page, change something (user picker interaction)

## Current Focus

- hypothesis: "Module-level searchUsersForPicker omits baseUrl argument required by Rust command"
- test: "Invoke search_jira_users_by_domain with { baseUrl, domain } vs { domain } only"
- expecting: "Command succeeds when baseUrl is provided"
- next_action: "fix applied"
- reasoning_checkpoint: "Rust command at commands.rs:1109 requires both base_url and domain. TS caller only sent domain."

## Evidence

- timestamp: 2026-05-03T00:00:00Z
  observation: "Rust command search_jira_users_by_domain signature at src-tauri/src/commands.rs:1109 requires `base_url: String` as first parameter"
  source: "src-tauri/src/commands.rs:1109-1120"
  supports: "missing baseUrl is the direct cause"

- timestamp: 2026-05-03T00:00:00Z
  observation: "TypeScript invoke call at CopyPreviewPage.tsx:93 passed only { domain }, omitting baseUrl"
  source: "src/features/tickets/CopyPreviewPage.tsx (original line 93)"
  supports: "confirms the call-site bug"

- timestamp: 2026-05-03T00:00:00Z
  observation: "sourceBaseUrl is already available in the component via useConnectionStore (line 135). The module-level function had no access to it."
  source: "src/features/tickets/CopyPreviewPage.tsx:135"
  supports: "fix approach: move function inside component as useCallback"

## Eliminated

- "baseUrl missing from connectionStore" — sourceBaseUrl was present and populated at line 135
- "Rust command removed baseUrl requirement" — command still requires it at commands.rs:1110

## Resolution

- root_cause: "searchUsersForPicker was a module-level async function outside the component, so it had no access to sourceBaseUrl. It called invoke('search_jira_users_by_domain', { domain }) without the required baseUrl argument."
- fix: "Moved searchUsersForPicker inside CopyPreviewPage as a useCallback closing over sourceBaseUrl, and updated the invoke call to pass { baseUrl: sourceBaseUrl, domain }."
- verification: "TypeScript compiles cleanly; both GapsSection and DynamicTargetForm receive the updated callback reference."
- files_changed: "src/features/tickets/CopyPreviewPage.tsx"
