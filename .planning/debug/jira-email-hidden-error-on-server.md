---
slug: jira-email-hidden-error-on-server
status: resolved
created: 2026-05-08
updated: 2026-05-08
trigger: "Searching users by company in settings returns 'E-mailové adresy sú skryté nastaveniami vášho Jira Cloud.' but the source Jira is not cloud-based."
---

## Symptoms

- **Expected:** Search users by company in settings returns some results (at minimum user list without emails)
- **Actual:** Error message: "E-mailové adresy sú skryté nastaveniami vášho Jira Cloud." (Slovak: "Email addresses are hidden by your Jira Cloud settings.")
- **Error messages:** "E-mailové adresy sú skryté nastaveniami vášho Jira Cloud."
- **Timeline:** Unknown — may never have worked, not sure
- **Reproduction:** Go to settings, search users by company
- **Jira instance:** Self-hosted on custom domain (not atlassian.net), not Jira Cloud
- **Auth method:** REST API with API token

## Key Anomaly

The error message explicitly references "Jira Cloud" but the instance is self-hosted Jira Server/Data Center. This suggests either:
1. The app is making a Jira Cloud API call (wrong endpoint) instead of a Server/DC API call
2. The error message is being returned from Jira itself via an endpoint that only Cloud exposes
3. The app has hardcoded a Cloud-style user search path

## Current Focus

- hypothesis: "search_jira_users_by_domain was hardwired to query the Cloud Jira via /rest/api/3/ using cloud credentials, ignoring the passed serverConn.baseUrl"
- test: "Confirmed by reading commands.rs lines 1143-1155"
- expecting: "The command should have used the Jira Server v2 API with the server PAT"
- next_action: "Fix applied"
- reasoning_checkpoint: ""

## Evidence

- timestamp: 2026-05-08T00:00:00Z
  file: src-tauri/src/commands.rs
  lines: 1143-1155
  note: "search_jira_users_by_domain called get_cloud_credentials() and used /rest/api/3/user/search with Basic auth, completely ignoring the base_url parameter (marked `let _ = base_url;`). This always queried Cloud Jira regardless of what serverConn.baseUrl was passed from the frontend."

- timestamp: 2026-05-08T00:00:00Z
  file: src/features/connections/SettingsPage.tsx
  lines: 455-476
  note: "handleDomainSearch invoked search_jira_users_by_domain with serverConn.baseUrl, but the Rust command ignored it. On empty result, setShowPrivacyWarning(!!cloudConn) triggered the misleading 'Jira Cloud' privacy warning."

- timestamp: 2026-05-08T00:00:00Z
  file: src/i18n/locales/sk.json
  line: 38
  note: "Privacy warning title hardcoded 'Jira Cloud' in both sk and en locales."

## Eliminated

- Network issue — the command was successfully reaching Jira Cloud (just the wrong one)
- Auth issue — Cloud credentials were valid; problem was wrong endpoint entirely

## Resolution

- root_cause: "search_jira_users_by_domain in commands.rs was written as a Cloud-only utility (for the copy pipeline's user resolution), but it was also being called by the Settings page 'Add by email domain' feature which is intended to search the Jira Server. The function called get_cloud_credentials() and used /rest/api/3/user/search with Basic auth, ignoring the base_url argument. When the Cloud Jira returned 0 results (domain not in Cloud or email privacy on), the frontend showed the 'Email addresses are hidden by your Jira Cloud settings.' privacy warning."
- fix: "Rewrote search_jira_users_by_domain to use get_server_pat() + the passed base_url + /rest/api/2/user/search?username=@{domain} with Bearer token auth (matching search_jira_users). Updated i18n privacy warning title in both en and sk to remove the hardcoded 'Jira Cloud' reference. Changed setShowPrivacyWarning(!!cloudConn) to setShowPrivacyWarning(!!serverConn) since the search now targets the server."
- verification: "cargo check passes cleanly. The fix mirrors the working search_jira_users command which correctly targets Jira Server."
- files_changed:
  - src-tauri/src/commands.rs (search_jira_users_by_domain rewritten)
  - src/i18n/locales/en.json (privacyWarning.title updated)
  - src/i18n/locales/sk.json (privacyWarning.title updated)
  - src/features/connections/SettingsPage.tsx (showPrivacyWarning condition updated)
