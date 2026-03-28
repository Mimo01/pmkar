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

  // Polling state (D-04, D-13, D-15)
  pollFrequency: string; // "off" | "5m" | "15m" | "30m" | "1h"
  lastCheckedAt: string | null; // ISO-8601 from poll-complete event

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

  // Actions — polling
  setPollFrequency: (freq: string) => void;
  setLastCheckedAt: (ts: string) => void;
  hydratePollFrequency: (freq: string) => void;

  // Actions — triage hydration
  hydrateTriageMap: (map: Record<string, TriageEntry>) => void;

  // Actions — fetch config
  setJqlPreset: (preset: JqlPreset) => void;
  setJqlCustom: (jql: string | null) => void;
  setWatchedUsers: (users: string[]) => void;
  hydrateFetchConfig: (config: FetchConfig) => void;

  // Unseen changes tracking (Phase 15)
  unseenChanges: Record<string, string[]>; // key -> changed field names (empty array = no tooltip data yet)

  // Actions — unseen changes
  hydrateUnseenChanges: (keys: string[]) => void;
  setUnseenChange: (key: string, fields: string[]) => void;
  clearUnseenChange: (key: string) => void;
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

  pollFrequency: 'off',
  lastCheckedAt: null,

  jqlPreset: 'assigned',
  jqlCustom: null,
  watchedUsers: [],

  unseenChanges: {},

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

  setPollFrequency: (freq) => set({ pollFrequency: freq }),
  setLastCheckedAt: (ts) => set({ lastCheckedAt: ts }),
  hydratePollFrequency: (freq) => set({ pollFrequency: freq || 'off' }),

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

  // Unseen changes actions
  hydrateUnseenChanges: (keys) =>
    set({
      unseenChanges: Object.fromEntries(keys.map((k) => [k, []])),
    }),
  setUnseenChange: (key, fields) =>
    set((state) => ({
      unseenChanges: { ...state.unseenChanges, [key]: fields },
    })),
  clearUnseenChange: (key) =>
    set((state) => {
      const { [key]: _, ...rest } = state.unseenChanges;
      return { unseenChanges: rest };
    }),
}));
