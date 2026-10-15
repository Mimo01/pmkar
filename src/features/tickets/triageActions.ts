import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { announce } from '../../components/LiveAnnouncer';
import i18n from '../../i18n/index';
import { useConnectionStore } from '../connections/connectionStore';
import { useCopyStore } from './copyStore';
import { useTicketStore } from './ticketStore';
import type { JiraTicketDetail, TriageEntry, TriageState } from './types';

/** Show a failure toast and mirror it to the live region (D-03, D-05). */
function notifyError(text: string): void {
  toast.error(text);
  announce(text);
}

/** Single writer of triage map entries (D-10, D-12). */
function writeEntry(issueKey: string, entry: TriageEntry): void {
  useTicketStore.getState().hydrateTriageMap({
    ...useTicketStore.getState().triageMap,
    [issueKey]: entry,
  });
}

/**
 * Optimistic state transition that carries the remembered Cloud key (D-09, LINT-01)
 * and persists only via set_triage_state (D-04, RTRI-02). Rolls back only if the
 * entry is still the optimistic object (D-05).
 */
async function applyState(
  issueKey: string,
  state: TriageState,
  failKey: string,
): Promise<{ ok: boolean; prev: TriageEntry | undefined }> {
  const prev: TriageEntry | undefined = useTicketStore.getState().triageMap[issueKey];
  const optimistic: TriageEntry = { state, copiedKey: prev?.copiedKey ?? null };
  writeEntry(issueKey, optimistic);
  try {
    await invoke('set_triage_state', { ticketKey: issueKey, state });
    return { ok: true, prev };
  } catch {
    const current = useTicketStore.getState().triageMap;
    if (current[issueKey] === optimistic) {
      const next = { ...current };
      if (prev === undefined) delete next[issueKey];
      else next[issueKey] = prev;
      useTicketStore.getState().hydrateTriageMap(next);
    }
    notifyError(i18n.t(failKey));
    return { ok: false, prev };
  }
}

/** Undo a deny: relink using the DB-returned key only (D-02, D-03, T-35-03). */
async function undoDeny(issueKey: string): Promise<void> {
  try {
    const key = await invoke<string | null>('relink_ticket', { ticketKey: issueKey });
    if (typeof key === 'string' && key) {
      writeEntry(issueKey, { state: 'copied', copiedKey: key });
      announce(i18n.t('a11y.undone', { key: issueKey, cloudKey: key }));
      return;
    }
  } catch {
    // fall through to the failure toast
  }
  notifyError(i18n.t('triage.undoFailed', { key: issueKey }));
}

/**
 * Move a ticket to Ignored without touching Jira (D-04, RTRI-02). On success with a
 * remembered key, shows an 8 s Undo toast (D-01, RTRI-03).
 */
export async function denyTicket(issueKey: string): Promise<boolean> {
  const { ok, prev } = await applyState(issueKey, 'ignored', 'triage.denyFailed');
  if (ok) announce(i18n.t('a11y.denied', { key: issueKey }));
  if (ok && prev?.copiedKey) {
    toast(i18n.t('triage.denied', { key: issueKey }), {
      id: `deny-${issueKey}`,
      duration: 8000,
      action: {
        label: i18n.t('triage.undo'),
        onClick: () => {
          void undoDeny(issueKey);
        },
      },
    });
  }
  return ok;
}

/** Restore a dismissed/handled ticket to 'seen', keeping its Cloud key (D-09). */
export async function restoreTicket(issueKey: string): Promise<boolean> {
  const { ok } = await applyState(issueKey, 'seen', 'ignored.restoreFailed');
  if (ok) announce(i18n.t('a11y.restored', { key: issueKey }));
  return ok;
}

/** Mark a ticket handled, keeping its Cloud key (D-09). */
export async function markHandled(issueKey: string): Promise<boolean> {
  const { ok } = await applyState(issueKey, 'handled', 'triage.handleFailed');
  if (ok) announce(i18n.t('a11y.handled', { key: issueKey }));
  return ok;
}

export type LinkResult = 'relinked' | 'needs-copy' | 'failed';

/**
 * Link a ticket to its remembered Cloud issue, or hand off to the copy preview when
 * none exists (D-06, D-07). Not optimistic (D-08).
 */
export async function linkTicket(issueKey: string, detail?: JiraTicketDetail): Promise<LinkResult> {
  let key: string | null;
  try {
    key = await invoke<string | null>('relink_ticket', { ticketKey: issueKey });
  } catch {
    notifyError(i18n.t('triage.linkFailed'));
    return 'failed';
  }
  if (typeof key === 'string' && key) {
    writeEntry(issueKey, { state: 'copied', copiedKey: key });
    toast.dismiss(`deny-${issueKey}`);
    announce(i18n.t('a11y.linked', { key: issueKey, cloudKey: key }));
    return 'relinked';
  }
  const serverBase = useConnectionStore.getState().serverConnection?.baseUrl ?? '';
  const cloudBase = useConnectionStore.getState().cloudConnection?.baseUrl ?? '';
  let resolved = detail;
  if (!resolved) {
    try {
      resolved = await invoke<JiraTicketDetail>('fetch_ticket_detail', {
        baseUrl: serverBase,
        issueKey,
      });
    } catch {
      notifyError(i18n.t('triage.linkFailed'));
      return 'failed';
    }
  }
  void useCopyStore.getState().startPreview(resolved, serverBase, cloudBase);
  return 'needs-copy';
}
