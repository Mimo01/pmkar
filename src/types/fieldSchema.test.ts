import { describe, it, expect } from 'vitest';
import {
  type FieldSchema,
  type FieldSchemaType,
  isArrayField,
  isCascadingField,
  isCustomField,
  isOptionField,
  isUnsupportedField,
  parseFieldSchemas,
} from './fieldSchema';

const BUG_PAGE_1: unknown = [
  { fieldId: 'summary', key: 'summary', name: 'Summary', required: true, schema: { type: 'string', system: 'summary' } },
  { fieldId: 'priority', key: 'priority', name: 'Priority', required: true, schema: { type: 'priority', system: 'priority' } },
  { fieldId: 'customfield_10006', key: 'customfield_10006', name: 'Severity', required: true, schema: { type: 'option', custom: '...:select', customId: 10006 } },
  { fieldId: 'assignee', key: 'assignee', name: 'Assignee', required: false, schema: { type: 'user', system: 'assignee' } },
  { fieldId: 'customfield_10001', key: 'customfield_10001', name: 'Story Points', required: false, schema: { type: 'number', custom: '...:float', customId: 10001 } },
];

const CASCADING_FIELD: unknown = {
  fieldId: 'customfield_10005', name: 'Department/Team', required: false,
  schema: { type: 'option-with-child', custom: '...:cascadingselect', customId: 10005 },
};

const ARRAY_OPTION_FIELD: unknown = {
  fieldId: 'customfield_10004', name: 'Team', required: false,
  schema: { type: 'array', items: 'option', custom: '...:multiselect', customId: 10004 },
};

const UNKNOWN_FIELD: unknown = {
  fieldId: 'watcher_field', name: 'Watcher', required: false,
  schema: { type: 'watches' },
};

describe('parseFieldSchemas', () => {
  it('parses a Bug page-1 createmeta response into typed FieldSchema[]', () => {
    const parsed = parseFieldSchemas(BUG_PAGE_1);
    expect(parsed).toHaveLength(5);
    expect(parsed[0].fieldId).toBe('summary');
    expect(parsed[0].schema.type).toBe('string');
  });

  it('handles unknown schema.type by treating it as any-variant (no throw)', () => {
    const parsed = parseFieldSchemas([UNKNOWN_FIELD]);
    expect(parsed).toHaveLength(1);
    expect(isUnsupportedField(parsed[0])).toBe(true);
  });
});

describe('isCustomField', () => {
  it('returns true for customfield_* ids', () => {
    const f = parseFieldSchemas([BUG_PAGE_1[2]])[0];
    expect(isCustomField(f)).toBe(true);
  });
  it('returns false for system fields', () => {
    const f = parseFieldSchemas([BUG_PAGE_1[0]])[0];
    expect(isCustomField(f)).toBe(false);
  });
});

describe('isOptionField', () => {
  it('returns true for plain option', () => {
    const f = parseFieldSchemas([BUG_PAGE_1[2]])[0];
    expect(isOptionField(f.schema)).toBe(true);
  });
  it('returns false for option-with-child (cascading)', () => {
    const f = parseFieldSchemas([CASCADING_FIELD])[0];
    expect(isOptionField(f.schema)).toBe(false);
  });
});

describe('isCascadingField', () => {
  it('returns true for option-with-child', () => {
    const f = parseFieldSchemas([CASCADING_FIELD])[0];
    expect(isCascadingField(f.schema)).toBe(true);
  });
});

describe('isArrayField', () => {
  it('returns true and narrows to provide items property', () => {
    const f = parseFieldSchemas([ARRAY_OPTION_FIELD])[0];
    if (isArrayField(f.schema)) {
      expect(f.schema.items).toBe('option');
    } else {
      throw new Error('expected array variant');
    }
  });
});

describe('isUnsupportedField', () => {
  it('returns true when schema.type is not a known discriminant', () => {
    const f = parseFieldSchemas([UNKNOWN_FIELD])[0];
    expect(isUnsupportedField(f)).toBe(true);
  });
  it('returns false for known types', () => {
    const f = parseFieldSchemas([BUG_PAGE_1[0]])[0];
    expect(isUnsupportedField(f)).toBe(false);
  });
});

// Type-only imports verify compile-time correctness
const _typeCheck: FieldSchema | null = null;
const _typeCheck2: FieldSchemaType | null = null;
void _typeCheck;
void _typeCheck2;
