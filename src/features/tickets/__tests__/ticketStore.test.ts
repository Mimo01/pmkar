import { beforeEach, describe, expect, it } from 'vitest';
import { useConnectionStore } from '../../connections/connectionStore';
import { useTicketStore } from '../ticketStore';
import type { FetchConfig, JiraTicket, TriageEntry, WatchedUser } from '../types';

const makeTicket = (key: string): JiraTicket => ({
  id: key,
  key,
  fields: {
    summary: `Summary for ${key}`,
    status: { name: 'Open' },
    priority: { name: 'Medium', id: '3' },
    assignee: null,
    created: '2024-01-01T00:00:00.000Z',
    updated: '2024-01-01T00:00:00.000Z',
  },
});

const initialState = {
  tickets: [],
  triageMap: {},
  selectedTicketKey: null,
  fetchStatus: 'idle' as const,
  fetchError: null,
  lastFetchedAt: null,
  totalCount: 0,
  newCount: 0,
  jqlPreset: 'mine' as const,
  jqlCustom: null,
  watchedUsers: [],
};

describe('ticketStore', () => {
  beforeEach(() => {
    useTicketStore.setState(initialState);
  });

  describe('initial state', () => {
    it('has empty tickets array', () => {
      expect(useTicketStore.getState().tickets).toEqual([]);
    });

    it('has null selectedTicketKey', () => {
      expect(useTicketStore.getState().selectedTicketKey).toBeNull();
    });

    it('has idle fetchStatus', () => {
      expect(useTicketStore.getState().fetchStatus).toBe('idle');
    });

    it('has null fetchError', () => {
      expect(useTicketStore.getState().fetchError).toBeNull();
    });

    it('has zero totalCount and newCount', () => {
      expect(useTicketStore.getState().totalCount).toBe(0);
      expect(useTicketStore.getState().newCount).toBe(0);
    });

    it('has default jqlPreset mine', () => {
      expect(useTicketStore.getState().jqlPreset).toBe('mine');
    });
  });

  describe('setTickets', () => {
    it('sets tickets and totalCount', () => {
      const tickets = [makeTicket('PROJ-1'), makeTicket('PROJ-2')];
      const triageMap: Record<string, TriageEntry> = {
        'PROJ-1': { state: 'new', copiedKey: null },
        'PROJ-2': { state: 'seen', copiedKey: null },
      };
      useTicketStore.getState().setTickets(tickets, triageMap, 2);

      const state = useTicketStore.getState();
      expect(state.tickets).toEqual(tickets);
      expect(state.totalCount).toBe(2);
    });

    it('calculates newCount from triage map', () => {
      const tickets = [makeTicket('PROJ-1'), makeTicket('PROJ-2'), makeTicket('PROJ-3')];
      const triageMap: Record<string, TriageEntry> = {
        'PROJ-1': { state: 'new', copiedKey: null },
        'PROJ-2': { state: 'new', copiedKey: null },
        'PROJ-3': { state: 'seen', copiedKey: null },
      };
      useTicketStore.getState().setTickets(tickets, triageMap, 3);

      expect(useTicketStore.getState().newCount).toBe(2);
    });

    it('excludes watched entries from newCount', () => {
      const tickets = [makeTicket('PROJ-1'), makeTicket('PROJ-2')];
      const triageMap: Record<string, TriageEntry> = {
        'PROJ-1': { state: 'new', copiedKey: null },
        'PROJ-2': { state: 'watched', copiedKey: 'CLOUD-2' },
      };
      useTicketStore.getState().setTickets(tickets, triageMap, 2);

      expect(useTicketStore.getState().newCount).toBe(1);
    });

    it('resets fetchStatus to idle and fetchError to null', () => {
      useTicketStore.setState({ fetchStatus: 'error', fetchError: 'previous error' });
      useTicketStore.getState().setTickets([], {}, 0);

      const state = useTicketStore.getState();
      expect(state.fetchStatus).toBe('idle');
      expect(state.fetchError).toBeNull();
    });

    it('handles null triageMap gracefully', () => {
      useTicketStore.getState().setTickets([], null as unknown as Record<string, TriageEntry>, 0);
      expect(useTicketStore.getState().triageMap).toEqual({});
    });
  });

  describe('selectTicket', () => {
    it('sets selectedTicketKey', () => {
      useTicketStore.getState().selectTicket('PROJ-42');
      expect(useTicketStore.getState().selectedTicketKey).toBe('PROJ-42');
    });

    it('clears selectedTicketKey with null', () => {
      useTicketStore.setState({ selectedTicketKey: 'PROJ-1' });
      useTicketStore.getState().selectTicket(null);
      expect(useTicketStore.getState().selectedTicketKey).toBeNull();
    });
  });

  describe('markSeen', () => {
    it('transitions ticket from new to seen', () => {
      const triageMap: Record<string, TriageEntry> = {
        'PROJ-1': { state: 'new', copiedKey: null },
      };
      useTicketStore.setState({ triageMap, newCount: 1 });
      useTicketStore.getState().markSeen('PROJ-1');

      expect(useTicketStore.getState().triageMap['PROJ-1'].state).toBe('seen');
    });

    it('decrements newCount when transitioning new -> seen', () => {
      const triageMap: Record<string, TriageEntry> = {
        'PROJ-1': { state: 'new', copiedKey: null },
        'PROJ-2': { state: 'new', copiedKey: null },
      };
      useTicketStore.setState({ triageMap, newCount: 2 });
      useTicketStore.getState().markSeen('PROJ-1');

      expect(useTicketStore.getState().newCount).toBe(1);
    });

    it('does not change state for already-seen ticket', () => {
      const triageMap: Record<string, TriageEntry> = {
        'PROJ-1': { state: 'seen', copiedKey: null },
      };
      useTicketStore.setState({ triageMap, newCount: 0 });
      useTicketStore.getState().markSeen('PROJ-1');

      expect(useTicketStore.getState().triageMap['PROJ-1'].state).toBe('seen');
      expect(useTicketStore.getState().newCount).toBe(0);
    });

    it('does nothing for unknown ticket key', () => {
      useTicketStore.setState({ triageMap: {}, newCount: 0 });
      expect(() => useTicketStore.getState().markSeen('UNKNOWN-99')).not.toThrow();
    });
  });

  describe('setFetchStatus', () => {
    it('sets fetchStatus to loading', () => {
      useTicketStore.getState().setFetchStatus('loading');
      expect(useTicketStore.getState().fetchStatus).toBe('loading');
    });

    it('sets fetchStatus to error with error message', () => {
      useTicketStore.getState().setFetchStatus('error', 'Network failed');
      const state = useTicketStore.getState();
      expect(state.fetchStatus).toBe('error');
      expect(state.fetchError).toBe('Network failed');
    });

    it('sets fetchError to null when no error provided', () => {
      useTicketStore.setState({ fetchError: 'old error' });
      useTicketStore.getState().setFetchStatus('idle');
      expect(useTicketStore.getState().fetchError).toBeNull();
    });
  });

  describe('setLastFetchedAt', () => {
    it('sets lastFetchedAt timestamp', () => {
      useTicketStore.getState().setLastFetchedAt('2024-06-01T12:00:00.000Z');
      expect(useTicketStore.getState().lastFetchedAt).toBe('2024-06-01T12:00:00.000Z');
    });
  });

  describe('hydrateTriageMap', () => {
    it('sets triageMap from provided map', () => {
      const map: Record<string, TriageEntry> = {
        'PROJ-1': { state: 'new', copiedKey: null },
        'PROJ-2': { state: 'copied', copiedKey: 'CLOUD-5' },
      };
      useTicketStore.getState().hydrateTriageMap(map);
      expect(useTicketStore.getState().triageMap).toEqual(map);
    });

    it('calculates newCount from hydrated map', () => {
      const map: Record<string, TriageEntry> = {
        'PROJ-1': { state: 'new', copiedKey: null },
        'PROJ-2': { state: 'new', copiedKey: null },
        'PROJ-3': { state: 'copied', copiedKey: 'CLOUD-5' },
      };
      useTicketStore.getState().hydrateTriageMap(map);
      expect(useTicketStore.getState().newCount).toBe(2);
    });

    it('handles null map gracefully', () => {
      useTicketStore.getState().hydrateTriageMap(null as unknown as Record<string, TriageEntry>);
      expect(useTicketStore.getState().triageMap).toEqual({});
      expect(useTicketStore.getState().newCount).toBe(0);
    });
  });

  describe('fetch config actions', () => {
    it('setJqlPreset updates jqlPreset', () => {
      useTicketStore.getState().setJqlPreset('all_watched');
      expect(useTicketStore.getState().jqlPreset).toBe('all_watched');
    });

    it('setJqlCustom updates jqlCustom', () => {
      useTicketStore.getState().setJqlCustom('project = FOO');
      expect(useTicketStore.getState().jqlCustom).toBe('project = FOO');
    });

    it('setJqlCustom accepts null', () => {
      useTicketStore.setState({ jqlCustom: 'project = FOO' });
      useTicketStore.getState().setJqlCustom(null);
      expect(useTicketStore.getState().jqlCustom).toBeNull();
    });

    it('setWatchedUsers updates watchedUsers array', () => {
      useTicketStore.getState().setWatchedUsers([
        { identifier: 'alice', displayName: 'Alice Smith', email: 'alice@example.com' },
        { identifier: 'bob', displayName: 'Bob Jones' },
      ]);
      expect(useTicketStore.getState().watchedUsers).toEqual([
        { identifier: 'alice', displayName: 'Alice Smith', email: 'alice@example.com' },
        { identifier: 'bob', displayName: 'Bob Jones' },
      ]);
    });
  });

  describe('hydrateFetchConfig', () => {
    it('sets all fetch config fields from config object', () => {
      const config: FetchConfig = {
        jqlPreset: 'custom',
        jqlCustom: 'project = MYPROJ',
        watchedUsers: [{ identifier: 'alice', displayName: 'Alice Smith' }],
        lastFetchedAt: '2024-01-15T08:00:00.000Z',
      };
      useTicketStore.getState().hydrateFetchConfig(config);

      const state = useTicketStore.getState();
      expect(state.jqlPreset).toBe('custom');
      expect(state.jqlCustom).toBe('project = MYPROJ');
      expect(state.watchedUsers).toEqual([{ identifier: 'alice', displayName: 'Alice Smith' }]);
      expect(state.lastFetchedAt).toBe('2024-01-15T08:00:00.000Z');
    });

    it('uses defaults for null/undefined config fields', () => {
      const config = {
        jqlPreset: null,
        jqlCustom: null,
        watchedUsers: null,
        lastFetchedAt: null,
      } as unknown as FetchConfig;
      useTicketStore.getState().hydrateFetchConfig(config);

      const state = useTicketStore.getState();
      expect(state.jqlPreset).toBe('all_watched');
      expect(state.jqlCustom).toBeNull();
      expect(state.watchedUsers).toEqual([]);
      expect(state.lastFetchedAt).toBeNull();
    });

    it('handles non-array watchedUsers gracefully', () => {
      const config = {
        jqlPreset: 'mine',
        jqlCustom: null,
        watchedUsers: 'alice' as unknown as WatchedUser[],
        lastFetchedAt: null,
      } as FetchConfig;
      useTicketStore.getState().hydrateFetchConfig(config);
      expect(useTicketStore.getState().watchedUsers).toEqual([]);
    });
  });

  describe('lastCompleteFetchSignature (GDUR-04)', () => {
    beforeEach(() => {
      useTicketStore.setState({ lastCompleteFetchSignature: null, truncated: false });
    });

    it('starts null', () => {
      expect(useTicketStore.getState().lastCompleteFetchSignature).toBeNull();
    });

    it('is set when setTickets receives a signature', () => {
      useTicketStore.getState().setTickets([], {}, 0, false, 'sig-a');
      expect(useTicketStore.getState().lastCompleteFetchSignature).toBe('sig-a');
    });

    it('is null for legacy 4-arg setTickets calls', () => {
      useTicketStore.getState().setTickets([], {}, 0, false, 'sig-a');
      useTicketStore.getState().setTickets([], {}, 0);
      expect(useTicketStore.getState().lastCompleteFetchSignature).toBeNull();
    });

    it('markFetchIncomplete clears it without touching tickets', () => {
      const t = makeTicket('A-1');
      useTicketStore.getState().setTickets([t], {}, 1, true, 'sig-a');
      useTicketStore.getState().markFetchIncomplete();
      const s = useTicketStore.getState();
      expect(s.lastCompleteFetchSignature).toBeNull();
      expect(s.tickets).toEqual([t]);
      expect(s.truncated).toBe(true);
      expect(s.fetchStatus).toBe('idle');
    });

    it('config setters and hydrate do not change it', () => {
      useTicketStore.getState().setTickets([], {}, 0, false, 'sig-a');
      useTicketStore.getState().setJqlPreset('custom');
      useTicketStore.getState().setJqlCustom('project = X');
      useTicketStore.getState().hydrateFetchConfig({
        jqlPreset: 'mine',
        jqlCustom: null,
        watchedUsers: [],
        lastFetchedAt: null,
      } as FetchConfig);
      expect(useTicketStore.getState().lastCompleteFetchSignature).toBe('sig-a');
    });
  });
  describe('server switch reset (CR-01)', () => {
    const meta = (baseUrl: string, username = 'u', status: 'connected' | 'error' = 'connected') =>
      ({
        baseUrl,
        username,
        serverVersion: '9',
        lastTestedAt: null,
        status,
      }) as unknown as NonNullable<
        ReturnType<typeof useConnectionStore.getState>['serverConnection']
      >;

    const seed = () =>
      useTicketStore.setState({
        tickets: [makeTicket('AB-1')],
        triageMap: { 'AB-1': { state: 'new' } as TriageEntry },
        selectedTicketKey: 'AB-1',
        totalCount: 1,
        newCount: 1,
        truncated: true,
        lastCompleteFetchSignature: 'sig',
        hasFetchedThisSession: true,
        unseenChanges: { 'AB-1': ['summary'] },
        jqlPreset: 'mine',
        fetchStatus: 'loading' as never,
      });

    beforeEach(() => {
      useConnectionStore.setState({ serverConnection: null, cloudConnection: null });
      useTicketStore.setState({ ...initialState, unseenChanges: {} });
    });

    it('A to B clears list state and leaves unrelated state', () => {
      useConnectionStore.setState({ serverConnection: meta('http://a') });
      seed();
      const genBefore = useTicketStore.getState().fetchGeneration;
      useConnectionStore.getState().setServerConnection(meta('http://b'));
      const s = useTicketStore.getState();
      // WR-07: the switch revokes the in-flight fetch's ownership and settles its status
      expect(s.fetchGeneration).toBe(genBefore + 1);
      expect(s.tickets).toEqual([]);
      expect(s.triageMap).toEqual({});
      expect(s.selectedTicketKey).toBeNull();
      expect(s.totalCount).toBe(0);
      expect(s.newCount).toBe(0);
      expect(s.truncated).toBe(false);
      expect(s.lastCompleteFetchSignature).toBeNull();
      expect(s.hasFetchedThisSession).toBe(false);
      expect(s.unseenChanges).toEqual({ 'AB-1': ['summary'] });
      expect(s.jqlPreset).toBe('mine');
      expect(s.fetchStatus).toBe('idle');
    });

    it('WR-07: reset leaves a non-loading status (e.g. error) alone', () => {
      useTicketStore.setState({ fetchStatus: 'error', fetchError: 'boom' });
      useTicketStore.getState().resetForServerSwitch();
      expect(useTicketStore.getState().fetchStatus).toBe('error');
      expect(useTicketStore.getState().fetchError).toBe('boom');
    });

    it('WR-07: beginFetch bumps the generation and sets loading', () => {
      useTicketStore.setState({ fetchError: 'old' });
      const before = useTicketStore.getState().fetchGeneration;
      const gen = useTicketStore.getState().beginFetch();
      expect(gen).toBe(before + 1);
      expect(useTicketStore.getState().fetchGeneration).toBe(gen);
      expect(useTicketStore.getState().fetchStatus).toBe('loading');
      expect(useTicketStore.getState().fetchError).toBeNull();
    });

    it('null to A (startup hydration) does not clear', () => {
      seed();
      useConnectionStore.getState().setServerConnection(meta('http://a'));
      expect(useTicketStore.getState().tickets).toHaveLength(1);
    });

    it('same baseUrl with different username/status does not clear', () => {
      useConnectionStore.setState({ serverConnection: meta('http://a') });
      seed();
      useConnectionStore.getState().setServerConnection(meta('http://a', 'other', 'error'));
      expect(useTicketStore.getState().tickets).toHaveLength(1);
    });

    it('clearConnections clears', () => {
      useConnectionStore.setState({ serverConnection: meta('http://a') });
      seed();
      useConnectionStore.getState().clearConnections();
      expect(useTicketStore.getState().tickets).toEqual([]);
    });

    it('cloudConnection and sourceProjectKey changes do not clear', () => {
      useConnectionStore.setState({ serverConnection: meta('http://a') });
      seed();
      useConnectionStore.getState().setCloudConnection(meta('http://cloud'));
      useConnectionStore.getState().setSourceProjectKey('XY');
      expect(useTicketStore.getState().tickets).toHaveLength(1);
    });

    it('resetForServerSwitch can be called directly', () => {
      seed();
      useTicketStore.getState().resetForServerSwitch();
      expect(useTicketStore.getState().tickets).toEqual([]);
      expect(useTicketStore.getState().hasFetchedThisSession).toBe(false);
    });
  });
});
