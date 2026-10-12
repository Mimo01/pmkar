import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import en from '../../../i18n/locales/en.json';
import sk from '../../../i18n/locales/sk.json';
import { copyStepLabel } from '../copyStepLabel';

// D-11: fail when Rust emits a copy step id that has no translation key.

const RUST_FILES = ['src-tauri/src/copy_pipeline.rs', 'src-tauri/src/commands.rs'];

function readRust(): string {
  return RUST_FILES.map((f) => readFileSync(resolve(process.cwd(), f), 'utf8')).join('\n');
}

function extractIds(src: string): { literals: Set<string>; kinds: Set<string> } {
  const literals = new Set<string>();
  const kinds = new Set<string>();
  for (const m of src.matchAll(/step:\s*"([a-z_:]+)"\.to_string\(\)/g)) literals.add(m[1]);
  for (const m of src.matchAll(/step:\s*format!\("([a-z_]+):\{/g)) kinds.add(m[1]);
  return { literals, kinds };
}

const SAMPLE_ARG: Record<string, string> = {
  attach: 'attach:file.png',
  comment: 'comment:1',
  worklog: 'worklog:1',
  subtask: 'subtask:ABC-1',
};

describe('copy step ids emitted by Rust all resolve to translation keys', () => {
  const { literals, kinds } = extractIds(readRust());
  const ids = [...literals, ...[...kinds].map((k) => SAMPLE_ARG[k] ?? `${k}:x`)];

  it('extracts a plausible set of ids (guards against a vacuous pass)', () => {
    expect(ids.length).toBeGreaterThanOrEqual(8);
    for (const lit of [
      'fetch_source',
      'create_issue',
      'update_triage',
      'add_remotelink',
      'worklog:fetch',
    ]) {
      expect(literals.has(lit), `missing literal ${lit}`).toBe(true);
    }
    for (const kind of ['attach', 'comment', 'worklog', 'subtask']) {
      expect(kinds.has(kind), `missing kind ${kind}`).toBe(true);
    }
  });

  for (const id of ids) {
    for (const success of [true, false]) {
      it(`${id} (${success ? 'success' : 'failure'}) maps to a real key in EN and SK`, () => {
        const keys: string[] = [];
        const t = ((key: string) => {
          keys.push(key);
          return key;
        }) as unknown as TFunction;
        copyStepLabel({ step: id, success, detail: null }, t);

        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) {
          expect(key).not.toBe('copy.step.unknown');
          expect(key).not.toBe('copy.step.unknownFailed');
          expect(en, `en.json missing ${key}`).toHaveProperty([key]);
          expect(sk, `sk.json missing ${key}`).toHaveProperty([key]);
        }
      });
    }
  }
});
