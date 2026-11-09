import { useEffect } from 'react';
import { useTicketStore } from '../tickets/ticketStore';
import { readHintsEligibleNow } from '../tickets/useHintsEligible';
import { useGroupStore } from './groupStore';

/** Shared empty set: returned whenever nothing is missing so references stay stable. */
export const EMPTY_MISSING: ReadonlySet<string> = new Set<string>();

/**
 * D-01: a member is missing only when hints are eligible (D-13) and its key is absent
 * from the live tickets. Key-only test; no Jira request is made.
 */
export function computeMissingKeys(
  memberKeys: readonly string[] | null,
  liveKeys: ReadonlySet<string>,
  eligible: boolean,
): ReadonlySet<string> {
  if (!eligible || memberKeys === null) return EMPTY_MISSING;
  const missing = new Set<string>();
  for (const key of memberKeys) {
    if (!liveKeys.has(key)) missing.add(key);
  }
  return missing.size === 0 ? EMPTY_MISSING : missing;
}

/** Non-hook reader for confirm-time rechecks (a member that came back is never removed). */
export function readMissingKeysNow(groupId: number): ReadonlySet<string> {
  const keys = useGroupStore.getState().memberKeysByGroup[groupId] ?? null;
  const liveKeys = new Set(useTicketStore.getState().tickets.map((t) => t.key));
  return computeMissingKeys(keys, liveKeys, readHintsEligibleNow());
}

let pruning = false;
let rerunRequested = false;

/**
 * Auto-removal: drops group membership for tickets Jira no longer returns. Every group is
 * gated by readMissingKeysNow at call time (after each await), which enforces the same
 * eligibility rule as the former hints (complete, matching-signature, non-loading fetch).
 * Failures are silent and never reject.
 */
export async function pruneMissingMembers(): Promise<void> {
  if (pruning) {
    rerunRequested = true;
    return;
  }
  pruning = true;
  try {
    if (!useGroupStore.getState().hydrated) return;
    const groupIds = Object.keys(useGroupStore.getState().memberKeysByGroup).map(Number);
    for (const id of groupIds) {
      const keys = readMissingKeysNow(id);
      if (keys.size === 0) continue;
      try {
        const res = await useGroupStore.getState().removeFromGroup(id, [...keys]);
        if (!res.ok) console.warn('auto-remove missing members failed', id, res.code);
      } catch (err) {
        console.warn('auto-remove missing members failed', id, err);
      }
    }
  } finally {
    pruning = false;
    if (rerunRequested) {
      rerunRequested = false;
      void pruneMissingMembers();
    }
  }
}

/** Mount once at app level: prunes whenever tickets, fetch state or memberships change. */
export function useAutoRemoveMissingMembers(): void {
  const tickets = useTicketStore((s) => s.tickets);
  const signature = useTicketStore((s) => s.lastCompleteFetchSignature);
  const fetchStatus = useTicketStore((s) => s.fetchStatus);
  const memberKeysByGroup = useGroupStore((s) => s.memberKeysByGroup);
  const hydrated = useGroupStore((s) => s.hydrated);
  // biome-ignore lint/correctness/useExhaustiveDependencies: values are triggers; eligibility is re-read at call time
  useEffect(() => {
    void pruneMissingMembers();
  }, [tickets, signature, fetchStatus, memberKeysByGroup, hydrated]);
}
