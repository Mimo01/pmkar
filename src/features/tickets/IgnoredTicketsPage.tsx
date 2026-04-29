import { invoke } from '@tauri-apps/api/core';
import { Info, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TicketCard } from './TicketCard';
import { TicketFilterBar } from './TicketFilterBar';
import { useTicketStore } from './ticketStore';
import type { JiraTicket } from './types';
import { isDoneTicket } from './utils';

function handleRestore(issueKey: string) {
  invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {});
  useTicketStore.getState().hydrateTriageMap({
    ...useTicketStore.getState().triageMap,
    [issueKey]: { state: 'seen', copiedKey: null },
  });
}

export function IgnoredTicketsPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sortField, setSortField] = useState<'updated' | 'key' | 'created' | 'priority' | 'status' | 'assignee'>('updated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showInfoCard, setShowInfoCard] = useState(true);
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);

  const ignoredTickets = useMemo(
    () =>
      tickets.filter((t) => {
        const s = triageMap[t.key]?.state;
        return (s === 'ignored' || s === 'handled') && !isDoneTicket(t);
      }),
    [tickets, triageMap],
  );

  const sorted = useMemo(() => {
    let filtered = ignoredTickets;
    if (searchText.length > 0) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter((ticket: JiraTicket) => ticket.key.toLowerCase().includes(lower));
    }
    if (assigneeFilter.length > 0) {
      const assigneeLower = assigneeFilter.toLowerCase();
      filtered = filtered.filter(
        (ticket: JiraTicket) =>
          (ticket.fields.assignee?.displayName ?? '').toLowerCase() === assigneeLower,
      );
    }
    return [...filtered].sort((a: JiraTicket, b: JiraTicket) => {
      let diff: number;
      if (sortField === 'key') {
        const parse = (k: string) => { const m = k.match(/^(.*)-(\d+)$/); return m ? { proj: m[1], num: parseInt(m[2], 10) } : { proj: k, num: 0 }; };
        const ka = parse(a.key); const kb = parse(b.key);
        diff = ka.proj !== kb.proj ? ka.proj.localeCompare(kb.proj) : ka.num - kb.num;
      } else if (sortField === 'created') {
        diff = new Date(a.fields.created ?? a.fields.updated).getTime() - new Date(b.fields.created ?? b.fields.updated).getTime();
      } else if (sortField === 'priority') {
        diff = parseInt(a.fields.priority.id, 10) - parseInt(b.fields.priority.id, 10);
      } else if (sortField === 'status') {
        diff = a.fields.status.name.localeCompare(b.fields.status.name);
      } else if (sortField === 'assignee') {
        diff = (a.fields.assignee?.displayName ?? '').localeCompare(b.fields.assignee?.displayName ?? '');
      } else {
        diff = new Date(a.fields.updated).getTime() - new Date(b.fields.updated).getTime();
      }
      return sortDirection === 'asc' ? diff : -diff;
    });
  }, [ignoredTickets, searchText, assigneeFilter, sortField, sortDirection]);

  function handleSelectTicket(key: string) {
    useTicketStore.getState().selectTicket(key);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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
        resultCount={sorted.length}
      />

      {/* Empty state */}
      {ignoredTickets.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <p className="text-sm font-semibold text-brand-text mb-1">{t('ignored.empty.heading')}</p>
          <p className="text-xs text-brand-muted text-center max-w-sm">{t('ignored.empty.body')}</p>
        </div>
      )}

      {/* Info card */}
      {ignoredTickets.length > 0 && showInfoCard && (
        <div className="mx-4 mt-3 mb-1 flex items-start gap-3 bg-brand/5 border border-brand/10 rounded-lg px-4 py-3">
          <Info className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-xs text-brand-text flex-1">{t('dismissed.infoCard')}</p>
          <button
            type="button"
            onClick={() => setShowInfoCard(false)}
            className="text-brand-muted hover:text-brand-text transition-colors duration-150 flex-shrink-0"
            aria-label="Dismiss info card"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Card list */}
      {ignoredTickets.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          {sorted.map((ticket) => (
            <TicketCard
              key={ticket.key}
              ticket={ticket}
              triageEntry={triageMap[ticket.key]}
              onClick={() => handleSelectTicket(ticket.key)}
              actionSlot={
                <div className="flex items-center gap-2">
                  {triageMap[ticket.key]?.state === 'handled' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-semibold">
                      {t('tickets.card.handledBadge')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(ticket.key);
                    }}
                    className="text-xs text-brand-muted hover:text-brand-text transition-colors duration-150"
                  >
                    {t('ignored.restore')}
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
