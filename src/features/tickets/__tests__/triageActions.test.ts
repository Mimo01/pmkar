import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
const toastError = vi.fn();
const toastFn = vi.fn();
const toastDismiss = vi.fn();
vi.mock('sonner', () => ({
  toast: Object.assign((...a: unknown[]) => toastFn(...a), {
    error: (...a: unknown[]) => toastError(...a),
    dismiss: (...a: unknown[]) => toastDismiss(...a),
  }),
}));

import { useConnectionStore } from '../../connections/connectionStore';
import { useCopyStore } from '../copyStore';
import { useTicketStore } from '../ticketStore';
import { denyTicket, linkTicket, markHandled, restoreTicket } from '../triageActions';
import type { JiraTicketDetail } from '../types';

const flush = () => new Promise((r) => setTimeout(r, 0));

const entry = () => useTicketStore.getState().triageMap['T-1'];
const seed = (state: 'copied' | 'ignored' | 'new' | 'seen' | 'handled', copiedKey: string | null) =>
  useTicketStore.getState().hydrateTriageMap({ 'T-1': { state, copiedKey } });

let startPreview: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  invokeMock.mockReset();
  toastError.mockReset();
  toastFn.mockReset();
  toastDismiss.mockReset();
  useConnectionStore.setState({
    serverConnection: { baseUrl: 'http://srv' },
    cloudConnection: { baseUrl: 'http://cld' },
  } as never);
  startPreview = vi.spyOn(useCopyStore.getState(), 'startPreview').mockResolvedValue(undefined);
});
afterEach(() => {
  startPreview.mockRestore();
});

describe('restoreTicket', () => {
  beforeEach(() => {
    useTicketStore.getState().hydrateTriageMap({
      'T-1': { state: 'ignored', copiedKey: null },
    });
  });

  it('optimistically sets seen and persists', async () => {
    invokeMock.mockResolvedValue(undefined);
    restoreTicket('T-1');
    expect(useTicketStore.getState().triageMap['T-1']).toEqual({ state: 'seen', copiedKey: null });
    await flush();
    expect(invokeMock).toHaveBeenCalledWith('set_triage_state', {
      ticketKey: 'T-1',
      state: 'seen',
    });
    expect(useTicketStore.getState().triageMap['T-1'].state).toBe('seen');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('rolls back and notifies when persistence fails', async () => {
    invokeMock.mockRejectedValue(new Error('db'));
    restoreTicket('T-1');
    expect(useTicketStore.getState().triageMap['T-1'].state).toBe('seen');
    await flush();
    expect(useTicketStore.getState().triageMap['T-1']).toEqual({
      state: 'ignored',
      copiedKey: null,
    });
    expect(toastError).toHaveBeenCalledWith('Could not restore the ticket. Try again.');
  });

  it('does not clobber a newer triage change on failure', async () => {
    let reject: (e: unknown) => void = () => {};
    invokeMock.mockReturnValue(new Promise((_, rej) => (reject = rej)));
    restoreTicket('T-1');
    useTicketStore.getState().hydrateTriageMap({
      ...useTicketStore.getState().triageMap,
      'T-1': { state: 'handled', copiedKey: null },
    });
    reject(new Error('db'));
    await flush();
    expect(useTicketStore.getState().triageMap['T-1'].state).toBe('handled');
    expect(toastError).toHaveBeenCalled();
  });
});

describe('denyTicket', () => {
  it('carries the key and only invokes set_triage_state', async () => {
    seed('copied', 'CLD-9');
    invokeMock.mockResolvedValue(undefined);
    expect(await denyTicket('T-1')).toBe(true);
    expect(entry()).toEqual({ state: 'ignored', copiedKey: 'CLD-9' });
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('set_triage_state', {
      ticketKey: 'T-1',
      state: 'ignored',
    });
  });

  it('shows the Undo toast', async () => {
    seed('copied', 'CLD-9');
    invokeMock.mockResolvedValue(undefined);
    await denyTicket('T-1');
    expect(toastFn).toHaveBeenCalledWith(
      'Moved T-1 to Ignored.',
      expect.objectContaining({
        id: 'deny-T-1',
        duration: 8000,
        action: expect.objectContaining({ label: 'Undo' }),
      }),
    );
  });

  it('shows no toast without a remembered key', async () => {
    seed('new', null);
    invokeMock.mockResolvedValue(undefined);
    await denyTicket('T-1');
    expect(entry()).toEqual({ state: 'ignored', copiedKey: null });
    expect(toastFn).not.toHaveBeenCalled();
  });

  it('rolls back on failure without Undo toast', async () => {
    seed('copied', 'CLD-9');
    invokeMock.mockRejectedValue(new Error('db'));
    expect(await denyTicket('T-1')).toBe(false);
    expect(entry()).toEqual({ state: 'copied', copiedKey: 'CLD-9' });
    expect(toastError).toHaveBeenCalledWith('Could not move the ticket to Ignored. Try again.');
    expect(toastFn).not.toHaveBeenCalled();
  });

  it('does not clobber a newer change on failure', async () => {
    seed('copied', 'CLD-9');
    let reject: (e: unknown) => void = () => {};
    invokeMock.mockReturnValue(new Promise((_, rej) => (reject = rej)));
    const p = denyTicket('T-1');
    seed('handled', 'CLD-9');
    reject(new Error('db'));
    await p;
    expect(entry().state).toBe('handled');
  });
});

describe('Undo', () => {
  const deny = async () => {
    seed('copied', 'CLD-9');
    invokeMock.mockResolvedValueOnce(undefined);
    await denyTicket('T-1');
    return toastFn.mock.calls[0][1].action.onClick as () => void;
  };

  it('relinks with the DB-returned key', async () => {
    const undo = await deny();
    invokeMock.mockResolvedValueOnce('CLD-9');
    undo();
    await flush();
    expect(invokeMock).toHaveBeenCalledWith('relink_ticket', { ticketKey: 'T-1' });
    expect(entry()).toEqual({ state: 'copied', copiedKey: 'CLD-9' });
  });

  it('reports failure when relink returns null', async () => {
    const undo = await deny();
    invokeMock.mockResolvedValueOnce(null);
    undo();
    await flush();
    expect(toastError).toHaveBeenCalledWith(
      'Could not restore the link to T-1. The ticket stays in Ignored.',
    );
    expect(entry()).toEqual({ state: 'ignored', copiedKey: 'CLD-9' });
  });

  it('reports failure when relink rejects', async () => {
    const undo = await deny();
    invokeMock.mockRejectedValueOnce(new Error('x'));
    undo();
    await flush();
    expect(toastError).toHaveBeenCalled();
    expect(entry()).toEqual({ state: 'ignored', copiedKey: 'CLD-9' });
  });
});

describe('markHandled', () => {
  it('carries the key', async () => {
    seed('copied', 'CLD-9');
    invokeMock.mockResolvedValue(undefined);
    await markHandled('T-1');
    expect(entry()).toEqual({ state: 'handled', copiedKey: 'CLD-9' });
    expect(invokeMock).toHaveBeenCalledWith('set_triage_state', {
      ticketKey: 'T-1',
      state: 'handled',
    });
  });

  it('rolls back on failure', async () => {
    seed('copied', 'CLD-9');
    invokeMock.mockRejectedValue(new Error('db'));
    await markHandled('T-1');
    expect(entry()).toEqual({ state: 'copied', copiedKey: 'CLD-9' });
    expect(toastError).toHaveBeenCalledWith('Could not mark the ticket as handled. Try again.');
  });
});

describe('restoreTicket carries key', () => {
  it('keeps the remembered key', async () => {
    seed('ignored', 'CLD-9');
    invokeMock.mockResolvedValue(undefined);
    await restoreTicket('T-1');
    expect(entry()).toEqual({ state: 'seen', copiedKey: 'CLD-9' });
  });
});

describe('linkTicket', () => {
  const detail = { key: 'T-1', fields: { summary: 's' } } as unknown as JiraTicketDetail;

  it('relinks when a key exists', async () => {
    seed('ignored', 'CLD-9');
    invokeMock.mockResolvedValue('CLD-9');
    expect(await linkTicket('T-1')).toBe('relinked');
    expect(entry()).toEqual({ state: 'copied', copiedKey: 'CLD-9' });
    expect(startPreview).not.toHaveBeenCalled();
    expect(toastDismiss).toHaveBeenCalledWith('deny-T-1');
  });

  it('is not optimistic', async () => {
    seed('ignored', 'CLD-9');
    const original = entry();
    let resolve: (v: unknown) => void = () => {};
    invokeMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const p = linkTicket('T-1');
    expect(entry()).toBe(original);
    resolve('CLD-9');
    await p;
  });

  it('hands off to the copy preview with a passed detail', async () => {
    seed('seen', null);
    const original = entry();
    invokeMock.mockResolvedValue(null);
    expect(await linkTicket('T-1', detail)).toBe('needs-copy');
    expect(startPreview).toHaveBeenCalledWith(detail, 'http://srv', 'http://cld');
    expect(entry()).toBe(original);
  });

  it('fetches the detail when not passed', async () => {
    seed('seen', null);
    invokeMock.mockResolvedValueOnce(null).mockResolvedValueOnce(detail);
    expect(await linkTicket('T-1')).toBe('needs-copy');
    expect(invokeMock).toHaveBeenCalledWith('fetch_ticket_detail', {
      baseUrl: 'http://srv',
      issueKey: 'T-1',
    });
    expect(startPreview).toHaveBeenCalledWith(detail, 'http://srv', 'http://cld');
  });

  it('fails when the detail fetch rejects', async () => {
    seed('seen', null);
    invokeMock.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('x'));
    expect(await linkTicket('T-1')).toBe('failed');
    expect(toastError).toHaveBeenCalledWith('Could not link the ticket. Try again.');
  });

  it('fails when relink rejects', async () => {
    seed('seen', null);
    const original = entry();
    invokeMock.mockRejectedValue(new Error('x'));
    expect(await linkTicket('T-1')).toBe('failed');
    expect(toastError).toHaveBeenCalledWith('Could not link the ticket. Try again.');
    expect(entry()).toBe(original);
  });
});

describe('hydrate round-trip (restart)', () => {
  it('keeps copiedKey across deny/restore/handled and relinks', async () => {
    seed('copied', 'CLD-9');
    invokeMock.mockResolvedValue(undefined);
    await denyTicket('T-1');
    await restoreTicket('T-1');
    await markHandled('T-1');
    invokeMock.mockReset();
    invokeMock.mockResolvedValueOnce({ 'T-1': { state: 'handled', copiedKey: 'CLD-9' } });
    const { invoke } = await import('@tauri-apps/api/core');
    useTicketStore
      .getState()
      .hydrateTriageMap(await invoke<Record<string, never>>('get_triage_state'));
    expect(entry()).toEqual({ state: 'handled', copiedKey: 'CLD-9' });
    invokeMock.mockResolvedValueOnce('CLD-9');
    expect(await linkTicket('T-1')).toBe('relinked');
    expect(entry()).toEqual({ state: 'copied', copiedKey: 'CLD-9' });
  });
});
