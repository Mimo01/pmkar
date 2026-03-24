import { create } from 'zustand';
import type {
  FetchConfig,
  FetchStatus,
  JiraTicket,
  JqlPreset,
  TriageEntry,
  TriageState,
} from './types';

interface TicketState {
  // Data
  tickets: JiraTicket[];
  triageMap: Record<string, TriageEntry>;
  selectedTicketKey: string | null;
  fetchStatus: FetchStatus;
  fetchError: string | null;
  lastFetchedAt: string | null;
  totalCount: number;
  newCount: number;

  // Fetch config (mirrors SQLite fetch_config)
  jqlPreset: JqlPreset;
  jqlCustom: string | null;
  watchedUsers: string[];

  // Actions — ticket data
  setTickets: (
    tickets: JiraTicket[],
    triageMap: Record<string, TriageEntry>,
    total: number,
  ) => void;
  selectTicket: (key: string | null) => void;
  markSeen: (key: string) => void;
  setFetchStatus: (status: FetchStatus, error?: string) => void;
  setLastFetchedAt: (timestamp: string) => void;

  // Actions — triage hydration
  hydrateTriageMap: (map: Record<string, TriageEntry>) => void;

  // Actions — fetch config
  setJqlPreset: (preset: JqlPreset) => void;
  setJqlCustom: (jql: string | null) => void;
  setWatchedUsers: (users: string[]) => void;
  hydrateFetchConfig: (config: FetchConfig) => void;
}

export const useTicketStore = create<TicketState>((set, get) => ({
  // Initial state
  tickets: [],
  triageMap: {},
  selectedTicketKey: null,
  fetchStatus: 'idle',
  fetchError: null,
  lastFetchedAt: null,
  totalCount: 0,
  newCount: 0,

  jqlPreset: 'assigned',
  jqlCustom: null,
  watchedUsers: [],

  // Actions
  setTickets: (tickets, triageMap, total) => {
    const safeMap = triageMap ?? {};
    const newCount = Object.values(safeMap).filter((e) => e.state === 'new').length;
    set({
      tickets,
      triageMap: safeMap,
      totalCount: total,
      newCount,
      fetchStatus: 'idle',
      fetchError: null,
    });
  },

  selectTicket: (key) => set({ selectedTicketKey: key }),

  markSeen: (key) => {
    const current = get().triageMap[key];
    if (current?.state === 'new') {
      const updated = { ...get().triageMap, [key]: { ...current, state: 'seen' as TriageState } };
      const newCount = Object.values(updated).filter((e) => e.state === 'new').length;
      set({ triageMap: updated, newCount });
    }
  },

  setFetchStatus: (status, error) => set({ fetchStatus: status, fetchError: error ?? null }),

  setLastFetchedAt: (timestamp) => set({ lastFetchedAt: timestamp }),

  hydrateTriageMap: (map) => {
    const safeMap = map ?? {};
    const newCount = Object.values(safeMap).filter((e) => e.state === 'new').length;
    set({ triageMap: safeMap, newCount });
  },

  setJqlPreset: (preset) => set({ jqlPreset: preset }),
  setJqlCustom: (jql) => set({ jqlCustom: jql }),
  setWatchedUsers: (users) => set({ watchedUsers: users }),

  hydrateFetchConfig: (config) =>
    set({
      jqlPreset: config.jqlPreset ?? 'assigned',
      jqlCustom: config.jqlCustom ?? null,
      watchedUsers: Array.isArray(config.watchedUsers) ? config.watchedUsers : [],
      lastFetchedAt: config.lastFetchedAt ?? null,
    }),
}));
