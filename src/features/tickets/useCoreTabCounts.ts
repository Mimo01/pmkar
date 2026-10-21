import { useMemo } from 'react';
import type { CoreTab } from '../groups/groupTabs';
import { isWatchedCandidate } from './ticketListUtils';
import { useTicketStore } from './ticketStore';

/**
 * Counts shown as pills on core nav tabs. Only the Watched tab carries a count (D-01):
 * exactly the tickets the Watched page lists, before any filters.
 */
export function useCoreTabCounts(): Partial<Record<CoreTab, number>> {
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);
  return useMemo(
    () => ({ watched: tickets.filter((t) => isWatchedCandidate(t, triageMap)).length }),
    [tickets, triageMap],
  );
}
