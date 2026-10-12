import { describe, expect, it } from 'vitest';
import {
  filterTickets,
  isLinkedCandidate,
  isNewCandidate,
  isNotMineCandidate,
  sortTickets,
} from '../ticketListUtils';
import type { JiraTicket, TriageEntry, TriageState } from '../types';

interface Opts {
  updated?: string;
  created?: string | null;
  priorityId?: string;
  status?: string;
  assignee?: string | null;
  done?: boolean;
}

function makeTicket(key: string, o: Opts = {}): JiraTicket {
  return {
    id: key,
    key,
    fields: {
      summary: `Summary for ${key}`,
      status: {
        name: o.status ?? 'Open',
        statusCategory: { key: o.done ? 'done' : 'indeterminate' },
      },
      priority: { name: 'P', id: o.priorityId ?? '3' },
      assignee: o.assignee ? { displayName: o.assignee } : null,
      created: o.created === null ? undefined : (o.created ?? '2024-01-01T00:00:00.000Z'),
      updated: o.updated ?? '2024-01-01T00:00:00.000Z',
    },
  } as unknown as JiraTicket;
}

function triage(state: TriageState): Record<string, TriageEntry> {
  return { 'A-1': { state, copiedKey: null } };
}

const keys = (ts: JiraTicket[]) => ts.map((t) => t.key);

describe('predicates', () => {
  const t = makeTicket('A-1');
  const done = makeTicket('A-1', { done: true });

  it('isNewCandidate accepts no entry, new and seen', () => {
    expect(isNewCandidate(t, {})).toBe(true);
    expect(isNewCandidate(t, triage('new'))).toBe(true);
    expect(isNewCandidate(t, triage('seen'))).toBe(true);
  });

  it('isNewCandidate rejects ignored, copied, handled and done', () => {
    expect(isNewCandidate(t, triage('ignored'))).toBe(false);
    expect(isNewCandidate(t, triage('copied'))).toBe(false);
    expect(isNewCandidate(t, triage('handled'))).toBe(false);
    expect(isNewCandidate(done, {})).toBe(false);
  });

  it('isNotMineCandidate accepts only ignored and handled, not done', () => {
    expect(isNotMineCandidate(t, triage('ignored'))).toBe(true);
    expect(isNotMineCandidate(t, triage('handled'))).toBe(true);
    expect(isNotMineCandidate(t, {})).toBe(false);
    expect(isNotMineCandidate(t, triage('new'))).toBe(false);
    expect(isNotMineCandidate(t, triage('seen'))).toBe(false);
    expect(isNotMineCandidate(t, triage('copied'))).toBe(false);
    expect(isNotMineCandidate(done, triage('ignored'))).toBe(false);
  });

  it('isLinkedCandidate accepts only copied, not done', () => {
    expect(isLinkedCandidate(t, triage('copied'))).toBe(true);
    expect(isLinkedCandidate(t, {})).toBe(false);
    expect(isLinkedCandidate(t, triage('ignored'))).toBe(false);
    expect(isLinkedCandidate(done, triage('copied'))).toBe(false);
  });
});

describe('filterTickets', () => {
  const tickets = [
    makeTicket('ABC-1', { assignee: 'Alice' }),
    makeTicket('ABC-2', { assignee: 'Bob' }),
    makeTicket('XYZ-3'),
  ];

  it('returns all tickets in order for empty filters', () => {
    expect(keys(filterTickets(tickets, '', ''))).toEqual(['ABC-1', 'ABC-2', 'XYZ-3']);
  });

  it('matches key case-insensitively', () => {
    expect(keys(filterTickets(tickets, 'abc', ''))).toEqual(['ABC-1', 'ABC-2']);
    expect(keys(filterTickets(tickets, 'XyZ-3', ''))).toEqual(['XYZ-3']);
  });

  it('does not match summary text', () => {
    expect(filterTickets(tickets, 'summary', '')).toEqual([]);
  });

  it('matches assignee display name exactly and case-insensitively', () => {
    expect(keys(filterTickets(tickets, '', 'alice'))).toEqual(['ABC-1']);
    expect(filterTickets(tickets, '', 'ali')).toEqual([]);
  });

  it('does not match unassigned tickets when an assignee filter is set', () => {
    expect(keys(filterTickets(tickets, '', 'Bob'))).toEqual(['ABC-2']);
  });

  it('combines search and assignee filters', () => {
    expect(keys(filterTickets(tickets, 'abc-2', 'bob'))).toEqual(['ABC-2']);
    expect(filterTickets(tickets, 'abc-1', 'bob')).toEqual([]);
  });
});

describe('sortTickets', () => {
  it('sorts keys numerically within a project and by project first', () => {
    const ts = [makeTicket('XYZ-1'), makeTicket('ABC-10'), makeTicket('ABC-2')];
    expect(keys(sortTickets(ts, 'key', 'asc'))).toEqual(['ABC-2', 'ABC-10', 'XYZ-1']);
    expect(keys(sortTickets(ts, 'key', 'desc'))).toEqual(['XYZ-1', 'ABC-10', 'ABC-2']);
  });

  it('handles keys that do not match the pattern', () => {
    const ts = [makeTicket('B'), makeTicket('A')];
    expect(keys(sortTickets(ts, 'key', 'asc'))).toEqual(['A', 'B']);
  });

  it('created falls back to updated when missing', () => {
    const ts = [
      makeTicket('A-1', { created: null, updated: '2024-03-01T00:00:00.000Z' }),
      makeTicket('A-2', { created: '2024-02-01T00:00:00.000Z' }),
      makeTicket('A-3', { created: '2024-04-01T00:00:00.000Z' }),
    ];
    expect(keys(sortTickets(ts, 'created', 'asc'))).toEqual(['A-2', 'A-1', 'A-3']);
  });

  it('sorts priority by numeric id', () => {
    const ts = [
      makeTicket('A-1', { priorityId: '10' }),
      makeTicket('A-2', { priorityId: '2' }),
      makeTicket('A-3', { priorityId: '5' }),
    ];
    expect(keys(sortTickets(ts, 'priority', 'asc'))).toEqual(['A-2', 'A-3', 'A-1']);
    expect(keys(sortTickets(ts, 'priority', 'desc'))).toEqual(['A-1', 'A-3', 'A-2']);
  });

  it('sorts status by name', () => {
    const ts = [
      makeTicket('A-1', { status: 'Review' }),
      makeTicket('A-2', { status: 'Blocked' }),
      makeTicket('A-3', { status: 'Open' }),
    ];
    expect(keys(sortTickets(ts, 'status', 'asc'))).toEqual(['A-2', 'A-3', 'A-1']);
  });

  it('sorts assignee by display name with null as empty string', () => {
    const ts = [
      makeTicket('A-1', { assignee: 'Bob' }),
      makeTicket('A-2'),
      makeTicket('A-3', { assignee: 'Alice' }),
    ];
    expect(keys(sortTickets(ts, 'assignee', 'asc'))).toEqual(['A-2', 'A-3', 'A-1']);
    expect(keys(sortTickets(ts, 'assignee', 'desc'))).toEqual(['A-1', 'A-3', 'A-2']);
  });

  it('sorts by updated and keeps input order on ties in both directions', () => {
    const ts = [
      makeTicket('A-1', { updated: '2024-03-08T00:00:00.000Z' }),
      makeTicket('A-2', { updated: '2024-03-08T00:00:00.000Z' }),
      makeTicket('A-3', { updated: '2024-03-12T00:00:00.000Z' }),
    ];
    expect(keys(sortTickets(ts, 'updated', 'desc'))).toEqual(['A-3', 'A-1', 'A-2']);
    expect(keys(sortTickets(ts, 'updated', 'asc'))).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it('does not mutate the input array', () => {
    const ts = [makeTicket('B-1'), makeTicket('A-1')];
    const copy = [...ts];
    const result = sortTickets(ts, 'key', 'asc');
    expect(ts).toEqual(copy);
    expect(result).not.toBe(ts);
  });
});
