import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '../../lib/format';
import type { JiraTicket, TriageEntry } from './types';

// --- Sub-components ---

function StatusDot({ status }: { status: string }) {
  const lower = status.toLowerCase();
  let colorClass = 'bg-brand-muted'; // default: To Do / Open
  if (lower.includes('progress') || lower.includes('review')) colorClass = 'bg-blue-600';
  if (lower.includes('done') || lower.includes('resolved') || lower.includes('closed')) colorClass = 'bg-green-600';
  if (lower.includes('blocked')) colorClass = 'bg-red-600';
  return (
    <span className="flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full ${colorClass}`} aria-hidden="true" />
      <span className="text-xs text-brand-text-secondary">{status}</span>
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const lower = priority.toLowerCase();
  let color = 'var(--color-brand-muted)'; // Lowest
  if (lower === 'highest' || lower === 'critical') color = '#dc2626';
  if (lower === 'high') color = '#ea580c';
  if (lower === 'medium') color = '#ca8a04';
  if (lower === 'low') color = '#3b82f6';
  return (
    <span
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
      aria-label={priority}
    />
  );
}

// --- TicketCard props interface ---

interface TicketCardProps {
  ticket: JiraTicket;
  triageEntry?: TriageEntry;
  onClick: () => void;
  actionSlot?: React.ReactNode; // Restore button (ignored), linked key badge (linked)
}

// --- TicketCard component ---

export function TicketCard({ ticket, onClick, actionSlot }: TicketCardProps) {
  return (
    <div
      onClick={onClick}
      className="px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-brand-surface-hover border-b border-brand-border"
    >
      {/* Line 1: ticket key + relative time */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-brand-muted">{ticket.key}</span>
        <div className="flex items-center gap-2">
          {actionSlot}
          <span className="text-xs text-brand-muted">{formatRelativeTime(ticket.fields.updated)}</span>
        </div>
      </div>
      {/* Line 2: summary */}
      <p className="text-sm font-semibold text-brand-text leading-snug line-clamp-1 mb-1">
        {ticket.fields.summary}
      </p>
      {/* Line 3: metadata row */}
      <div className="flex items-center gap-2">
        <StatusDot status={ticket.fields.status.name} />
        <PriorityDot priority={ticket.fields.priority.name} />
        <span className="text-xs text-brand-text-secondary truncate">
          {ticket.fields.assignee?.displayName ?? ''}
        </span>
      </div>
    </div>
  );
}

// --- SkeletonCards component ---

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading tickets">
      {Array.from({ length: count }).map((_, i) => (
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
