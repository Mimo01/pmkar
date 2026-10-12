import { useMemo } from 'react';
import { useTicketStore } from '../tickets/ticketStore';
import { readHintsEligibleNow, useHintsEligible } from '../tickets/useHintsEligible';
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

/** Map of groupId -> missing keys. Groups with nothing missing have no entry. */
export function useMissingKeysByGroup(): ReadonlyMap<number, ReadonlySet<string>> {
  const memberKeysByGroup = useGroupStore((s) => s.memberKeysByGroup);
  const tickets = useTicketStore((s) => s.tickets);
  const eligible = useHintsEligible();
  return useMemo(() => {
    const out = new Map<number, ReadonlySet<string>>();
    if (!eligible) return out;
    const liveKeys = new Set(tickets.map((t) => t.key));
    for (const [id, keys] of Object.entries(memberKeysByGroup)) {
      const missing = computeMissingKeys(keys, liveKeys, eligible);
      if (missing.size > 0) out.set(Number(id), missing);
    }
    return out;
  }, [memberKeysByGroup, tickets, eligible]);
}

/** Non-hook reader for confirm-time rechecks (a member that came back is never removed). */
export function readMissingKeysNow(groupId: number): ReadonlySet<string> {
  const keys = useGroupStore.getState().memberKeysByGroup[groupId] ?? null;
  const liveKeys = new Set(useTicketStore.getState().tickets.map((t) => t.key));
  return computeMissingKeys(keys, liveKeys, readHintsEligibleNow());
}
