import { useMemo } from 'react';
import { useConnectionStore } from '../connections/connectionStore';
import { computeFetchSignature, currentFetchSignatureInput } from './fetchSignature';
import { useTicketStore } from './ticketStore';

/**
 * Whether "No longer in results" hints may be shown right now (GDUR-04, D-12..D-14).
 * True only when the latest fetch was complete AND the current query signature still
 * equals the signature that fetch used. Selectors return primitives or stable store refs
 * only (never `?? []`) to avoid render loops.
 *
 * It intentionally ignores fetchStatus, so the missing block does not flicker on
 * background polls; removal safety during loading comes from readHintsEligibleNow (WR-06).
 */
export function useHintsEligible(): boolean {
  const stored = useTicketStore((s) => s.lastCompleteFetchSignature);
  const jqlPreset = useTicketStore((s) => s.jqlPreset);
  const jqlCustom = useTicketStore((s) => s.jqlCustom);
  const watchedUsers = useTicketStore((s) => s.watchedUsers);
  const baseUrl = useConnectionStore((s) => s.serverConnection?.baseUrl ?? null);
  const username = useConnectionStore((s) => s.serverConnection?.username ?? null);
  const sourceProjectKey = useConnectionStore((s) => s.sourceProjectKey);

  return useMemo(() => {
    if (stored === null) return false;
    const current = computeFetchSignature({
      baseUrl,
      username,
      preset: jqlPreset,
      custom: jqlCustom,
      projectKey: sourceProjectKey,
      watchedIdentifiers: watchedUsers.map((u) => u.identifier),
    });
    return stored === current;
  }, [stored, jqlPreset, jqlCustom, watchedUsers, baseUrl, username, sourceProjectKey]);
}

/**
 * WR-08: true while a fetch is in flight. Removal triggers and confirm buttons are disabled
 * for this window, because readHintsEligibleNow() aborts every removal while loading and a
 * clickable-but-inert destructive button would be a silent no-op.
 */
export function useRemovalBlockedByFetch(): boolean {
  return useTicketStore((s) => s.fetchStatus === 'loading');
}

/**
 * Non-hook reader for confirm-time checks. While a fetch is in flight the last list is
 * not authoritative, so this returns false and every removal recheck aborts (WR-06,
 * T-32-23).
 */
export function readHintsEligibleNow(): boolean {
  const s = useTicketStore.getState();
  if (s.fetchStatus === 'loading' || s.lastCompleteFetchSignature === null) return false;
  const current = computeFetchSignature(
    currentFetchSignatureInput(s, useConnectionStore.getState()),
  );
  return s.lastCompleteFetchSignature === current;
}
