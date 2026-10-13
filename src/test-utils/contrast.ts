/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

export function extractBlock(source: string, opener: RegExp): string {
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

export const themeBlock = extractBlock(css, /@theme\s*\{/);
export const rootBlock = extractBlock(css, /:root\s*\{/);
export const darkBlock = extractBlock(css, /body\.dark\s*\{/);

export function readVar(block: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Anchor to a whole declaration name so --color-ring never matches --color-focus-ring
  const m = new RegExp(`(?:^|[\\s;{])${escaped}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`, 'm').exec(block);
  if (!m) throw new Error(`var not found: ${name}`);
  return m[1].toLowerCase();
}

export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Alpha-composite fg over bg at the given opacity; returns 6-digit hex. */
export function mix(fg: string, bg: string, opacity: number): string {
  const out = [1, 3, 5].map((i) => {
    const f = Number.parseInt(fg.slice(i, i + 2), 16);
    const b = Number.parseInt(bg.slice(i, i + 2), 16);
    return Math.round(f * opacity + b * (1 - opacity))
      .toString(16)
      .padStart(2, '0');
  });
  return `#${out.join('')}`;
}
