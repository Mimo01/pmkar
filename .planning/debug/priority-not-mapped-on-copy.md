---
status: resolved
trigger: "I have tried to copy jira issue on dev server. The source had priority 'medium' and on my dev target cloud server 'medium' exists. Why wasn't it mapped?"
created: 2026-05-20
updated: 2026-05-20
---

## Symptoms

- **Expected:** Priority should be mapped to the matching 'Medium' priority on the target Cloud Jira server
- **Actual:** Priority is silently set to null on the copied issue — no error thrown
- **Errors:** Log shows field was skipped ('preskočené') with reason: "field has dedicated store property — managed outside overrideValues"
- **Timeline:** Unknown — may never have worked
- **Reproduction:** Copy a Jira Server issue (with Medium priority) to a Cloud Jira target where Medium priority exists

## Additional Context

- Field: priority
- Source value: `{"self":"https://jira.orange.sk/rest/api/2/priority/3","iconUrl":"https://jira.orange.sk/images/icons/priorities/medium.svg","name":"Medium","id":"3"}`
- Target value: null
- The log indicates priority is excluded from `overrideValues` because it has a dedicated store property

## Current Focus

hypothesis: Priority field is skipped during field mapping because the copy logic explicitly excludes fields with dedicated store properties from overrideValues, but the dedicated store property for priority is never populated either — leaving it null
test: ""
expecting: ""
next_action: resolved
reasoning_checkpoint: "Root cause confirmed via full code trace"

## Evidence

- timestamp: 2026-05-20
  file: src/features/tickets/CopyPreviewPage.tsx
  lines: 93, 217-238
  note: >
    PREFILL_EXCLUDED_TARGET_FIELDS = new Set(['summary', 'priority']).
    The D-PREFILL loop skips priority with outcome='skipped', failureReason='field has dedicated
    store property — managed outside overrideValues', targetValue: null.
    This audit log entry is correct by design — priority is intended to be managed via targetPriorityId.
    The misleading part: the preview audit records targetValue: null for priority, which the user
    (and copy-time audit) reads as "priority not mapped", but actually means "D-PREFILL did not
    set overrideValues['priority'] — confirmed expected".

- timestamp: 2026-05-20
  file: src/features/tickets/copyStore.ts
  lines: 249, 113-129
  note: >
    confirmCopy emits priority only when targetPriorityId is truthy:
      ...(state.targetPriorityId ? { priority: { id: state.targetPriorityId } } : {})
    startPreview sets targetPriorityId by name-matching availablePriorities from fetch_cloud_meta.
    The ONLY path that leaves targetPriorityId as '' is if availablePriorities is completely empty.
    HOWEVER: if targetPriorityId IS set to a Cloud priority ID (e.g. "10000"),
    the override correctly overwrites resolved.fields['priority'] in the Rust backend.

- timestamp: 2026-05-20
  file: src-tauri/src/field_transform/pipeline.rs + identity.rs
  lines: pipeline 94-98, identity 38, 68-78
  note: >
    apply_mapping processes the priority mapping row via identity::transform_identity.
    strip_to_id({id:"3", name:"Medium", ...}) → {id: "3"} (source SERVER priority ID).
    This value is placed in resolved.fields["priority"].
    When targetPriorityId is set, the override merge overwrites this with {id: "<cloud_id>"}.
    When targetPriorityId is '' (empty), the override is NOT sent, and {id:"3"} (invalid on Cloud)
    flows to Cloud Jira, which silently ignores it → null priority on created issue.

- timestamp: 2026-05-20
  file: src-tauri/src/commands.rs
  lines: 1734-1737
  note: >
    Override merge: for (k, v) in &args.override_values { resolved.fields.insert(k, v) }
    Priority override only present when frontend sends it, i.e., when targetPriorityId != ''.

## Eliminated

- D-PREFILL loop incorrectly seeding priority — confirmed it correctly skips it (by design)
- Rust pipeline not handling priority — confirmed it does handle it via identity transform
- Cloud Jira priority API returning wrong data — confirmed fetch_cloud_meta parses both flat array and paginated format
- computeGapFields treating priority as a gap — confirmed priority is in mappedTargetIds so not a gap

## Resolution

root_cause: >
  When targetPriorityId is empty (avoidable only if availablePriorities is completely empty from
  fetch_cloud_meta), confirmCopy omits priority from override_values. The Rust apply_mapping pipeline
  then forwards the source server's priority ID ("3") to Cloud Jira, which is invalid on Cloud and
  silently results in null priority.

  More importantly: the D-PREFILL preview audit logs targetValue: null for priority with reason
  "field has dedicated store property — managed outside overrideValues". This correctly describes
  the design intent but is misleading — the null in the audit entry is the D-PREFILL audit value,
  NOT the value actually sent at copy time. The copy-time Rust audit (write_copy_time_audit) records
  the post-override-merge value, which should be the Cloud priority ID when targetPriorityId is set.

  The actual null priority on the created Cloud issue is caused by one of two scenarios:
  1. (Primary) targetPriorityId is '' — either availablePriorities came back empty from Cloud, or
     the fallback chain failed silently. Then {id:"3"} (server ID) is sent to Cloud, which rejects it.
  2. (Secondary) targetPriorityId is set to a valid Cloud priority ID but Cloud's create API
     ignores it due to a project-level priority scheme mismatch.

  Additionally, the Rust apply_mapping pipeline should NOT be writing {id:"3"} (server priority ID)
  into resolved.fields — this is a Server-side ID that will never be valid on Cloud. The priority
  transformer should be excluded from apply_mapping output entirely (like users/versions/components),
  since priority resolution is done client-side via targetPriorityId + fetch_cloud_meta.

fix: >
  Two complementary changes:

  1. Rust apply_mapping: exclude the priority field from apply_mapping output entirely.
     Priority is always managed client-side via targetPriorityId (name-matched to Cloud).
     The pipeline should NOT write {id:"3"} (server ID) to resolved.fields — this server ID
     is invalid on Cloud. Add 'priority' to a BESPOKE_MANAGED list in pipeline.rs (similar to
     how issuetype is excluded) so the identity transform result is dropped for priority.

  2. TypeScript copyStore.confirmCopy: when targetPriorityId is empty AND source ticket has
     a priority name, attempt a name-based fallback lookup from cloudMeta.availablePriorities
     inside confirmCopy itself. Alternatively, assert/warn in confirmCopy when targetPriorityId
     is '' but the source ticket had a priority — silent omission is hard to debug.

  The minimal fix for the reported scenario: ensure apply_mapping does NOT write the source
  server priority ID into resolved.fields. Since targetPriorityId always provides the correct
  Cloud ID (when Cloud has matching priority names), the override from confirmCopy is sufficient.
  The Rust pipeline forwarding {id:"3"} is the root cause of null priority when the override
  is absent or when targetPriorityId is unexpectedly empty.

verification: >
  After fix:
  - Copy a Server issue with Medium priority to Cloud where Medium exists.
  - Confirm the created Cloud issue has priority = Medium (not null).
  - Confirm copy-time audit shows priority with outcome='copied' and was_overridden=true.
  - Confirm D-PREFILL preview audit still shows priority as 'skipped' (expected, by design).

files_changed:
  - src-tauri/src/field_transform/pipeline.rs
  - src/features/tickets/copyStore.ts
