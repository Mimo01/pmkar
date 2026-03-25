---
status: awaiting_human_verify
trigger: "copy-target-fields-fail — copy to company Jira fails with real Jira Cloud but works with mock server"
created: 2026-03-25T00:00:00Z
updated: 2026-03-25T00:00:02Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED and FIXED — replaced /rest/api/3/project/MYPROJ/statuses with /rest/api/3/status
test: compiled cleanly; all Rust tests (9) and frontend tests (389) pass
expecting: user confirms fix works with real Jira Cloud instance
next_action: await human verification

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Clicking 'copy to company jira' should load target Jira fields and show the copy preview modal
actual: Error message "Could not load target fields. Check your company Jira connection in settings" appears
errors: "Could not load target fields. Check your company Jira connection in settings"
reproduction: Connect to real Jira Cloud instance, try to copy a ticket to company Jira
started: Feature works with mock server but fails with real Jira Cloud

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: authentication failure (wrong credentials)
  evidence: /myself and /priority succeed; only /project/statuses fails — same auth is used for all calls
  timestamp: 2026-03-25T00:00:01Z

- hypothesis: CORS or network issue
  evidence: all other API calls succeed; failure is specific to /project/MYPROJ/statuses endpoint
  timestamp: 2026-03-25T00:00:01Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-25T00:00:01Z
  checked: src/features/tickets/copyStore.ts line 74
  found: error is thrown when invoke('fetch_cloud_meta') rejects
  implication: root cause is in the Rust fetch_cloud_meta command

- timestamp: 2026-03-25T00:00:01Z
  checked: src-tauri/src/commands.rs lines 183-213 (original)
  found: hardcoded URL /rest/api/3/project/MYPROJ/statuses; comment says "cloud_project_key not yet in settings; mock server responds to any key"
  implication: mock server ignores the key so it works; real Jira Cloud returns 404 for MYPROJ causing AppError

- timestamp: 2026-03-25T00:00:01Z
  checked: src-tauri/src/mock_server.rs line 678-688
  found: mock handler Path(_key) ignores the project key, returns fixed statuses array regardless
  implication: confirms mock works with any key including MYPROJ

- timestamp: 2026-03-25T00:00:01Z
  checked: src-tauri/src/triage_db.rs ConnectionMeta struct and DB schema
  found: no project_key field in connection_meta table; only connection_type, base_url, username, server_version, last_tested_at, status
  implication: cannot retrieve a real project key from settings — must use keyless endpoint

- timestamp: 2026-03-25T00:00:01Z
  checked: parsing code at commands.rs lines 201-213 (original)
  found: code does .first()["statuses"] to unwrap nested project-type structure from /project/{key}/statuses response
  implication: switching to /rest/api/3/status (flat array) requires updated parsing — iterate directly without .first()["statuses"]

- timestamp: 2026-03-25T00:00:02Z
  checked: build and test results after fix
  found: cargo build clean; cargo test 9/9 pass; npm test 389/389 pass
  implication: fix is non-breaking

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: fetch_cloud_meta in commands.rs used hardcoded project key MYPROJ in the URL /rest/api/3/project/MYPROJ/statuses. The mock server ignores the key and always responds with 200. Real Jira Cloud returns 404 for MYPROJ (a project that does not exist in the user's instance), causing the command to return an AppError, which the frontend catches and displays as "Could not load target fields".

fix: Replaced /rest/api/3/project/MYPROJ/statuses with the global /rest/api/3/status endpoint that returns all statuses without requiring a project key. Updated the response parsing to handle the flat array format (removed .first()["statuses"] unwrapping). Added /rest/api/3/status handler to mock server so all existing tests continue to pass.

verification: cargo build clean; cargo test 9/9 pass; npm test 389/389 pass. Awaiting user confirmation with real Jira Cloud.

files_changed: [src-tauri/src/commands.rs, src-tauri/src/mock_server.rs]
