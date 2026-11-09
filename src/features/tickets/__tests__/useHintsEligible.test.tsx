import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useConnectionStore } from '../../connections/connectionStore';
import { computeFetchSignature, currentFetchSignatureInput } from '../fetchSignature';
import { useTicketStore } from '../ticketStore';
import { readHintsEligibleNow } from '../useHintsEligible';

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

describe('readHintsEligibleNow', () => {
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
    expect(readHintsEligibleNow()).toBe(false);
  });

  it('is true when the stored signature matches the current query', () => {
    completeFetch();
    expect(readHintsEligibleNow()).toBe(true);
  });

  it('is false on preset change and true again when switching back', () => {
    completeFetch();
    act(() => useTicketStore.getState().setJqlPreset('all_watched'));
    expect(readHintsEligibleNow()).toBe(false);
    act(() => useTicketStore.getState().setJqlPreset('mine'));
    expect(readHintsEligibleNow()).toBe(true);
  });

  it('is false when custom JQL changes under the custom preset', () => {
    act(() => {
      useTicketStore.getState().setJqlPreset('custom');
      useTicketStore.getState().setJqlCustom('project = A');
    });
    completeFetch();
    expect(readHintsEligibleNow()).toBe(true);
    act(() => useTicketStore.getState().setJqlCustom('project = B'));
    expect(readHintsEligibleNow()).toBe(false);
  });

  it('is false when sourceProjectKey changes', () => {
    completeFetch();
    act(() => useConnectionStore.setState({ sourceProjectKey: 'OTHER' } as never));
    expect(readHintsEligibleNow()).toBe(false);
  });

  it('is false after markFetchIncomplete', () => {
    completeFetch();
    act(() => useTicketStore.getState().markFetchIncomplete());
    expect(readHintsEligibleNow()).toBe(false);
  });

  it('is false while loading and true again once idle', () => {
    completeFetch();
    expect(readHintsEligibleNow()).toBe(true);
    act(() => useTicketStore.getState().setFetchStatus('loading'));
    expect(readHintsEligibleNow()).toBe(false);
    act(() => useTicketStore.getState().setFetchStatus('idle'));
    expect(readHintsEligibleNow()).toBe(true);
  });

  it('stays true on error with a matching signature (not loading)', () => {
    completeFetch();
    act(() => useTicketStore.getState().setFetchStatus('error', 'boom'));
    expect(readHintsEligibleNow()).toBe(true);
  });
});
