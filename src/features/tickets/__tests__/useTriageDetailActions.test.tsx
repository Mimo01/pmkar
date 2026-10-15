import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), dismiss: vi.fn() }),
}));

import { useConnectionStore } from '../../connections/connectionStore';
import { ConfirmTransitionDialog } from '../ConfirmTransitionDialog';
import { useCopyStore } from '../copyStore';
import { useTicketStore } from '../ticketStore';
import { useTriageDetailActions } from '../useTriageDetailActions';
import { cancelConfirm, confirmDeny, confirmLink, expectNoConfirmDialog } from './confirmHelpers';

function Harness({ issueKey }: { issueKey: string }) {
  const fallbackRef = useRef<HTMLButtonElement | null>(null);
  const a = useTriageDetailActions(issueKey, null, fallbackRef);
  return (
    <div>
      <span data-testid="remembered">{String(a.rememberedKey)}</span>
      <span data-testid="linked">{String(a.isLinked)}</span>
      {a.isLinked && (
        <>
          <span ref={a.badgeRef} tabIndex={-1}>
            badge
          </span>
          <button type="button" ref={a.denyRef} onClick={() => void a.requestDeny()}>
            Deny
          </button>
        </>
      )}
      {a.isDenied && (
        <>
          <button
            type="button"
            ref={a.primaryRef}
            disabled={a.linking}
            onClick={() => void a.requestLink()}
          >
            Primary
          </button>
          <button type="button" onClick={() => void a.handleRestore()}>
            Restore
          </button>
        </>
      )}
      {!a.isLinked && !a.isDenied && (
        <button type="button" ref={a.dismissRef} onClick={() => void a.handleDismiss()}>
          Dismiss
        </button>
      )}
      <button type="button" ref={fallbackRef}>
        Fallback
      </button>
      <ConfirmTransitionDialog {...a.confirmDialog} />
    </div>
  );
}

const seed = (state: 'copied' | 'ignored' | 'seen', copiedKey: string | null) =>
  useTicketStore.getState().hydrateTriageMap({ 'PROJ-1': { state, copiedKey } });
const entry = () => useTicketStore.getState().triageMap['PROJ-1'];

let startPreview: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  invokeMock.mockReset();
  useTicketStore.getState().hydrateTriageMap({});
  useConnectionStore.setState({
    serverConnection: { baseUrl: 'http://srv' },
    cloudConnection: { baseUrl: 'http://cld' },
  } as never);
  startPreview = vi.spyOn(useCopyStore.getState(), 'startPreview').mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  startPreview.mockRestore();
});

describe('useTriageDetailActions', () => {
  it('deny calls only set_triage_state and focuses the denied primary button', async () => {
    seed('copied', 'CLD-9');
    invokeMock.mockResolvedValue(undefined);
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Deny'));
    await confirmDeny();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Primary')));
    expect(invokeMock).toHaveBeenCalledWith('set_triage_state', {
      ticketKey: 'PROJ-1',
      state: 'ignored',
    });
    expect(invokeMock).not.toHaveBeenCalledWith('relink_ticket', expect.anything());
  });

  it('rollback after failed deny focuses the Deny button', async () => {
    seed('copied', 'CLD-9');
    invokeMock.mockRejectedValue(new Error('db'));
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Deny'));
    await confirmDeny();
    await waitFor(() => expect(entry().state).toBe('copied'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Deny')));
  });

  it('relink focuses the Linked badge', async () => {
    seed('ignored', 'CLD-9');
    invokeMock.mockResolvedValue('CLD-9');
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Primary'));
    await confirmLink();
    await waitFor(() => expect(entry()).toEqual({ state: 'copied', copiedKey: 'CLD-9' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('badge')));
  });

  it('needs-copy does not move focus to the badge and re-enables the button', async () => {
    seed('ignored', null);
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'relink_ticket') return null;
      if (cmd === 'fetch_ticket_detail') return { key: 'PROJ-1' };
      return undefined;
    });
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Primary'));
    await waitFor(() => expect(startPreview).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Primary')).not.toBeDisabled());
    expect(screen.queryByText('badge')).toBeNull();
    expect(document.activeElement).not.toBe(document.querySelector('[tabindex="-1"]'));
  });

  it('failed relink re-enables and refocuses Primary', async () => {
    seed('ignored', 'CLD-9');
    invokeMock.mockRejectedValue(new Error('net'));
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Primary'));
    await confirmLink();
    await waitFor(() => expect(screen.getByText('Primary')).not.toBeDisabled());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Primary')));
  });

  it('cannot double submit while relink is in flight', async () => {
    seed('ignored', 'CLD-9');
    invokeMock.mockImplementation(() => new Promise(() => {}));
    render(<Harness issueKey="PROJ-1" />);
    const primary = screen.getByText('Primary');
    fireEvent.click(primary);
    fireEvent.click(primary);
    await confirmLink();
    await waitFor(() => expect(primary).toBeDisabled());
    const relinkCalls = invokeMock.mock.calls.filter((c) => c[0] === 'relink_ticket');
    expect(relinkCalls).toHaveLength(1);
  });

  it('restore focuses Dismiss', async () => {
    seed('ignored', null);
    invokeMock.mockResolvedValue(undefined);
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Restore'));
    await waitFor(() => expect(entry().state).toBe('seen'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Dismiss')));
  });

  it('does not steal focus on mount or external store changes', async () => {
    seed('seen', null);
    render(<Harness issueKey="PROJ-1" />);
    expect(document.activeElement).toBe(document.body);
    act(() => seed('copied', 'CLD-9'));
    expect(screen.getByText('Deny')).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
  });

  it('rememberedKey only for ignored entries', () => {
    seed('seen', 'CLD-9');
    const { unmount } = render(<Harness issueKey="PROJ-1" />);
    expect(screen.getByTestId('remembered').textContent).toBe('null');
    unmount();
    seed('ignored', 'CLD-9');
    render(<Harness issueKey="PROJ-1" />);
    expect(screen.getByTestId('remembered').textContent).toBe('CLD-9');
  });

  it('deny opens dialog without invoking, then Confirm runs set_triage_state', async () => {
    seed('copied', 'CLD-9');
    invokeMock.mockResolvedValue(undefined);
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Deny'));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(invokeMock).not.toHaveBeenCalledWith('set_triage_state', expect.anything());
    await confirmDeny();
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('set_triage_state', {
        ticketKey: 'PROJ-1',
        state: 'ignored',
      }),
    );
  });

  it('deny Cancel performs no invoke and refocuses Deny', async () => {
    seed('copied', 'CLD-9');
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Deny'));
    await cancelConfirm();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(entry().state).toBe('copied');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Deny')));
  });

  it('deny Escape behaves like Cancel', async () => {
    seed('copied', 'CLD-9');
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Deny'));
    const dlg = await screen.findByRole('alertdialog');
    fireEvent.keyDown(dlg, { key: 'Escape' });
    await waitFor(() => expectNoConfirmDialog());
    expect(invokeMock).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Deny')));
  });

  it('link with remembered key requires Confirm before relink_ticket', async () => {
    seed('ignored', 'CLD-9');
    invokeMock.mockResolvedValue('CLD-9');
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Primary'));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(invokeMock).not.toHaveBeenCalledWith('relink_ticket', expect.anything());
    await confirmLink();
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('relink_ticket', expect.anything()),
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('badge')));
  });

  it('link without remembered key skips the dialog', async () => {
    seed('ignored', null);
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'relink_ticket') return null;
      if (cmd === 'fetch_ticket_detail') return { key: 'PROJ-1' };
      return undefined;
    });
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Primary'));
    expectNoConfirmDialog();
    await waitFor(() => expect(startPreview).toHaveBeenCalled());
  });

  it('stale deny: no invoke when entry changed before Confirm', async () => {
    seed('copied', 'CLD-9');
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Deny'));
    await screen.findByRole('alertdialog');
    act(() => seed('ignored', 'CLD-9'));
    await confirmDeny();
    expect(invokeMock).not.toHaveBeenCalledWith('set_triage_state', expect.anything());
  });

  it('stale link: no relink when remembered key changed before Confirm', async () => {
    seed('ignored', 'CLD-9');
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Primary'));
    await screen.findByRole('alertdialog');
    act(() => seed('ignored', 'CLD-10'));
    await confirmLink();
    expect(invokeMock).not.toHaveBeenCalledWith('relink_ticket', expect.anything());
  });

  it('closes silently without invoking when issueKey changes', async () => {
    seed('copied', 'CLD-9');
    const { rerender } = render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Deny'));
    await screen.findByRole('alertdialog');
    rerender(<Harness issueKey="PROJ-2" />);
    await waitFor(() => expectNoConfirmDialog());
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('dismiss from New runs without a dialog', async () => {
    seed('seen', null);
    invokeMock.mockResolvedValue(undefined);
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Dismiss'));
    expectNoConfirmDialog();
    await waitFor(() => expect(entry().state).toBe('ignored'));
  });
});
