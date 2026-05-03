import { describe, expect, it } from 'vitest';
import { computeGapFields } from '../computeGapFields';
import type { FieldSchema } from '@/types/fieldSchema';
import type { FieldMappingRow } from '@/features/field-mapping/types';

const f = (
  fieldId: string,
  required: boolean,
  hasDefaultValue?: boolean,
): FieldSchema => ({
  fieldId,
  name: fieldId,
  required,
  ...(hasDefaultValue !== undefined ? { hasDefaultValue } : {}),
  schema: { type: 'string' },
});

const row = (sourceFieldId: string, targetFieldId: string): FieldMappingRow => ({
  sourceFieldId,
  targetFieldId,
  transformerKind: 'identity',
  sourceSchema: { type: 'any' },
  targetSchema: { type: 'any' },
});

describe('computeGapFields', () => {
  it('returns empty when resolvedTargetFields is empty', () => {
    expect(computeGapFields([], [row('a', 'b')])).toEqual([]);
  });

  it('returns empty when no fields are required', () => {
    expect(
      computeGapFields(
        [f('environment', false), f('components', false)],
        [],
      ),
    ).toEqual([]);
  });

  it('filters out required fields with hasDefaultValue=true', () => {
    const fields = [f('environment', true, true), f('components', true)];
    const gaps = computeGapFields(fields, []);
    expect(gaps.map((g) => g.fieldId)).toEqual(['components']);
  });

  it('filters out fields covered by a non-empty mapping row targetFieldId', () => {
    const fields = [f('customfield_10001', true), f('customfield_10002', true)];
    const rows = [row('source_a', 'customfield_10001')];
    const gaps = computeGapFields(fields, rows);
    expect(gaps.map((g) => g.fieldId)).toEqual(['customfield_10002']);
  });

  it('treats empty-string targetFieldId as NOT covering (dismissed-sentinel)', () => {
    const fields = [f('customfield_10001', true)];
    const rows = [row('source_a', '')];
    const gaps = computeGapFields(fields, rows);
    expect(gaps.map((g) => g.fieldId)).toEqual(['customfield_10001']);
  });

  it("always excludes the 'summary' field even when required and unmapped", () => {
    const fields = [f('summary', true), f('environment', true)];
    const gaps = computeGapFields(fields, []);
    expect(gaps.map((g) => g.fieldId)).toEqual(['environment']);
  });

  it("always excludes 'issuetype' — copy_ticket_v2 always injects it", () => {
    const fields = [f('issuetype', true), f('environment', true)];
    const gaps = computeGapFields(fields, []);
    expect(gaps.map((g) => g.fieldId)).toEqual(['environment']);
  });

  it("always excludes 'project' — copy_ticket_v2 always injects it", () => {
    const fields = [f('project', true), f('environment', true)];
    const gaps = computeGapFields(fields, []);
    expect(gaps.map((g) => g.fieldId)).toEqual(['environment']);
  });

  it('excludes all three pipeline-managed fields together', () => {
    const fields = [
      f('summary', true),
      f('issuetype', true),
      f('project', true),
      f('environment', true),
    ];
    const gaps = computeGapFields(fields, []);
    expect(gaps.map((g) => g.fieldId)).toEqual(['environment']);
  });

  it('preserves the input order of remaining gap fields', () => {
    const fields = [
      f('a', true),
      f('b', false), // not required → skip
      f('c', true),
      f('d', true, true), // hasDefault → skip
      f('e', true),
    ];
    const rows = [row('x', 'c')]; // c covered → skip
    const gaps = computeGapFields(fields, rows);
    expect(gaps.map((g) => g.fieldId)).toEqual(['a', 'e']);
  });

  it('returns the original field objects (referential equality preserved)', () => {
    const aField = f('a', true);
    const gaps = computeGapFields([aField], []);
    expect(gaps[0]).toBe(aField); // same reference, useful for React keying
  });
});
