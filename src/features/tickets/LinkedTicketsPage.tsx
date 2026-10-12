import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { TicketCard } from './TicketCard';
import { TicketFilterBar } from './TicketFilterBar';
import {
  filterTickets,
  isLinkedCandidate,
  type SortDirection,
  sortTickets,
  type TicketSortField,
} from './ticketListUtils';
import { useTicketStore } from './ticketStore';

export function LinkedTicketsPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sortField, setSortField] = useState<TicketSortField>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);

  const copiedTickets = useMemo(
    () => tickets.filter((t) => isLinkedCandidate(t, triageMap)),
    [tickets, triageMap],
  );

  const sorted = useMemo(() => {
    return sortTickets(
      filterTickets(copiedTickets, searchText, assigneeFilter),
      sortField,
      sortDirection,
    );
  }, [copiedTickets, searchText, assigneeFilter, sortField, sortDirection]);

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
      {copiedTickets.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <p className="text-sm font-semibold text-brand-text mb-1">{t('linked.empty.heading')}</p>
          <p className="text-xs text-brand-muted text-center max-w-sm">{t('linked.empty.body')}</p>
        </div>
      )}

      {/* Card list */}
      {copiedTickets.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          {sorted.map((ticket) => (
            <TicketCard
              key={ticket.key}
              ticket={ticket}
              triageEntry={triageMap[ticket.key]}
              onClick={() => handleSelectTicket(ticket.key)}
              actionSlot={
                triageMap[ticket.key]?.copiedKey ? (
                  <Badge variant="outline" className="text-xs font-mono">
                    {triageMap[ticket.key].copiedKey}
                  </Badge>
                ) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
