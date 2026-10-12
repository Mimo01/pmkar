/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GROUP_COLOR_HEX,
  GROUP_COLOR_TOKENS,
  groupColorVar,
  isGroupColorToken,
  pickDefaultColor,
} from '../colors';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

function extractBlock(source: string, opener: RegExp): string {
  const m = opener.exec(source);
  if (!m) throw new Error(`block not found: ${opener}`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(start, i - 1);
}

const themeBlock = extractBlock(css, /@theme\s*\{/);
const darkBlock = extractBlock(css, /body\.dark\s*\{/);

function readVar(block: string, name: string): string {
  const m = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(block);
  if (!m) throw new Error(`var not found: ${name}`);
  return m[1].toLowerCase();
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('palette', () => {
  it('has the eight tokens in order', () => {
    expect([...GROUP_COLOR_TOKENS]).toEqual([
      'blue',
      'teal',
      'green',
      'amber',
      'orange',
      'purple',
      'pink',
      'slate',
    ]);
  });

  it('has a hex pair for every token', () => {
    expect(Object.keys(GROUP_COLOR_HEX)).toEqual([...GROUP_COLOR_TOKENS]);
    for (const t of GROUP_COLOR_TOKENS) {
      expect(GROUP_COLOR_HEX[t].light).toMatch(/^#[0-9a-f]{6}$/);
      expect(GROUP_COLOR_HEX[t].dark).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('contains no red', () => {
    const forbidden = ['#c02232', '#dc2626', '#d4354a', '#a01c2a'];
    for (const t of GROUP_COLOR_TOKENS) {
      expect(t).not.toContain('red');
      expect(forbidden).not.toContain(GROUP_COLOR_HEX[t].light);
      expect(forbidden).not.toContain(GROUP_COLOR_HEX[t].dark);
    }
  });
});

describe('contrast', () => {
  const lightSurface = readVar(themeBlock, '--color-brand-surface');
  const lightBg = readVar(themeBlock, '--color-brand-bg');
  const darkSurface = readVar(darkBlock, '--color-brand-surface');
  const darkBg = readVar(darkBlock, '--color-brand-bg');

  for (const t of GROUP_COLOR_TOKENS) {
    it(`${t} reaches 3:1 in both themes`, () => {
      const { light, dark } = GROUP_COLOR_HEX[t];
      expect(contrast(light, lightSurface)).toBeGreaterThanOrEqual(3);
      expect(contrast(light, lightBg)).toBeGreaterThanOrEqual(3);
      expect(contrast(dark, darkSurface)).toBeGreaterThanOrEqual(3);
      expect(contrast(dark, darkBg)).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('pickDefaultColor', () => {
  it('returns blue for empty', () => {
    expect(pickDefaultColor([])).toBe('blue');
  });
  it('returns next unused', () => {
    expect(pickDefaultColor(['blue'])).toBe('teal');
  });
  it('wraps to blue when all used once', () => {
    expect(pickDefaultColor([...GROUP_COLOR_TOKENS])).toBe('blue');
  });
  it('picks least used, ties by order', () => {
    expect(
      pickDefaultColor([
        'blue',
        'blue',
        'teal',
        'green',
        'amber',
        'orange',
        'purple',
        'pink',
        'slate',
      ]),
    ).toBe('teal');
  });
  it('ignores unknown strings', () => {
    expect(pickDefaultColor(['red', '#fff'])).toBe('blue');
  });
});

describe('isGroupColorToken', () => {
  it('accepts tokens and rejects others', () => {
    expect(isGroupColorToken('slate')).toBe(true);
    expect(isGroupColorToken('red')).toBe(false);
    expect(isGroupColorToken('')).toBe(false);
    expect(isGroupColorToken(undefined)).toBe(false);
  });
});

describe('groupColorVar', () => {
  it('returns the css var reference', () => {
    expect(groupColorVar('amber')).toBe('var(--color-group-amber)');
  });
});

describe('css parity', () => {
  const count = (block: string) => (block.match(/--color-group-/g) ?? []).length;

  it('declares exactly eight group variables in each block', () => {
    expect(count(themeBlock)).toBe(8);
    expect(count(darkBlock)).toBe(8);
  });

  for (const t of GROUP_COLOR_TOKENS) {
    it(`${t} matches colors.ts in both themes`, () => {
      expect(readVar(themeBlock, `--color-group-${t}`)).toBe(
        GROUP_COLOR_HEX[t].light.toLowerCase(),
      );
      expect(readVar(darkBlock, `--color-group-${t}`)).toBe(GROUP_COLOR_HEX[t].dark.toLowerCase());
    });
  }
});
