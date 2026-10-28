import { describe, expect, it } from 'vitest';
import { foldText, foldWithMap, highlightRanges, mergeRanges, parseQuery } from '../normalize';

describe('normalize', () => {
  it('folds diacritics and case', () => {
    expect(foldText('Chyba prihlásenia')).toBe('chyba prihlasenia');
    expect(foldText('ÁČŤ')).toBe('act');
  });
  it('does not fold non-decomposing characters', () => {
    expect(foldText('ł')).toBe('ł');
  });
  it('parseQuery splits and folds', () => {
    expect(parseQuery('  Login   TIMEOUT ')).toEqual(['login', 'timeout']);
    expect(parseQuery('   ')).toEqual([]);
  });
  it('foldWithMap records original indexes and sentinel', () => {
    const { folded, map } = foldWithMap('áb');
    expect(folded).toBe('ab');
    expect(map[0]).toBe(0);
    expect(map[1]).toBe(1);
    expect(map[map.length - 1]).toBe(2);
  });
  it('highlightRanges points at original chars', () => {
    expect(highlightRanges('Chyba prihlásenia', ['prihlasenia'])).toEqual([[6, 17]]);
    expect(highlightRanges('abcabc', ['bc', 'c'])).toEqual([
      [1, 3],
      [4, 6],
    ]);
    expect(highlightRanges('x', [])).toEqual([]);
    expect(highlightRanges('foo a.b( bar', ['a.b('])).toEqual([[4, 8]]);
  });
  it('mergeRanges merges overlaps', () => {
    expect(
      mergeRanges([
        [5, 7],
        [1, 3],
        [2, 4],
      ]),
    ).toEqual([
      [1, 4],
      [5, 7],
    ]);
  });
});
