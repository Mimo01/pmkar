import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IgnoredTicketsPage } from './IgnoredTicketsPage';
import { useTicketStore } from './ticketStore';
import type { JiraTicket, TriageEntry } from './types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

const ticket1: JiraTicket = {
  id: '1',
  key: 'TEST-1',
  fields: {
    summary: 'First ignored ticket',
    status: { name: 'Open', id: '1' },
    priority: { name: 'High', id: '2' },
    assignee: { displayName: 'Alice' },
    created: '2026-01-10T10:00:00.000Z',
    updated: '2026-01-10T10:00:00.000Z',
  },
};

const ticket2: JiraTicket = {
  id: '2',
  key: 'TEST-2',
  fields: {
    summary: 'Second ignored ticket',
    status: { name: 'In Progress', id: '3' },
    priority: { name: 'Medium', id: '3' },
    assignee: { displayName: 'Bob' },
    created: '2026-01-11T10:00:00.000Z',
    updated: '2026-01-11T10:00:00.000Z',
  },
};

const ticket3: JiraTicket = {
  id: '3',
  key: 'TEST-3',
  fields: {
    summary: 'Seen ticket (not ignored)',
    status: { name: 'Done', id: '5' },
    priority: { name: 'Low', id: '4' },
    assignee: null,
    created: '2026-01-12T10:00:00.000Z',
    updated: '2026-01-12T10:00:00.000Z',
  },
};

function setupStore(
  tickets: JiraTicket[] = [ticket1, ticket2, ticket3],
  triageMap: Record<string, TriageEntry> = {
    'TEST-1': { state: 'ignored', copiedKey: null },
    'TEST-2': { state: 'ignored', copiedKey: null },
    'TEST-3': { state: 'seen', copiedKey: null },
  },
) {
  useTicketStore.setState({ tickets, triageMap });
}

describe('IgnoredTicketsPage', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
    setupStore();
  });

  it('renders ignored tickets only', () => {
    render(<IgnoredTicketsPage />);
    expect(screen.getByText('TEST-1')).toBeInTheDocument();
    expect(screen.getByText('TEST-2')).toBeInTheDocument();
    expect(screen.queryByText('TEST-3')).not.toBeInTheDocument();
  });

  it('each row has a Restore button', () => {
    render(<IgnoredTicketsPage />);
    const restoreButtons = screen.getAllByRole('button', { name: 'Restore' });
    expect(restoreButtons).toHaveLength(2);
  });

  it('clicking Restore invokes set_triage_state with seen', async () => {
    render(<IgnoredTicketsPage />);
    // TEST-2 (Jan 11) sorts before TEST-1 (Jan 10) in DESC order — first button is TEST-2
    const restoreButton = screen.getAllByRole('button', { name: 'Restore' })[0];
    fireEvent.click(restoreButton);
    expect(mockInvoke).toHaveBeenCalledWith('set_triage_state', {
      ticketKey: 'TEST-2',
      state: 'seen',
    });
  });

  it('clicking Restore updates triageMap via hydrateTriageMap', () => {
    render(<IgnoredTicketsPage />);
    // TEST-2 (Jan 11) sorts first in DESC order — click first button
    const restoreButton = screen.getAllByRole('button', { name: 'Restore' })[0];
    fireEvent.click(restoreButton);
    const updatedMap = useTicketStore.getState().triageMap;
    expect(updatedMap['TEST-2'].state).toBe('seen');
  });

  it('shows empty state when no ignored tickets', () => {
    setupStore([ticket3], { 'TEST-3': { state: 'seen', copiedKey: null } });
    render(<IgnoredTicketsPage />);
    expect(screen.getByText('No dismissed tickets')).toBeInTheDocument();
    expect(screen.getByText(/Tickets you dismiss will appear here/)).toBeInTheDocument();
  });

  it('only ignored tickets are shown', () => {
    render(<IgnoredTicketsPage />);
    expect(screen.queryByText('Seen ticket (not ignored)')).not.toBeInTheDocument();
    expect(screen.queryByText('TEST-3')).not.toBeInTheDocument();
  });
});
