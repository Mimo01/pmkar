import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatRelativeTime } from '../../lib/format';
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
}

// --- TicketCard component ---

export function TicketCard({ ticket, onClick, actionSlot }: TicketCardProps) {
  const { t } = useTranslation();
  const unseenFields = useTicketStore((s) => s.unseenChanges[ticket.key]);
  const hasUnseenChanges = !!unseenFields;
  const changeCount = unseenFields?.length ?? 0;
  const fieldList = unseenFields?.join(', ') ?? '';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ticket.fields.summary}
      className="w-full text-left px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-brand-surface-hover border-b border-brand-border focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px]"
    >
      {/* Line 1: ticket key + dates on right */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-brand-muted">{ticket.key}</span>
          {hasUnseenChanges && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400 flex-shrink-0">
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
          {actionSlot}
        </div>
        <div className="flex items-center gap-2 text-xs text-brand-muted">
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
      <p className="text-sm font-semibold text-brand-text leading-snug line-clamp-1 mb-1">
        {ticket.fields.summary}
      </p>
      {/* Line 4: metadata row */}
      <div className="flex items-center gap-2">
        <StatusBadge status={ticket.fields.status.name} />
        <PriorityIcon priority={ticket.fields.priority.name} size="sm" />
        <UserAvatar user={ticket.fields.assignee} size="sm" />
        {ticket.fields.assignee && (
          <span className="text-xs text-brand-text-secondary truncate">
            {ticket.fields.assignee.displayName}
          </span>
        )}
      </div>
    </button>
  );
}

// --- SkeletonCards component ---

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading tickets" role="status">
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
