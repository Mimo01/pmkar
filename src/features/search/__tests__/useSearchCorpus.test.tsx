import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGroupStore } from '../../groups/groupStore';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket, TriageEntry, TriageState } from '../../tickets/types';
import { categoryFor, useSearchCorpus } from '../useSearchCorpus';

function mk(key: string, o: { done?: boolean; summary?: string } = {}): JiraTicket {
  return {
    id: key,
    key,
    fields: {
      summary: o.summary ?? `Summary ${key}`,
      status: {
        name: 'Open',
        statusCategory: { key: o.done ? 'done' : 'indeterminate' },
      },
      priority: { name: 'P', id: '3' },
      assignee: null,
      created: '2024-01-01T00:00:00.000Z',
      updated: '2024-01-01T00:00:00.000Z',
    },
  } as unknown as JiraTicket;
}

function entry(state: TriageState, copiedKey: string | null = null): TriageEntry {
  return { state, copiedKey } as TriageEntry;
}

type GetMembers = ReturnType<typeof useGroupStore.getState>['getGroupMembers'];

function stubMembers(fn: (id: number) => ReturnType<GetMembers>) {
  useGroupStore.setState({ getGroupMembers: fn as GetMembers });
}

function snapOf(t: JiraTicket) {
  return { issueKey: t.key, ticketJson: JSON.stringify(t), addedAt: '2024-01-01' };
}

const originalGet = useGroupStore.getState().getGroupMembers;

beforeEach(() => {
  useTicketStore.setState({ tickets: [], triageMap: {}, lastFetchedAt: null });
  useGroupStore.setState({
    groups: [],
    memberKeysByGroup: {},
    groupIdsByIssue: {},
    snapshotRevision: 0,
    getGroupMembers: originalGet,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  useGroupStore.setState({ getGroupMembers: originalGet });
});

describe('categoryFor', () => {
  it('maps triage states to categories', () => {
    const t = mk('A-1');
    expect(categoryFor(t, { 'A-1': entry('ignored') })).toBe('dismissed');
    expect(categoryFor(t, { 'A-1': entry('handled') })).toBe('dismissed');
    expect(categoryFor(t, { 'A-1': entry('copied', 'B-1') })).toBe('linked');
    expect(categoryFor(t, { 'A-1': entry('watched') })).toBe('watched');
    expect(categoryFor(t, {})).toBe('new');
    expect(categoryFor(t, { 'A-1': entry('seen') })).toBe('new');
  });

  it('returns null for Done tickets', () => {
    expect(categoryFor(mk('A-1', { done: true }), {})).toBeNull();
  });
});

describe('useSearchCorpus', () => {
  it('disabled: live tickets only, never loads snapshots', () => {
    const spy = vi.fn();
    stubMembers(spy as unknown as (id: number) => ReturnType<GetMembers>);
    useTicketStore.setState({ tickets: [mk('A-1')], lastFetchedAt: 'x' });
    useGroupStore.setState({ memberKeysByGroup: { 1: ['S-1'] } });
    const { result } = renderHook(() => useSearchCorpus(false));
    expect(result.current.items.map((i) => i.ticket.key)).toEqual(['A-1']);
    expect(spy).not.toHaveBeenCalled();
  });

  it('merges snapshot-only members once, live wins, Done included', async () => {
    const live = mk('A-1', { summary: 'live' });
    const stale = mk('A-1', { summary: 'snapshot' });
    const only = mk('S-1');
    stubMembers(async (id) => ({
      ok: true,
      value: id === 1 ? [snapOf(stale), snapOf(only)] : [snapOf(only)],
    }));
    useTicketStore.setState({
      tickets: [live, mk('D-1', { done: true })],
      lastFetchedAt: 'x',
    });
    useGroupStore.setState({ memberKeysByGroup: { 1: ['A-1', 'S-1'], 2: ['S-1'] } });
    const { result } = renderHook(() => useSearchCorpus(true));
    await waitFor(() => expect(result.current.ready).toBe(true));
    const keys = result.current.items.map((i) => i.ticket.key);
    expect(keys).toEqual(['A-1', 'D-1', 'S-1']);
    expect(result.current.items[0].ticket).toBe(live);
    expect(result.current.items[1].category).toBeNull();
  });

  it('skips invalid snapshots and failed groups but still becomes ready', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const good = mk('G-1');
    stubMembers(async (id) => {
      if (id === 1) return { ok: false, code: 'unknown' } as never;
      return {
        ok: true,
        value: [
          { issueKey: 'BAD-1', ticketJson: '{nope', addedAt: '' },
          { issueKey: 'BAD-2', ticketJson: '{"key":"BAD-2"}', addedAt: '' },
          snapOf(good),
        ],
      };
    });
    useTicketStore.setState({ lastFetchedAt: 'x' });
    useGroupStore.setState({
      memberKeysByGroup: { 1: ['F-1'], 2: ['BAD-1', 'BAD-2', 'G-1'] },
    });
    const { result } = renderHook(() => useSearchCorpus(true));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.items.map((i) => i.ticket.key)).toEqual(['G-1']);
  });

  it('carries copiedKey from triage for any state', () => {
    useTicketStore.setState({
      tickets: [mk('A-1'), mk('A-2')],
      triageMap: { 'A-1': entry('watched', 'Z-9') },
      lastFetchedAt: 'x',
    });
    const { result } = renderHook(() => useSearchCorpus(true));
    expect(result.current.items[0].copiedKey).toBe('Z-9');
    expect(result.current.items[0].category).toBe('watched');
    expect(result.current.items[1].copiedKey).toBeNull();
  });

  it('reloads on snapshotRevision and excludes keys no longer members', async () => {
    const s1 = mk('S-1');
    const fn = vi.fn(async () => ({ ok: true as const, value: [snapOf(s1)] }));
    stubMembers(fn as unknown as (id: number) => ReturnType<GetMembers>);
    useTicketStore.setState({ lastFetchedAt: 'x' });
    useGroupStore.setState({ memberKeysByGroup: { 1: ['S-1'] } });
    const { result } = renderHook(() => useSearchCorpus(true));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => useGroupStore.setState({ snapshotRevision: 1 }));
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
    act(() => useGroupStore.setState({ memberKeysByGroup: { 1: [] } }));
    await waitFor(() => expect(result.current.items).toHaveLength(0));
  });

  it('drops a stale slower response', async () => {
    const s1 = mk('S-1');
    const s2 = mk('S-2');
    let resolveFirst: (v: unknown) => void = () => {};
    let call = 0;
    stubMembers((() => {
      call += 1;
      if (call === 1)
        return new Promise((r) => {
          resolveFirst = r;
        });
      return Promise.resolve({ ok: true, value: [snapOf(s2)] });
    }) as never);
    useTicketStore.setState({ lastFetchedAt: 'x' });
    useGroupStore.setState({ memberKeysByGroup: { 1: ['S-1'] } });
    const { result } = renderHook(() => useSearchCorpus(true));
    act(() => useGroupStore.setState({ memberKeysByGroup: { 1: ['S-2'] } }));
    await waitFor(() => expect(result.current.items.map((i) => i.ticket.key)).toEqual(['S-2']));
    await act(async () => resolveFirst({ ok: true, value: [snapOf(s1)] }));
    expect(result.current.items.map((i) => i.ticket.key)).toEqual(['S-2']);
  });

  it('is empty after a server switch', async () => {
    stubMembers(async () => ({ ok: true, value: [snapOf(mk('S-1'))] }));
    useTicketStore.setState({ tickets: [mk('A-1')], lastFetchedAt: 'x' });
    useGroupStore.setState({ memberKeysByGroup: { 1: ['S-1'] } });
    const { result } = renderHook(() => useSearchCorpus(true));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    act(() => {
      useTicketStore.getState().resetForServerSwitch();
      useGroupStore.setState({ groups: [], memberKeysByGroup: {}, groupIdsByIssue: {} });
    });
    await waitFor(() => expect(result.current.items).toEqual([]));
  });

  it('ready is false until snapshots settle', async () => {
    let resolve: (v: unknown) => void = () => {};
    stubMembers(
      (() =>
        new Promise((r) => {
          resolve = r;
        })) as never,
    );
    useTicketStore.setState({ lastFetchedAt: 'x' });
    useGroupStore.setState({ memberKeysByGroup: { 1: ['S-1'] } });
    const { result } = renderHook(() => useSearchCorpus(true));
    expect(result.current.ready).toBe(false);
    await act(async () => resolve({ ok: true, value: [] }));
    expect(result.current.ready).toBe(true);
  });

  it('ready immediately with no member keys', async () => {
    useTicketStore.setState({ lastFetchedAt: 'x' });
    const { result } = renderHook(() => useSearchCorpus(true));
    await waitFor(() => expect(result.current.ready).toBe(true));
  });
});
