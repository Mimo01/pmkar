import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { FetchTicketsResult, JqlPreset } from './types';
import { useTicketStore } from './ticketStore';
import { useConnectionStore } from '../connections/connectionStore';
import { TicketTable } from './TicketTable';
import { TicketDetailPanel } from './TicketDetailPanel';

// --- Helpers ---

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSeconds = Math.round((then - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const absDiff = Math.abs(diffSeconds);
  if (absDiff < 60) return rtf.format(diffSeconds, 'second');
  if (absDiff < 3600) return rtf.format(Math.round(diffSeconds / 60), 'minute');
  if (absDiff < 86400) return rtf.format(Math.round(diffSeconds / 3600), 'hour');
  return rtf.format(Math.round(diffSeconds / 86400), 'day');
}

function buildJql(
  preset: JqlPreset,
  custom: string | null,
  watchedUsers: string[],
  currentUser: string,
): string {
  if (preset === 'custom' && custom) return custom;
  if (preset === 'assigned') return `assignee = "${currentUser}" ORDER BY updated DESC`;
  if (preset === 'mentioned') return `text ~ "${currentUser}" ORDER BY updated DESC`;
  // 'all_watched': combine current user + watched users
  const allUsers = [currentUser, ...watchedUsers].map((u) => `"${u}"`).join(', ');
  return `assignee in (${allUsers}) ORDER BY updated DESC`;
}

function SpinnerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function getErrorDetail(error: string): string {
  const lower = error.toLowerCase();
  if (lower.includes('401') || lower.includes('auth') || lower.includes('unauthorized')) {
    return 'Authentication failed. Check your Source connection credentials in Settings.';
  }
  if (lower.includes('network') || lower.includes('connect') || lower.includes('reach')) {
    return 'Could not reach the server. Check your network and Source connection URL.';
  }
  if (lower.includes('429') || lower.includes('rate')) {
    return 'Rate limited by Jira. Try again in a few seconds.';
  }
  if (lower.includes('500') || lower.includes('server error')) {
    return 'Jira returned a server error. Try again or check server status.';
  }
  return error;
}

// --- Component ---

export function TicketListPage() {
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);
  const selectedTicketKey = useTicketStore((s) => s.selectedTicketKey);
  const fetchStatus = useTicketStore((s) => s.fetchStatus);
  const fetchError = useTicketStore((s) => s.fetchError);
  const lastFetchedAt = useTicketStore((s) => s.lastFetchedAt);
  const totalCount = useTicketStore((s) => s.totalCount);
  const newCount = useTicketStore((s) => s.newCount);

  // Hydrate triage map and fetch config on mount
  useEffect(() => {
    invoke<Record<string, string>>('get_triage_state')
      .then((map) => useTicketStore.getState().hydrateTriageMap(map as Record<string, import('./types').TriageState>))
      .catch(() => {/* triage hydration is best-effort */});

    invoke<import('./types').FetchConfig>('get_fetch_config')
      .then((config) => useTicketStore.getState().hydrateFetchConfig(config))
      .catch(() => {/* config hydration is best-effort */});
  }, []);

  async function handleFetch() {
    const store = useTicketStore.getState();
    store.setFetchStatus('loading');
    try {
      const serverConn = useConnectionStore.getState().serverConnection;
      if (!serverConn) throw new Error('No server connection');
      const jql = buildJql(store.jqlPreset, store.jqlCustom, store.watchedUsers, serverConn.username);
      const result = await invoke<FetchTicketsResult>('fetch_tickets', {
        baseUrl: serverConn.baseUrl,
        jql,
      });
      store.setTickets(result.issues, result.triageMap, result.total);
      store.setLastFetchedAt(new Date().toISOString());
    } catch (err) {
      store.setFetchStatus('error', err instanceof Error ? err.message : String(err));
    }
  }

  function handleSelectTicket(key: string) {
    const store = useTicketStore.getState();
    store.selectTicket(key);
    store.markSeen(key);
    // Fire-and-forget persist to SQLite
    invoke('set_triage_state', { ticketKey: key, state: 'seen' }).catch(() => {});
  }

  const isLoading = fetchStatus === 'loading';
  const hasFetched = lastFetchedAt !== null;
  const hasTickets = tickets.length > 0;
  const showEmptyState = hasFetched && !hasTickets && fetchStatus === 'idle';

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden">
      {/* Left pane: ticket list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* FetchBar */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-800/60">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleFetch}
            className={`flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-4 py-3 text-sm transition-colors duration-150 ${
              isLoading ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            {isLoading && <SpinnerIcon />}
            {isLoading ? 'Fetching...' : 'Fetch Tickets'}
          </button>

          <span className="text-xs text-slate-500">
            {lastFetchedAt ? `Last fetched: ${relativeTime(lastFetchedAt)}` : 'Not yet fetched'}
          </span>

          {totalCount > 0 && (
            <span className="text-xs text-slate-400" aria-live="polite">
              {totalCount} candidates{newCount > 0 ? ', ' : ''}
              {newCount > 0 && <span className="text-blue-400">{newCount} new</span>}
            </span>
          )}
        </div>

        {/* Error state */}
        {fetchStatus === 'error' && fetchError && (
          <div
            className="mx-6 mt-3 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3"
            role="alert"
          >
            <p className="text-sm text-red-400">Could not fetch tickets</p>
            <p className="text-xs text-slate-500 mt-1">{getErrorDetail(fetchError)}</p>
          </div>
        )}

        {/* Empty state */}
        {showEmptyState && (
          <div className="flex flex-col items-center justify-center flex-1 py-16">
            <p className="text-sm font-semibold text-slate-400 mb-1">No candidates found</p>
            <p className="text-xs text-slate-600">
              Your JQL returned no results. Try adjusting your fetch settings.
            </p>
          </div>
        )}

        {/* Ticket table */}
        {(hasTickets || isLoading) && (
          <TicketTable
            tickets={tickets}
            triageMap={triageMap}
            selectedKey={selectedTicketKey}
            onSelectTicket={handleSelectTicket}
          />
        )}
      </div>

      {/* Right pane: detail panel */}
      {selectedTicketKey ? (
        <div className="w-[45%] border-l border-slate-800 bg-slate-900 flex flex-col transition-all duration-200 ease-in-out">
          <TicketDetailPanel
            issueKey={selectedTicketKey}
            baseUrl={useConnectionStore.getState().serverConnection?.baseUrl ?? ''}
            onClose={() => useTicketStore.getState().selectTicket(null)}
          />
        </div>
      ) : (
        <div className="w-0 overflow-hidden transition-all duration-200 ease-in-out" />
      )}
    </div>
  );
}
