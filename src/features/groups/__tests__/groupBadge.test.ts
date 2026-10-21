import { describe, expect, it } from 'vitest';
import type { JiraTicket, TriageEntry, TriageState } from '../../tickets/types';
import { groupBadgeKey } from '../groupBadge';

function makeTicket(done: boolean): JiraTicket {
  return {
    id: 'A-1',
    key: 'A-1',
    fields: {
      summary: 's',
      status: { name: 'Open', statusCategory: { key: done ? 'done' : 'indeterminate' } },
    },
  } as unknown as JiraTicket;
}

function triage(state: TriageState | undefined): Record<string, TriageEntry> {
  return state ? { 'A-1': { state, copiedKey: null } } : {};
}

describe('groupBadgeKey', () => {
  const open = makeTicket(false);
  const done = makeTicket(true);
  it.each([undefined, 'new', 'seen'] as const)('open %s -> nav.new', (s) => {
    expect(groupBadgeKey(open, triage(s))).toBe('nav.new');
  });
  it.each(['ignored', 'handled'] as const)('open %s -> nav.notMine', (s) => {
    expect(groupBadgeKey(open, triage(s))).toBe('nav.notMine');
  });
  it('open copied -> nav.linked', () => {
    expect(groupBadgeKey(open, triage('copied'))).toBe('nav.linked');
  });
  it('open watched -> nav.watched', () => {
    expect(groupBadgeKey(open, triage('watched'))).toBe('nav.watched');
  });
  it.each([
    undefined,
    'new',
    'seen',
    'ignored',
    'handled',
    'copied',
    'watched',
  ] as const)('done %s -> groups.badge.done', (s) => {
    expect(groupBadgeKey(done, triage(s))).toBe('groups.badge.done');
  });
});
