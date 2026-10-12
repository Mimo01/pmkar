import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import sk from '../locales/sk.json';

const enMap = en as Record<string, string>;
const skMap = sk as Record<string, string>;

const groupKeys = (m: Record<string, string>) =>
  Object.keys(m).filter((k) => k.startsWith('groups.'));

// Wrong quote characters (U+2018, U+2019, ASCII ") directly adjacent to an interpolation.
const WRONG_BEFORE = /[‘’"]\{\{/;
const WRONG_AFTER = /\}\}[‘’"]/;

describe('groups.* quote style (D-13)', () => {
  it('EN and SK never wrap interpolations in single or ASCII quotes', () => {
    for (const [label, m] of [
      ['en.json', enMap],
      ['sk.json', skMap],
    ] as const) {
      for (const k of groupKeys(m)) {
        expect(WRONG_BEFORE.test(m[k]), `${label} key "${k}" has wrong opening quote`).toBe(false);
        expect(WRONG_AFTER.test(m[k]), `${label} key "${k}" has wrong closing quote`).toBe(false);
      }
    }
  });

  it('EN never uses the SK opener „ (U+201E)', () => {
    for (const k of groupKeys(enMap)) {
      expect(enMap[k].includes('„'), `en.json key "${k}" contains U+201E`).toBe(false);
    }
  });

  it('SK never uses U+201C before an interpolation nor the EN closer U+201D', () => {
    for (const k of groupKeys(skMap)) {
      expect(skMap[k].includes('“{{'), `sk.json key "${k}" has U+201C before {{`).toBe(false);
      expect(skMap[k].includes('”'), `sk.json key "${k}" contains U+201D`).toBe(false);
    }
  });
});

describe('groups.* plurals (D-16, D-17)', () => {
  it('SK _many equals _other', () => {
    for (const k of groupKeys(skMap).filter((x) => x.endsWith('_other'))) {
      const many = k.replace(/_other$/, '_many');
      if (many in skMap) {
        expect(skMap[many], `sk.json key "${many}" must equal "${k}"`).toBe(skMap[k]);
      }
    }
  });

  it('every plural base has one/few/many/other in SK and EN', () => {
    const bases = groupKeys(skMap)
      .filter((k) => k.endsWith('_one'))
      .map((k) => k.replace(/_one$/, ''));
    expect(bases.length).toBeGreaterThan(0);
    for (const b of bases) {
      for (const suffix of ['one', 'few', 'many', 'other']) {
        expect(skMap[`${b}_${suffix}`], `sk.json missing "${b}_${suffix}"`).toBeTruthy();
        expect(enMap[`${b}_${suffix}`], `en.json missing "${b}_${suffix}"`).toBeTruthy();
      }
    }
  });
});

describe('groups.* SK wording (D-14, D-15)', () => {
  it('announceRemoved uses the genitive with proper quotes', () => {
    expect(skMap['groups.picker.announceRemoved']).toBe('Odstránené zo skupiny „{{name}}“');
  });

  it('no forbidden glossary terms in SK', () => {
    const forbidden = /tiket|záložk|zmaza|vymaza|založ|\bissue\b/i;
    for (const k of groupKeys(skMap)) {
      expect(forbidden.test(skMap[k]), `sk.json key "${k}" uses a forbidden term`).toBe(false);
    }
  });

  it('EN and SK groups.* key sets match', () => {
    expect(groupKeys(enMap).sort()).toEqual(groupKeys(skMap).sort());
  });
});
