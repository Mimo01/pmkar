import { Info, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { SelectionBar } from '../groups/SelectionBar';
import { useListSelection } from '../groups/useListSelection';
import { RememberedLinkHint } from './RememberedLinkHint';
import { TicketCard } from './TicketCard';
import { TicketFilterBar } from './TicketFilterBar';
import {
  filterTickets,
  isWatchedCandidate,
  type SortDirection,
  sortTickets,
  type TicketSortField,
} from './ticketListUtils';
import { useTicketStore } from './ticketStore';

export function WatchedTicketsPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sortField, setSortField] = useState<TicketSortField>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showInfoCard, setShowInfoCard] = useState(true);
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);

  const watchedTickets = useMemo(
    () => tickets.filter((t) => isWatchedCandidate(t, triageMap)),
    [tickets, triageMap],
  );

  const sorted = useMemo(() => {
    return sortTickets(
      filterTickets(watchedTickets, searchText, assigneeFilter),
      sortField,
      sortDirection,
    );
  }, [watchedTickets, searchText, assigneeFilter, sortField, sortDirection]);

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
      {watchedTickets.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <p className="text-sm font-semibold text-brand-text mb-1">{t('watched.empty.heading')}</p>
          <p className="text-xs text-brand-muted text-center max-w-sm">{t('watched.empty.body')}</p>
        </div>
      )}

      {/* Info card */}
      {watchedTickets.length > 0 && showInfoCard && (
        <div className="mx-4 mt-3 mb-1 flex items-start gap-3 bg-brand/5 border border-brand/10 rounded-lg px-4 py-3">
          <Info className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-xs text-brand-text flex-1">{t('watched.infoCard')}</p>
          <button
            type="button"
            onClick={() => setShowInfoCard(false)}
            className="text-brand-muted hover:text-brand-text transition-colors duration-150 flex-shrink-0"
            aria-label={t('watched.infoCard.dismiss')}
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Card list */}
      {watchedTickets.length > 0 && (
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
                  <div className="flex items-center gap-2">
                    <RememberedLinkHint variant="row" entry={triageMap[ticket.key]} />
                  </div>
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
