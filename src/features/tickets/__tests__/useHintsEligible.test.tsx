import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useConnectionStore } from '../../connections/connectionStore';
import { computeFetchSignature, currentFetchSignatureInput } from '../fetchSignature';
import { useTicketStore } from '../ticketStore';
import { readHintsEligibleNow, useHintsEligible } from '../useHintsEligible';

function sigNow(): string {
  return computeFetchSignature(
    currentFetchSignatureInput(useTicketStore.getState(), useConnectionStore.getState()),
  );
}

function completeFetch() {
  act(() => {
    useTicketStore.getState().setTickets([], {}, 0, false, sigNow());
  });
}

describe('useHintsEligible', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      serverConnection: { baseUrl: 'https://jira.example.com', username: 'alice' },
      sourceProjectKey: 'PROJ',
    } as never);
    useTicketStore.setState({
      jqlPreset: 'mine',
      jqlCustom: null,
      watchedUsers: [],
      lastCompleteFetchSignature: null,
      fetchStatus: 'idle',
    });
  });

  afterEach(() => {
    useConnectionStore.setState({ serverConnection: null, sourceProjectKey: null } as never);
    useTicketStore.setState({
      jqlPreset: 'all_watched',
      jqlCustom: null,
      watchedUsers: [],
      lastCompleteFetchSignature: null,
    });
  });

  it('is false on a fresh session', () => {
    const { result } = renderHook(() => useHintsEligible());
    expect(result.current).toBe(false);
    expect(readHintsEligibleNow()).toBe(false);
  });

  it('is true when the stored signature matches the current query', () => {
    const { result } = renderHook(() => useHintsEligible());
    completeFetch();
    expect(result.current).toBe(true);
    expect(readHintsEligibleNow()).toBe(true);
  });

  it('hides on preset change and re-shows when switching back', () => {
    const { result } = renderHook(() => useHintsEligible());
    completeFetch();
    act(() => useTicketStore.getState().setJqlPreset('all_watched'));
    expect(result.current).toBe(false);
    expect(readHintsEligibleNow()).toBe(false);
    act(() => useTicketStore.getState().setJqlPreset('mine'));
    expect(result.current).toBe(true);
  });

  it('hides when custom JQL changes under the custom preset', () => {
    act(() => {
      useTicketStore.getState().setJqlPreset('custom');
      useTicketStore.getState().setJqlCustom('project = A');
    });
    const { result } = renderHook(() => useHintsEligible());
    completeFetch();
    expect(result.current).toBe(true);
    act(() => useTicketStore.getState().setJqlCustom('project = B'));
    expect(result.current).toBe(false);
  });

  it('hides when sourceProjectKey changes', () => {
    const { result } = renderHook(() => useHintsEligible());
    completeFetch();
    act(() => useConnectionStore.setState({ sourceProjectKey: 'OTHER' } as never));
    expect(result.current).toBe(false);
  });

  it('hides after markFetchIncomplete', () => {
    const { result } = renderHook(() => useHintsEligible());
    completeFetch();
    act(() => useTicketStore.getState().markFetchIncomplete());
    expect(result.current).toBe(false);
  });

  it('readHintsEligibleNow is false while loading and true again once idle', () => {
    completeFetch();
    expect(readHintsEligibleNow()).toBe(true);
    act(() => useTicketStore.getState().setFetchStatus('loading'));
    expect(readHintsEligibleNow()).toBe(false);
    act(() => useTicketStore.getState().setFetchStatus('idle'));
    expect(readHintsEligibleNow()).toBe(true);
  });

  it('readHintsEligibleNow stays true on error with a matching signature (not loading)', () => {
    completeFetch();
    act(() => useTicketStore.getState().setFetchStatus('error', 'boom'));
    expect(readHintsEligibleNow()).toBe(true);
  });

  it('hook stays true across loading (no flicker on background polls)', () => {
    const { result } = renderHook(() => useHintsEligible());
    completeFetch();
    expect(result.current).toBe(true);
    act(() => useTicketStore.getState().setFetchStatus('loading'));
    expect(result.current).toBe(true);
    expect(readHintsEligibleNow()).toBe(false);
  });

  it('does not loop on rerender', () => {
    let renders = 0;
    const { rerender } = renderHook(() => {
      renders++;
      return useHintsEligible();
    });
    rerender();
    rerender();
    expect(renders).toBeLessThan(5);
  });
});
