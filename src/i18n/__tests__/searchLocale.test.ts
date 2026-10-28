import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import sk from '../locales/sk.json';

const enMap = en as Record<string, string>;
const skMap = sk as Record<string, string>;

const searchKeys = (m: Record<string, string>) =>
  Object.keys(m).filter((k) => k.startsWith('search.'));
const placeholders = (s: string) => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort().join(',');

describe('search.* locale guard (D-17)', () => {
  it('EN and SK have the same non-empty search keys with identical placeholders', () => {
    const enKeys = searchKeys(enMap).sort();
    expect(enKeys.length).toBeGreaterThanOrEqual(24);
    expect(searchKeys(skMap).sort()).toEqual(enKeys);
    for (const k of enKeys) {
      expect(enMap[k].length, `en ${k}`).toBeGreaterThan(0);
      expect(skMap[k].length, `sk ${k}`).toBeGreaterThan(0);
      expect(placeholders(skMap[k]), `placeholders ${k}`).toBe(placeholders(enMap[k]));
    }
  });

  it('SK uses "tiket" and never "úloha"', () => {
    const keys = searchKeys(skMap);
    for (const k of keys) {
      expect(/úloh/i.test(skMap[k]), `sk ${k}`).toBe(false);
    }
    expect(keys.some((k) => /tiket/i.test(skMap[k]))).toBe(true);
  });

  it('result-count announcement has all plural forms with {{count}}', () => {
    for (const m of [enMap, skMap]) {
      for (const suffix of ['', '_one', '_few', '_many', '_other']) {
        const v = m[`search.live.count${suffix}`];
        expect(v, `search.live.count${suffix}`).toBeTruthy();
        expect(v).toContain('{{count}}');
      }
    }
  });

  it('footer carries shown and total', () => {
    for (const m of [enMap, skMap]) {
      expect(m['search.footer.truncated']).toContain('{{shown}}');
      expect(m['search.footer.truncated']).toContain('{{total}}');
    }
  });

  it('per-tab filter wording mentions summary (D-02)', () => {
    expect(enMap['tickets.filter.keyPlaceholder']).toContain('summary');
    expect(skMap['tickets.filter.keyPlaceholder']).toContain('zhrnutia');
  });
});
