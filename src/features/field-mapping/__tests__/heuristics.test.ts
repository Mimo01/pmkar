import { describe, expect, it } from 'vitest';
import type { FieldSchema } from '../../../types/fieldSchema';
import { findNameMatchSuggestion } from '../heuristics';

const makeField = (fieldId: string, name: string): FieldSchema => ({
  fieldId,
  name,
  required: false,
  schema: { type: 'string' },
});

describe('findNameMatchSuggestion', () => {
  it('returns null for empty target list', () => {
    expect(findNameMatchSuggestion('summary', 'Summary', [])).toBeNull();
  });

  it('matches by exact fieldId (highest precedence)', () => {
    const a = makeField('summary', 'Other Name');
    const b = makeField('description', 'Summary');
    expect(findNameMatchSuggestion('summary', 'completely-different', [b, a])).toBe(a);
  });

  it('matches case-insensitively on name', () => {
    const f = makeField('f1', 'summary');
    expect(findNameMatchSuggestion('f2', 'SUMMARY', [f])).toBe(f);
  });

  it('normalizes underscores, dashes, and spaces', () => {
    const f = makeField('f1', 'subtask');
    expect(findNameMatchSuggestion('f2', 'sub-task', [f])).toBe(f);
    expect(findNameMatchSuggestion('f3', 'sub_task', [f])).toBe(f);
    expect(findNameMatchSuggestion('f4', 'SUB TASK', [f])).toBe(f);
  });

  it('matches via synonym (severity → priority)', () => {
    const f = makeField('f1', 'Priority');
    expect(findNameMatchSuggestion('f2', 'severity', [f])).toBe(f);
  });

  it('matches via synonym (tags → labels)', () => {
    const f = makeField('f1', 'Labels');
    expect(findNameMatchSuggestion('f2', 'tags', [f])).toBe(f);
  });

  it('matches via synonym (desc → description)', () => {
    const f = makeField('f1', 'Description');
    expect(findNameMatchSuggestion('f2', 'desc', [f])).toBe(f);
  });

  it('returns null when no match found', () => {
    const f = makeField('f1', 'Other Field');
    expect(findNameMatchSuggestion('f2', 'random-xyz', [f])).toBeNull();
  });
});
