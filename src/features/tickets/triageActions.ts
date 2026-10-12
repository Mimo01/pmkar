import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import i18n from '../../i18n/index';
import { useTicketStore } from './ticketStore';
import type { TriageEntry } from './types';

/** Restore a dismissed/handled ticket to the 'seen' triage state (shared by Dismissed page and group view). */
export function restoreTicket(issueKey: string): void {
  const prev: TriageEntry | undefined = useTicketStore.getState().triageMap[issueKey];
  const optimistic: TriageEntry = { state: 'seen', copiedKey: null };
  useTicketStore.getState().hydrateTriageMap({
    ...useTicketStore.getState().triageMap,
    [issueKey]: optimistic,
  });
  invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {
    const current = useTicketStore.getState().triageMap;
    // Roll back only if nothing has changed this entry since the optimistic update.
    if (current[issueKey] === optimistic) {
      const next = { ...current };
      if (prev === undefined) delete next[issueKey];
      else next[issueKey] = prev;
      useTicketStore.getState().hydrateTriageMap(next);
    }
    toast.error(i18n.t('ignored.restoreFailed'));
  });
}
