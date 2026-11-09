import { AlertCircle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { RememberedLinkHint } from '../tickets/RememberedLinkHint';
import { SkeletonCards, TicketCard } from '../tickets/TicketCard';
import { TicketFilterBar } from '../tickets/TicketFilterBar';
import {
  filterTickets,
  type SortDirection,
  sortTickets,
  type TicketSortField,
} from '../tickets/ticketListUtils';
import { useTicketStore } from '../tickets/ticketStore';
import type { JiraTicket } from '../tickets/types';
import { groupBadgeKey } from './groupBadge';
import { useGroupStore } from './groupStore';
import { SelectionBar } from './SelectionBar';
import { useGroupMembers } from './useGroupMembers';
import { useListSelection } from './useListSelection';

export function GroupViewPage({ groupId }: { groupId: number }) {
  const { t } = useTranslation();
  // State resets per visit: the parent mounts this with key={groupId} (D-16).
  const [searchText, setSearchText] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sortField, setSortField] = useState<TicketSortField>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const triageMap = useTicketStore((s) => s.triageMap);
  const { keys, members, loading, error, incomplete, retry } = useGroupMembers(groupId);

  const sorted = useMemo(
    () => sortTickets(filterTickets(members, searchText, assigneeFilter), sortField, sortDirection),
    [members, searchText, assigneeFilter, sortField, sortDirection],
  );

  const visibleKeys = useMemo(() => sorted.map((t) => t.key), [sorted]);
  const sel = useListSelection(visibleKeys);
  const selectedTickets = useMemo(
    () => sorted.filter((t) => sel.selected.has(t.key)),
    [sorted, sel.selected],
  );
  const group = useGroupStore((s) => s.groups.find((g) => g.id === groupId));
  const listRef = useRef<HTMLDivElement | null>(null);

  const isEmpty = keys === null || keys.length === 0;
  // Members exist and loaded, but the search/assignee filter excludes all of them.
  const noResults = !isEmpty && !loading && members.length > 0 && sorted.length === 0;

  function renderCard(ticket: JiraTicket) {
    const badge = groupBadgeKey(ticket, triageMap);
    const entry = triageMap[ticket.key];
    return (
      <TicketCard
        key={ticket.key}
        ticket={ticket}
        triageEntry={entry}
        onClick={() => useTicketStore.getState().selectTicket(ticket.key)}
        hideGroupId={groupId}
        selectMode={sel.selectMode}
        selected={sel.isSelected(ticket.key)}
        onToggleSelect={(shift) => sel.toggle(ticket.key, shift)}
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
                <RememberedLinkHint variant="row" entry={entry} />
              </>
            )}
            {badge === 'nav.watched' && <RememberedLinkHint variant="row" entry={entry} />}
            {badge === 'nav.linked' && entry?.copiedKey && (
              <Badge variant="outline" className="text-xs font-mono">
                {entry.copiedKey}
              </Badge>
            )}
          </div>
        }
      />
    );
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Esc handler for select mode
    <div className="flex-1 flex flex-col overflow-hidden" onKeyDown={sel.handleKeyDown}>
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

      {isEmpty && (
        <div className="flex flex-col items-center justify-center flex-1 py-12">
          <p className="text-base font-semibold text-brand-text mb-2">
            {t('groups.empty.heading')}
          </p>
          <p className="text-sm text-brand-text-secondary text-center max-w-sm">
            {t('groups.empty.body')}
          </p>
        </div>
      )}

      {!isEmpty && loading && <SkeletonCards />}

      {!isEmpty && !loading && incomplete && (
        <div
          role="alert"
          className="flex items-center gap-2 px-4 py-2 border-b border-brand-border text-xs text-destructive-text"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{t('groups.loadError')}</span>
          {error && (
            <button
              type="button"
              onClick={retry}
              className="ml-auto text-xs font-semibold text-brand-text-secondary hover:text-brand-text transition-colors duration-150"
            >
              {t('common.retry')}
            </button>
          )}
        </div>
      )}

      {noResults && (
        <div className="flex flex-col items-center justify-center flex-1 py-16">
          <p className="text-sm font-semibold text-brand-text mb-1">
            {t('groups.noResults.heading')}
          </p>
          <p className="text-xs text-brand-text-secondary text-center max-w-sm">
            {t('groups.noResults.body')}
          </p>
        </div>
      )}

      {!isEmpty && !loading && !noResults && (
        <div className="relative flex-1 flex flex-col min-h-0">
          <div
            ref={listRef}
            tabIndex={-1}
            className={cn('flex-1 overflow-y-auto', selectedTickets.length > 0 && 'pb-20')}
          >
            {sorted.map((ticket) => renderCard(ticket))}
          </div>
          <SelectionBar
            selectedTickets={selectedTickets}
            group={group ?? null}
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
