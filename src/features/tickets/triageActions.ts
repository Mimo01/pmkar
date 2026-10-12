import { invoke } from '@tauri-apps/api/core';
import { useTicketStore } from './ticketStore';

/** Restore a dismissed/handled ticket to the 'seen' triage state (shared by Dismissed page and group view). */
export function restoreTicket(issueKey: string): void {
  invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {});
  useTicketStore.getState().hydrateTriageMap({
    ...useTicketStore.getState().triageMap,
    [issueKey]: { state: 'seen', copiedKey: null },
  });
}
