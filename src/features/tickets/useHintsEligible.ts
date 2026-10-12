import { useMemo } from 'react';
import { useConnectionStore } from '../connections/connectionStore';
import { computeFetchSignature, currentFetchSignatureInput } from './fetchSignature';
import { useTicketStore } from './ticketStore';

/**
 * Whether "No longer in results" hints may be shown right now (GDUR-04, D-12..D-14).
 * True only when the latest fetch was complete AND the current query signature still
 * equals the signature that fetch used. Selectors return primitives or stable store refs
 * only (never `?? []`) to avoid render loops.
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

/** Non-hook reader for confirm-time checks. */
export function readHintsEligibleNow(): boolean {
  const stored = useTicketStore.getState().lastCompleteFetchSignature;
  if (stored === null) return false;
  const current = computeFetchSignature(
    currentFetchSignatureInput(useTicketStore.getState(), useConnectionStore.getState()),
  );
  return stored === current;
}
