import type { JiraStatus, JiraTicket } from './types';

/**
 * Returns true if the status is a Done/Resolved/Closed state.
 *
 * Primary check: statusCategory.key === 'done' (Jira's canonical marker).
 * Fallback: status name contains 'done', 'resolved', or 'closed' for Jira
 * Server instances that don't return statusCategory.
 * A missing status or name is treated as not done.
 */
export function isDoneStatus(status: JiraStatus | null | undefined): boolean {
  if (!status) return false;
  const statusCategory = status.statusCategory?.key;
  if (statusCategory !== undefined) {
    return statusCategory === 'done';
  }
  if (typeof status.name !== 'string') return false;
  const name = status.name.toLowerCase();
  return name.includes('done') || name.includes('resolved') || name.includes('closed');
}

/** Returns true if the ticket is in a Done/Resolved/Closed state. */
export function isDoneTicket(ticket: JiraTicket): boolean {
  return isDoneStatus(ticket.fields?.status);
}
