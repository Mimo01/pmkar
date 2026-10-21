import { AlertCircle } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FOCUS_RING } from '@/lib/focusRing';
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
import { restoreTicket } from '../tickets/triageActions';
import type { JiraTicket } from '../tickets/types';
import { useRemovalBlockedByFetch } from '../tickets/useHintsEligible';
import { ConfirmRemovePopover } from './ConfirmRemovePopover';
import { groupBadgeKey } from './groupBadge';
import { useGroupStore } from './groupStore';
import { removeAllMissingWithFeedback, removeMissingMember } from './membershipActions';
import { readMissingKeysNow } from './missingMembers';
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
  const { keys, members, loading, error, incomplete, missingKeys, retry } =
    useGroupMembers(groupId);

  const sorted = useMemo(
    () => sortTickets(filterTickets(members, searchText, assigneeFilter), sortField, sortDirection),
    [members, searchText, assigneeFilter, sortField, sortDirection],
  );

  // D-03: one stable sort, then partition: present members first, missing as one block.
  const present = useMemo(
    () => sorted.filter((t) => !missingKeys.has(t.key)),
    [sorted, missingKeys],
  );
  const missingVisible = useMemo(
    () => sorted.filter((t) => missingKeys.has(t.key)),
    [sorted, missingKeys],
  );
  const ordered = useMemo(() => [...present, ...missingVisible], [present, missingVisible]);

  const visibleKeys = useMemo(() => ordered.map((t) => t.key), [ordered]);
  const sel = useListSelection(visibleKeys);
  const selectedTickets = useMemo(
    () => ordered.filter((t) => sel.selected.has(t.key)),
    [ordered, sel.selected],
  );
  const group = useGroupStore((s) => s.groups.find((g) => g.id === groupId));
  // WR-08: removals abort while a fetch is in flight, so say so instead of failing silently.
  const fetching = useRemovalBlockedByFetch();
  const refreshingHint = fetching ? t('groups.missing.refreshing') : null;

  const headingId = useId();
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const removeAllRef = useRef<HTMLButtonElement | null>(null);
  const pendingFocusRef = useRef<{ removed: string; target: string | null } | null>(null);

  // After a successful single removal, move focus to the neighbouring missing card.
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    if (ordered.some((tk) => tk.key === pending.removed)) return;
    pendingFocusRef.current = null;
    const list = listRef.current;
    const targetBtn = pending.target
      ? list?.querySelector<HTMLElement>(`[data-ticket-key="${pending.target}"] > button`)
      : null;
    (targetBtn ?? removeAllRef.current ?? list)?.focus();
  }, [ordered]);

  // A popover that unmounts with its card or block never fires onOpenChange(false), so stale
  // state would re-open it uninvited later (WR-05).
  useEffect(() => {
    if (confirmKey !== null && !missingVisible.some((m) => m.key === confirmKey)) {
      setConfirmKey(null);
    }
    if (confirmAll && missingVisible.length === 0) setConfirmAll(false);
  }, [missingVisible, confirmKey, confirmAll]);

  const isEmpty = keys === null || keys.length === 0;
  // Members exist and loaded, but the search/assignee filter excludes all of them.
  const noResults = !isEmpty && !loading && members.length > 0 && sorted.length === 0;

  function renderCard(ticket: JiraTicket, missing: boolean) {
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
        dimmed={missing}
        footerSlot={
          missing && group ? (
            <>
              <span className="text-xs text-brand-text-secondary">{t('groups.missing.hint')}</span>
              <ConfirmRemovePopover
                open={confirmKey === ticket.key}
                onOpenChange={(o) => setConfirmKey(o ? ticket.key : null)}
                question={t('groups.missing.removeConfirm', { key: ticket.key, name: group.name })}
                confirmDisabledReason={refreshingHint}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={fetching}
                    title={refreshingHint ?? undefined}
                    aria-label={t('groups.missing.removeAria', {
                      key: ticket.key,
                      name: group.name,
                    })}
                  >
                    {t('groups.missing.remove')}
                  </Button>
                }
                onConfirm={async () => {
                  const idx = missingVisible.findIndex((m) => m.key === ticket.key);
                  const target =
                    missingVisible[idx + 1]?.key ?? missingVisible[idx - 1]?.key ?? null;
                  pendingFocusRef.current = { removed: ticket.key, target };
                  const ok = await removeMissingMember(group, ticket.key, t);
                  if (!ok) pendingFocusRef.current = null;
                  return ok;
                }}
              />
            </>
          ) : undefined
        }
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void restoreTicket(ticket.key);
                  }}
                  className={`rounded text-xs text-brand-text-secondary hover:text-brand-text transition-colors duration-150 ${FOCUS_RING}`}
                >
                  {t('ignored.restore')}
                </button>
              </>
            )}
            {badge === 'nav.watched' && (
              <>
                <RememberedLinkHint variant="row" entry={entry} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void restoreTicket(ticket.key);
                  }}
                  className={`rounded text-xs text-brand-text-secondary hover:text-brand-text transition-colors duration-150 ${FOCUS_RING}`}
                >
                  {t('watched.restore')}
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
            {present.map((ticket) => renderCard(ticket, false))}
            {missingVisible.length > 0 && group && (
              // biome-ignore lint/a11y/useSemanticElements: a fieldset would add form semantics; this is a labelled list region
              <div role="group" aria-labelledby={headingId}>
                <div className="flex items-center justify-between gap-2 px-4 pt-6 pb-2 min-h-10 border-t border-brand-border">
                  <h3 id={headingId} className="text-xs font-semibold text-brand-text-secondary">
                    {t('groups.missing.heading', { count: missingVisible.length })}
                  </h3>
                  <ConfirmRemovePopover
                    open={confirmAll}
                    onOpenChange={setConfirmAll}
                    question={t('groups.missing.removeAllConfirm', {
                      count: missingKeys.size,
                      name: group.name,
                    })}
                    confirmDisabledReason={refreshingHint}
                    trigger={
                      <Button
                        ref={removeAllRef}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={fetching}
                        title={refreshingHint ?? undefined}
                      >
                        {t('groups.missing.removeAll')}
                      </Button>
                    }
                    onConfirm={async () => {
                      // Recompute at confirm time: a member that came back is never removed.
                      const now = readMissingKeysNow(groupId);
                      if (now.size === 0) return false;
                      return removeAllMissingWithFeedback(group, [...now], t);
                    }}
                  />
                </div>
                {missingVisible.map((ticket) => renderCard(ticket, true))}
              </div>
            )}
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
