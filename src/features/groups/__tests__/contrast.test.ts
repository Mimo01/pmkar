import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast, darkBlock, mix, readVar, themeBlock } from '../../../test-utils/contrast';

/**
 * D-04: token-level contrast for every group-UI foreground/background pair in
 * both themes (jsdom cannot compute contrast via axe).
 *
 * Dimmed missing cards dim only the brand-text summary. Key, dates and
 * metadata stay undimmed text-secondary (covered by the >= 4.5 secondary
 * tests). Every dimmed text must meet 4.5:1 composited at the opacity that
 * TicketCard.tsx actually renders.
 */
const ticketCardSource = readFileSync(
  resolve(process.cwd(), 'src/features/tickets/TicketCard.tsx'),
  'utf8',
);
const opacityMatch = /opacity-(\d+)/.exec(ticketCardSource);
if (!opacityMatch) throw new Error('TicketCard.tsx has no opacity-NN dim class');
const MISSING_DIM_OPACITY = Number(opacityMatch[1]) / 100;

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

      it(`${theme} dimmed summary (brand-text at ${MISSING_DIM_OPACITY}) on ${bgName} >= 4.5`, () => {
        const dimmed = mix(readThemed('--color-brand-text', theme), bg(), MISSING_DIM_OPACITY);
        expect(contrast(dimmed, bg())).toBeGreaterThanOrEqual(4.5);
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
