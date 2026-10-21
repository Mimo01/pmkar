import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

import { invoke } from '@tauri-apps/api/core';
import { useTicketStore } from '../ticketStore';
import type { JiraTicket, TriageEntry } from '../types';
import { WatchedTicketsPage } from '../WatchedTicketsPage';

const mockInvoke = vi.mocked(invoke);

const makeTicket = (key: string, summary: string, done = false): JiraTicket => ({
  id: key,
  key,
  fields: {
    summary,
    status: {
      name: done ? 'Done' : 'Open',
      statusCategory: { key: done ? 'done' : 'indeterminate' },
    },
    priority: { name: 'Medium', id: '3' },
    assignee: null,
    created: '2026-01-10T10:00:00.000Z',
    updated: '2026-01-10T10:00:00.000Z',
  },
});

function setup(tickets: JiraTicket[], triageMap: Record<string, TriageEntry>) {
  useTicketStore.setState({ tickets, triageMap, selectedTicketKey: null });
}

describe('WatchedTicketsPage', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    setup([], {});
  });

  it('lists only watched, not-done tickets', () => {
    setup(
      [
        makeTicket('W-1', 'Watched one'),
        makeTicket('W-2', 'Ignored one'),
        makeTicket('W-3', 'Copied one'),
        makeTicket('W-4', 'Seen one'),
        makeTicket('W-5', 'Watched done', true),
      ],
      {
        'W-1': { state: 'watched', copiedKey: 'C-1' },
        'W-2': { state: 'ignored', copiedKey: null },
        'W-3': { state: 'copied', copiedKey: 'C-3' },
        'W-4': { state: 'seen', copiedKey: null },
        'W-5': { state: 'watched', copiedKey: null },
      },
    );
    render(<WatchedTicketsPage />);
    expect(screen.getByText('Watched one')).toBeInTheDocument();
    expect(screen.queryByText('Ignored one')).toBeNull();
    expect(screen.queryByText('Copied one')).toBeNull();
    expect(screen.queryByText('Seen one')).toBeNull();
    expect(screen.queryByText('Watched done')).toBeNull();
  });

  it('shows hint and only a Restore button per row', () => {
    setup([makeTicket('W-1', 'Watched one')], {
      'W-1': { state: 'watched', copiedKey: 'C-1' },
    });
    render(<WatchedTicketsPage />);
    expect(screen.getByText(/Previously linked to/)).toHaveTextContent(/C-1/);
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Watch' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Link' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Deny' })).toBeNull();
  });

  it('Restore sets seen without relinking', async () => {
    setup([makeTicket('W-1', 'Watched one')], {
      'W-1': { state: 'watched', copiedKey: 'C-1' },
    });
    render(<WatchedTicketsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('set_triage_state', {
        ticketKey: 'W-1',
        state: 'seen',
      }),
    );
    expect(mockInvoke).not.toHaveBeenCalledWith('relink_ticket', expect.anything());
    await waitFor(() => expect(screen.queryByText('Watched one')).toBeNull());
  });

  it('shows empty state', () => {
    render(<WatchedTicketsPage />);
    expect(screen.getByText('No watched tickets')).toBeInTheDocument();
    expect(screen.getByText(/Open a linked or dismissed ticket/)).toBeInTheDocument();
  });

  it('clicking a card selects the ticket', () => {
    setup([makeTicket('W-1', 'Watched one')], {
      'W-1': { state: 'watched', copiedKey: null },
    });
    render(<WatchedTicketsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Watched one' }));
    expect(useTicketStore.getState().selectedTicketKey).toBe('W-1');
  });

  it('info card dismiss button has a translated accessible name', () => {
    setup([makeTicket('W-1', 'Watched one')], {
      'W-1': { state: 'watched', copiedKey: null },
    });
    render(<WatchedTicketsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss info card' }));
    expect(screen.queryByRole('button', { name: 'Dismiss info card' })).toBeNull();
  });
});
