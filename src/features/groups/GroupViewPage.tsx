import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { SkeletonCards, TicketCard } from '../tickets/TicketCard';
import { TicketFilterBar } from '../tickets/TicketFilterBar';
import {
  filterTickets,
  type SortDirection,
  sortTickets,
  type TicketSortField,
} from '../tickets/ticketListUtils';
import { useTicketStore } from '../tickets/ticketStore';
import { restoreTicket } from '../tickets/triageActions';
import { groupBadgeKey } from './groupBadge';
import { useGroupMembers } from './useGroupMembers';

export function GroupViewPage({ groupId }: { groupId: number }) {
  const { t } = useTranslation();
  // State resets per visit: the parent mounts this with key={groupId} (D-16).
  const [searchText, setSearchText] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sortField, setSortField] = useState<TicketSortField>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const triageMap = useTicketStore((s) => s.triageMap);
  const { keys, members, loading } = useGroupMembers(groupId);

  const sorted = useMemo(
    () => sortTickets(filterTickets(members, searchText, assigneeFilter), sortField, sortDirection),
    [members, searchText, assigneeFilter, sortField, sortDirection],
  );

  const isEmpty = keys === null || keys.length === 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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

      {isEmpty && (
        <div className="flex flex-col items-center justify-center flex-1 py-12">
          <p className="text-base font-semibold text-brand-text mb-2">
            {t('groups.empty.heading')}
          </p>
          <p className="text-sm text-brand-muted text-center max-w-sm">{t('groups.empty.body')}</p>
        </div>
      )}

      {!isEmpty && loading && <SkeletonCards />}

      {!isEmpty && !loading && (
        <div className="flex-1 overflow-y-auto">
          {sorted.map((ticket) => {
            const badge = groupBadgeKey(ticket, triageMap);
            const entry = triageMap[ticket.key];
            return (
              <TicketCard
                key={ticket.key}
                ticket={ticket}
                triageEntry={entry}
                onClick={() => useTicketStore.getState().selectTicket(ticket.key)}
                actionSlot={
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded border border-brand-border-subtle bg-brand-surface-hover text-brand-text-secondary">
                      {t(badge)}
                    </span>
                    {badge === 'nav.notMine' && (
                      <>
                        {entry?.state === 'handled' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-semibold">
                            {t('tickets.card.handledBadge')}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreTicket(ticket.key);
                          }}
                          className="text-xs text-brand-muted hover:text-brand-text transition-colors duration-150"
                        >
                          {t('ignored.restore')}
                        </button>
                      </>
                    )}
                    {badge === 'nav.linked' && entry?.copiedKey && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {entry.copiedKey}
                      </Badge>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
