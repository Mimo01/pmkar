import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

import { useTicketStore } from '../ticketStore';
import { restoreTicket } from '../triageActions';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('restoreTicket', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    toastError.mockReset();
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
