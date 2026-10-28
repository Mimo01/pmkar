import { useEffect, useMemo, useState } from 'react';
import { groupBadgeKey } from '../groups/groupBadge';
import { useGroupStore } from '../groups/groupStore';
import { isRenderableTicket } from '../groups/useGroupMembers';
import { useTicketStore } from '../tickets/ticketStore';
import type { JiraTicket, TriageEntry } from '../tickets/types';
import type { CorpusItem, SearchCategory } from './types';

/** Category for a ticket, derived from the same predicates the tabs use. Done -> null. */
export function categoryFor(
  ticket: JiraTicket,
  triageMap: Record<string, TriageEntry>,
): SearchCategory | null {
  switch (groupBadgeKey(ticket, triageMap)) {
    case 'nav.new':
      return 'new';
    case 'nav.notMine':
      return 'dismissed';
    case 'nav.linked':
      return 'linked';
    case 'nav.watched':
      return 'watched';
    default:
      return null;
  }
}

/**
 * All known tickets (live plus snapshot-only group members) with category and linked key.
 * Snapshots load lazily, only once `enabled` is true.
 */
export function useSearchCorpus(enabled: boolean): { items: CorpusItem[]; ready: boolean } {
  const tickets = useTicketStore((s) => s.tickets);
  const triageMap = useTicketStore((s) => s.triageMap);
  const lastFetchedAt = useTicketStore((s) => s.lastFetchedAt);
  const memberKeysByGroup = useGroupStore((s) => s.memberKeysByGroup);
  const snapshotRevision = useGroupStore((s) => s.snapshotRevision);
  const [snap, setSnap] = useState<{
    forMembers: Record<number, string[]>;
    map: Record<string, JiraTicket>;
  } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: snapshotRevision is a silent reload trigger
  useEffect(() => {
    if (!enabled) return;
    const groupIds = Object.keys(memberKeysByGroup)
      .map(Number)
      .filter((id) => memberKeysByGroup[id].length > 0);
    if (groupIds.length === 0) {
      setSnap({ forMembers: memberKeysByGroup, map: {} });
      return;
    }
    let cancelled = false;
    Promise.all(groupIds.map((id) => useGroupStore.getState().getGroupMembers(id))).then(
      (results) => {
        if (cancelled) return;
        const map: Record<string, JiraTicket> = {};
        results.forEach((res, i) => {
          if (!res.ok) {
            console.warn(
              `[search] failed to load group members for group ${groupIds[i]}: ${res.code}`,
            );
            return;
          }
          for (const m of res.value) {
            if (map[m.issueKey]) continue;
            try {
              const parsed: unknown = JSON.parse(m.ticketJson);
              if (isRenderableTicket(parsed)) {
                map[m.issueKey] = parsed;
                continue;
              }
            } catch {
              // fall through to warning
            }
            console.warn(`[search] skipping unreadable snapshot for ${m.issueKey}`);
          }
        });
        setSnap({ forMembers: memberKeysByGroup, map });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, memberKeysByGroup, snapshotRevision]);

  const items = useMemo(() => {
    const out: CorpusItem[] = [];
    const seen = new Set<string>();
    const push = (ticket: JiraTicket) => {
      out.push({
        ticket,
        category: categoryFor(ticket, triageMap),
        copiedKey: triageMap[ticket.key]?.copiedKey ?? null,
      });
    };
    for (const t of tickets) {
      if (seen.has(t.key)) continue;
      seen.add(t.key);
      push(t);
    }
    if (enabled && snap) {
      for (const keys of Object.values(memberKeysByGroup)) {
        for (const key of keys) {
          if (seen.has(key)) continue;
          const t = snap.map[key];
          if (!t) continue;
          seen.add(key);
          push(t);
        }
      }
    }
    return out;
  }, [enabled, tickets, triageMap, memberKeysByGroup, snap]);

  const noMemberKeys = Object.values(memberKeysByGroup).every((k) => k.length === 0);
  const ready =
    enabled &&
    (lastFetchedAt !== null || tickets.length > 0 || items.length > 0) &&
    (noMemberKeys || snap?.forMembers === memberKeysByGroup);

  return { items, ready };
}
