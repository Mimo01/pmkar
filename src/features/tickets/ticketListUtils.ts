import type { JiraTicket, TriageEntry } from './types';
import { isDoneTicket } from './utils';

/** Fields the ticket lists can be sorted by. */
export type TicketSortField = 'updated' | 'key' | 'created' | 'priority' | 'status' | 'assignee';

/** Sort direction for ticket lists. */
export type SortDirection = 'asc' | 'desc';

/**
 * New tab predicate: not ignored / copied / handled / watched, and not done.
 */
export function isNewCandidate(
  ticket: JiraTicket,
  triageMap: Record<string, TriageEntry>,
): boolean {
  const s = triageMap[ticket.key]?.state;
  return (
    s !== 'ignored' && s !== 'copied' && s !== 'handled' && s !== 'watched' && !isDoneTicket(ticket)
  );
}

/**
 * Not mine tab predicate: ignored or handled, and not done.
 */
export function isNotMineCandidate(
  ticket: JiraTicket,
  triageMap: Record<string, TriageEntry>,
): boolean {
  const s = triageMap[ticket.key]?.state;
  return (s === 'ignored' || s === 'handled') && !isDoneTicket(ticket);
}

/**
 * Linked tab predicate: copied, and not done.
 */
export function isLinkedCandidate(
  ticket: JiraTicket,
  triageMap: Record<string, TriageEntry>,
): boolean {
  return triageMap[ticket.key]?.state === 'copied' && !isDoneTicket(ticket);
}

/**
 * Watched tab predicate: watched, and not done.
 */
export function isWatchedCandidate(
  ticket: JiraTicket,
  triageMap: Record<string, TriageEntry>,
): boolean {
  return triageMap[ticket.key]?.state === 'watched' && !isDoneTicket(ticket);
}

/**
 * Filters by key substring (case-insensitive) and by exact assignee display name
 * (case-insensitive). Empty strings disable the respective filter.
 */
export function filterTickets(
  tickets: readonly JiraTicket[],
  searchText: string,
  assigneeFilter: string,
): JiraTicket[] {
  let filtered: readonly JiraTicket[] = tickets;
  if (searchText.length > 0) {
    const lower = searchText.toLowerCase();
    filtered = filtered.filter((ticket) => ticket.key.toLowerCase().includes(lower));
  }
  if (assigneeFilter.length > 0) {
    const assigneeLower = assigneeFilter.toLowerCase();
    filtered = filtered.filter(
      (ticket) => (ticket.fields.assignee?.displayName ?? '').toLowerCase() === assigneeLower,
    );
  }
  return [...filtered];
}

/**
 * Returns a sorted copy of the tickets. Does not mutate the input.
 */
export function sortTickets(
  tickets: readonly JiraTicket[],
  sortField: TicketSortField,
  sortDirection: SortDirection,
): JiraTicket[] {
  return [...tickets].sort((a, b) => {
    let diff: number;
    if (sortField === 'key') {
      const parse = (k: string) => {
        const m = k.match(/^(.*)-(\d+)$/);
        return m ? { proj: m[1], num: parseInt(m[2], 10) } : { proj: k, num: 0 };
      };
      const ka = parse(a.key);
      const kb = parse(b.key);
      diff = ka.proj !== kb.proj ? ka.proj.localeCompare(kb.proj) : ka.num - kb.num;
    } else if (sortField === 'created') {
      const ta = a.fields.created ?? a.fields.updated;
      const tb = b.fields.created ?? b.fields.updated;
      diff = new Date(ta).getTime() - new Date(tb).getTime();
    } else if (sortField === 'priority') {
      diff = parseInt(a.fields.priority.id, 10) - parseInt(b.fields.priority.id, 10);
    } else if (sortField === 'status') {
      diff = a.fields.status.name.localeCompare(b.fields.status.name);
    } else if (sortField === 'assignee') {
      diff = (a.fields.assignee?.displayName ?? '').localeCompare(
        b.fields.assignee?.displayName ?? '',
      );
    } else {
      diff = new Date(a.fields.updated).getTime() - new Date(b.fields.updated).getTime();
    }
    return sortDirection === 'asc' ? diff : -diff;
  });
}
