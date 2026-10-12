import { useTicketStore } from '../tickets/ticketStore';
import type { JiraTicket, JiraTicketDetail } from '../tickets/types';

/**
 * Convert a full ticket detail to the list-card JiraTicket shape. Heavy fields
 * (large text, comments, attachments, changelog) are dropped so the snapshot
 * persisted by add_issues_to_group stays small.
 */
export function detailToTicket(detail: JiraTicketDetail): JiraTicket {
  const { summary, status, priority, assignee, created, updated } = detail.fields;
  return {
    id: detail.id,
    key: detail.key,
    fields: {
      summary,
      status,
      priority,
      assignee,
      ...(created !== undefined ? { created } : {}),
      updated,
    },
  };
}

/** Prefer the list ticket (same shape as cards), else derive from the loaded detail. */
export function resolveTicketForIssue(
  issueKey: string,
  detail: JiraTicketDetail | null,
): JiraTicket | null {
  const fromStore = useTicketStore.getState().tickets.find((t) => t.key === issueKey);
  if (fromStore) return fromStore;
  return detail ? detailToTicket(detail) : null;
}
