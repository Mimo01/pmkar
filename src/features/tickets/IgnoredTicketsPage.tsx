import { invoke } from '@tauri-apps/api/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TicketCard } from './TicketCard';
import { TicketFilterBar } from './TicketFilterBar';
import { useTicketStore } from './ticketStore';
import type { JiraTicket } from './types';

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
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);

  const ignoredTickets = useMemo(
    () => tickets.filter((t) => triageMap[t.key]?.state === 'ignored'),
    [tickets, triageMap],
  );

  const sorted = useMemo(() => {
    let filtered = ignoredTickets;
    if (searchText.length > 0) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter((ticket: JiraTicket) =>
        ticket.key.toLowerCase().includes(lower),
      );
    }
    if (assigneeFilter.length > 0) {
      const assigneeLower = assigneeFilter.toLowerCase();
      filtered = filtered.filter(
        (ticket: JiraTicket) =>
          (ticket.fields.assignee?.displayName ?? '').toLowerCase() === assigneeLower,
      );
    }
    return [...filtered].sort((a: JiraTicket, b: JiraTicket) => {
      const diff = new Date(b.fields.updated).getTime() - new Date(a.fields.updated).getTime();
      return sortDirection === 'desc' ? diff : -diff;
    });
  }, [ignoredTickets, searchText, assigneeFilter, sortDirection]);

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
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
