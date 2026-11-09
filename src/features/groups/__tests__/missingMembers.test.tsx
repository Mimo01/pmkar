import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';

import { useConnectionStore } from '../../connections/connectionStore';
import { computeFetchSignature, currentFetchSignatureInput } from '../../tickets/fetchSignature';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket } from '../../tickets/types';
import { useGroupStore } from '../groupStore';
import {
  computeMissingKeys,
  EMPTY_MISSING,
  pruneMissingMembers,
  readMissingKeysNow,
  useAutoRemoveMissingMembers,
  useMissingKeysByGroup,
} from '../missingMembers';

const tk = (key: string) => ({ id: key, key, fields: {} }) as unknown as JiraTicket;

function makeEligible() {
  useTicketStore.setState({
    lastCompleteFetchSignature: computeFetchSignature(
      currentFetchSignatureInput(useTicketStore.getState(), useConnectionStore.getState()),
    ),
  });
}

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockResolvedValue(1);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  useGroupStore.setState({ memberKeysByGroup: { 1: ['A', 'B'], 2: ['A'] }, hydrated: true });
  useTicketStore.setState({
    tickets: [tk('A')],
    lastCompleteFetchSignature: null,
    fetchStatus: 'idle',
  });
});

describe('computeMissingKeys', () => {
  it('returns absent keys when eligible', () => {
    expect([...computeMissingKeys(['A', 'B'], new Set(['A']), true)]).toEqual(['B']);
  });
  it('returns EMPTY_MISSING when not eligible, null keys or nothing missing', () => {
    expect(computeMissingKeys(['A', 'B'], new Set(['A']), false)).toBe(EMPTY_MISSING);
    expect(computeMissingKeys(null, new Set(), true)).toBe(EMPTY_MISSING);
    expect(computeMissingKeys(['A'], new Set(['A']), true)).toBe(EMPTY_MISSING);
  });
});

describe('useMissingKeysByGroup', () => {
  it('is empty when not eligible', () => {
    const { result } = renderHook(() => useMissingKeysByGroup());
    expect(result.current.size).toBe(0);
  });
  it('maps groups with missing keys and is referentially stable', () => {
    makeEligible();
    const { result, rerender } = renderHook(() => useMissingKeysByGroup());
    expect([...(result.current.get(1) ?? [])]).toEqual(['B']);
    expect(result.current.has(2)).toBe(false);
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe('readMissingKeysNow', () => {
  it('matches the computed state', () => {
    expect(readMissingKeysNow(1)).toBe(EMPTY_MISSING);
    makeEligible();
    expect([...readMissingKeysNow(1)]).toEqual(['B']);
    expect(readMissingKeysNow(99)).toBe(EMPTY_MISSING);
  });
  it('is empty while loading and recovers once idle', () => {
    makeEligible();
    expect([...readMissingKeysNow(1)]).toEqual(['B']);
    useTicketStore.getState().setFetchStatus('loading');
    expect(readMissingKeysNow(1)).toBe(EMPTY_MISSING);
    useTicketStore.getState().setFetchStatus('idle');
    expect([...readMissingKeysNow(1)]).toEqual(['B']);
  });
});

const removeCalls = () => mockInvoke.mock.calls.filter((c) => c[0] === 'remove_issues_from_group');

describe('pruneMissingMembers', () => {
  it('removes exactly the absent keys of the affected group', async () => {
    makeEligible();
    await pruneMissingMembers();
    expect(removeCalls()).toHaveLength(1);
    expect(removeCalls()[0][1]).toEqual({ groupId: 1, issueKeys: ['B'] });
  });

  it('does nothing without a complete signature', async () => {
    await pruneMissingMembers();
    expect(removeCalls()).toHaveLength(0);
  });

  it('does nothing while loading, then prunes once idle', async () => {
    makeEligible();
    useTicketStore.setState({ fetchStatus: 'loading' });
    await pruneMissingMembers();
    expect(removeCalls()).toHaveLength(0);
    useTicketStore.setState({ fetchStatus: 'idle' });
    await pruneMissingMembers();
    expect(removeCalls()).toHaveLength(1);
  });

  it('does nothing on signature mismatch', async () => {
    makeEligible();
    useTicketStore.setState({ lastCompleteFetchSignature: 'stale-signature' });
    await pruneMissingMembers();
    expect(removeCalls()).toHaveLength(0);
  });

  it('does nothing after a partial fetch', async () => {
    useTicketStore.getState().setTickets([tk('A')], {}, 5, true, null);
    await pruneMissingMembers();
    expect(removeCalls()).toHaveLength(0);
  });

  it('does nothing when groups are not hydrated', async () => {
    makeEligible();
    useGroupStore.setState({ hydrated: false });
    await pruneMissingMembers();
    expect(removeCalls()).toHaveLength(0);
  });

  it('does nothing when all members are present', async () => {
    makeEligible();
    useTicketStore.setState({ tickets: [tk('A'), tk('B')] });
    await pruneMissingMembers();
    expect(removeCalls()).toHaveLength(0);
  });

  it('stops pruning later groups when a fetch begins mid-prune', async () => {
    useGroupStore.setState({ memberKeysByGroup: { 1: ['A', 'B'], 2: ['A', 'C'] } });
    makeEligible();
    mockInvoke.mockImplementation(async () => {
      useTicketStore.getState().beginFetch();
      return 1;
    });
    await pruneMissingMembers();
    expect(removeCalls()).toHaveLength(1);
    expect(removeCalls()[0][1]).toEqual({ groupId: 1, issueKeys: ['B'] });
  });

  it('is re-entrancy safe: concurrent calls yield one removal per group', async () => {
    useGroupStore.setState({ memberKeysByGroup: { 1: ['A', 'B'], 2: ['A', 'C'] } });
    makeEligible();
    // Emulate the real store: a successful removal re-hydrates membership.
    mockInvoke.mockImplementation(async (_cmd, args) => {
      const { groupId, issueKeys } = args as { groupId: number; issueKeys: string[] };
      const cur = useGroupStore.getState().memberKeysByGroup;
      useGroupStore.setState({
        memberKeysByGroup: {
          ...cur,
          [groupId]: cur[groupId].filter((k) => !issueKeys.includes(k)),
        },
      });
      return 1;
    });
    await Promise.all([pruneMissingMembers(), pruneMissingMembers()]);
    expect(removeCalls()).toHaveLength(2);
  });

  it('swallows removal failures without throwing or looping', async () => {
    makeEligible();
    mockInvoke.mockRejectedValue('boom');
    await expect(pruneMissingMembers()).resolves.toBeUndefined();
    expect(removeCalls()).toHaveLength(1);
  });
});

describe('useAutoRemoveMissingMembers', () => {
  it('prunes after a complete matching fetch lands', async () => {
    renderHook(() => useAutoRemoveMissingMembers());
    await act(async () => {
      const state = useTicketStore.getState();
      const sig = computeFetchSignature(
        currentFetchSignatureInput(state, useConnectionStore.getState()),
      );
      state.setTickets([tk('A')], {}, 1, false, sig);
    });
    await vi.waitFor(() => expect(removeCalls()).toHaveLength(1));
    expect(removeCalls()[0][1]).toEqual({ groupId: 1, issueKeys: ['B'] });
  });
});
