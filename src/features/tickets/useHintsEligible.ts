import { useConnectionStore } from '../connections/connectionStore';
import { computeFetchSignature, currentFetchSignatureInput } from './fetchSignature';
import { useTicketStore } from './ticketStore';

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
