---
status: resolved
trigger: "When copying a ticket from source Jira to destination Jira Cloud, the API returns error: {\"errorMessages\":[],\"errors\":{\"project\":\"valid project is required\"}}"
created: 2026-04-01T00:00:00Z
updated: 2026-04-01T00:01:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — targetProjectKey is empty string when copy_ticket is invoked because
  (1) loadProjectConfig is never called at app startup (only in SettingsPage useEffect), and
  (2) CopyPreviewPage has no project selector, so users cannot set/override it during copy
test: confirmed by reading all code paths
expecting: fix requires: call loadProjectConfig at App startup AND add project selector to CopyPreviewPage
next_action: implement fix

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Ticket should be copied successfully from source to destination Jira Cloud
actual: Jira Cloud API returns error response with "project": "valid project is required"
errors: {"errorMessages":[],"errors":{"project":"valid project is required"}}
reproduction: Copy any ticket from source to Cloud destination
started: First time trying to copy to real Jira Cloud (was previously using mock server)

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Wrong project field format in Rust (e.g. needs {"id":"..."} not {"key":"..."})
  evidence: Rust commands.rs line 1256 uses {"key": target_project_key} which is correct for Jira Cloud v3
  timestamp: 2026-04-01T00:01:00Z

- hypothesis: project key is valid but pagination bug prevents projects loading (260401-j1u bug)
  evidence: commands.rs line 347-352 already has the dual-format fix applied from task 260401-j1u
  timestamp: 2026-04-01T00:01:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-01T00:01:00Z
  checked: App.tsx startup effect
  found: App.tsx only loads connection meta on startup; does NOT call loadProjectConfig
  implication: useConnectionStore.targetProjectKey stays null until SettingsPage is visited

- timestamp: 2026-04-01T00:01:00Z
  checked: copyStore.ts startPreview (line 67)
  found: const savedTargetProjectKey = useConnectionStore.getState().targetProjectKey ?? '';
  implication: if targetProjectKey is null (never loaded), this becomes empty string ''

- timestamp: 2026-04-01T00:01:00Z
  checked: CopyPreviewPage.tsx
  found: Page has NO project selector dropdown — only reads targetProjectName for display in button label
  implication: user has no way to set targetProjectKey during copy flow if it was empty

- timestamp: 2026-04-01T00:01:00Z
  checked: CopyPreviewModal.tsx
  found: Modal HAS a project dropdown, but is dead code — never imported in App.tsx or any production component
  implication: the project selector UI exists but is completely unused

- timestamp: 2026-04-01T00:01:00Z
  checked: mock_server.rs v3 create_issue handler
  found: mock accepts any payload without validating project key
  implication: bug was invisible during mock testing; real Jira Cloud rejects empty/invalid key

- timestamp: 2026-04-01T00:01:00Z
  checked: commands.rs line 1254-1263
  found: create_body sends "project": { "key": target_project_key }; format is correct for Cloud v3
  implication: if key is non-empty valid string, API call should succeed

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  Two compounding issues:
  1. loadProjectConfig is never called at app startup (only in SettingsPage useEffect).
     On first use without visiting Settings, useConnectionStore.targetProjectKey is null,
     copyStore.startPreview coalesces to '', and copy_ticket sends "project": {"key": ""}
     which Jira Cloud rejects with "valid project is required".
  2. CopyPreviewPage has no project selector, so even if the project is empty,
     there is no UI affordance to set it before confirming the copy.
fix:
  1. Call loadProjectConfig in App.tsx startup effect alongside get_all_connection_meta
  2. Add project selector dropdown to CopyPreviewPage (fetch_cloud_projects + setTargetProjectKey),
     matching the pattern already in CopyPreviewModal.tsx
  3. Disable Confirm button in CopyPreviewPage when targetProjectKey is empty, with
     "Select a target project" label to guide the user
verification: |
  - npm test: 536/536 passed (including updated CopyPreviewPage.test.tsx)
  - cargo test: 9/9 passed
  - Code change reviewed: minimal, targeted
files_changed:
  - src/App.tsx
  - src/features/tickets/CopyPreviewPage.tsx
  - src/features/tickets/__tests__/CopyPreviewPage.test.tsx
  - src/i18n/locales/en.json
  - src/i18n/locales/sk.json
