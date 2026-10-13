/**
 * Group color palette (Phase 28, D-05..D-08).
 *
 * Groups persist a color TOKEN NAME (e.g. "teal"), never a hex value (D-06).
 * Consumers must validate stored strings with `isGroupColorToken` and render
 * via `groupColorVar`; never interpolate raw stored strings into styles.
 *
 * Rendering rule (D-07, revised by quick task 261013-e6u): the color is exposed
 * as the `--group-color` custom property via `groupColorStyle`. Chips and
 * picker names are button-like (rounded-md) chips with a ~30% tint background
 * and a ~70% group-color border. Every group tab carries a group-color
 * underline: faint at rest, full strength when active. Text always stays neutral
 * (text-brand-text), never colored, and color is never the only signal (the
 * name is always shown). Every value reaches >= 3:1 non-text contrast against
 * the card surface and page background of its theme.
 *
 * The hex values here are mirrored as --color-group-* variables in the plain
 * :root (light) and body.dark (dark) rules of src/index.css; a test keeps them
 * in sync. They must not be moved into @theme: Tailwind v4 would drop the ones
 * not named literally in source.
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

export const GROUP_COLOR_HEX: Readonly<Record<GroupColorToken, { light: string; dark: string }>> = {
  blue: { light: '#0a6cff', dark: '#4d9bff' },
  teal: { light: '#00968a', dark: '#2dd4c4' },
  green: { light: '#1a9e2e', dark: '#4ade5a' },
  yellow: { light: '#ad8b00', dark: '#facc15' },
  orange: { light: '#f05a00', dark: '#ff8a3d' },
  purple: { light: '#8b3dff', dark: '#b083ff' },
  pink: { light: '#e8178a', dark: '#ff5cb0' },
  slate: { light: '#5b6b82', dark: '#9fb0c8' },
};

export function isGroupColorToken(value: unknown): value is GroupColorToken {
  return typeof value === 'string' && (GROUP_COLOR_TOKENS as readonly string[]).includes(value);
}

export function groupColorVar(token: GroupColorToken): string {
  return `var(--color-group-${token})`;
}

/**
 * Inline style exposing the group color as `--group-color`, consumed by
 * Tailwind classes like `bg-(--group-color)/12`. The value only flows through
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
