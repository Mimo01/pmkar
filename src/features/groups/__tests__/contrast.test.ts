import { describe, expect, it } from 'vitest';
import { contrast, darkBlock, readVar, themeBlock } from '../../../test-utils/contrast';

/**
 * D-04: token-level contrast for every group-UI foreground/background pair in
 * both themes (jsdom cannot compute contrast via axe).
 */
type Theme = 'light' | 'dark';
const THEMES: Theme[] = ['light', 'dark'];

// Falls back to the @theme value when body.dark does not override the token.
function readThemed(name: string, theme: Theme): string {
  if (theme === 'dark') {
    try {
      return readVar(darkBlock, name);
    } catch {
      // not overridden in dark
    }
  }
  return readVar(themeBlock, name);
}

const BACKGROUNDS = ['--color-brand-surface', '--color-brand-bg', '--color-brand-surface-hover'];

describe('token contrast', () => {
  for (const theme of THEMES) {
    for (const bgName of BACKGROUNDS) {
      const bg = () => readThemed(bgName, theme);

      it(`${theme} --color-brand-text-secondary on ${bgName} >= 4.5`, () => {
        expect(
          contrast(readThemed('--color-brand-text-secondary', theme), bg()),
        ).toBeGreaterThanOrEqual(4.5);
      });

      it(`${theme} --color-brand-text on ${bgName} >= 4.5`, () => {
        expect(contrast(readThemed('--color-brand-text', theme), bg())).toBeGreaterThanOrEqual(4.5);
      });

      it(`${theme} --color-focus-ring on ${bgName} >= 3`, () => {
        expect(contrast(readThemed('--color-focus-ring', theme), bg())).toBeGreaterThanOrEqual(3);
      });

      it(`${theme} --color-destructive-text on ${bgName} >= 4.5`, () => {
        expect(
          contrast(readThemed('--color-destructive-text', theme), bg()),
        ).toBeGreaterThanOrEqual(4.5);
      });

      it(`${theme} unchecked checkbox boundary (text-secondary) on ${bgName} >= 3`, () => {
        expect(
          contrast(readThemed('--color-brand-text-secondary', theme), bg()),
        ).toBeGreaterThanOrEqual(3);
      });

      if (theme === 'dark') {
        it(`dark shared --color-ring on ${bgName} >= 3`, () => {
          expect(contrast(readVar(darkBlock, '--color-ring'), bg())).toBeGreaterThanOrEqual(3);
        });
      }
    }

    it(`${theme} --color-destructive-foreground on --color-destructive >= 4.5`, () => {
      expect(
        contrast(
          readThemed('--color-destructive-foreground', theme),
          readThemed('--color-destructive', theme),
        ),
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('readVar', () => {
  it('resolves a whole declaration name, not a suffix of another', () => {
    expect(readVar('--color-focus-ring: #111111;\n  --color-ring: #222222;', '--color-ring')).toBe(
      '#222222',
    );
  });

  it('does not match a name that merely ends with the requested one', () => {
    expect(() =>
      readVar('  --x--color-ring: #333333;\n  --color-focus-ring: #111111;', '--color-ring'),
    ).toThrow('var not found: --color-ring');
  });

  it('lowercases the hex and accepts a declaration right after a brace', () => {
    expect(readVar('{--color-a: #ABCDEF;}', '--color-a')).toBe('#abcdef');
  });

  it('escapes regex metacharacters in the name', () => {
    expect(() => readVar('--a: #111111;', '--(a')).toThrow('var not found: --(a');
  });
});
