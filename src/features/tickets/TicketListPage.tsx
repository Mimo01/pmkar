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
import type { FetchTicketsResult, JiraTicket, TriageEntry } from './types';
import { isDoneTicket } from './utils';

// --- Helpers ---

/**
 * Build the "mine" batch JQL — D-02 simplified clause set.
 *
 * Drops the legacy broad text-match clauses (Phase 26): those clauses
 * caused the combined query to time out for users with many watched
 * accounts. The mine batch now includes only direct assignee match plus
 * the user's explicitly watched issues.
 *
 * Project scoping pattern preserved verbatim (debug session:
 * fetched-tasks-wrong-project).
 */
function buildMineBatchJql(currentUser: string, sourceProjectKey: string | null): string {
  const clause = `assignee = "${currentUser}" OR issueKey in watchedIssues()`;
  if (sourceProjectKey && sourceProjectKey.length > 0) {
    return `project = "${sourceProjectKey}" AND (${clause}) ORDER BY updated DESC`;
  }
  return `(${clause}) ORDER BY updated DESC`;
}

/**
 * Build a per-watched-user batch JQL — D-02 simplified clause set.
 * One batch per watched user; only assignee match (no comment/description
 * text search) keeps each request small and timeout-safe.
 */
function buildUserBatchJql(identifier: string, sourceProjectKey: string | null): string {
  const clause = `assignee = "${identifier}"`;
  if (sourceProjectKey && sourceProjectKey.length > 0) {
    return `project = "${sourceProjectKey}" AND ${clause} ORDER BY updated DESC`;
  }
  return `${clause} ORDER BY updated DESC`;
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
  const [sortField, setSortField] = useState<
    'updated' | 'key' | 'created' | 'priority' | 'status' | 'assignee'
  >('updated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);
  const fetchStatus = useTicketStore((s) => s.fetchStatus);
  const fetchError = useTicketStore((s) => s.fetchError);
  const lastFetchedAt = useTicketStore((s) => s.lastFetchedAt);
  const lastCheckedAt = useTicketStore((s) => s.lastCheckedAt);
  const totalCount = useTicketStore((s) => s.totalCount);
  const newCount = useTicketStore((s) => s.newCount);
  const truncated = useTicketStore((s) => s.truncated);

  const isLoading = fetchStatus === 'loading';

  const [batchesDone, setBatchesDone] = useState(0);
  const [batchesTotal, setBatchesTotal] = useState(0);
  const [failedUserNames, setFailedUserNames] = useState<string[]>([]);

  // Re-render every 30s so formatRelativeTime stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const handleFetch = useCallback(async () => {
    const store = useTicketStore.getState();
    store.setFetchStatus('loading');

    // Reset batch progress and prior failure state (Pitfall 3)
    setFailedUserNames([]);
    setBatchesDone(0);

    try {
      const connState = useConnectionStore.getState();
      const serverConn = connState.serverConnection;
      if (!serverConn) throw new Error('No server connection');

      const preset = store.jqlPreset;

      // Fast path: custom JQL — single invoke, no batching (Pitfall 4)
      if (preset === 'custom' && store.jqlCustom) {
        const result = await invoke<FetchTicketsResult>('fetch_tickets', {
          baseUrl: serverConn.baseUrl,
          jql: store.jqlCustom,
        });
        store.setTickets(result.issues, result.triageMap, result.total, result.truncated);
        const nowCustom = new Date().toISOString();
        store.setLastFetchedAt(nowCustom);
        store.setLastCheckedAt(nowCustom);

        // Change-detection loop for custom preset
        for (const ticket of result.issues) {
          try {
            // NOTE: Tauri command `fetch_ticket_detail` takes Rust param `issue_key`,
            // which Tauri exposes to JS as `issueKey`. Passing the wrong key (e.g.
            // `ticketKey`) causes a silent IPC rejection swallowed by the catch
            // below, which previously caused manual-fetch change detection to never
            // run. See debug session: manual-fetch-misses-changes.
            const detail = await invoke<unknown>('fetch_ticket_detail', {
              baseUrl: serverConn.baseUrl,
              issueKey: ticket.key,
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
          } catch (err) {
            console.error(`[manual-fetch] change detection failed for ${ticket.key}:`, err);
          }
        }

        invoke<string[]>('get_unseen_change_keys')
          .then((keys) => {
            for (const key of keys) {
              if (!store.unseenChanges[key]) store.setUnseenChange(key, []);
            }
          })
          .catch(() => {});

        invoke('trigger_manual_poll').catch(() => {});
        return;
      }

      // Build batch list — mine preset uses only the "mine" batch (Pitfall 5)
      const batches: { label: string; jql: string }[] = [
        {
          label: 'mine',
          jql: buildMineBatchJql(serverConn.username, connState.sourceProjectKey),
        },
        ...(preset === 'all_watched'
          ? store.watchedUsers.map((u) => ({
              label: u.displayName,
              jql: buildUserBatchJql(u.identifier, connState.sourceProjectKey),
            }))
          : []),
      ];

      setBatchesTotal(batches.length);

      const mergedIssues: JiraTicket[] = [];
      const seenKeys = new Set<string>();
      const mergedTriageMap: Record<string, TriageEntry> = {};
      let totalCount = 0;
      let anyTruncated = false;
      const localFailedUsers: string[] = [];

      // Sequential loop — D-05 (no concurrent fetch primitives)
      for (const batch of batches) {
        try {
          const result = await invoke<FetchTicketsResult>('fetch_tickets', {
            baseUrl: serverConn.baseUrl,
            jql: batch.jql,
          });
          // Dedup: first-seen wins (D-07)
          for (const issue of result.issues) {
            if (!seenKeys.has(issue.key)) {
              seenKeys.add(issue.key);
              mergedIssues.push(issue);
            }
          }
          for (const [key, entry] of Object.entries(result.triageMap)) {
            if (!(key in mergedTriageMap)) {
              mergedTriageMap[key] = entry;
            }
          }
          totalCount += result.total;
          if (result.truncated) anyTruncated = true;
        } catch (err) {
          // Per-user failure tolerance — D-06
          console.error(`[manual-fetch] batch '${batch.label}' failed:`, err);
          localFailedUsers.push(batch.label);
        }
        setBatchesDone((n) => n + 1);
      }

      // WR-01: if every batch failed, preserve existing tickets and show an error banner.
      // Do not set failedUserNames here — only the error state is appropriate.
      if (localFailedUsers.length === batches.length) {
        store.setFetchStatus(
          'error',
          `All ${batches.length} batch(es) failed. Check your connection.`,
        );
        return;
      }

      // Partial failure: only some batches failed — show the per-user warning.
      if (localFailedUsers.length > 0) {
        setFailedUserNames(localFailedUsers);
      }

      // Single setTickets call after loop — D-03 (avoids fetchStatus reset mid-loop, Pitfall 1)
      store.setTickets(mergedIssues, mergedTriageMap, totalCount, anyTruncated);
      const now = new Date().toISOString();
      store.setLastFetchedAt(now);
      store.setLastCheckedAt(now);

      // Dual-purpose: run snapshot change detection after successful fetch (D-10, POLL-06)
      // Change-detection loop over mergedIssues (not individual batch result — Pitfall 2)
      // Also hydrate unseen changes for frontend indicators (Phase 15)
      for (const ticket of mergedIssues) {
        try {
          // NOTE: Tauri command `fetch_ticket_detail` takes Rust param `issue_key`,
          // which Tauri exposes to JS as `issueKey`. Passing the wrong key (e.g.
          // `ticketKey`) causes a silent IPC rejection swallowed by the catch
          // below, which previously caused manual-fetch change detection to never
          // run. See debug session: manual-fetch-misses-changes.
          const detail = await invoke<unknown>('fetch_ticket_detail', {
            baseUrl: serverConn.baseUrl,
            issueKey: ticket.key,
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
        } catch (err) {
          // Skip change detection for this ticket if detail fetch fails (POLL-06: no watermark advance).
          // Log to console so silent IPC parameter mismatches surface during development.
          console.error(`[manual-fetch] change detection failed for ${ticket.key}:`, err);
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

      // Reset progress counter after fetch completes (Pitfall 6)
      setBatchesTotal(0);
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

        // If changes detected, silently re-fetch ticket list (D-16).
        // Guard with !isLoading to avoid launching a second concurrent fetch (WR-03).
        if (event.payload.changedKeys.length > 0 && !isLoading) {
          handleFetch();
        }
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleFetch, isLoading]);

  function handleSelectTicket(key: string) {
    const store = useTicketStore.getState();
    store.selectTicket(key);
    store.markSeen(key);
    // Fire-and-forget persist to SQLite
    invoke('set_triage_state', { ticketKey: key, state: 'seen' }).catch(() => {});
  }

  const candidateTickets = tickets.filter((t) => {
    const s = triageMap[t.key]?.state;
    return s !== 'ignored' && s !== 'copied' && s !== 'handled' && !isDoneTicket(t);
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
      let diff: number;
      if (sortField === 'key') {
        const parse = (k: string) => {
          const m = k.match(/^(.*)-(\d+)$/);
          return m ? { proj: m[1], num: parseInt(m[2], 10) } : { proj: k, num: 0 };
        };
        const ka = parse(a.key);
        const kb = parse(b.key);
        diff = ka.proj !== kb.proj ? ka.proj.localeCompare(kb.proj) : ka.num - kb.num;
      } else if (sortField === 'created') {
        const ta = a.fields.created ?? a.fields.updated;
        const tb = b.fields.created ?? b.fields.updated;
        diff = new Date(ta).getTime() - new Date(tb).getTime();
      } else if (sortField === 'priority') {
        diff = parseInt(a.fields.priority.id, 10) - parseInt(b.fields.priority.id, 10);
      } else if (sortField === 'status') {
        diff = a.fields.status.name.localeCompare(b.fields.status.name);
      } else if (sortField === 'assignee') {
        diff = (a.fields.assignee?.displayName ?? '').localeCompare(
          b.fields.assignee?.displayName ?? '',
        );
      } else {
        diff = new Date(a.fields.updated).getTime() - new Date(b.fields.updated).getTime();
      }
      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [candidateTickets, searchText, assigneeFilter, sortField, sortDirection]);

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
        {isLoading && batchesTotal > 0 && (
          <span className="text-xs text-brand-muted" aria-live="polite" data-testid="fetch-progress">
            {t('tickets.fetchProgress', { done: batchesDone, total: batchesTotal })}
          </span>
        )}
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
        sortField={sortField}
        onSortFieldChange={setSortField}
        sortDirection={sortDirection}
        onToggleSort={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
        resultCount={sortedCandidates.length}
      />

      {/* Truncation warning — backend pagination cap was hit (jira-fetch-pagination-50-cap) */}
      {truncated && fetchStatus !== 'error' && (
        <div
          className="mx-4 mt-3 rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-4 py-3"
          role="alert"
          data-testid="truncation-warning"
        >
          <p className="text-sm text-yellow-400">{t('tickets.truncationWarning')}</p>
          <p className="text-xs text-brand-muted mt-1">{t('tickets.truncationWarningHint')}</p>
        </div>
      )}

      {/* Partial-failure warning — one or more per-user batches failed (D-06) */}
      {failedUserNames.length > 0 && fetchStatus !== 'loading' && (
        <div
          className="mx-4 mt-3 rounded-lg border border-yellow-400/30 bg-yellow-400/5 px-4 py-3"
          role="alert"
          data-testid="partial-fetch-warning"
        >
          <p className="text-sm text-yellow-400">
            {t('tickets.partialFetchWarning', { count: failedUserNames.length })}
          </p>
          <p className="text-xs text-brand-muted mt-1">
            {failedUserNames
              .map((n) => (n === 'mine' ? t('settings.preset.mine') : n))
              .join(', ')}
          </p>
        </div>
      )}

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
