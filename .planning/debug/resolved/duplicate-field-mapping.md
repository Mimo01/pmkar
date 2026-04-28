---
slug: duplicate-field-mapping
status: resolved
trigger: "What happens when two fields are mapped to the same field?"
created: 2026-04-28
updated: 2026-04-28
---

## Symptoms

- **Expected behavior:** Unknown — not yet determined
- **Actual behavior:** Unknown — not yet tested
- **Error messages:** None observed
- **Timeline:** Hypothetical investigation — hasn't been explicitly tested
- **Reproduction:** Map two source fields to the same target field in the field mapping configuration UI

## Scope

Full stack: UI/form layer, data layer (state/storage), sync/export layer

## Current Focus

- hypothesis: "Duplicate target field mappings are permitted at every layer — no deduplication exists. During copy, the last source field processed wins and overwrites the first. computeGapFields treats the target as covered by the first row found, so gaps disappear silently."
- test: "n/a — behavioral investigation only"
- expecting: "see Resolution below"
- next_action: "investigation complete"
- reasoning_checkpoint: "Traced through DB schema, UI combobox items, apply_mapping loop, and computeGapFields. All four layers confirmed."
- tdd_checkpoint: ""

## Evidence

- timestamp: 2026-04-28T00:00:00Z
  layer: DB schema (field_mapping_db.rs:36-46)
  finding: >
    The `field_mapping` table has `UNIQUE(source_field_id)` only — there is NO
    unique constraint on `target_field_id`. Multiple rows can share the same
    `target_field_id` value. The `upsert_mapping_row` function conflicts on
    `source_field_id`, not `target_field_id`, so inserting two rows with different
    source_field_ids but the same target_field_id succeeds without error.

- timestamp: 2026-04-28T00:00:01Z
  layer: UI — target combobox (MappingRow.tsx:97-113)
  finding: >
    The target combobox in MappingRow renders `items={targetFields}` — the full
    unfiltered target field list. There is no filter removing already-mapped
    target fields. The user can freely select the same target field for two
    different source rows. No warning, badge, or validation is shown.

- timestamp: 2026-04-28T00:00:02Z
  layer: UI — new source row (FieldMappingSection.tsx:368)
  finding: >
    The "Add row" source combobox DOES filter out already-mapped source fields:
    `sourceFields.filter((sf) => !mappingRows.some((r) => r.sourceFieldId === sf.fieldId))`.
    This prevents duplicate source entries but does nothing to prevent two
    different sources mapping to the same target.

- timestamp: 2026-04-28T00:00:03Z
  layer: apply_mapping pipeline (pipeline.rs:25-73)
  finding: >
    `apply_mapping` iterates over `mapping` (a `&[FieldMappingRow]`) and writes
    into a `Map<String, Value>` keyed by `target_field_id`. When two rows share
    the same target_field_id, the loop calls `fields.insert(row.target_field_id, ...)` twice.
    `serde_json::Map::insert` replaces on duplicate key. The LAST row in the array
    (ordered by DB insertion order `id ASC`) wins. The first row's output is
    silently overwritten. No error, no warning, no gap is emitted.

- timestamp: 2026-04-28T00:00:04Z
  layer: computeGapFields (computeGapFields.ts:27-32)
  finding: >
    `computeGapFields` builds a `Set<string>` of mapped target IDs from all rows.
    If two source rows point to the same target, that target appears once in the
    Set. The target is considered "covered" regardless of the duplication.
    This means: if target T is required and two sources map to it, T is treated
    as covered and does NOT appear in the gaps section. The user gets no signal
    that the mapping is ambiguous.

- timestamp: 2026-04-28T00:00:05Z
  layer: audit log (commands.rs:1527-1577)
  finding: >
    During copy, the audit loop iterates over ALL mapping_rows and logs an audit
    entry for each, keyed by `target_field_id`. With duplicates, two audit rows
    with the same `target_field_id` are inserted. The audit table has no unique
    constraint on `(copy_id, target_field_id)`, so both persist.
    The `was_overridden` flag is checked against `args.override_values` by
    target_field_id — both rows get the same override flag, giving a misleading
    audit trail.

- timestamp: 2026-04-28T00:00:06Z
  layer: tests
  finding: >
    No test in pipeline.rs, FieldMappingSection.test.tsx, MappingRow.test.tsx,
    or computeGapFields.test.ts covers the duplicate-target-field scenario.

## Eliminated Hypotheses

- "The DB enforces uniqueness on target_field_id" — ELIMINATED. Only source_field_id is UNIQUE in the schema.
- "The UI prevents selecting an already-used target" — ELIMINATED. targetFields are passed unfiltered to the combobox.
- "An error is returned to the caller on duplicate" — ELIMINATED. The last-writer-wins behavior is silent.

## Resolution

- root_cause: >
    No layer enforces uniqueness on `target_field_id`. The DB schema constrains
    only `source_field_id`. The UI target combobox has no filter. The
    `apply_mapping` pipeline writes to a keyed map so the last matching row
    silently overwrites earlier ones. `computeGapFields` treats the target as
    covered regardless. The result: two source fields mapped to the same target
    — the first source's transformed value is silently discarded at copy time,
    replaced by the second source's value. No error, no warning, no gap.

- fix: >
    Not determined — this is a find_root_cause_only session. Possible approaches:
    (A) Enforce UNIQUE(target_field_id) in the DB and return a user-facing error
        on conflict; (B) filter already-used targets from the target combobox items
        in MappingRow; (C) detect duplicates in apply_mapping and emit a TransformError
        or structured warning; (D) some combination. The correct UX decision (which
        source wins, or whether to error, or to warn visually) needs a product spec.

- verification: ""
- files_changed: []
