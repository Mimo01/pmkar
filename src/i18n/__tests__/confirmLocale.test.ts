import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import sk from '../locales/sk.json';

const enMap = en as Record<string, string>;
const skMap = sk as Record<string, string>;

const KEYS = [
  'triage.confirm.deny.title',
  'triage.confirm.deny.body',
  'triage.confirm.deny.action',
  'triage.confirm.link.title',
  'triage.confirm.link.body',
  'triage.confirm.link.action',
  'triage.confirm.cancel',
];

const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
const render = (s: string, vars: Record<string, string>) =>
  s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');

describe('triage.confirm.* Phase 37.1 strings', () => {
  it('exist and are non-empty in EN and SK', () => {
    for (const k of KEYS) {
      expect(enMap[k]?.length, `en.json missing "${k}"`).toBeGreaterThan(0);
      expect(skMap[k]?.length, `sk.json missing "${k}"`).toBeGreaterThan(0);
    }
  });

  it('EN and SK placeholder sets are equal per key', () => {
    for (const k of KEYS) {
      expect(placeholders(skMap[k]), `placeholders of "${k}"`).toEqual(placeholders(enMap[k]));
    }
  });

  it('expected placeholders are present', () => {
    expect(placeholders(enMap['triage.confirm.deny.title'])).toContain('tab');
    expect(placeholders(enMap['triage.confirm.deny.action'])).toContain('tab');
    expect(placeholders(enMap['triage.confirm.deny.body'])).toContain('key');
    expect(placeholders(enMap['triage.confirm.deny.body'])).toContain('cloudKey');
    expect(placeholders(enMap['triage.confirm.link.title'])).toContain('cloudKey');
    expect(placeholders(enMap['triage.confirm.link.body'])).toEqual(['key']);
  });

  it('SK uses "tiket" in bodies and never "úloh"', () => {
    expect(skMap['triage.confirm.deny.body']).toMatch(/tiket/i);
    expect(skMap['triage.confirm.link.body']).toMatch(/tiket/i);
    for (const k of KEYS) {
      expect(/úloh/i.test(skMap[k]), `sk.json key "${k}" uses úloh`).toBe(false);
    }
  });

  it('deny title renders with the nav.notMine label', () => {
    expect(
      render(skMap['triage.confirm.deny.title'], { key: 'X-1', tab: skMap['nav.notMine'] }),
    ).toContain('Zamietnuté');
    expect(
      render(enMap['triage.confirm.deny.title'], { key: 'X-1', tab: enMap['nav.notMine'] }),
    ).toContain('Dismissed');
  });

  it('SK keeps diacritics', () => {
    expect(skMap['triage.confirm.deny.title']).toContain('Presunúť');
    expect(skMap['triage.confirm.cancel']).toBe('Zrušiť');
  });
});
