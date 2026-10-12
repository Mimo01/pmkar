import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SelectionBar } from '../groups/SelectionBar';
import { useListSelection } from '../groups/useListSelection';
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

  const keys = useMemo(() => sorted.map((t) => t.key), [sorted]);
  const sel = useListSelection(keys);
  const selectedTickets = useMemo(
    () => sorted.filter((t) => sel.selected.has(t.key)),
    [sorted, sel.selected],
  );

  function handleSelectTicket(key: string) {
    useTicketStore.getState().selectTicket(key);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Esc handler for select mode; real controls are inside
    <div className="flex-1 flex flex-col overflow-hidden" onKeyDown={sel.handleKeyDown}>
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
        selectMode={sel.selectMode}
        onToggleSelectMode={sel.toggleSelectMode}
        selectDisabled={sorted.length === 0 && !sel.selectMode}
        selectToggleRef={sel.selectToggleRef}
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
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className={cn('flex-1 overflow-y-auto', selectedTickets.length > 0 && 'pb-20')}>
            {sorted.map((ticket) => (
              <TicketCard
                key={ticket.key}
                ticket={ticket}
                triageEntry={triageMap[ticket.key]}
                onClick={() => handleSelectTicket(ticket.key)}
                selectMode={sel.selectMode}
                selected={sel.isSelected(ticket.key)}
                onToggleSelect={(shift) => sel.toggle(ticket.key, shift)}
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
          <SelectionBar
            selectedTickets={selectedTickets}
            group={null}
            onClear={sel.clear}
            onActionSucceeded={() => {
              sel.exit();
              sel.focusSelectToggle();
            }}
          />
        </div>
      )}
    </div>
  );
}
