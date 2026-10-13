import { describe, expect, it } from 'vitest';
import {
  contrast,
  darkBlock,
  mix,
  readVar,
  rootBlock,
  themeBlock,
} from '../../../test-utils/contrast';
import {
  GROUP_COLOR_HEX,
  GROUP_COLOR_TOKENS,
  groupColorStyle,
  groupColorVar,
  isGroupColorToken,
  pickDefaultColor,
} from '../colors';

// Counts declarations only, so stray mentions in comments never change the count.
const count = (block: string) => (block.match(/--color-group-[a-z]+\s*:/g) ?? []).length;

describe('palette', () => {
  it('has the eight tokens in order', () => {
    expect([...GROUP_COLOR_TOKENS]).toEqual([
      'blue',
      'teal',
      'green',
      'yellow',
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
        'yellow',
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
    expect(groupColorVar('yellow')).toBe('var(--color-group-yellow)');
  });
});

describe('css parity', () => {
  it('declares exactly eight group variables in each block', () => {
    expect(count(rootBlock)).toBe(8);
    expect(count(darkBlock)).toBe(8);
  });

  for (const t of GROUP_COLOR_TOKENS) {
    it(`${t} matches colors.ts in both themes`, () => {
      expect(readVar(rootBlock, `--color-group-${t}`)).toBe(GROUP_COLOR_HEX[t].light.toLowerCase());
      expect(readVar(darkBlock, `--color-group-${t}`)).toBe(GROUP_COLOR_HEX[t].dark.toLowerCase());
    });
  }
});

describe('light palette emission', () => {
  // Phase 30 UAT gap: Tailwind v4 drops @theme variables not named literally in source.
  // Group vars are referenced via a runtime-built var() name, so they must live in :root.
  // See .planning/debug/group-colors-not-rendering.md
  it('keeps group variables out of @theme so Tailwind cannot tree-shake them', () => {
    expect(count(themeBlock)).toBe(0);
  });
});

describe('groupColorStyle', () => {
  it('sets --group-color to the css var reference', () => {
    expect((groupColorStyle('blue') as Record<string, string>)['--group-color']).toBe(
      'var(--color-group-blue)',
    );
  });
});

describe('tint text contrast', () => {
  const darkText = readVar(darkBlock, '--color-brand-text');
  const darkSurface = readVar(darkBlock, '--color-brand-surface');
  for (const t of GROUP_COLOR_TOKENS) {
    it(`${t} tint keeps neutral text at 4.5:1 in dark`, () => {
      const bg = mix(GROUP_COLOR_HEX[t].dark, darkSurface, 0.3);
      expect(contrast(darkText, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
