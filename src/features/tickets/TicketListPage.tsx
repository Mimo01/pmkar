import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '../../lib/format';
import { useConnectionStore } from '../connections/connectionStore';
import { SkeletonCards, TicketCard } from './TicketCard';
import { TicketFilterBar } from './TicketFilterBar';
import { useTicketStore } from './ticketStore';
import type { FetchTicketsResult, JqlPreset } from './types';
import { isDoneTicket } from './utils';

// --- Helpers ---

function buildJql(
  preset: JqlPreset,
  custom: string | null,
  watchedUsers: { identifier: string }[],
  currentUser: string,
): string {
  if (preset === 'custom' && custom) return custom;
  if (preset === 'assigned') return `assignee = "${currentUser}" ORDER BY updated DESC`;
  if (preset === 'mentioned') return `text ~ "${currentUser}" ORDER BY updated DESC`;
  // 'all_watched': combine current user + watched users
  const allUsers = [currentUser, ...watchedUsers.map((u) => u.identifier)]
    .map((u) => `"${u}"`)
    .join(', ');
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
  const [searchText, setSearchText] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);
  const fetchStatus = useTicketStore((s) => s.fetchStatus);
  const fetchError = useTicketStore((s) => s.fetchError);
  const lastFetchedAt = useTicketStore((s) => s.lastFetchedAt);
  const lastCheckedAt = useTicketStore((s) => s.lastCheckedAt);
  const totalCount = useTicketStore((s) => s.totalCount);
  const newCount = useTicketStore((s) => s.newCount);

  const isLoading = fetchStatus === 'loading';

  // Re-render every 30s so formatRelativeTime stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const handleFetch = useCallback(async () => {
    const store = useTicketStore.getState();
    store.setFetchStatus('loading');
    try {
      const serverConn = useConnectionStore.getState().serverConnection;
      if (!serverConn) throw new Error('No server connection');
      const jql = buildJql(
        store.jqlPreset,
        store.jqlCustom,
        store.watchedUsers,
        serverConn.username,
      );
      const result = await invoke<FetchTicketsResult>('fetch_tickets', {
        baseUrl: serverConn.baseUrl,
        jql,
      });
      store.setTickets(result.issues, result.triageMap, result.total);
      const now = new Date().toISOString();
      store.setLastFetchedAt(now);
      store.setLastCheckedAt(now);

      // Dual-purpose: run snapshot change detection after successful fetch (D-10, POLL-06)
      // Also hydrate unseen changes for frontend indicators (Phase 15)
      for (const ticket of result.issues) {
        try {
          const detail = await invoke<unknown>('fetch_ticket_detail', {
            baseUrl: serverConn.baseUrl,
            ticketKey: ticket.key,
          });
          const changes = await invoke<
            { field: string; oldValue: string | null; newValue: string | null }[]
          >('check_ticket_changes', {
            ticketKey: ticket.key,
            responseJson: JSON.stringify(detail),
          });
          if (changes.length > 0) {
            store.setUnseenChange(
              ticket.key,
              changes.map((c) => c.field),
            );
          }
        } catch {
          // Skip change detection for this ticket if detail fetch fails (POLL-06: no watermark advance)
        }
      }

      // Hydrate full unseen state from SQLite (catches any keys set by background polls too)
      invoke<string[]>('get_unseen_change_keys')
        .then((keys) => {
          // Merge: keep field info for keys we just detected, add empty arrays for others
          for (const key of keys) {
            if (!store.unseenChanges[key]) {
              store.setUnseenChange(key, []);
            }
          }
        })
        .catch(() => {});

      // Reset background poll timer after manual fetch (D-12)
      invoke('trigger_manual_poll').catch(() => {});
    } catch (err) {
      store.setFetchStatus('error', err instanceof Error ? err.message : String(err));
    }
  }, []);

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
      invoke<string[]>('get_unseen_change_keys')
        .then((keys) => useTicketStore.getState().hydrateUnseenChanges(keys))
        .catch(() => {}),
    ]).then(([, config]) => {
      // Auto-refetch if user has previously fetched (tickets are in-memory only)
      if (config?.lastFetchedAt) {
        handleFetch();
      }
    });
  }, [handleFetch]);

  // F5 manual poll shortcut (D-11)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'F5') {
        e.preventDefault(); // Prevent browser page reload
        if (!isLoading) handleFetch();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, handleFetch]);

  // Listen for background poll-complete events (D-15, D-16)
  useEffect(() => {
    const unlisten = listen<{ changedKeys: string[]; checkedAt: string; hadError: boolean }>(
      'poll-complete',
      (event) => {
        const store = useTicketStore.getState();
        store.setLastCheckedAt(event.payload.checkedAt);

        // If changes detected, silently re-fetch ticket list (D-16)
        if (event.payload.changedKeys.length > 0) {
          handleFetch();
        }
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleFetch]);

  function handleSelectTicket(key: string) {
    const store = useTicketStore.getState();
    store.selectTicket(key);
    store.markSeen(key);
    // Fire-and-forget persist to SQLite
    invoke('set_triage_state', { ticketKey: key, state: 'seen' }).catch(() => {});
  }

  const candidateTickets = tickets.filter((t) => {
    const s = triageMap[t.key]?.state;
    return s !== 'ignored' && s !== 'copied' && !isDoneTicket(t);
  });

  const sortedCandidates = useMemo(() => {
    let filtered = candidateTickets;
    if (searchText.length > 0) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter((ticket) => ticket.key.toLowerCase().includes(lower));
    }
    if (assigneeFilter.length > 0) {
      const assigneeLower = assigneeFilter.toLowerCase();
      filtered = filtered.filter(
        (ticket) => (ticket.fields.assignee?.displayName ?? '').toLowerCase() === assigneeLower,
      );
    }
    return [...filtered].sort((a, b) => {
      const diff = new Date(b.fields.updated).getTime() - new Date(a.fields.updated).getTime();
      return sortDirection === 'desc' ? diff : -diff;
    });
  }, [candidateTickets, searchText, assigneeFilter, sortDirection]);

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
          title="Refresh (F5)"
          className={cn(
            'flex items-center gap-2 bg-brand hover:bg-brand-light text-white font-semibold rounded-md px-4 py-2 text-sm transition-colors duration-150',
            isLoading && 'opacity-40 cursor-not-allowed',
          )}
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          {isLoading ? t('tickets.fetching') : t('tickets.fetchButton')}
        </button>
        <span className="text-xs text-brand-muted" aria-live="polite">
          {lastCheckedAt || lastFetchedAt
            ? t('tickets.lastChecked', {
                time: formatRelativeTime(lastCheckedAt || lastFetchedAt!),
              })
            : t('tickets.notYetFetched')}
        </span>
        {totalCount > 0 && (
          <span className="text-xs text-brand-text-secondary">
            {t('tickets.candidates', { count: candidateTickets.length })}
            {newCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-brand">
                {t('tickets.new', { count: newCount })}
              </Badge>
            )}
          </span>
        )}
      </div>

      {/* Filter bar */}
      <TicketFilterBar
        searchText={searchText}
        onSearchChange={setSearchText}
        assigneeFilter={assigneeFilter}
        onAssigneeChange={setAssigneeFilter}
        sortDirection={sortDirection}
        onToggleSort={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
        resultCount={sortedCandidates.length}
      />

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
