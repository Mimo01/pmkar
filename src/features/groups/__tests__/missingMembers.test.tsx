import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { useConnectionStore } from '../../connections/connectionStore';
import { computeFetchSignature, currentFetchSignatureInput } from '../../tickets/fetchSignature';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket } from '../../tickets/types';
import { useGroupStore } from '../groupStore';
import {
  computeMissingKeys,
  EMPTY_MISSING,
  readMissingKeysNow,
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

beforeEach(() => {
  useGroupStore.setState({ memberKeysByGroup: { 1: ['A', 'B'], 2: ['A'] } });
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
