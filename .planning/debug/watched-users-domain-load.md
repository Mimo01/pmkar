---
status: resolved
trigger: "watched-users-domain-load: When entering a company domain in the watched users feature, it fails to load users. An error message is shown. This works correctly with the dev server but fails in the live/production build."
created: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — connection_meta stores display name as username, but credential is keyed by email; in production OS keychain lookup fails with "No credential found"; in dev the manually seeded ~/.pmkar-dev-credentials.json happened to use the display name as key so it works
test: trace wizard → store_credential(email) vs set_connection_meta(username=displayName) vs get_cloud_credentials(meta.username=displayName)
expecting: fix stores email in connection_meta.username for cloud, making keychain roundtrip consistent
next_action: fix SetupWizard.tsx and SettingsPage.tsx to pass email (not display name) as username in cloud connection_meta

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Should fetch and display a list of users belonging to that company domain when the domain is entered
actual: An error message is shown instead of loading users
errors: Error message displayed on screen (exact message unknown - investigate in code)
reproduction: Enter a company domain in the watched users section
started: Works with dev server, doesn't work in the live/production build — suggests a build/packaging/CORS/CSP/env difference

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-01T00:00:00Z
  checked: keychain.rs — debug vs release builds
  found: debug_assertions=true uses file-based store at ~/.pmkar-dev-credentials.json; release uses OS keychain (keyring crate)
  implication: credential key mismatch would manifest differently in dev (pre-seeded file) vs prod (OS keychain)

- timestamp: 2026-04-01T00:00:00Z
  checked: ~/.pmkar-dev-credentials.json
  found: key "pmkar-jira-cloud:John Doe" exists (display name, not email)
  implication: dev lookup works because the dev file was manually seeded with display name key; this masks the real production bug

- timestamp: 2026-04-01T00:00:00Z
  checked: SetupWizard.tsx handleCloudTestSuccess and SettingsPage.tsx handleEditTestSuccess
  found: store_credential uses username=email; set_connection_meta uses username=result.username (displayName from /myself)
  implication: credential key (email) ≠ meta.username (displayName); get_cloud_credentials reads meta.username to look up keychain → wrong key in prod

- timestamp: 2026-04-01T00:00:00Z
  checked: test_jira_cloud_connection Rust command (commands.rs:606)
  found: result.username = myself_body["displayName"] (e.g. "John Doe"), NOT the email address
  implication: this is the source of the display name in connection_meta

- timestamp: 2026-04-01T00:00:00Z
  checked: ConnectionForm.tsx pre-fill behavior
  found: email field and get_credential call both use initialValues.username (= meta.username = displayName in prod)
  implication: re-edit form pre-fill is also broken in prod (shows display name in email field, fails to load API token)

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  cloud connection_meta.username was being stored as the display name (from /myself response
  "displayName" field, e.g. "John Doe") rather than the email address. The credential was stored
  with the email as the keychain key. When get_cloud_credentials ran in production, it read
  meta.username (display name) to look up the keychain entry but found nothing (key was email).
  In dev, ~/.pmkar-dev-credentials.json had been manually seeded with the display name as key,
  which masked the bug. The catch block in handleDomainSearch showed the generic
  settings.watchedUsers.domainSearch.error message.

fix: |
  SetupWizard.tsx handleCloudTestSuccess: removed the `username = result.username` variable and
  replaced all uses with `email` from credentials — both for connection_meta and store_credential.
  SettingsPage.tsx handleEditTestSuccess: introduced `metaUsername` that uses `credentials.email`
  for cloud connections and `result.username` for server connections — consistent across both
  store_credential and set_connection_meta calls.
  ~/.pmkar-dev-credentials.json: updated the cloud credential key from "pmkar-jira-cloud:John Doe"
  to "pmkar-jira-cloud:jdoe@example.com" to match the new email-based key format.

verification: |
  - TypeScript compiles with no errors
  - 38 connection-related tests pass (SettingsPage + SetupWizard)

files_changed:
  - src/features/connections/SetupWizard.tsx
  - src/features/connections/SettingsPage.tsx
  - ~/.pmkar-dev-credentials.json
