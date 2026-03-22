import { create } from 'zustand';
import type {
  JiraTicket,
  TriageState,
  FetchStatus,
  FetchConfig,
  JqlPreset,
} from './types';

interface TicketState {
  // Data
  tickets: JiraTicket[];
  triageMap: Record<string, TriageState>;
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
  setTickets: (tickets: JiraTicket[], triageMap: Record<string, TriageState>, total: number) => void;
  selectTicket: (key: string | null) => void;
  markSeen: (key: string) => void;
  setFetchStatus: (status: FetchStatus, error?: string) => void;
  setLastFetchedAt: (timestamp: string) => void;

  // Actions — triage hydration
  hydrateTriageMap: (map: Record<string, TriageState>) => void;

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
    const newCount = Object.values(triageMap).filter((s) => s === 'new').length;
    set({
      tickets,
      triageMap,
      totalCount: total,
      newCount,
      fetchStatus: 'idle',
      fetchError: null,
    });
  },

  selectTicket: (key) => set({ selectedTicketKey: key }),

  markSeen: (key) => {
    const current = get().triageMap[key];
    if (current === 'new') {
      const updated = { ...get().triageMap, [key]: 'seen' as TriageState };
      const newCount = Object.values(updated).filter((s) => s === 'new').length;
      set({ triageMap: updated, newCount });
    }
  },

  setFetchStatus: (status, error) =>
    set({ fetchStatus: status, fetchError: error ?? null }),

  setLastFetchedAt: (timestamp) => set({ lastFetchedAt: timestamp }),

  hydrateTriageMap: (map) => {
    const newCount = Object.values(map).filter((s) => s === 'new').length;
    set({ triageMap: map, newCount });
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
