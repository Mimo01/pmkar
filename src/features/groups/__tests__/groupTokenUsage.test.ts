/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// D-04: locks in the contrast token adoption from plans 33-04 and 33-05.

const ROOT = process.cwd();
const TICKET_CARD = 'src/features/tickets/TicketCard.tsx';

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(resolve(ROOT, dir))) {
    const rel = join(dir, name);
    if (statSync(resolve(ROOT, rel)).isDirectory()) {
      if (name !== '__tests__') walk(rel, out);
    } else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) {
      out.push(rel);
    }
  }
}

const groupFiles: string[] = [];
walk('src/features/groups', groupFiles);
const files = [...groupFiles, TICKET_CARD];
const read = (f: string) => readFileSync(resolve(ROOT, f), 'utf8');

function offenders(re: RegExp, filter?: (line: string) => boolean): string[] {
  const out: string[] = [];
  for (const f of files) {
    read(f)
      .split('\n')
      .forEach((line, i) => {
        if (re.test(line) && (!filter || filter(line))) out.push(`${f}:${i + 1}: ${line.trim()}`);
      });
  }
  return out;
}

describe('group UI contrast token usage', () => {
  it('scans a non-trivial file set', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('has no brand-colored focus rings', () => {
    expect(offenders(/(focus|focus-visible):(ring|outline|border)-brand(?![-\w])/)).toEqual([]);
  });

  it('has no plain text-destructive', () => {
    expect(offenders(/text-destructive(?![-\w])/)).toEqual([]);
  });

  it('uses muted text only on disabled rows or the decorative separator', () => {
    expect(
      offenders(
        /text-brand-muted(?![-\w])/,
        (l) => !l.includes('cursor-not-allowed') && !/text-brand-muted\/40/.test(l),
      ),
    ).toEqual([]);
  });

  it('keeps the inactive tab label on the secondary token', () => {
    expect(read('src/features/groups/GroupTab.tsx')).toContain(
      'text-brand-text-secondary font-normal',
    );
  });

  it('dims missing cards with opacity-70', () => {
    const card = read(TICKET_CARD);
    expect(card).toContain('opacity-70');
    expect(card).not.toContain('opacity-60');
  });
});
