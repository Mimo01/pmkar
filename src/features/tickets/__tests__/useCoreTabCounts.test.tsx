import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTicketStore } from '../ticketStore';
import type { JiraTicket, TriageEntry } from '../types';
import { useCoreTabCounts } from '../useCoreTabCounts';

const mk = (key: string, done = false): JiraTicket => ({
  id: key,
  key,
  fields: {
    summary: key,
    status: { name: done ? 'Done' : 'Open', statusCategory: { key: done ? 'done' : 'new' } },
    priority: { name: 'Medium', id: '3' },
    assignee: null,
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
  },
});

describe('useCoreTabCounts', () => {
  beforeEach(() => {
    useTicketStore.setState({ tickets: [], triageMap: {} });
  });

  it('counts only watched, not-done tickets and returns no other keys', () => {
    const triageMap: Record<string, TriageEntry> = {
      A: { state: 'watched', copiedKey: null },
      B: { state: 'watched', copiedKey: 'C-1' },
      C: { state: 'ignored', copiedKey: null },
      D: { state: 'handled', copiedKey: 'C-2' },
      E: { state: 'copied', copiedKey: 'C-3' },
      F: { state: 'watched', copiedKey: null },
    };
    useTicketStore.setState({
      tickets: [mk('A'), mk('B'), mk('C'), mk('D'), mk('E'), mk('F', true)],
      triageMap,
    });
    const { result } = renderHook(() => useCoreTabCounts());
    expect(result.current).toEqual({ watched: 2 });
  });
});
