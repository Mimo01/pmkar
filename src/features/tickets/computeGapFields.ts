import type { FieldSchema } from '@/types/fieldSchema';
import type { FieldMappingRow } from '@/features/field-mapping/types';

/**
 * Phase 22 — derive the `FieldSchema[]` of required-but-unmapped target fields
 * for the currently-selected target issue type.
 *
 * A field is a "gap" iff:
 *   1. It is marked required (`required === true`) by createmeta.
 *   2. It does NOT advertise a server-side default (`hasDefaultValue !== true`).
 *   3. No saved mapping row points to its `fieldId` with a non-empty
 *      `targetFieldId`. The empty-string sentinel (Phase 21 D-07) is a
 *      dismissed suggestion, NOT a coverage commitment, so it does not
 *      remove a field from the gap list.
 *   4. It is NOT one of the pipeline-managed fields that `copy_ticket_v2`
 *      always injects unconditionally regardless of the mapping:
 *        - `summary`  — dedicated input (D-01) above the form
 *        - `issuetype` — always set from `args.target_issue_type_id`
 *        - `project`  — always set from the configured target project key
 *
 * Output preserves the input order of `resolvedTargetFields`.
 *
 * Pure function — no React, no store reads. Tested in isolation.
 */

// Fields that copy_ticket_v2 always injects — never a user-fillable gap.
const PIPELINE_MANAGED_FIELDS = new Set(['summary', 'issuetype', 'project']);

export function computeGapFields(
  resolvedTargetFields: FieldSchema[],
  mappingRows: FieldMappingRow[],
): FieldSchema[] {
  if (!resolvedTargetFields.length) return [];
  const mappedTargetIds = new Set<string>();
  for (const row of mappingRows) {
    if (row.targetFieldId && row.targetFieldId !== '') {
      mappedTargetIds.add(row.targetFieldId);
    }
  }
  const out: FieldSchema[] = [];
  for (const f of resolvedTargetFields) {
    if (!f.required) continue;
    if (f.hasDefaultValue === true) continue;
    if (mappedTargetIds.has(f.fieldId)) continue;
    if (PIPELINE_MANAGED_FIELDS.has(f.fieldId)) continue;
    out.push(f);
  }
  return out;
}
