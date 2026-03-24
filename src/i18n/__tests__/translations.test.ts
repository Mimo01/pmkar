import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import sk from '../locales/sk.json';

describe('Translation completeness', () => {
  const enKeys = Object.keys(en).sort();
  const skKeys = Object.keys(sk).sort();

  it('en.json and sk.json have identical key sets', () => {
    expect(enKeys).toEqual(skKeys);
  });

  it('en.json has at least 80 keys', () => {
    expect(enKeys.length).toBeGreaterThanOrEqual(80);
  });

  it('no empty values in en.json', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en.json key "${key}" is empty`).not.toBe('');
    }
  });

  it('no empty values in sk.json', () => {
    for (const [key, value] of Object.entries(sk)) {
      expect(value, `sk.json key "${key}" is empty`).not.toBe('');
    }
  });

  it('sk.json values differ from en.json (not just copied English)', () => {
    // At least 80% of keys should have different values
    const diffCount = enKeys.filter(
      (k) => (en as Record<string, string>)[k] !== (sk as Record<string, string>)[k],
    ).length;
    expect(diffCount / enKeys.length).toBeGreaterThan(0.8);
  });
});
