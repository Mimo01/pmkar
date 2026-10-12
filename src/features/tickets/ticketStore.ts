import { create } from 'zustand';
import { useConnectionStore } from '../connections/connectionStore';
import type {
  FetchConfig,
  FetchStatus,
  JiraTicket,
  JqlPreset,
  TriageEntry,
  TriageState,
  WatchedUser,
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
  /** True when the last fetch exceeded the backend pagination cap. UI surfaces a warning. */
  truncated: boolean;
  /**
   * Signature of the query whose latest fetch was fully complete (every batch ok, not truncated,
   * no error). null = no missing-member hints. Session-only: never persisted or hydrated (GDUR-04).
   */
  lastCompleteFetchSignature: string | null;
  /**
   * WR-07: global fetch ownership token. Bumped by every fetch start and by a server switch.
   * A fetch may only write terminal state (status, error, hint eligibility, tickets) while the
   * generation it started with is still current. Per-instance refs cannot do this, because the
   * Settings round-trip unmounts TicketListPage and leaves the old fetch running as an orphan.
   */
  fetchGeneration: number;

  // Polling state (D-04, D-13, D-15)
  pollFrequency: string; // "off" | "5m" | "15m" | "30m" | "1h"
  lastCheckedAt: string | null; // ISO-8601 from poll-complete event

  // Fetch config (mirrors SQLite fetch_config)
  jqlPreset: JqlPreset;
  jqlCustom: string | null;
  watchedUsers: WatchedUser[];

  // Actions — ticket data
  setTickets: (
    tickets: JiraTicket[],
    triageMap: Record<string, TriageEntry>,
    total: number,
    truncated?: boolean,
    completeSignature?: string | null,
  ) => void;
  /** Clears hint eligibility (partial/failed fetch). Tickets are left untouched. */
  markFetchIncomplete: () => void;
  /** WR-07: takes fetch ownership (++fetchGeneration), sets 'loading', returns the new generation. */
  beginFetch: () => number;
  /**
   * CR-01: drops the previous server's live list, selection and hint eligibility.
   * Deliberately leaves unseenChanges (hydrated from SQLite independently), fetch config and
   * poll state alone. WR-07: also revokes ownership from any in-flight fetch (++fetchGeneration)
   * and settles a 'loading' status to 'idle' itself, since the orphaned fetch will no longer write.
   */
  resetForServerSwitch: () => void;
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
  setWatchedUsers: (users: WatchedUser[]) => void;
  hydrateFetchConfig: (config: FetchConfig) => void;

  // Session-local flag: true once the first successful fetch completes in the current app session.
  // Stored in the Zustand store (not React state) so it survives component unmount/remount on navigation.
  // Must NOT be persisted or hydrated.
  hasFetchedThisSession: boolean;
  setHasFetchedThisSession: (v: boolean) => void;

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
  truncated: false,
  lastCompleteFetchSignature: null,
  fetchGeneration: 0,

  pollFrequency: 'off',
  lastCheckedAt: null,

  jqlPreset: 'all_watched',
  jqlCustom: null,
  watchedUsers: [],

  hasFetchedThisSession: false,

  unseenChanges: {},

  // Actions
  setTickets: (tickets, triageMap, total, truncated = false, completeSignature = null) => {
    const safeMap = triageMap ?? {};
    const newCount = Object.values(safeMap).filter((e) => e.state === 'new').length;
    set({
      tickets,
      triageMap: safeMap,
      totalCount: total,
      newCount,
      truncated,
      lastCompleteFetchSignature: completeSignature,
      fetchStatus: 'idle',
      fetchError: null,
    });
  },

  markFetchIncomplete: () => set({ lastCompleteFetchSignature: null }),

  beginFetch: () => {
    const gen = get().fetchGeneration + 1;
    set({ fetchGeneration: gen, fetchStatus: 'loading', fetchError: null });
    return gen;
  },

  resetForServerSwitch: () =>
    set((state) => ({
      fetchGeneration: state.fetchGeneration + 1,
      ...(state.fetchStatus === 'loading'
        ? { fetchStatus: 'idle' as const, fetchError: null }
        : {}),
      tickets: [],
      triageMap: {},
      selectedTicketKey: null,
      totalCount: 0,
      newCount: 0,
      truncated: false,
      lastCompleteFetchSignature: null,
      hasFetchedThisSession: false,
    })),

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
      jqlPreset: config.jqlPreset ?? 'all_watched',
      jqlCustom: config.jqlCustom ?? null,
      watchedUsers: Array.isArray(config.watchedUsers) ? config.watchedUsers : [],
      lastFetchedAt: config.lastFetchedAt ?? null,
    }),

  setHasFetchedThisSession: (v) => set({ hasFetchedThisSession: v }),

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

// CR-01: the old server's tickets must not stay live after a server switch, because group views
// prefer live data and the list feeds add_issues_to_group. Skip the startup null -> A hydration;
// clear on A -> B and A -> null. Strict string comparison: an over-eager clear just means a refetch.
useConnectionStore.subscribe((state, prev) => {
  const prevUrl = prev.serverConnection?.baseUrl ?? null;
  const nextUrl = state.serverConnection?.baseUrl ?? null;
  if (prevUrl !== null && nextUrl !== prevUrl) {
    useTicketStore.getState().resetForServerSwitch();
  }
});
