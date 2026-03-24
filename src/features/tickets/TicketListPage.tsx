import { useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { FetchTicketsResult, JqlPreset } from './types';
import { useTicketStore } from './ticketStore';
import { useConnectionStore } from '../connections/connectionStore';
import { TicketCard, SkeletonCards } from './TicketCard';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '../../lib/format';
import { cn } from '@/lib/utils';

// --- Helpers ---

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

function getErrorDetail(error: string, t: (key: string) => string): string {
  const lower = error.toLowerCase();
  if (lower.includes('401') || lower.includes('auth') || lower.includes('unauthorized')) {
    return t('error.authFailed');
  }
  if (lower.includes('network') || lower.includes('connect') || lower.includes('reach')) {
    return t('error.networkError');
  }
  if (lower.includes('429') || lower.includes('rate')) {
    return t('error.rateLimited');
  }
  if (lower.includes('500') || lower.includes('server error')) {
    return t('error.serverError');
  }
  return error;
}

// --- Component ---

export function TicketListPage() {
  const { t } = useTranslation();
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);
  const fetchStatus = useTicketStore((s) => s.fetchStatus);
  const fetchError = useTicketStore((s) => s.fetchError);
  const lastFetchedAt = useTicketStore((s) => s.lastFetchedAt);
  const totalCount = useTicketStore((s) => s.totalCount);
  const newCount = useTicketStore((s) => s.newCount);

  // Hydrate triage map and fetch config on mount, then auto-refetch if previously fetched
  useEffect(() => {
    Promise.all([
      invoke<Record<string, import('./types').TriageEntry>>('get_triage_state')
        .then((map) => useTicketStore.getState().hydrateTriageMap(map))
        .catch(() => {}),
      invoke<import('./types').FetchConfig>('get_fetch_config')
        .then((config) => {
          useTicketStore.getState().hydrateFetchConfig(config);
          return config;
        })
        .catch(() => null),
    ]).then(([, config]) => {
      // Auto-refetch if user has previously fetched (tickets are in-memory only)
      if (config && config.lastFetchedAt) {
        handleFetch();
      }
    });
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

  const candidateTickets = tickets.filter((t) => {
    const s = triageMap[t.key]?.state;
    return s !== 'ignored' && s !== 'copied';
  });

  // Sort by updated DESC (no user-selectable sort — cards don't have column headers)
  const sortedCandidates = useMemo(
    () =>
      [...candidateTickets].sort(
        (a, b) => new Date(b.fields.updated).getTime() - new Date(a.fields.updated).getTime(),
      ),
    [candidateTickets],
  );

  const isLoading = fetchStatus === 'loading';
  const hasFetched = lastFetchedAt !== null;
  const hasTickets = sortedCandidates.length > 0;
  const showEmptyState = hasFetched && !hasTickets && fetchStatus === 'idle';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* FetchBar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-brand-border">
        <button
          type="button"
          disabled={isLoading}
          onClick={handleFetch}
          className={cn(
            "flex items-center gap-2 bg-brand hover:bg-brand-light text-white font-semibold rounded-md px-4 py-2 text-sm transition-colors duration-150",
            isLoading && "opacity-40 cursor-not-allowed"
          )}
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {isLoading ? t('tickets.fetching') : t('tickets.fetchButton')}
        </button>
        <span className="text-xs text-brand-muted" aria-live="polite">
          {lastFetchedAt ? t('tickets.lastFetched', { time: formatRelativeTime(lastFetchedAt) }) : t('tickets.notYetFetched')}
        </span>
        {totalCount > 0 && (
          <span className="text-xs text-brand-text-secondary">
            {t('tickets.candidates', { count: candidateTickets.length })}
            {newCount > 0 && <Badge variant="secondary" className="ml-1 text-brand">{t('tickets.new', { count: newCount })}</Badge>}
          </span>
        )}
      </div>

      {/* Error state */}
      {fetchStatus === 'error' && fetchError && (
        <div
          className="mx-4 mt-3 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-red-400">{t('tickets.fetchError')}</p>
          <p className="text-xs text-brand-muted mt-1">{getErrorDetail(fetchError, t)}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && <SkeletonCards count={3} />}

      {/* Empty state */}
      {showEmptyState && (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <p className="text-sm font-semibold text-brand-text mb-1">{t('tickets.empty.heading')}</p>
          <p className="text-xs text-brand-muted text-center max-w-sm">{t('tickets.empty.body')}</p>
        </div>
      )}

      {/* Card list */}
      {hasTickets && (
        <div className="flex-1 overflow-y-auto">
          {sortedCandidates.map((ticket) => (
            <TicketCard
              key={ticket.key}
              ticket={ticket}
              triageEntry={triageMap[ticket.key]}
              onClick={() => handleSelectTicket(ticket.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
