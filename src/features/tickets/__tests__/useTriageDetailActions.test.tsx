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
import { useCopyStore } from '../copyStore';
import { useTicketStore } from '../ticketStore';
import { useTriageDetailActions } from '../useTriageDetailActions';

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
          <button type="button" ref={a.denyRef} onClick={() => void a.handleDeny()}>
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
            onClick={() => void a.handleLink()}
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
    await waitFor(() => expect(entry().state).toBe('copied'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Deny')));
  });

  it('relink focuses the Linked badge', async () => {
    seed('ignored', 'CLD-9');
    invokeMock.mockResolvedValue('CLD-9');
    render(<Harness issueKey="PROJ-1" />);
    fireEvent.click(screen.getByText('Primary'));
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
});
