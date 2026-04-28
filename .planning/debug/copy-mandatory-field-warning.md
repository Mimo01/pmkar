---
status: resolved
trigger: "On the copy screen if a field is mandatory and a mapping for it exists, it still doesnt allow me to map it and shows a warning"
created: 2026-04-29
updated: 2026-04-29
---

# Debug Session: copy-mandatory-field-warning

## Symptoms

- expected: Warning clears AND mapped value is pre-filled in target field when a valid mapping exists for a mandatory field
- actual: Warning still shown for mandatory fields even when a mapping exists; copy is not fully blocked but warning persists
- scope: All mandatory fields with mappings are affected
- timeline: Recent regression — was working before a recent change
- reproduction: Go to copy screen, configure a mapping for a mandatory field, observe warning still shows and blocks proceeding

## Current Focus

hypothesis: "UNIQUE INDEX on target_field_id includes the empty-string dismissed sentinel, blocking all but one dismiss/add row operation"
test: "multiple_empty_sentinel_rows_are_allowed and real_mapping_can_be_added_after_multiple_dismissals"
expecting: "All empty-string sentinel rows coexist; adding a real mapping row for a mandatory field always succeeds"
next_action: "resolved — fix applied and tests pass"
reasoning_checkpoint: "The ADD_UNIQUE_TARGET migration added an unconditional UNIQUE INDEX on target_field_id including the empty string. DEDUP_TARGETS (same commit) also silently reduced multiple dismissed rows to one. Together these prevented users from adding new mapping rows (any new row starts with targetFieldId='') if another dismissed row already existed. The mandatory target field remained in gapFields indefinitely."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-04-29T00:19:00
  type: code_read
  note: "computeGapFields.ts logic is correct — uses mappedTargetIds.has(f.fieldId) to exclude mapped targets"

- timestamp: 2026-04-29T00:19:30
  type: code_read
  note: "field_mapping_db.rs — ADD_UNIQUE_TARGET creates UNIQUE INDEX on ALL target_field_id values including empty string ''"

- timestamp: 2026-04-29T00:20:00
  type: code_read
  note: "DEDUP_TARGETS SQL groups by target_field_id including '' — reduces multiple dismissed rows to one MAX(id) row"

- timestamp: 2026-04-29T00:20:30
  type: hypothesis_confirmed
  note: "handleSelectNewSource in FieldMappingSection creates row with targetFieldId=''. If another ''-row exists, UNIQUE constraint fires, save fails, user cannot add the mapping, mandatory field stays in gapFields"

- timestamp: 2026-04-29T00:21:00
  type: fix_applied
  note: "Changed DEDUP_TARGETS to only deduplicate non-empty target_field_id values; added DROP_OLD_TARGET_INDEX migration step; changed ADD_UNIQUE_TARGET to partial index WHERE target_field_id != ''"

## Eliminated

- timing race in CopyPreviewPage useEffect — mappingRows fetch would eventually resolve; not a persistent bug
- schema field ID mismatch — fieldId is global per project, consistent across issue types
- DEDUP_TARGETS deleting real mapping rows — DEDUP only causes persistent loss for empty-string sentinel rows

## Resolution

root_cause: "The UNIQUE INDEX on target_field_id (added in fix quick-260428-525) was unconditional — it included the empty-string dismissed-suggestion sentinel (''), so only one dismissed/incomplete mapping row could exist at a time. Any attempt to add a second mapping row (which starts with targetFieldId='') failed with a UNIQUE constraint error. The user could not create a mapping for the mandatory field, which remained in gapFields and showed the warning indefinitely."
fix: "Changed DEDUP_TARGETS to only deduplicate non-empty target_field_id rows; added DROP_OLD_TARGET_INDEX migration to replace the old unconditional index; changed ADD_UNIQUE_TARGET to a partial unique index (WHERE target_field_id != '') that excludes the dismissed sentinel from uniqueness enforcement."
verification: "cargo test: 182 lib tests pass including duplicate_target_field_id_is_rejected (non-empty duplicates still rejected), multiple_empty_sentinel_rows_are_allowed (3 dismissed rows coexist), real_mapping_can_be_added_after_multiple_dismissals (real mapping succeeds after 2 dismissals). Frontend vitest: 35 tests pass."
files_changed:
  - src-tauri/src/field_mapping_db.rs
