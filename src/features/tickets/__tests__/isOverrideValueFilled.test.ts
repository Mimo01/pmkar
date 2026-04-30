import { describe, expect, it } from 'vitest';
import { isOverrideValueFilled } from '../isOverrideValueFilled';

describe('isOverrideValueFilled', () => {
  it('treats undefined as empty', () => {
    expect(isOverrideValueFilled(undefined)).toBe(false);
  });

  it('treats null as empty', () => {
    expect(isOverrideValueFilled(null)).toBe(false);
  });

  it('treats empty string as empty', () => {
    expect(isOverrideValueFilled('')).toBe(false);
  });

  it('treats whitespace-only string as empty', () => {
    expect(isOverrideValueFilled('   ')).toBe(false);
    expect(isOverrideValueFilled('\t\n')).toBe(false);
  });

  it('treats non-empty string as filled', () => {
    expect(isOverrideValueFilled('prod')).toBe(true);
  });

  it('treats empty array as empty', () => {
    expect(isOverrideValueFilled([])).toBe(false);
  });

  it('treats non-empty array as filled', () => {
    expect(isOverrideValueFilled(['a'])).toBe(true);
    expect(isOverrideValueFilled([0])).toBe(true);
  });

  it('treats empty object as empty (cleared user picker)', () => {
    expect(isOverrideValueFilled({})).toBe(false);
  });

  it('treats populated object as filled (user picker result, option object, etc.)', () => {
    expect(isOverrideValueFilled({ accountId: 'abc' })).toBe(true);
    expect(isOverrideValueFilled({ id: '1', value: 'opt' })).toBe(true);
  });

  it('treats numbers and booleans as filled', () => {
    expect(isOverrideValueFilled(0)).toBe(true);
    expect(isOverrideValueFilled(42)).toBe(true);
    expect(isOverrideValueFilled(false)).toBe(true);
    expect(isOverrideValueFilled(true)).toBe(true);
  });
});
