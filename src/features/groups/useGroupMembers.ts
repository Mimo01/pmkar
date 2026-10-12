import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTicketStore } from '../tickets/ticketStore';
import type { JiraTicket } from '../tickets/types';
import { useHintsEligible } from '../tickets/useHintsEligible';
import { useGroupStore } from './groupStore';
import { computeMissingKeys } from './missingMembers';

/**
 * Shape guard for tickets parsed from stored snapshots. TicketCard, filterTickets and
 * sortTickets dereference these fields unguarded. `created` is optional in JiraTicket
 * (older cached tickets) and handled by consumers, so it is not required here.
 */
export function isRenderableTicket(x: unknown): x is JiraTicket {
  if (typeof x !== 'object' || x === null) return false;
  const t = x as { key?: unknown; fields?: unknown };
  if (typeof t.key !== 'string') return false;
  if (typeof t.fields !== 'object' || t.fields === null) return false;
  const f = t.fields as {
    summary?: unknown;
    status?: { name?: unknown } | null;
    priority?: { id?: unknown; name?: unknown } | null;
    created?: unknown;
    updated?: unknown;
  };
  if (typeof f.summary !== 'string') return false;
  if (typeof f.status !== 'object' || f.status === null || typeof f.status.name !== 'string')
    return false;
  if (
    typeof f.priority !== 'object' ||
    f.priority === null ||
    typeof f.priority.id !== 'string' ||
    typeof f.priority.name !== 'string'
  )
    return false;
  if (typeof f.updated !== 'string') return false;
  if (f.created !== undefined && typeof f.created !== 'string') return false;
  return true;
}

export function useGroupMembers(groupId: number): {
  keys: string[] | null;
  members: JiraTicket[];
  loading: boolean;
  /** Loading stored snapshots failed for the current keys. */
  error: boolean;
  /** Some members could not be shown (load failure or unreadable snapshot, no live ticket). */
  incomplete: boolean;
  /**
   * Members absent from the latest complete fetch (D-01). Empty when hints are not
   * eligible (D-13). `members` still includes them (D-08).
   */
  missingKeys: ReadonlySet<string>;
  retry: () => void;
} {
  // null fallback only: a fresh [] inside a selector causes an infinite re-render loop.
  const keys = useGroupStore((s) => s.memberKeysByGroup[groupId] ?? null);
  const tickets = useTicketStore((s) => s.tickets);
  const snapshotRevision = useGroupStore((s) => s.snapshotRevision);
  const eligible = useHintsEligible();
  // forKeys records which keys reference the snapshots were loaded for, so a stale
  // result (keys changed, refetch pending) is never reported as incomplete.
  const [result, setResult] = useState<{
    forKeys: string[];
    map: Record<string, JiraTicket>;
    error: boolean;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const snapshots = result?.map ?? null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is a retry trigger and snapshotRevision a silent reload trigger (result is kept until the new one lands)
  useEffect(() => {
    if (keys === null || keys.length === 0) return;
    let cancelled = false;
    useGroupStore
      .getState()
      .getGroupMembers(groupId)
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, JiraTicket> = {};
        if (!res.ok) {
          console.warn(`[groups] failed to load group members for group ${groupId}: ${res.code}`);
          setResult({ forKeys: keys, map, error: true });
          return;
        }
        for (const m of res.value) {
          try {
            const parsed: unknown = JSON.parse(m.ticketJson);
            if (isRenderableTicket(parsed)) {
              map[m.issueKey] = parsed;
              continue;
            }
          } catch {
            // fall through to warning
          }
          console.warn(`[groups] skipping unreadable snapshot for ${m.issueKey}`);
        }
        setResult({ forKeys: keys, map, error: false });
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, keys, attempt, snapshotRevision]);

  const members = useMemo(() => {
    if (keys === null) return [];
    const live = new Map(tickets.map((t) => [t.key, t]));
    const out: JiraTicket[] = [];
    for (const key of keys) {
      // D-14: absent members render from the stored snapshot. Only a member with an
      // unparseable snapshot and no live ticket is skipped (user decision).
      const ticket = live.get(key) ?? snapshots?.[key];
      if (ticket) out.push(ticket);
    }
    return out;
  }, [keys, tickets, snapshots]);

  const missingKeys = useMemo(
    () => computeMissingKeys(keys, new Set(tickets.map((t) => t.key)), eligible),
    [keys, tickets, eligible],
  );

  const loading =
    keys !== null && keys.length > 0 && snapshots === null && members.length < keys.length;
  const fresh = result !== null && keys !== null && result.forKeys === keys;
  const error = fresh && result.error;
  const incomplete = fresh && members.length < keys.length;

  const retry = useCallback(() => {
    setResult(null);
    setAttempt((a) => a + 1);
  }, []);

  return { keys, members, loading, error, incomplete, missingKeys, retry };
}
