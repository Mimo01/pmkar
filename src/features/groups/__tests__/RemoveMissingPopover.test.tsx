import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import i18n from '../../../i18n/index';
import { renderWithI18n } from '../../../test-utils/renderWithI18n';
import { useConnectionStore } from '../../connections/connectionStore';
import { computeFetchSignature, currentFetchSignatureInput } from '../../tickets/fetchSignature';
import { useTicketStore } from '../../tickets/ticketStore';
import type { JiraTicket } from '../../tickets/types';
import { useGroupStore } from '../groupStore';
import { RemoveMissingPopover } from '../RemoveMissingPopover';
import type { Group } from '../types';

const group = {
  id: 1,
  name: 'Sprint',
  color: 'blue',
  position: 0,
  createdAt: 't',
  memberCount: 2,
} as unknown as Group;

const tk = (key: string) => ({ id: key, key, fields: {} }) as unknown as JiraTicket;

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

beforeEach(async () => {
  await i18n.changeLanguage('en');
  invokeMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  invokeMock.mockImplementation(async (cmd: string) => {
    if (cmd === 'remove_issues_from_group') return 1;
    return [];
  });
  useGroupStore.setState({ memberKeysByGroup: { 1: ['AB-1', 'AB-2'] } });
  useTicketStore.setState({ tickets: [tk('AB-1')], lastCompleteFetchSignature: null });
  useTicketStore.setState({
    lastCompleteFetchSignature: computeFetchSignature(
      currentFetchSignatureInput(useTicketStore.getState(), useConnectionStore.getState()),
    ),
  });
});

function Harness({
  onOpenChange,
  onReturnFocus,
}: {
  onOpenChange: (o: boolean) => void;
  onReturnFocus: () => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(true);
  return (
    <>
      <div
        ref={(el) => {
          ref.current = el;
        }}
      >
        anchor
      </div>
      <RemoveMissingPopover
        group={group}
        open={open}
        anchorRef={ref}
        onOpenChange={(o) => {
          onOpenChange(o);
          setOpen(o);
        }}
        onReturnFocus={onReturnFocus}
      />
    </>
  );
}

describe('RemoveMissingPopover', () => {
  it('shows the question with Cancel focused; Cancel does not invoke', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<Harness onOpenChange={onOpenChange} onReturnFocus={() => {}} />);
    expect(
      await screen.findByText('Remove 1 issue from “Sprint”? It is no longer in results.'),
    ).toBeTruthy();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await user.click(cancel);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(invokeMock.mock.calls.some((c) => c[0] === 'remove_issues_from_group')).toBe(false);
  });

  it('Remove makes one atomic call, toasts, closes and returns focus', async () => {
    const onOpenChange = vi.fn();
    const onReturnFocus = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<Harness onOpenChange={onOpenChange} onReturnFocus={onReturnFocus} />);
    await screen.findByText(/Remove 1 issue/);
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('remove_issues_from_group', {
        groupId: 1,
        issueKeys: ['AB-2'],
      }),
    );
    expect(invokeMock.mock.calls.filter((c) => c[0] === 'remove_issues_from_group')).toHaveLength(
      1,
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    await waitFor(() => expect(onReturnFocus).toHaveBeenCalled());
  });

  it('removes nothing when no member is missing at confirm time', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<Harness onOpenChange={onOpenChange} onReturnFocus={() => {}} />);
    await screen.findByText(/Remove 1 issue/);
    useTicketStore.setState({ tickets: [tk('AB-1'), tk('AB-2')] });
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(invokeMock.mock.calls.some((c) => c[0] === 'remove_issues_from_group')).toBe(false);
  });
});
