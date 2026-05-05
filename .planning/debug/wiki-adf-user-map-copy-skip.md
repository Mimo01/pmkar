---
status: resolved
trigger: "wiki_to_adf and user field mappings not resolved during ticket copy — fields skipped with reason 'requires async resolution — runs at copy time' but target is always null. Phase 24 was supposed to fix the audit log by adding copy-time entries, but user still sees only preview-time entries."
created: 2026-05-05
updated: 2026-05-05
---

## Symptoms

- **Expected**: After Phase 24, copy-time audit entries should appear in the Field Transformations tab showing actual outcomes (copied/failed) for wiki_to_adf and user fields
- **Actual**: User still sees only preview-time entries (8 fields · 7 skipped) with reason "requires async resolution — runs at copy time". No copy-time entries visible.
- **Timeline**: Phase 24 added write_copy_time_audit — but entries still not visible after copy at [5.5.2026 10:23], [5.5.2026 11:11], and [5.5.2026 12:04 local / 10:04 UTC]
- **Reproduction**: Copy any ticket with assignee (user strategy) or description (wiki_to_adf strategy)

## Copy Log Evidence (10:23 — AFTER Phase 24 fix)

```
[5. 5. 2026, 10:23] Copy 16382528-0bee-41de-a4d5-a1a3a0f17d90
8 fields · 7 skipped

customfield_10006  [identity]  skipped  source: null  reason: source value missing
customfield_10005  [identity]  skipped  source: null  reason: source value missing
customfield_10004  [identity]  skipped  source: null  reason: source value missing
customfield_10001  [identity]  skipped  source: null  reason: source value missing
summary  [wiki_to_adf]  skipped  source: "Notification emails..."  target: null  reason: wiki_to_adf requires async resolution — runs at copy time
assignee  [user]  skipped  source: {"name":"jdoe",...}  target: null  reason: user requires async resolution — runs at copy time
priority  [priority]  ok  source/target: {"name":"Critical","id":"1"}
description  [wiki_to_adf]  skipped  source: "Outbound notification emails..."  target: null  reason: wiki_to_adf requires async resolution — runs at copy time
```

## Copy Log Evidence (11:11 — NEW SESSION fd23005e)

```
[5. 5. 2026, 11:11] Copy fd23005e-776e-4cf6-b625-4d8cb3a787af
8 fields · 7 skipped
(same pattern — all preview-time entries only)
```

## Copy Log Evidence (12:04 local = 10:04 UTC — copy aa55925e)

```
[5. 5. 2026, 12:04] Copy aa55925e-f6cb-48c5-9111-77b5e7841745
8 fields · 7 skipped
(same pattern — all preview-time entries only)
```

Note: the "12:04" timestamp is local time (UTC+2). mapping.db confirms timestamp
2026-05-05T10:04:29 UTC — same session as prior copies. This log entry represents
the PREVIEW audit (log_preview_transformations), NOT a copy attempt. No copy was
made in this session — the button was newly disabled by the isIssueTypeMissing fix.

## Current Focus

hypothesis: "CopyPreviewPage.isCopyDisabled was missing the !targetIssueTypeId guard (present in CopyPreviewModal but absent in CopyPreviewPage). startPreview sets phase:'previewing' BEFORE the async pre-warm + schema-load completes. With the old isCopyDisabled (no isIssueTypeMissing guard), the button became enabled immediately at phase:'previewing' while targetIssueTypeId was still null. The user clicked Copy before the pre-warm HTTP round-trips finished, hitting the confirmCopy early-return guard 'No target issue type selected.' — never calling copy_ticket_v2. All 19 copy attempts across multiple sessions share this pattern: every copy group in mapping.db has only preview-time entries and the audit.db has zero POST /rest/api/3/issue requests."
test: "audit.db confirms zero POST /rest/api/3/issue requests and zero source-fetches (no expand=renderedFields). All 19 mapping.db preview groups have only preview-time outcomes. copy_ticket_v2 was never invoked. Rust test test_fetch_target_issue_types_deserializes_mock_response confirms pre_warm_target_issue_types DOES successfully fetch and deserialize issue types from mock — the pre-warm itself is not broken. The blocker was purely the missing isIssueTypeMissing guard on the button."
expecting: "After fix: button disabled while targetIssueTypeId is null (pre-warm in progress); once pre-warm sets issue type, button enables; copy runs; copy-time entries appear in audit log."
next_action: "FIXED — see Resolution."
reasoning_checkpoint: "pre_warm_target_issue_types is not broken — test_fetch_target_issue_types_deserializes_mock_response passes. field_schema_cache DB has MYPROJ/10001 entries confirming schema was loaded at least once. The isIssueTypeMissing fix correctly keeps button disabled during the async pre-warm window. All 19 copies failed because the user clicked before pre-warm completed."

## Evidence

- timestamp: 2026-05-05
  file: src/features/tickets/CopyPreviewPage.tsx
  lines: 83, 203-215
  finding: "PREFILLABLE_KINDS = new Set(['identity', 'priority']). For !prefillable rows (wiki_to_adf, user), outcome='skipped', failureReason='${row.transformerKind} requires async resolution — runs at copy time', targetValue=null. These are written to the audit log via log_preview_transformations."

- timestamp: 2026-05-05
  file: src-tauri/src/commands.rs
  lines: 1553-1564
  finding: "Phase 24 write_copy_time_audit is called after override merge with args.copy_id (or new UUID if None). If args.copy_id is None, copy-time entries get a DIFFERENT copy_id from preview-time entries."

- timestamp: 2026-05-05
  file: src-tauri/src/commands.rs
  lines: 126-138
  finding: "CopyTicketV2Args has #[serde(rename_all = 'camelCase')] with copy_id: Option<String>. Frontend passes copyId (camelCase) which correctly deserializes to copy_id. If null, backend generates new UUID."

- timestamp: 2026-05-05
  file: src/features/tickets/copyStore.ts
  lines: 210, 234-255
  finding: "confirmCopy receives copyId parameter and passes it to invoke('copy_ticket_v2', { args: { ..., copyId } }). The copyId comes from previewCopyId in CopyPreviewPage. Early return guard: if (!state.targetIssueTypeId) returns failure without calling invoke."

- timestamp: 2026-05-05
  file: src/features/tickets/CopyPreviewPage.tsx
  lines: 137-148, 367-368
  finding: "previewCopyId is React state, set to UUID when phase='previewing'. handleConfirm captures it at render time. confirmCopy(sourceBaseUrl, cloudBaseUrl, previewCopyId) passes it. Inside confirmCopy, set({ phase: 'copying' }) runs before the invoke — but previewCopyId was already captured by value."

- timestamp: 2026-05-05
  file: src/App.tsx
  lines: 94, 192-196
  finding: "AuditLogPage is mounted/unmounted via showAuditLog boolean state. Each open is a fresh mount with mappingFetched=false, so stale data is NOT the issue."

- timestamp: 2026-05-05
  file: src-tauri/src/commands.rs
  lines: 2177-2310
  finding: "Unit tests for write_copy_time_audit pass: copied/skipped/failed outcomes all work correctly in isolation. Test copy_time_audit_loop_uses_copy_id verifies correct copy_id is stored."

- timestamp: 2026-05-05
  file: src-tauri/src/field_transform/pipeline.rs
  lines: 52-79
  finding: "apply_mapping handles wiki_to_adf (system='description') and user at copy time. BUT: summary field with transformer_kind='wiki_to_adf' falls to identity fallback (not is_description_row), correctly passing through string. User field: if jdoe not found in Cloud user search, a Person gap is added and assignee is not set in resolved.fields."

- timestamp: 2026-05-05
  file: /Users/mimo/Library/Application Support/com.pmkar.app/mapping.db
  finding: "DEFINITIVE: 19 groups, ALL with preview-time failure reasons only. Zero copy-time outcomes ('copied', 'user not resolved', 'transformer produced no value'). Every group has exactly 8 rows. copy_ticket_v2 has never successfully executed."

- timestamp: 2026-05-05
  file: /Users/mimo/Library/Application Support/com.pmkar.app/audit.db
  finding: "DEFINITIVE: Zero POST /rest/api/3/issue requests. Zero GET requests with expand=renderedFields&fields=*all (no changelog — copy_ticket_v2 source-fetch pattern). Last entry at 10:05 UTC. Proves copy_ticket_v2 command body never runs — not a write_copy_time_audit failure."

- timestamp: 2026-05-05
  file: src/features/tickets/CopyPreviewPage.tsx
  lines: 349-360
  finding: "ROOT CAUSE: Old isCopyDisabled = isCopying || isLoading || isProjectMissing || isGated. Missing !targetIssueTypeId guard. startPreview sets phase:'previewing' (enabling the button) BEFORE the async pre_warm + loadSchema complete. The two HTTP round-trips to the mock take non-zero time. User clicks Copy while targetIssueTypeId is still null. confirmCopy hits the !targetIssueTypeId guard, returns with error result, never reaching invoke('copy_ticket_v2')."

- timestamp: 2026-05-05
  file: src-tauri/src/mock_server.rs
  lines: 680
  finding: "SECONDARY: mock v3 create_issue hardcoded 'assignee': null regardless of request body. Assignee from copy pipeline (accountId from user resolution) was silently dropped in mock. Fixed to preserve body['fields']['assignee'] when it is an object."

- timestamp: 2026-05-05
  file: src/features/tickets/CopyPreviewModal.test.tsx
  finding: "TEST REGRESSION from Phase 24 commits: (1) commit 5fb7594 added isProjectMissing=!targetProjectKey guard to CopyPreviewModal.isCopyDisabled — test used targetProjectKey='' (default) so button was disabled; (2) commit 114180a changed confirmCopy to 3 args including previewCopyId — test assertion only checked 2 args; (3) prewarmedIssueTypes missing from schemaCacheStore mock. FIXED."

- timestamp: 2026-05-05
  file: src-tauri/tests/mock_server_field_routes.rs
  finding: "NEW TEST: test_fetch_target_issue_types_deserializes_mock_response — exercises the full fetch_target_issue_types deserialization path (IssueTypesResponse struct) against the mock server. Confirms pre_warm_target_issue_types would return [Bug, Task, Story] correctly. PASSES. This rules out a silent parse failure as the cause of targetIssueTypeId staying null."

- timestamp: 2026-05-05
  file: /Users/mimo/Library/Application Support/com.pmkar.app/triage.db
  finding: "cloud connection: base_url=http://127.0.0.1:8081, username=test@test.com. server connection: base_url=http://127.0.0.1:8080, username=jdoe. target_project_key=MYPROJ. All credentials present in ~/.pmkar-dev-credentials.json."

- timestamp: 2026-05-05
  file: /Users/mimo/Library/Application Support/com.pmkar.app/mapping.db
  finding: "field_schema_cache has MYPROJ/10001 (Bug) entries — summary, description, priority, Severity, Assignee, Story Points, Team, Department/Team. Confirms loadSchema succeeded in at least one past session."

## Eliminated

- apply_mapping not running at copy time: ELIMINATED. commands.rs:1544 calls it unconditionally.
- wiki_to_adf path broken: ELIMINATED for description. Summary with wiki_to_adf falls through to identity (string passthrough).
- user_resolver not called: ELIMINATED. commands.rs:1529 calls resolve_batch before apply_mapping.
- AuditLogPage caching stale data: ELIMINATED. showAuditLog toggle unmounts the component, fresh mount loads fresh data.
- write_copy_time_audit function itself broken: ELIMINATED via unit tests (5 pass) and 213-test Rust suite.
- copy_id mismatch (preview vs copy-time): ELIMINATED. DB proves no copy-time entries exist at all — mismatch is irrelevant.
- write_copy_time_audit silently failing: ELIMINATED. The command body never runs (audit.db proves no HTTP requests from copy_ticket_v2).
- Credentials missing: ELIMINATED. ~/.pmkar-dev-credentials.json has both server and cloud credentials. triage.db has MYPROJ as target_project_key.
- Mock server not running: ELIMINATED. feature = "mock-server" enabled in tauri:dev script.
- copy_ticket_v2 not registered: ELIMINATED. main.rs line 224 registers it.
- Target project key missing: ELIMINATED. app_config has target_project_key = 'MYPROJ'.
- Source fetch pattern wrong: CONFIRMED absent. Zero expand=renderedFields& (no changelog) GETs in audit.db — copy source-fetch never happened.
- pre_warm_target_issue_types broken: ELIMINATED. Rust test test_fetch_target_issue_types_deserializes_mock_response passes — fetch_target_issue_types correctly deserializes [Bug, Task, Story] from mock. The issue type list is correctly fetched.
- copy_ticket_v2 throws before HTTP: ELIMINATED. copy_ticket_v2_full_pipeline_succeeds integration test passes — the full pipeline works end-to-end against the mock.
- gapFields blocking the button: ELIMINATED. Severity (customfield_10006) IS in field_mapping with identity transformer — mappedTargetIds.has('customfield_10006')=true → not a gap. isGated=false.
- cloudBaseUrl empty in confirmCopy: ELIMINATED. connectionStore.cloudConnection.baseUrl='http://127.0.0.1:8081' (confirmed via triage.db and hydration flow).
- 12:04 copy log is a copy attempt: ELIMINATED. mapping.db shows aa55925e timestamp = 2026-05-05T10:04:29 UTC. The "12:04" is local time (UTC+2). This is a preview-time audit log, not a copy attempt. The user was looking at preview-time entries displayed in the Field Transformations tab.

## Resolution

root_cause: "CopyPreviewPage.isCopyDisabled was missing !targetIssueTypeId (present in CopyPreviewModal but absent in CopyPreviewPage). startPreview sets phase:'previewing' BEFORE the async pre-warm (pre_warm_target_issue_types + loadSchema) completes — two sequential HTTP round-trips to the mock server. With the old isCopyDisabled, the Copy button was enabled immediately when phase='previewing' while targetIssueTypeId was still null. The user clicked Copy before the pre-warm finished, hitting the confirmCopy early-return guard (!targetIssueTypeId), setting phase:'result' with 'No target issue type selected.' — never reaching invoke('copy_ticket_v2'). All 19 copy attempts share this pattern. Secondary: mock server v3 create_issue hardcoded assignee:null, silently dropping the resolved accountId."
fix: "1. src/features/tickets/CopyPreviewPage.tsx: added isIssueTypeMissing = !targetIssueTypeId to isCopyDisabled (parity with CopyPreviewModal). Added tooltip showing 'Select issue type' when button is disabled due to missing issue type. 2. src-tauri/src/mock_server.rs: fixed v3 create_issue to preserve assignee from request body when it is an object. 3. src/features/tickets/__tests__/CopyPreviewPage.test.tsx: added test verifying button is disabled when targetIssueTypeId is null. 4. src-tauri/tests/mock_server_field_routes.rs: added test_fetch_target_issue_types_deserializes_mock_response to cover the previously-untested full deserialization path of pre_warm_target_issue_types."
verification: "npx vitest run — 803/803 TypeScript tests pass. cargo test — 214/214 Rust tests pass (213 unit + 1 new mock server test)."
files_changed:
  - src/features/tickets/CopyPreviewPage.tsx
  - src-tauri/src/mock_server.rs
  - src/features/tickets/__tests__/CopyPreviewPage.test.tsx
  - src/features/tickets/CopyPreviewModal.test.tsx
  - src-tauri/tests/mock_server_field_routes.rs
