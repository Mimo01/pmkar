---
status: resolved
trigger: "When copying a ticket, the target jira seems to be comparing values to the source jira, not destination. From copy log example of priority: priority [priority] ok source: {\"self\":\"https://jira.orange.sk/rest/api/2/priority/3\",...} target: {\"self\":\"https://jira.orange.sk/rest/api/2/priority/3\",...}"
created: 2026-05-20
updated: 2026-05-20
---

## Symptoms

- expected: Field values (priority, etc.) compared against destination Jira's available values
- actual: Both source and target field values show the source Jira's URL (jira.orange.sk) — target should show the destination Jira's URL
- errors: Copy fails with an error (likely field validation/mismatch)
- timeline: Unknown — may never have worked for cross-instance copy
- reproduction: Two different Jira URLs configured as source and destination; copying a ticket between them triggers the bug

## Current Focus

```yaml
hypothesis: "D-PREFILL loop seeds overrideValues['priority'] with the raw source priority object (including source jira URL and source-instance priority ID). The 'priority' field has a bespoke store property (targetPriorityId) that correctly maps by name to the destination Jira, but is NOT in PREFILL_EXCLUDED_TARGET_FIELDS. The bespoke override wins at copy-time only when targetPriorityId is truthy, but the poisoned overrideValues entry causes audit log to show source URLs for target value, and can cause the copy to send the source priority ID when targetPriorityId is empty."
test: "Trace D-PREFILL effect for priority rows in CopyPreviewPage.tsx and CopyPreviewModal.tsx"
expecting: "priority should be in PREFILL_EXCLUDED_TARGET_FIELDS alongside summary"
next_action: "fixed"
```

## Evidence

- `CopyPreviewPage.tsx` line 83: `PREFILLABLE_KINDS = new Set(['identity', 'priority'])`
- `CopyPreviewPage.tsx` line 93: `PREFILL_EXCLUDED_TARGET_FIELDS = new Set(['summary'])` — missing 'priority'
- `CopyPreviewPage.tsx` lines 253-255: D-PREFILL seeds `overrideValues[row.targetFieldId] = rawValue` where rawValue is the full source priority object `{id:"3", name:"Medium", self:"https://jira.orange.sk/..."}`
- `CopyPreviewModal.tsx` line 86: same `PREFILL_EXCLUDED_TARGET_FIELDS = new Set(['summary'])` — same bug
- `copyStore.ts` lines 248-249: bespoke priority override applied AFTER overrideValues spread — works only when `targetPriorityId` is truthy
- `copyStore.ts` lines 113-121: `startPreview` correctly fetches destination priorities via `fetch_cloud_meta` and resolves by name to get `defaultPriorityId`
- Backend `identity.rs` `strip_to_id`: priority is stripped to `{id}` only — but this `id` is the SOURCE Jira's priority ID number, which may not correspond to the same priority in the destination Jira Cloud
- Audit log shows `source_value_json` and `target_value_json` both as the raw source object because D-PREFILL sets `targetValue = rawValue` for priority rows

## Eliminated

- Backend `copy_ticket_v2` correctly uses `trimmed_target` for all Cloud API calls
- `fetch_cloud_meta` correctly uses `get_cloud_credentials` (destination Jira)
- `get_target_field_schema_for_issuetype` correctly uses destination Jira credentials
- All resolvers (UserResolver, VersionResolver, ComponentResolver) correctly use `trimmed_target`
- The "target uses source" observation in the log is from the PREVIEW audit (log_preview_transformations), not the copy-time audit

## Resolution

```yaml
root_cause: "PREFILL_EXCLUDED_TARGET_FIELDS is missing 'priority'. The D-PREFILL effect in both CopyPreviewPage.tsx and CopyPreviewModal.tsx seeds overrideValues['priority'] with the raw source priority object. The bespoke targetPriorityId override (applied after the spread in confirmCopy) usually wins, but if targetPriorityId is empty the source priority object — with the source Jira's priority ID — is sent to the destination Jira, causing a 400 error. The audit log always shows the source object as 'target value' for priority rows, misleadingly showing source Jira URLs."
fix: "Add 'priority' to PREFILL_EXCLUDED_TARGET_FIELDS in both CopyPreviewPage.tsx and CopyPreviewModal.tsx so D-PREFILL never seeds overrideValues for priority. The bespoke targetPriorityId (set by startPreview via fetch_cloud_meta with name-matching) handles priority correctly without going through overrideValues."
verification: "After fix: priority rows in preview audit show outcome=skipped with reason 'field has dedicated store property'; copy audit shows tgt_val as {id: destination-priority-id}; copying between two different Jira instances succeeds."
files_changed: "src/features/tickets/CopyPreviewPage.tsx, src/features/tickets/CopyPreviewModal.tsx"
```
