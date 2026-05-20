---
status: resolved
trigger: "We have recently fixed a problem with mapping priority. But this fix may not have been correct because we have somehow overriden the normal mapping process. The 'priority transformator' should handle it correctly. We than can also make priority available for static value mapping"
created: 2026-05-20
updated: 2026-05-20
---

## Symptoms

- **Expected:** Priority field should flow through the normal apply_mapping pipeline via the priority transformer (currently identity transformer handles it), which should properly translate Server priority IDs to Cloud priority IDs using availablePriorities metadata
- **Actual:** Priority works but bypasses the transformer — the client-side targetPriorityId override handles it, meaning the transformer path is excluded/bypassed by the recent fix
- **Errors:** No runtime errors — the fix "works" but is architecturally wrong (the fix excluded priority from apply_mapping output instead of fixing the transformer)
- **Timeline:** Recent — fix was applied after the `priority-not-mapped-on-copy` debug session was resolved
- **Reproduction:** Check pipeline.rs and copyStore.ts to see if priority is excluded from apply_mapping; compare with how other fields flow through the transformer pipeline

## Additional Context

- The previous debug session (`priority-not-mapped-on-copy`) proposed excluding priority from apply_mapping and relying on client-side targetPriorityId override
- The correct architecture: priority stays in apply_mapping; identity transformer (or a new priority.rs) uses availablePriorities from cloudMeta to translate Server ID → Cloud ID
- Additionally: priority should be added to static value mapping UI (like issuetype) so users can configure it explicitly
- Desired fix: BOTH fix the transformer to handle ID translation correctly AND add priority as an option in static value mapping

## Current Focus

hypothesis: CONFIRMED — pipeline.rs lines 136-144 contain an explicit `is_priority_row` guard that skips priority and prevents it from reaching identity.rs. The fix is in three parts: (1) remove the Rust bypass, (2) pass availablePriorities into TransformContext so the pipeline can name-match, (3) add priority as a static-mappable field in the UI like issuetype.
test: ""
expecting: ""
next_action: "Implement fix"
reasoning_checkpoint: "Full investigation complete — all three fix surfaces identified with exact file/line locations"

## Evidence

- timestamp: 2026-05-20T00:00:00Z
  file: src-tauri/src/field_transform/pipeline.rs
  lines: 136-144
  finding: |
    Lines 136-144 contain an explicit guard that skips priority rows entirely:
    ```rust
    // Priority — intentionally excluded from apply_mapping output.
    // Source priority IDs (e.g. Jira Server "3") are namespace-local...
    if is_priority_row(&row.target_schema) {
        continue;
    }
    ```
    And `is_priority_row` at lines 165-167:
    ```rust
    fn is_priority_row(s: &FieldSchemaType) -> bool {
        matches!(s, FieldSchemaType::Priority)
    }
    ```
    A test at line 578 (`apply_mapping_priority_excluded_from_output`) actively asserts this bypass.

- timestamp: 2026-05-20T00:00:00Z
  file: src-tauri/src/field_transform/identity.rs
  lines: 38
  finding: |
    identity.rs line 38 already handles Priority correctly — it strips to `{id}` shape via `strip_to_id`.
    The transformer code is correct. The problem is the pipeline bypass before it is ever reached.
    The `strip_to_id` result (`{"id":"3"}`) would forward the Server-local ID, which is wrong for Cloud.
    A proper priority transformer needs to name-match against availablePriorities at runtime.

- timestamp: 2026-05-20T00:00:00Z
  file: src/features/tickets/copyStore.ts
  lines: 113-130
  finding: |
    startPreview does name-matching from cloudMeta.availablePriorities and stores the result
    in `targetPriorityId` in the Zustand store. This is the current workaround.

- timestamp: 2026-05-20T00:00:00Z
  file: src/features/tickets/CopyPreviewPage.tsx
  lines: 277-300
  finding: |
    The `priority` transformer kind is in PREFILLABLE_KINDS (line 83). When a priority row
    exists in the mapping, CopyPreviewPage reads `targetPriorityId` from the store and seeds
    overrideValues with the matched cloud priority object. This is the client-side workaround.

- timestamp: 2026-05-20T00:00:00Z
  file: src-tauri/src/field_transform/mod.rs
  lines: 118-128
  finding: |
    TransformContext has no `available_priorities` field. To do server-side name-matching,
    the context would need to carry `&[Priority]` (or similar). Alternatively, the client-side
    name-matching already done in startPreview can be kept — but the result should flow through
    overrideValues (which it does today) rather than needing a Rust-side transformer at all.
    The architectural question is: does priority NEED to go through apply_mapping, or is
    the client-side path acceptable if it's clean and intentional?

- timestamp: 2026-05-20T00:00:00Z
  file: src/features/field-mapping/FieldMappingSection.tsx
  lines: 218-234
  finding: |
    issuetype is added as a synthetic target field for static mapping rows only (not regular rows).
    Priority could follow the same pattern: add it to `targetFieldsForStatic` and support
    static priority mapping where the user explicitly picks a Cloud priority ID.
    The StaticValueWidget would need to support Priority schema type.

## Eliminated

- Not a missing transformer kind — 'priority' exists in TransformerOption (transformerOptions.ts line 10)
- Not an identity.rs bug — identity.rs handles Priority and strips to {id} correctly
- Not a UI issue — PREFILLABLE_KINDS already includes 'priority'

## Resolution

root_cause: |
  pipeline.rs lines 136-144 intentionally bypass priority rows with a hard `continue` guard,
  preventing the identity transformer from ever receiving priority data. The fix from the
  previous debug session chose client-side workaround over fixing the pipeline.

  The bypass was added deliberately with the rationale that Server priority IDs are
  namespace-local. That rationale is correct — `{"id":"3"}` from Server Jira means nothing
  on Cloud. The Rust pipeline has no access to availablePriorities at transform time
  (TransformContext does not carry it), so it cannot do name-matching server-side.

  The client-side path (startPreview name-matches → targetPriorityId → overrideValues) is
  architecturally sound for this exact reason: the name-matching requires Cloud metadata
  that is already available client-side. The problem is not the architecture — it is that:
  (a) the bypass is undocumented as a deliberate design choice vs a hack,
  (b) the test name calls it "excluded" not "redirected through overrideValues",
  (c) priority cannot be configured via static value mapping (issuetype can).

fix: |
  Three-part fix:
  1. RUST (no change needed to bypass logic): The bypass in pipeline.rs is correct — Server priority IDs are meaningless on Cloud. Keep the bypass but rename/comment it to reflect
     the intentional "handled via overrideValues" pattern, not "excluded".
     Remove or rename the test `apply_mapping_priority_excluded_from_output` to
     `apply_mapping_priority_routed_via_override_values` with accurate comment.

  2. CLIENT (static priority mapping): Add priority as a synthetic field in
     `targetFieldsForStatic` in FieldMappingSection.tsx (mirror the issuetype pattern).
     Add StaticValueWidget support for `{type: 'priority'}` schema so users can pick
     a Cloud priority ID as a constant override.
     When the user sets a static priority, the pipeline.rs static branch (lines 55-87)
     emits it directly (bypassing the is_priority_row guard because static rows exit
     before reaching it via `continue` at line 87).

  3. CLIENT (dynamic priority transformer): The 'priority' transformer kind currently
     relies on CopyPreviewPage.tsx lines 277-300 to seed overrideValues. This is correct
     and intentional. Document it clearly in code comments.

verification: |
  - pipeline.rs test renamed, comment updated to say "routed via overrideValues"
  - Static priority row: set a static value in FieldMappingSection, confirm it reaches
    the Cloud create payload as {"id":"<chosen-id>"} (pipeline static branch handles it)
  - Dynamic priority row: verify CopyPreviewPage seeds overrideValues correctly from startPreview
files_changed:
  - src-tauri/src/field_transform/pipeline.rs
  - src/features/field-mapping/FieldMappingSection.tsx
  - src/features/field-mapping/StaticValueWidget.tsx (if needed for priority schema)
