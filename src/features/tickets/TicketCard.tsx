import { Check } from 'lucide-react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '../../lib/format';
import { GroupChips } from '../groups/GroupChips';
import { PriorityIcon } from './PriorityIcon';
import { StatusBadge } from './StatusBadge';
import { useTicketStore } from './ticketStore';
import type { JiraTicket, TriageEntry } from './types';
import { UserAvatar } from './UserAvatar';

// --- TicketCard props interface ---

interface TicketCardProps {
  ticket: JiraTicket;
  triageEntry?: TriageEntry;
  onClick: () => void;
  actionSlot?: React.ReactNode; // Restore button (ignored), linked key badge (linked)
  hideGroupId?: number; // hide this group's chip (inside its own group view)
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (shift: boolean) => void;
  /**
   * Dims the summary only; key, dates and metadata stay at full secondary-text
   * contrast (WCAG 1.4.3). Chips, checkbox and footer are never dimmed.
   */
  dimmed?: boolean;
  /** Full-contrast control row rendered below the content. */
  footerSlot?: React.ReactNode;
}

// --- TicketCard component ---

export function TicketCard({
  ticket,
  onClick,
  actionSlot,
  hideGroupId,
  selectMode,
  selected,
  onToggleSelect,
  dimmed,
  footerSlot,
}: TicketCardProps) {
  const { t } = useTranslation();
  const unseenFields = useTicketStore((s) => s.unseenChanges[ticket.key]);
  const hasUnseenChanges = !!unseenFields;
  const changeCount = unseenFields?.length ?? 0;
  const fieldList = unseenFields?.join(', ') ?? '';
  // Opacity on a parent cannot be undone by a child, so dim individual elements only.
  // Only the brand-text summary is dimmed: secondary-text elements cannot reach 4.5:1 at 70%.
  const dimClass = dimmed
    ? 'opacity-70 transition-opacity duration-150 motion-reduce:transition-none'
    : '';
  return (
    <div
      data-testid="ticket-card"
      data-ticket-key={ticket.key}
      className={`group relative border-b border-brand-border transition-colors duration-150 hover:bg-brand-surface-hover ${
        selectMode && selected ? 'shadow-[inset_3px_0_0_var(--color-brand)]' : ''
      }`}
    >
      <button
        type="button"
        aria-label={ticket.fields.summary}
        // In select mode this button toggles selection (and stays focusable for
        // Shift+Space range select), so expose the selected state to AT
        aria-pressed={selectMode ? !!selected : undefined}
        onClick={(e) => {
          if (selectMode && onToggleSelect) {
            onToggleSelect(e.shiftKey);
          } else {
            onClick();
          }
        }}
        className="absolute inset-0 w-full h-full cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-[-2px]"
      />
      <div className={`pointer-events-none relative px-4 py-3 ${selectMode ? 'pl-14' : ''}`}>
        {/* Line 1: ticket key + dates on right */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-brand-text-secondary">{ticket.key}</span>
            {hasUnseenChanges && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="pointer-events-auto relative z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400 flex-shrink-0">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
                      {t('tickets.card.changedLabel')}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {changeCount > 0
                      ? t('tickets.card.changeTooltip', {
                          count: changeCount,
                          fields: fieldList,
                        })
                      : t('tickets.card.unseenChanges', { count: 0 })}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: only stops click propagation; real controls live inside actionSlot */}
            <span
              className="pointer-events-auto relative z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {actionSlot}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-brand-text-secondary">
            {ticket.fields.created && (
              <>
                <span>
                  {t('tickets.card.created', { time: formatRelativeTime(ticket.fields.created) })}
                </span>
                <span className="text-brand-muted/40">·</span>
              </>
            )}
            <span>
              {t('tickets.card.updated', { time: formatRelativeTime(ticket.fields.updated) })}
            </span>
          </div>
        </div>
        {/* Line 2: summary */}
        <p
          className={cn(
            'text-sm font-semibold text-brand-text leading-snug line-clamp-1 mb-1',
            dimClass,
          )}
        >
          {ticket.fields.summary}
        </p>
        {/* Line 4: metadata row */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <StatusBadge status={ticket.fields.status.name} />
            <PriorityIcon priority={ticket.fields.priority.name} size="sm" />
            <UserAvatar user={ticket.fields.assignee} size="sm" />
            {ticket.fields.assignee && (
              <span className="text-xs text-brand-text-secondary truncate">
                {ticket.fields.assignee.displayName}
              </span>
            )}
          </span>
          <span className="pointer-events-auto relative z-10 ml-auto min-w-0">
            <GroupChips issueKey={ticket.key} hideGroupId={hideGroupId} />
          </span>
        </div>
      </div>
      {footerSlot && (
        // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: only stops click propagation; real controls live inside footerSlot
        <div
          className={cn(
            'pointer-events-auto relative z-10 px-4 pb-3 -mt-1 flex items-center justify-between gap-2',
            selectMode && 'pl-14',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {footerSlot}
        </div>
      )}
      {selectMode && (
        // biome-ignore lint/a11y/useSemanticElements: custom 24px hit area with styled box; shift-click needs the click event
        <button
          type="button"
          role="checkbox"
          aria-checked={!!selected}
          aria-label={t('groups.select.checkbox', { key: ticket.key })}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(e.shiftKey);
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-ring"
        >
          <span
            className={`w-4 h-4 rounded-sm border border-brand-text-secondary flex items-center justify-center ${
              selected ? 'bg-brand border-brand text-white' : ''
            }`}
          >
            {selected && <Check className="w-3 h-3" aria-hidden="true" />}
          </span>
        </button>
      )}
    </div>
  );
}

// --- SkeletonCards component ---

export function SkeletonCards({ count = 3 }: { count?: number }) {
  const { t } = useTranslation();
  return (
    <div aria-busy="true" aria-label={t('tickets.loadingAria')} role="status">
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton loading rows are static, index is stable
        <div key={i} className="px-4 py-3 border-b border-brand-border">
          <div className="flex justify-between mb-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-4 w-full mb-1" />
          <div className="flex gap-2">
            <Skeleton className="h-3 w-8 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
