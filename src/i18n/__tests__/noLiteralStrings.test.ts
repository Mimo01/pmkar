/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { GROUP_COLOR_TOKENS } from '../../features/groups/colors';
import { groupNameErrorKey } from '../../features/groups/GroupNameForm';
import type { GroupBadgeKey } from '../../features/groups/groupBadge';
import { membershipErrorKey } from '../../features/groups/membershipActions';
import type { GroupErrorCode } from '../../features/groups/types';
import en from '../locales/en.json';
import sk from '../locales/sk.json';

// D-02: static guard against untranslated user-facing strings in group UI.

const ROOT = process.cwd();
const GROUPS_DIR = 'src/features/groups';
const EXTRA_FILES = [
  'src/features/tickets/TicketCard.tsx',
  'src/features/tickets/TicketFilterBar.tsx',
  'src/features/tickets/TicketListPage.tsx',
  'src/components/ui/AppShell.tsx',
  'src/features/tickets/ConfirmTransitionDialog.tsx',
];

/** Callees whose string arguments reach the user (toasts, live regions, inline errors). */
const USER_FACING_SINKS = [
  'toast',
  'toast.error',
  'toast.success',
  'toast.info',
  'toast.warning',
  'toast.message',
  'announce',
  'setAnnouncement',
  'setError',
  'setMessage',
];

const A11Y_ATTRS = new Set(['aria-label', 'title', 'placeholder', 'alt']);

/** Intentional non-translatable strings that contain letters. Each must still occur in its file. */
const NON_TRANSLATABLE: { file: string; text: string; reason: string }[] = [
  // Brand wordmark "pmkar" is split across a styled span; not translatable.
  { file: 'src/components/ui/AppShell.tsx', text: 'pm', reason: 'product wordmark' },
  { file: 'src/components/ui/AppShell.tsx', text: 'kar', reason: 'product wordmark' },
];

/** Pre-v0.5.0 non-group literals, logged in deferred-items.md (D-03). Each must still occur. */
const DEFERRED_NON_GROUP: { file: string; text: string }[] = [
  // D-03: pre-v0.5.0 refresh button tooltip, see deferred-items.md
  { file: 'src/features/tickets/TicketListPage.tsx', text: 'Refresh (F5)' },
];

// Exhaustive records: a new union member is a type error here.
const GROUP_ERROR_CODES = Object.keys({
  empty: true,
  too_long: true,
  duplicate: true,
  reserved: true,
  no_scope: true,
  scope_mismatch: true,
  not_found: true,
  invalid_color: true,
  invalid_issue_key: true,
  invalid_ticket: true,
  internal: true,
} satisfies Record<GroupErrorCode, true>) as GroupErrorCode[];

const GROUP_BADGE_KEYS = Object.keys({
  'nav.new': true,
  'nav.notMine': true,
  'nav.linked': true,
  'nav.watched': true,
  'groups.badge.done': true,
} satisfies Record<GroupBadgeKey, true>);

/** Every non-literal t() first argument must be listed here with the full set of keys it can yield. */
const DYNAMIC_KEY_ALLOWLIST: { file: string; exprText: string; expand: () => string[] }[] = [
  {
    // groups.color.<token> for each palette token
    file: 'GroupColorSwatches.tsx',
    exprText: '`groups.color.${token}`',
    expand: () => GROUP_COLOR_TOKENS.map((tk) => `groups.color.${tk}`),
  },
  {
    // badge key union from groupBadge.ts
    file: 'GroupViewPage.tsx',
    exprText: 'badge',
    expand: () => GROUP_BADGE_KEYS,
  },
  {
    // membership error key helper, every error code
    file: 'membershipActions.ts',
    exprText: 'membershipErrorKey(r.code)',
    expand: () => GROUP_ERROR_CODES.map(membershipErrorKey),
  },
  {
    file: 'DetailGroupsRow.tsx',
    exprText: 'membershipErrorKey(r.code)',
    expand: () => GROUP_ERROR_CODES.map(membershipErrorKey),
  },
  {
    file: 'GroupPicker.tsx',
    exprText: 'membershipErrorKey(r.code)',
    expand: () => GROUP_ERROR_CODES.map(membershipErrorKey),
  },
  {
    file: 'GroupPicker.tsx',
    exprText: 'membershipErrorKey(added.code)',
    expand: () => GROUP_ERROR_CODES.map(membershipErrorKey),
  },
  {
    file: 'GroupPicker.tsx',
    exprText: "groupNameErrorKey(validation.code, 'create')",
    expand: () => GROUP_ERROR_CODES.map((c) => groupNameErrorKey(c, 'create')),
  },
  {
    file: 'GroupPicker.tsx',
    exprText: "groupNameErrorKey(r.code, 'create')",
    expand: () => GROUP_ERROR_CODES.map((c) => groupNameErrorKey(c, 'create')),
  },
  {
    // group name error key helper, every code and action
    file: 'GroupNameForm.tsx',
    exprText: 'groupNameErrorKey(messageCode, action)',
    expand: () =>
      GROUP_ERROR_CODES.flatMap((c) => [
        groupNameErrorKey(c, 'create'),
        groupNameErrorKey(c, 'rename'),
      ]),
  },
];

// ---------------------------------------------------------------------------

const hasLetter = (s: string) => /\p{L}/u.test(s);
const KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+$/;

interface ScanResult {
  literals: { line: number; text: string }[];
  dynamicKeys: { line: number; expr: string }[];
  keys: string[];
}

function unwrap(e: ts.Expression): ts.Expression {
  let cur = e;
  while (ts.isParenthesizedExpression(cur) || ts.isAsExpression(cur)) cur = cur.expression;
  return cur;
}

/** Literal texts (with letters) reachable from an expression as user-visible output. */
function literalTexts(expr: ts.Expression): string[] {
  const e = unwrap(expr);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
    return hasLetter(e.text) ? [e.text] : [];
  }
  if (ts.isTemplateExpression(e)) {
    const parts = [e.head.text, ...e.templateSpans.map((s) => s.literal.text)];
    return parts.some(hasLetter) ? [parts.join('${}')] : [];
  }
  if (ts.isConditionalExpression(e)) {
    return [...literalTexts(e.whenTrue), ...literalTexts(e.whenFalse)];
  }
  if (ts.isBinaryExpression(e)) {
    const k = e.operatorToken.kind;
    if (
      k === ts.SyntaxKind.QuestionQuestionToken ||
      k === ts.SyntaxKind.BarBarToken ||
      k === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return [...literalTexts(e.left), ...literalTexts(e.right)];
    }
  }
  return [];
}

function isTCall(node: ts.CallExpression): boolean {
  const c = node.expression;
  return (
    (ts.isIdentifier(c) && c.text === 't') ||
    (ts.isPropertyAccessExpression(c) && c.name.text === 't')
  );
}

function literalKeys(e: ts.Expression): string[] | null {
  const x = unwrap(e);
  if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) return [x.text];
  if (ts.isConditionalExpression(x)) {
    const a = literalKeys(x.whenTrue);
    const b = literalKeys(x.whenFalse);
    if (a && b) return [...a, ...b];
  }
  return null;
}

function scanSource(fileName: string, text: string): ScanResult {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const result: ScanResult = { literals: [], dynamicKeys: [], keys: [] };
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const add = (n: ts.Node, texts: string[]) => {
    for (const t of texts) result.literals.push({ line: lineOf(n), text: t });
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const trimmed = node.text.trim();
      if (hasLetter(trimmed)) add(node, [trimmed]);
    } else if (ts.isJsxExpression(node) && node.expression) {
      const parent = node.parent;
      if (ts.isJsxElement(parent) || ts.isJsxFragment(parent)) {
        add(node, literalTexts(node.expression));
      }
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      const init = node.initializer;
      if (init && A11Y_ATTRS.has(name)) {
        if (ts.isStringLiteral(init)) {
          if (hasLetter(init.text)) add(init, [init.text]);
        } else if (ts.isJsxExpression(init) && init.expression) {
          add(init, literalTexts(init.expression));
        }
      }
      if (name === 'i18nKey' && init && ts.isStringLiteral(init)) result.keys.push(init.text);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sf);
      if (USER_FACING_SINKS.includes(callee)) {
        for (const arg of node.arguments) add(arg, literalTexts(arg));
      }
      if (isTCall(node) && node.arguments.length > 0) {
        const keys = literalKeys(node.arguments[0]);
        if (keys) result.keys.push(...keys);
        else {
          result.dynamicKeys.push({
            line: lineOf(node),
            expr: node.arguments[0].getText(sf).replace(/\s+/g, ' '),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return result;
}

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(resolve(ROOT, dir))) {
    const rel = join(dir, name);
    if (statSync(resolve(ROOT, rel)).isDirectory()) {
      if (name !== '__tests__') walk(rel, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(rel);
    }
  }
}

const FILES = (() => {
  const files: string[] = [];
  walk(GROUPS_DIR, files);
  return [...files, ...EXTRA_FILES];
})();
const SCANS = new Map(
  FILES.map((f) => [f, scanSource(f, readFileSync(resolve(ROOT, f), 'utf8'))] as const),
);
const base = (f: string) => f.split('/').pop() ?? f;

const isExempt = (file: string, text: string) =>
  NON_TRANSLATABLE.some((n) => n.file === file && n.text === text) ||
  DEFERRED_NON_GROUP.some((n) => n.file === file && n.text === text);

describe('scanner sanity', () => {
  const lit = (src: string, f = 'x.tsx') => scanSource(f, src).literals.length;
  it('flags JSX text and a11y attributes, not t() or symbols', () => {
    expect(lit('const a = <span aria-label="Close">Hello</span>;')).toBe(2);
    expect(lit("const a = <span>{t('x')}</span>;")).toBe(0);
    expect(lit('const a = <span>+</span>;')).toBe(0);
  });
  it('flags literal expression children, template attributes and conditionals', () => {
    expect(lit("const a = <span>{'Loading'}</span>;")).toBe(1);
    expect(lit('const a = <div title={`${n} tickets`} />;')).toBe(1);
    expect(lit("const a = <p>{ok ? 'Yes' : t('no')}</p>;")).toBe(1);
  });
  it('flags literals passed to toast sinks in .ts files', () => {
    expect(lit("toast.error('Failed to save');", 'x.ts')).toBe(1);
    expect(lit("toast.error(t('groups.error.move'));", 'x.ts')).toBe(0);
  });
  it('detects dynamic keys and collects literal conditional keys', () => {
    const dyn = scanSource('x.ts', 't(someKey);');
    expect(dyn.dynamicKeys).toHaveLength(1);
    const cond = scanSource('x.ts', "t(cond ? 'a.b' : 'a.c');");
    expect(cond.dynamicKeys).toHaveLength(0);
    expect(cond.keys).toEqual(['a.b', 'a.c']);
  });
});

describe('file walk', () => {
  it('covers .ts files recursively and skips tests', () => {
    expect(FILES).toContain('src/features/groups/membershipActions.ts');
    expect(FILES.some((f) => f.includes('__tests__'))).toBe(false);
  });
});

describe('no literal user-facing strings (D-02)', () => {
  it('group UI has no untranslated literals', () => {
    const violations: string[] = [];
    for (const [file, res] of SCANS) {
      for (const l of res.literals) {
        if (isExempt(file, l.text)) continue;
        violations.push(`${file}:${l.line}: ${JSON.stringify(l.text)}`);
      }
    }
    expect(violations, `Untranslated literals:\n${violations.join('\n')}`).toEqual([]);
  });

  it('exemptions are not stale', () => {
    for (const n of [...NON_TRANSLATABLE, ...DEFERRED_NON_GROUP]) {
      const found = SCANS.get(n.file)?.literals.some((l) => l.text === n.text);
      expect(found, `stale exemption ${n.file}: ${n.text}`).toBe(true);
    }
  });
});

describe('dynamic t() keys', () => {
  it('every non-literal t() key is allowlisted', () => {
    const bad: string[] = [];
    for (const [file, res] of SCANS) {
      for (const d of res.dynamicKeys) {
        const ok = DYNAMIC_KEY_ALLOWLIST.some(
          (a) => a.file === base(file) && a.exprText === d.expr,
        );
        if (!ok) bad.push(`unlisted dynamic t() key at ${file}:${d.line}: ${d.expr}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('allowlist entries are not stale', () => {
    for (const a of DYNAMIC_KEY_ALLOWLIST) {
      const found = [...SCANS].some(
        ([file, res]) =>
          base(file) === a.file && res.dynamicKeys.some((d) => d.expr === a.exprText),
      );
      expect(found, `stale dynamic-key entry ${a.file}: ${a.exprText}`).toBe(true);
    }
  });
});

describe('referenced keys exist in both locales', () => {
  const keys = new Set<string>();
  for (const res of SCANS.values()) for (const k of res.keys) keys.add(k);
  for (const a of DYNAMIC_KEY_ALLOWLIST) for (const k of a.expand()) keys.add(k);

  const present = (loc: Record<string, string>, k: string) =>
    (typeof loc[k] === 'string' && loc[k] !== '') || (!!loc[`${k}_one`] && !!loc[`${k}_other`]);

  it('collects keys', () => {
    expect(keys.size).toBeGreaterThan(20);
  });

  it('each key is non-empty in en.json and sk.json', () => {
    const missing: string[] = [];
    for (const k of [...keys].sort()) {
      if (!KEY_RE.test(k)) continue;
      if (!present(en as Record<string, string>, k)) missing.push(`en: ${k}`);
      if (!present(sk as Record<string, string>, k)) missing.push(`sk: ${k}`);
    }
    expect(missing).toEqual([]);
  });
});
