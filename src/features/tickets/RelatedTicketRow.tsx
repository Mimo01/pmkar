import { PriorityIcon } from './PriorityIcon';
import { StatusBadge } from './StatusBadge';
import { useTicketStore } from './ticketStore';
import type { JiraRelatedIssue } from './types';
import { UserAvatar } from './UserAvatar';

interface RelatedTicketRowProps {
  issue: JiraRelatedIssue;
  compact?: boolean;
  interactive?: boolean;
}

export function RelatedTicketRow({
  issue,
  compact = false,
  interactive = true,
}: RelatedTicketRowProps) {
  const layout = compact ? 'gap-2 py-0.5 px-1.5' : 'gap-2.5 py-1.5 px-3';
  const base = `flex items-center ${layout} rounded-md`;
  const summarySize = compact ? 'text-xs' : 'text-sm';
  const statusName = issue.fields?.status?.name;
  // Jira's embedded parent/sub-task data has no assignee, so take it (and a
  // fallback priority) from the loaded list when that ticket is in it.
  const listed = useTicketStore((s) => s.tickets.find((tk) => tk.key === issue.key) ?? null);
  const priorityName = issue.fields?.priority?.name ?? listed?.fields.priority?.name;

  const content = (
    <>
      <span className="text-xs font-mono text-brand-text-secondary">{issue.key}</span>
      <span className={`${summarySize} text-brand-text-secondary truncate flex-1`}>
        {issue.fields?.summary ?? ''}
      </span>
      {compact && priorityName && <PriorityIcon priority={priorityName} size="sm" />}
      {compact && listed?.fields.assignee && (
        <span className="flex items-center gap-1 min-w-0">
          <UserAvatar user={listed.fields.assignee} size="sm" />
          <span className="text-xs text-brand-text-secondary truncate max-w-[8rem]">
            {listed.fields.assignee.displayName}
          </span>
        </span>
      )}
      {statusName && <StatusBadge status={statusName} />}
    </>
  );

  if (!interactive) {
    return <div className={base}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={`${base} w-full cursor-pointer text-left hover:bg-brand-border transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring`}
      onClick={(e) => {
        e.stopPropagation();
        useTicketStore.getState().selectTicket(issue.key);
      }}
    >
      {content}
    </button>
  );
}
