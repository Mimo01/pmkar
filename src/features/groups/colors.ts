/**
 * Group color palette (Phase 28, D-05..D-08; vivid fills since quick fast 261013).
 *
 * Groups persist a color TOKEN NAME (e.g. "teal"), never a hex value (D-06).
 * Consumers must validate stored strings with `isGroupColorToken` and render
 * via `groupColorVar`; never interpolate raw stored strings into styles.
 *
 * Rendering rule: `groupColorStyle` exposes the fill as `--group-color`.
 * Chips and picker names are solid group-color fills with one shared dark label
 * color (`--group-chip-text`, GROUP_LABEL_HEX) that reaches >= 4.5:1 on every
 * fill. Every group tab carries a group-color underline: softer at rest, full
 * strength when active. Color is never the only signal (the name is always
 * shown). Fills are identical in both themes.
 *
 * The hex values here are mirrored as --color-group-* (and --group-chip-text)
 * variables in the plain :root rule of src/index.css; a test keeps them in sync.
 * They must not be moved into @theme: Tailwind v4 would drop the ones not named
 * literally in source.
 */

import type { CSSProperties } from 'react';

export const GROUP_COLOR_TOKENS = [
  'blue',
  'teal',
  'green',
  'yellow',
  'orange',
  'purple',
  'pink',
  'slate',
] as const;

export type GroupColorToken = (typeof GROUP_COLOR_TOKENS)[number];

export const GROUP_COLOR_HEX: Readonly<Record<GroupColorToken, string>> = {
  blue: '#3b8bff',
  teal: '#14b8a6',
  green: '#22c55e',
  yellow: '#facc15',
  orange: '#f97316',
  purple: '#a66bff',
  pink: '#f0529c',
  slate: '#8796ad',
};

/** Shared chip label color, dark on every fill in both themes. */
export const GROUP_LABEL_HEX = '#1c1917';

export function isGroupColorToken(value: unknown): value is GroupColorToken {
  return typeof value === 'string' && (GROUP_COLOR_TOKENS as readonly string[]).includes(value);
}

export function groupColorVar(token: GroupColorToken): string {
  return `var(--color-group-${token})`;
}

/**
 * Inline style exposing the group fill as `--group-color`, consumed by Tailwind classes like `bg-(--group-color)`. The value only flows through
 * groupColorVar; stored strings are never interpolated.
 */
export function groupColorStyle(token: GroupColorToken): CSSProperties {
  return { '--group-color': groupColorVar(token) } as CSSProperties;
}

/**
 * Least-used token wins; ties go to palette order (D-08). Unknown strings are
 * ignored.
 */
export function pickDefaultColor(usedColors: readonly string[]): GroupColorToken {
  const counts = new Map<GroupColorToken, number>(GROUP_COLOR_TOKENS.map((t) => [t, 0]));
  for (const c of usedColors) {
    if (isGroupColorToken(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: GroupColorToken = GROUP_COLOR_TOKENS[0];
  let bestCount = Number.POSITIVE_INFINITY;
  for (const t of GROUP_COLOR_TOKENS) {
    const n = counts.get(t) ?? 0;
    if (n < bestCount) {
      best = t;
      bestCount = n;
    }
  }
  return best;
}
