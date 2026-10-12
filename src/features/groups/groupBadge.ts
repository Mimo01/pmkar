import { isLinkedCandidate, isNewCandidate, isNotMineCandidate } from '../tickets/ticketListUtils';
import type { JiraTicket, TriageEntry } from '../tickets/types';

export type GroupBadgeKey = 'nav.new' | 'nav.notMine' | 'nav.linked' | 'groups.badge.done';

/** Pill key following the core-tab predicates; done is the fall-through (all three exclude done). */
export function groupBadgeKey(
  ticket: JiraTicket,
  triageMap: Record<string, TriageEntry>,
): GroupBadgeKey {
  if (isNotMineCandidate(ticket, triageMap)) return 'nav.notMine';
  if (isLinkedCandidate(ticket, triageMap)) return 'nav.linked';
  if (isNewCandidate(ticket, triageMap)) return 'nav.new';
  return 'groups.badge.done';
}
