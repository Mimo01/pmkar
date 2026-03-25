import type { JiraTicket } from './types';

/**
 * Returns true if the ticket is in a Done/Resolved/Closed state.
 *
 * Primary check: statusCategory.key === 'done' (Jira's canonical marker).
 * Fallback: status name contains 'done', 'resolved', or 'closed' for Jira
 * Server instances that don't return statusCategory.
 */
export function isDoneTicket(ticket: JiraTicket): boolean {
  const statusCategory = ticket.fields.status.statusCategory?.key;
  if (statusCategory !== undefined) {
    return statusCategory === 'done';
  }
  // Fallback for APIs without statusCategory
  const name = ticket.fields.status.name.toLowerCase();
  return name.includes('done') || name.includes('resolved') || name.includes('closed');
}
