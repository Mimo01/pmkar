import { describe, expect, it } from 'vitest';
import vectors from '../../../test-fixtures/group-vectors.json';
import { GROUP_COLOR_TOKENS, pickDefaultColor } from '../colors';
import { RESERVED_NAME_KEYS, validateGroupName } from '../validation';

describe('group validation vs shared vectors', () => {
  for (const row of vectors.names) {
    it(`name vector ${JSON.stringify(row.input).slice(0, 30)} -> ${row.error ?? 'ok'}`, () => {
      const r = validateGroupName(row.input, row.existing);
      if (row.error === null) {
        expect(r).toEqual({ ok: true, display: row.display, key: row.key });
      } else {
        expect(r).toEqual({ ok: false, code: row.error });
      }
    });
  }

  for (const row of vectors.defaultColor) {
    it(`default color for [${row.used.join(',')}] is ${row.expected}`, () => {
      expect(pickDefaultColor(row.used)).toBe(row.expected);
    });
  }

  it('palette equals vectors palette', () => {
    expect([...GROUP_COLOR_TOKENS]).toEqual(vectors.palette);
  });

  it('counts length in code points', () => {
    const name = `${'a'.repeat(39)}😀`;
    expect(name.length).toBe(41);
    expect(validateGroupName(name, []).ok).toBe(true);
  });

  it('reserved keys has 6 entries including new and nove', () => {
    expect(RESERVED_NAME_KEYS.size).toBe(6);
    expect(RESERVED_NAME_KEYS.has('new')).toBe(true);
    expect(RESERVED_NAME_KEYS.has('nove')).toBe(true);
  });
});
