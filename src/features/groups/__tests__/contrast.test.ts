import { describe, expect, it } from 'vitest';
import { contrast, darkBlock, mix, readVar, themeBlock } from '../../../test-utils/contrast';

/**
 * D-04: token-level contrast for every group-UI foreground/background pair in
 * both themes (jsdom cannot compute contrast via axe).
 *
 * Dimmed missing card decision: dimmed content is decorative de-emphasis. The
 * undimmed hint line (text-secondary, >= 4.5) and the labelled Remove /
 * Remove all missing buttons (full contrast) carry the meaning; key/meta keep
 * a 3:1 legibility floor at the dim opacity.
 */
const MISSING_DIM_OPACITY = 0.7;

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

    it(`${theme} dimmed missing card keeps legibility at ${MISSING_DIM_OPACITY} opacity`, () => {
      const surface = readThemed('--color-brand-surface', theme);
      const secondary = mix(
        readThemed('--color-brand-text-secondary', theme),
        surface,
        MISSING_DIM_OPACITY,
      );
      const text = mix(readThemed('--color-brand-text', theme), surface, MISSING_DIM_OPACITY);
      expect(contrast(secondary, surface)).toBeGreaterThanOrEqual(3);
      expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
