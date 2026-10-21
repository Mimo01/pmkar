/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// CONF-03: all Linked/Not mine transitions go through the confirmed hook path
// (useTriageDetailActions -> triageActions); no other caller may reach them.

const ROOT = process.cwd();
const HOOK = 'src/features/tickets/useTriageDetailActions.ts';
const ACTIONS = 'src/features/tickets/triageActions.ts';

function collect(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      collect(full, out);
    } else if (/\.tsx?$/.test(name) && !name.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

interface Call {
  file: string;
  line: number;
  callee: string;
}

function scan(): Call[] {
  const calls: Call[] = [];
  for (const full of collect(resolve(ROOT, 'src'))) {
    const file = relative(ROOT, full).split('\\').join('/');
    const sf = ts.createSourceFile(file, readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const e = node.expression;
        const name = ts.isIdentifier(e)
          ? e.text
          : ts.isPropertyAccessExpression(e)
            ? e.name.text
            : '';
        const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        if (
          name === 'denyTicket' ||
          name === 'linkTicket' ||
          name === 'undoDeny' ||
          name === 'watchTicket' ||
          name === 'undoWatch'
        ) {
          calls.push({ file, line, callee: name });
        } else if (name === 'invoke') {
          const arg = node.arguments[0];
          if (
            arg &&
            ts.isStringLiteralLike(arg) &&
            (arg.text === 'relink_ticket' || arg.text === 'set_triage_state')
          ) {
            calls.push({ file, line, callee: `invoke:${arg.text}` });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return calls;
}

const offending = (calls: Call[], allowed: string, match: (c: string) => boolean) =>
  calls
    .filter((c) => match(c.callee) && c.file !== allowed)
    .map((c) => `${c.file}:${c.line} ${c.callee}`);

describe('transition guard (CONF-03)', () => {
  const calls = scan();

  it('denyTicket/linkTicket are only called from useTriageDetailActions', () => {
    expect(offending(calls, HOOK, (c) => c === 'denyTicket' || c === 'linkTicket')).toEqual([]);
  });

  it('undoDeny is only called from triageActions', () => {
    expect(offending(calls, ACTIONS, (c) => c === 'undoDeny')).toEqual([]);
  });

  it('watchTicket is only called from useTriageDetailActions', () => {
    expect(offending(calls, HOOK, (c) => c === 'watchTicket')).toEqual([]);
  });

  it('undoWatch is only called from triageActions', () => {
    expect(offending(calls, ACTIONS, (c) => c === 'undoWatch')).toEqual([]);
  });

  it('relink_ticket/set_triage_state are only invoked from triageActions', () => {
    expect(offending(calls, ACTIONS, (c) => c.startsWith('invoke:'))).toEqual([]);
  });

  it('scan finds the allow-listed calls (cannot pass by matching nothing)', () => {
    expect(calls.some((c) => c.file === HOOK && c.callee === 'denyTicket')).toBe(true);
    expect(calls.some((c) => c.file === HOOK && c.callee === 'linkTicket')).toBe(true);
    expect(calls.some((c) => c.file === ACTIONS && c.callee === 'undoDeny')).toBe(true);
    expect(calls.some((c) => c.file === HOOK && c.callee === 'watchTicket')).toBe(true);
    expect(calls.some((c) => c.file === ACTIONS && c.callee === 'undoWatch')).toBe(true);
    expect(calls.some((c) => c.file === ACTIONS && c.callee === 'invoke:relink_ticket')).toBe(true);
    expect(calls.some((c) => c.file === ACTIONS && c.callee === 'invoke:set_triage_state')).toBe(
      true,
    );
  });
});
