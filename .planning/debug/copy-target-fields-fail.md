---
status: resolved
trigger: "copy-target-fields-fail — copy to company Jira fails with real Jira Cloud but works with mock server"
created: 2026-03-25T00:00:00Z
updated: 2026-04-01T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED AND FIXED — extra baseUrl parameter removed from invoke call; priority parsing updated to handle both flat array and paginated response format
test: cargo build clean, cargo test 9/9, npm test 536/536
expecting: user confirms clicking "Copy to Company Jira" now loads the preview modal with real Jira Cloud
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

- hypothesis: hardcoded MYPROJ project key in URL
  evidence: FIXED in previous session — commands.rs now uses /rest/api/3/status flat endpoint
  timestamp: 2026-03-25T00:00:02Z

- hypothesis: connection_type stored as wrong value
  evidence: SetupWizard.tsx:102 stores connectionType: 'cloud'; get_cloud_credentials looks for m.connection_type == "cloud" — matches; keychain credential stored under "jira-cloud" and retrieved under "jira-cloud" — matches
  timestamp: 2026-04-01T00:00:00Z

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
  checked: build and test results after MYPROJ fix
  found: cargo build clean; cargo test 9/9 pass; npm test 389/389 pass
  implication: MYPROJ fix is non-breaking but error still persists with real Jira Cloud

- timestamp: 2026-04-01T00:00:00Z
  checked: src-tauri/src/commands.rs line 142 — fetch_cloud_meta signature
  found: pub async fn fetch_cloud_meta(db: State<...>, triage_db: State<...>) — zero caller-supplied parameters; State<> args are Tauri-injected managed state, not passed from JS
  implication: the function accepts no JS-side args; passing { baseUrl: cloudBaseUrl } from JS triggers Tauri v2 InvalidArgs deserialization error

- timestamp: 2026-04-01T00:00:00Z
  checked: src/features/tickets/copyStore.ts line 80-82
  found: invoke<CloudMeta>('fetch_cloud_meta', { baseUrl: cloudBaseUrl }) — passes baseUrl that Rust does not expect
  implication: THIS IS THE BUG — Tauri v2 fails to deserialize the unknown arg; real Jira Cloud call never even starts

- timestamp: 2026-04-01T00:00:00Z
  checked: src/features/tickets/__tests__/copyStore.test.ts line 91
  found: mockInvoke.mockResolvedValue(makeCloudMeta()) — mock ignores all args; tests pass regardless of what args are sent
  implication: explains why tests did not catch the parameter mismatch

- timestamp: 2026-04-01T00:00:00Z
  checked: SetupWizard.tsx:84,102 vs commands.rs:69,73
  found: store_credential called with connectionType:'jira-cloud', set_connection_meta with connectionType:'cloud'; get_cloud_credentials looks for connection_type=="cloud" (matches) and calls keychain::get_credential("jira-cloud", email) (matches)
  implication: credential retrieval chain is correct — hypothesis 1 eliminated

- timestamp: 2026-04-01T00:00:00Z
  checked: commands.rs line 191-201 — priority parsing
  found: prio_body.as_array().unwrap_or(&vec![]) — expects flat array; real Jira Cloud /rest/api/3/priority may return paginated SearchResult { values: [...], isLast: true }
  implication: secondary risk — if priority returns paginated format, priorities will be empty (no error thrown, just silent empty list); fix defensively

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: copyStore.ts:80 passes { baseUrl: cloudBaseUrl } to invoke('fetch_cloud_meta') but the Rust command accepts zero caller parameters (only Tauri-injected State<>). In Tauri v2, passing an unknown parameter causes an InvalidArgs deserialization error before the command even executes. This error propagates to the catch block at line 112 which swallows it and shows the generic "Could not load target fields" message. Mock tests pass because mockInvoke ignores all arguments entirely.

fix: Removed { baseUrl: cloudBaseUrl } from invoke('fetch_cloud_meta') in copyStore.ts:80. The Rust command already retrieves base_url from triage_db via get_cloud_credentials — the JS side must not pass it. Also updated priority parsing in commands.rs to handle both flat array (older Jira Cloud) and paginated SearchResult { values: [...] } (newer Jira Cloud). Added console.error logging in the catch block for future diagnosability.

verification: cargo build clean; cargo test 9/9 pass; npm test 536/536 pass. Awaiting user confirmation with real Jira Cloud.

files_changed: [src/features/tickets/copyStore.ts, src-tauri/src/commands.rs]
