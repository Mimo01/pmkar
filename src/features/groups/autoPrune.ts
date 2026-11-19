import { useEffect } from 'react';
import { useTicketStore } from '../tickets/ticketStore';
import type { JiraTicket } from '../tickets/types';
import { readHintsEligibleNow } from '../tickets/useHintsEligible';
import { isDoneStatus } from '../tickets/utils';
import { useGroupStore } from './groupStore';

/** Shared empty set: returned whenever nothing is prunable so references stay stable. */
export const EMPTY_PRUNABLE: ReadonlySet<string> = new Set<string>();

/**
 * A member is prunable only when hints are eligible (D-13) and it is missing from the live
 * tickets, its live ticket is done, or its direct parent is done (the live parent ticket
 * wins, otherwise the child's embedded fields.parent.status). No Jira request is made.
 */
export function computePrunableKeys(
  memberKeys: readonly string[] | null,
  liveByKey: ReadonlyMap<string, JiraTicket>,
  eligible: boolean,
): ReadonlySet<string> {
  if (!eligible || memberKeys === null) return EMPTY_PRUNABLE;
  const prunable = new Set<string>();
  for (const key of memberKeys) {
    const ticket = liveByKey.get(key);
    if (!ticket || isDoneStatus(ticket.fields?.status)) {
      prunable.add(key);
      continue;
    }
    const parent = ticket.fields?.parent;
    if (parent?.key) {
      const liveParent = liveByKey.get(parent.key);
      const parentStatus = liveParent ? liveParent.fields?.status : parent.fields?.status;
      if (isDoneStatus(parentStatus)) prunable.add(key);
    }
  }
  return prunable.size === 0 ? EMPTY_PRUNABLE : prunable;
}

/** Non-hook reader for confirm-time rechecks (a member that came back is never removed). */
export function readPrunableKeysNow(groupId: number): ReadonlySet<string> {
  const keys = useGroupStore.getState().memberKeysByGroup[groupId] ?? null;
  const liveByKey = new Map(useTicketStore.getState().tickets.map((t) => [t.key, t] as const));
  return computePrunableKeys(keys, liveByKey, readHintsEligibleNow());
}

let pruning = false;
let rerunRequested = false;

/**
 * Auto-removal: drops group membership for tickets Jira no longer returns, tickets that are
 * done, and children of a done parent. Every group is
 * gated by readPrunableKeysNow at call time (after each await), which enforces the same
 * eligibility rule as the former hints (complete, matching-signature, non-loading fetch).
 * Failures are silent and never reject.
 */
export async function pruneGroupMembers(): Promise<void> {
  if (pruning) {
    rerunRequested = true;
    return;
  }
  pruning = true;
  try {
    if (!useGroupStore.getState().hydrated) return;
    const groupIds = Object.keys(useGroupStore.getState().memberKeysByGroup).map(Number);
    for (const id of groupIds) {
      const keys = readPrunableKeysNow(id);
      if (keys.size === 0) continue;
      try {
        const res = await useGroupStore.getState().removeFromGroup(id, [...keys]);
        if (!res.ok) console.warn('auto-prune group members failed', id, res.code);
      } catch (err) {
        console.warn('auto-prune group members failed', id, err);
      }
    }
  } finally {
    pruning = false;
    if (rerunRequested) {
      rerunRequested = false;
      void pruneGroupMembers();
    }
  }
}

/** Mount once at app level: prunes whenever tickets, fetch state or memberships change. */
export function useAutoPruneGroupMembers(): void {
  const tickets = useTicketStore((s) => s.tickets);
  const signature = useTicketStore((s) => s.lastCompleteFetchSignature);
  const fetchStatus = useTicketStore((s) => s.fetchStatus);
  const memberKeysByGroup = useGroupStore((s) => s.memberKeysByGroup);
  const hydrated = useGroupStore((s) => s.hydrated);
  // biome-ignore lint/correctness/useExhaustiveDependencies: values are triggers; eligibility is re-read at call time
  useEffect(() => {
    void pruneGroupMembers();
  }, [tickets, signature, fetchStatus, memberKeysByGroup, hydrated]);
}
