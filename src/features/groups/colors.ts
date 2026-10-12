/**
 * Group color palette (Phase 28, D-05..D-08).
 *
 * Groups persist a color TOKEN NAME (e.g. "teal"), never a hex value (D-06).
 * Consumers must validate stored strings with `isGroupColorToken` and render
 * via `groupColorVar`; never interpolate raw stored strings into styles.
 *
 * Rendering rule (D-07): the color is shown as an 8px dot beside neutral text,
 * never as a tinted background or colored text. Every value reaches >= 3:1
 * non-text contrast against the card surface and page background of its theme.
 *
 * The hex values here are mirrored as --color-group-* variables in
 * src/index.css; a test keeps the two in sync.
 */

export const GROUP_COLOR_TOKENS = [
  'blue',
  'teal',
  'green',
  'amber',
  'orange',
  'purple',
  'pink',
  'slate',
] as const;

export type GroupColorToken = (typeof GROUP_COLOR_TOKENS)[number];

export const GROUP_COLOR_HEX: Readonly<Record<GroupColorToken, { light: string; dark: string }>> = {
  blue: { light: '#2563eb', dark: '#60a5fa' },
  teal: { light: '#0d9488', dark: '#2dd4bf' },
  green: { light: '#16a34a', dark: '#4ade80' },
  amber: { light: '#b45309', dark: '#fbbf24' },
  orange: { light: '#ea580c', dark: '#fb923c' },
  purple: { light: '#7c3aed', dark: '#a78bfa' },
  pink: { light: '#db2777', dark: '#f472b6' },
  slate: { light: '#64748b', dark: '#94a3b8' },
};

export function isGroupColorToken(value: unknown): value is GroupColorToken {
  return typeof value === 'string' && (GROUP_COLOR_TOKENS as readonly string[]).includes(value);
}

export function groupColorVar(token: GroupColorToken): string {
  return `var(--color-group-${token})`;
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
