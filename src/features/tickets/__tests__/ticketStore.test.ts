import { beforeEach, describe, expect, it } from 'vitest';
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
  jqlPreset: 'assigned' as const,
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

    it('has default jqlPreset assigned', () => {
      expect(useTicketStore.getState().jqlPreset).toBe('assigned');
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
      useTicketStore.getState().setJqlPreset('mentioned');
      expect(useTicketStore.getState().jqlPreset).toBe('mentioned');
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
      expect(state.jqlPreset).toBe('assigned');
      expect(state.jqlCustom).toBeNull();
      expect(state.watchedUsers).toEqual([]);
      expect(state.lastFetchedAt).toBeNull();
    });

    it('handles non-array watchedUsers gracefully', () => {
      const config = {
        jqlPreset: 'assigned',
        jqlCustom: null,
        watchedUsers: 'alice' as unknown as WatchedUser[],
        lastFetchedAt: null,
      } as FetchConfig;
      useTicketStore.getState().hydrateFetchConfig(config);
      expect(useTicketStore.getState().watchedUsers).toEqual([]);
    });
  });
});
