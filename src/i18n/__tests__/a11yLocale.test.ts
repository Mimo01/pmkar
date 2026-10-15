import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import sk from '../locales/sk.json';

const enMap = en as Record<string, string>;
const skMap = sk as Record<string, string>;

const NEW_KEYS = ['a11y.denied', 'a11y.undone', 'a11y.linked', 'a11y.restored', 'a11y.handled'];

const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('a11y.* Phase 37 announcement strings', () => {
  it('exist and are non-empty in EN and SK', () => {
    for (const k of NEW_KEYS) {
      expect(enMap[k]?.length, `en.json missing "${k}"`).toBeGreaterThan(0);
      expect(skMap[k]?.length, `sk.json missing "${k}"`).toBeGreaterThan(0);
    }
  });

  it('contain {{key}} (and {{cloudKey}} for undone/linked) with equal EN/SK placeholders', () => {
    for (const k of NEW_KEYS) {
      expect(placeholders(enMap[k])).toContain('key');
      expect(placeholders(skMap[k]), `placeholders of "${k}"`).toEqual(placeholders(enMap[k]));
    }
    for (const k of ['a11y.undone', 'a11y.linked']) {
      expect(placeholders(enMap[k])).toContain('cloudKey');
      expect(placeholders(skMap[k])).toContain('cloudKey');
    }
  });

  it('SK uses "tiket" and never "úloh"', () => {
    for (const k of NEW_KEYS) {
      expect(skMap[k]).toMatch(/tiket/i);
      expect(/úloh/i.test(skMap[k]), `sk.json key "${k}" uses úloh`).toBe(false);
    }
  });

  it('a11y.denied uses the nav.notMine label (no terminology drift)', () => {
    expect(enMap['a11y.denied']).toContain(enMap['nav.notMine']);
    expect(skMap['a11y.denied']).toContain(skMap['nav.notMine']);
  });

  it('triage toast strings use the nav.notMine label too', () => {
    for (const k of ['triage.denied', 'triage.denyFailed', 'triage.undoFailed']) {
      expect(enMap[k], k).toContain(enMap['nav.notMine']);
      expect(skMap[k], k).toContain(skMap['nav.notMine']);
    }
  });
});
