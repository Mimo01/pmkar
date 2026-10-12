import { describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { copyStepLabel } from '../copyStepLabel';
import type { CopyStepResult } from '../types';

const en = i18n.getFixedT('en');
const sk = i18n.getFixedT('sk');

function step(id: string, success: boolean, detail: string | null = null): CopyStepResult {
  return { step: id, success, detail };
}

describe('copyStepLabel (EN)', () => {
  it('fetch_source', () => {
    expect(copyStepLabel(step('fetch_source', true), en)).toBe('Source ticket loaded');
    expect(copyStepLabel(step('fetch_source', false), en)).toBe(
      'Source ticket — could not be loaded',
    );
  });

  it('add_remotelink', () => {
    expect(copyStepLabel(step('add_remotelink', true), en)).toBe('Origin link added');
  });

  it('worklog:fetch is not treated as a worklog entry', () => {
    expect(copyStepLabel(step('worklog:fetch', true), en)).toBe('Work log loaded');
    expect(copyStepLabel(step('worklog:fetch', false), en)).toBe('Work log — could not be loaded');
  });

  it('worklog:N', () => {
    expect(copyStepLabel(step('worklog:3', true), en)).toBe('Work log entry 3 copied');
    expect(copyStepLabel(step('worklog:3', false), en)).toBe('Work log 3 — failed');
  });

  it('update_triage', () => {
    expect(copyStepLabel(step('update_triage', true), en)).toBe('Triage state updated');
    expect(copyStepLabel(step('update_triage', false), en)).toBe(
      'Triage state — could not be updated',
    );
  });

  it('attach splits on the first colon only', () => {
    expect(copyStepLabel(step('attach:my:file.png', true), en)).toContain('my:file.png');
  });

  it('attach failure without detail uses translated fallback', () => {
    expect(copyStepLabel(step('attach:x.png', false), en)).toBe('x.png — attachment failed');
    expect(copyStepLabel(step('attach:x.png', false), sk)).toContain('príloha zlyhala');
  });

  it('subtask fallbacks are translated', () => {
    expect(copyStepLabel(step('subtask:ABC-1', true), en)).toBe('Sub-task ABC-1 — created');
    expect(copyStepLabel(step('subtask:ABC-1', false), en)).toBe(
      'Sub-task ABC-1 — creation failed',
    );
    expect(copyStepLabel(step('subtask:ABC-1', true), sk)).toContain('vytvorené');
    expect(copyStepLabel(step('subtask:ABC-1', false), sk)).toContain('vytvorenie zlyhalo');
  });

  it('comment failure keeps Jira detail unchanged', () => {
    expect(copyStepLabel(step('comment:2', false, 'HTTP 403'), en)).toBe('Comment 2 — HTTP 403');
  });

  it('unknown ids use the translated fallback', () => {
    expect(copyStepLabel(step('foo_bar', true), en)).toBe('Step: foo_bar — completed');
    expect(copyStepLabel(step('foo_bar', false), en)).toBe('Step: foo_bar — failed');
  });
});

describe('copyStepLabel (SK)', () => {
  const ids = [
    'fetch_source',
    'create_issue',
    'convert_description',
    'upload_image_1',
    'add_remotelink',
    'attach:a.png',
    'comment:1',
    'worklog:fetch',
    'worklog:2',
    'subtask:ABC-1',
    'update_triage',
    'foo_bar',
  ];

  for (const id of ids) {
    for (const success of [true, false]) {
      it(`${id} (${success ? 'ok' : 'fail'}) yields a real label in EN and SK`, () => {
        for (const t of [en, sk]) {
          const label = copyStepLabel(step(id, success), t);
          expect(label.length).toBeGreaterThan(0);
          expect(label).not.toMatch(/^copy\./);
        }
      });
    }
  }

  it('unknown id label in SK contains the raw id', () => {
    expect(copyStepLabel(step('foo_bar', true), sk)).toBe('Krok: foo_bar — dokončený');
    expect(copyStepLabel(step('foo_bar', false), sk)).toContain('foo_bar');
  });
});
