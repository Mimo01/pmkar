import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { TicketCard } from './TicketCard';
import { TicketFilterBar } from './TicketFilterBar';
import { useTicketStore } from './ticketStore';
import type { JiraTicket } from './types';
import { isDoneTicket } from './utils';

export function LinkedTicketsPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sortField, setSortField] = useState<'updated' | 'key' | 'created' | 'priority' | 'status' | 'assignee'>('updated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);

  const copiedTickets = useMemo(
    () => tickets.filter((t) => triageMap[t.key]?.state === 'copied' && !isDoneTicket(t)),
    [tickets, triageMap],
  );

  const sorted = useMemo(() => {
    let filtered = copiedTickets;
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
