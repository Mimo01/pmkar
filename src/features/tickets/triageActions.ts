import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { announce } from '../../components/LiveAnnouncer';
import i18n from '../../i18n/index';
import { useConnectionStore } from '../connections/connectionStore';
import { useCopyStore } from './copyStore';
import { useTicketStore } from './ticketStore';
import type { JiraTicketDetail, TriageEntry, TriageState } from './types';

/** How long the deny Undo toast stays visible. */
export const UNDO_TOAST_MS = 8000;

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

interface PersistRecord {
  /** Last entry known to be persisted (undefined if none). */
  base: TriageEntry | undefined;
  /** Never-rejecting tail of the per-key invoke chain. */
  tail: Promise<void>;
  count: number;
}

/** Per-key serialization of set_triage_state writes (35 WR-02). */
const records = new Map<string, PersistRecord>();

/**
 * Optimistic state transition that carries the remembered Cloud key (D-09, LINT-01)
 * and persists only via set_triage_state (D-04, RTRI-02). Writes for one key run in
 * order; a failure rolls back to the last persisted entry, and only if the store
 * entry is still this call's optimistic object (D-05).
 */
async function applyState(
  issueKey: string,
  state: TriageState,
  failKey: string,
): Promise<{ ok: boolean; prev: TriageEntry | undefined }> {
  const prev: TriageEntry | undefined = useTicketStore.getState().triageMap[issueKey];
  let record = records.get(issueKey);
  if (!record) {
    record = { base: prev, tail: Promise.resolve(), count: 0 };
    records.set(issueKey, record);
  }
  const rec = record;
  const optimistic: TriageEntry = { state, copiedKey: prev?.copiedKey ?? null };
  writeEntry(issueKey, optimistic);
  const persist = () => invoke('set_triage_state', { ticketKey: issueKey, state });
  const run: Promise<unknown> = rec.count === 0 ? persist() : rec.tail.then(persist);
  rec.count += 1;
  rec.tail = run.then(
    () => undefined,
    () => undefined,
  );
  try {
    await run;
    rec.base = optimistic;
    return { ok: true, prev };
  } catch {
    const current = useTicketStore.getState().triageMap;
    if (current[issueKey] === optimistic) {
      const next = { ...current };
      if (rec.base === undefined) delete next[issueKey];
      else next[issueKey] = rec.base;
      useTicketStore.getState().hydrateTriageMap(next);
    }
    notifyError(i18n.t(failKey));
    return { ok: false, prev };
  } finally {
    rec.count -= 1;
    if (rec.count === 0) records.delete(issueKey);
  }
}

/** Undo a deny: relink using the DB-returned key only (D-02, D-03, T-35-03). */
async function undoDeny(issueKey: string): Promise<void> {
  // Stale toast: the ticket was restored, handled or relinked since (35 WR-01).
  if (useTicketStore.getState().triageMap[issueKey]?.state !== 'ignored') return;
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
 * remembered key, shows an Undo toast lasting UNDO_TOAST_MS (D-01, RTRI-03).
 */
export async function denyTicket(issueKey: string): Promise<boolean> {
  const { ok, prev } = await applyState(issueKey, 'ignored', 'triage.denyFailed');
  if (ok) announce(i18n.t('a11y.denied', { key: issueKey }));
  if (ok && prev?.copiedKey) {
    toast(i18n.t('triage.denied', { key: issueKey }), {
      id: `deny-${issueKey}`,
      duration: UNDO_TOAST_MS,
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
  if (ok) {
    toast.dismiss(`deny-${issueKey}`);
    announce(i18n.t('a11y.restored', { key: issueKey }));
  }
  return ok;
}

/** Mark a ticket handled, keeping its Cloud key (D-09). */
export async function markHandled(issueKey: string): Promise<boolean> {
  const { ok } = await applyState(issueKey, 'handled', 'triage.handleFailed');
  if (ok) {
    toast.dismiss(`deny-${issueKey}`);
    announce(i18n.t('a11y.handled', { key: issueKey }));
  }
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
  const serverConnection = useConnectionStore.getState().serverConnection;
  if (!serverConnection) {
    notifyError(i18n.t('triage.notConnected'));
    return 'failed';
  }
  const serverBase = serverConnection.baseUrl ?? '';
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
  try {
    await useCopyStore.getState().startPreview(resolved, serverBase, cloudBase);
  } catch {
    notifyError(i18n.t('triage.linkFailed'));
    return 'failed';
  }
  return 'needs-copy';
}

/**
 * Mark a ticket seen when opened from the list and persist it in the background
 * (W-1). Only 'new' (or unknown) tickets are touched; failures are silent.
 */
export function markSeen(issueKey: string): void {
  const current = useTicketStore.getState().triageMap[issueKey];
  if (current && current.state !== 'new') return;
  useTicketStore.getState().markSeen(issueKey);
  invoke('set_triage_state', { ticketKey: issueKey, state: 'seen' }).catch(() => {});
}
