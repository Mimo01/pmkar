import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketListPage } from './TicketListPage';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

vi.mock('../connections/connectionStore', () => ({
  useConnectionStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        serverConnection: {
          baseUrl: 'http://127.0.0.1:8080',
          username: 'jdoe',
          serverVersion: '8.20.0',
          lastTestedAt: new Date().toISOString(),
          status: 'ok',
        },
        cloudConnection: null,
        hasCompletedSetup: () => true,
      }),
    {
      getState: () => ({
        serverConnection: {
          baseUrl: 'http://127.0.0.1:8080',
          username: 'jdoe',
          serverVersion: '8.20.0',
          lastTestedAt: new Date().toISOString(),
          status: 'ok',
        },
        cloudConnection: null,
        hasCompletedSetup: () => true,
      }),
    },
  ),
}));

// Reset ticket store between tests
import { useTicketStore } from './ticketStore';

const mockTickets = [
  {
    id: '10001',
    key: 'PROJ-1',
    fields: {
      summary: 'First ticket summary',
      status: { name: 'Open', id: '1' },
      priority: { name: 'High', id: '2' },
      assignee: { name: 'jdoe', displayName: 'Jane Doe' },
      created: '2026-03-20T10:00:00.000+0000',
      updated: '2026-03-20T10:00:00.000+0000',
    },
  },
  {
    id: '10002',
    key: 'PROJ-2',
    fields: {
      summary: 'Second ticket summary',
      status: { name: 'In Progress', id: '3' },
      priority: { name: 'Medium', id: '3' },
      assignee: { name: 'csmith', displayName: 'Chris Smith' },
      created: '2026-03-19T10:00:00.000+0000',
      updated: '2026-03-19T10:00:00.000+0000',
    },
  },
];

describe('TicketListPage', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    // Reset ticket store to initial state
    useTicketStore.setState({
      tickets: [],
      triageMap: {},
      selectedTicketKey: null,
      fetchStatus: 'idle',
      fetchError: null,
      lastFetchedAt: null,
      totalCount: 0,
      newCount: 0,
      jqlPreset: 'assigned',
      jqlCustom: null,
      watchedUsers: [],
    });
    // Mock hydration invokes to resolve silently
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_triage_state') return Promise.resolve({});
      if (cmd === 'get_fetch_config')
        return Promise.resolve({
          jqlPreset: 'assigned',
          jqlCustom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        });
      return Promise.resolve(undefined);
    });
  });

  it('renders Fetch Tickets button', () => {
    render(<TicketListPage />);
    expect(screen.getByText('Fetch Tickets')).toBeInTheDocument();
  });

  it('shows Not yet fetched initially', () => {
    render(<TicketListPage />);
    expect(screen.getByText('Not yet fetched')).toBeInTheDocument();
  });

  it('calls fetch_tickets invoke on button click', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_triage_state') return Promise.resolve({});
      if (cmd === 'get_fetch_config')
        return Promise.resolve({
          jqlPreset: 'assigned',
          jqlCustom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        });
      if (cmd === 'fetch_tickets')
        return Promise.resolve({
          issues: mockTickets,
          total: 2,
          triageMap: { 'PROJ-1': { state: 'new', copiedKey: null } },
        });
      return Promise.resolve(undefined);
    });

    render(<TicketListPage />);

    const fetchBtn = screen.getByText('Fetch Tickets');
    fireEvent.click(fetchBtn);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('fetch_tickets', {
        baseUrl: 'http://127.0.0.1:8080',
        jql: expect.stringContaining('assignee'),
      });
    });
  });

  it('renders ticket cards after fetch', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_triage_state') return Promise.resolve({});
      if (cmd === 'get_fetch_config')
        return Promise.resolve({
          jqlPreset: 'assigned',
          jqlCustom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        });
      if (cmd === 'fetch_tickets')
        return Promise.resolve({
          issues: mockTickets,
          total: 2,
          triageMap: { 'PROJ-1': { state: 'new', copiedKey: null } },
        });
      return Promise.resolve(undefined);
    });

    render(<TicketListPage />);

    fireEvent.click(screen.getByText('Fetch Tickets'));

    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
      expect(screen.getByText('First ticket summary')).toBeInTheDocument();
      expect(screen.getByText('PROJ-2')).toBeInTheDocument();
    });
  });

  it('renders ticket key in card layout', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_triage_state') return Promise.resolve({});
      if (cmd === 'get_fetch_config')
        return Promise.resolve({
          jqlPreset: 'assigned',
          jqlCustom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        });
      if (cmd === 'fetch_tickets')
        return Promise.resolve({
          issues: mockTickets,
          total: 2,
          triageMap: { 'PROJ-1': { state: 'new', copiedKey: null } },
        });
      return Promise.resolve(undefined);
    });

    render(<TicketListPage />);

    fireEvent.click(screen.getByText('Fetch Tickets'));

    await waitFor(() => {
      // Cards show ticket key as monospace text
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
      // Cards show ticket summary as heading line
      expect(screen.getByText('First ticket summary')).toBeInTheDocument();
    });
  });

  it('shows empty state when no results', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_triage_state') return Promise.resolve({});
      if (cmd === 'get_fetch_config')
        return Promise.resolve({
          jqlPreset: 'assigned',
          jqlCustom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        });
      if (cmd === 'fetch_tickets')
        return Promise.resolve({
          issues: [],
          total: 0,
          triageMap: {},
        });
      return Promise.resolve(undefined);
    });

    render(<TicketListPage />);

    fireEvent.click(screen.getByText('Fetch Tickets'));

    await waitFor(() => {
      expect(screen.getByText('No new tickets')).toBeInTheDocument();
    });
  });

  it('auto-refetches when lastFetchedAt is set in fetch config', async () => {
    const fetchConfig = {
      jqlPreset: 'assigned',
      jqlCustom: null,
      watchedUsers: [],
      lastFetchedAt: '2024-06-01T12:00:00.000Z', // triggers auto-refetch
    };
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_triage_state') return Promise.resolve({});
      if (cmd === 'get_fetch_config') return Promise.resolve(fetchConfig);
      if (cmd === 'fetch_tickets')
        return Promise.resolve({
          issues: mockTickets,
          total: 2,
          triageMap: {},
        });
      return Promise.resolve(undefined);
    });

    render(<TicketListPage />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('fetch_tickets', expect.anything());
    });
  });

  it('calls selectTicket and markSeen when a ticket card is clicked', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_triage_state')
        return Promise.resolve({
          'PROJ-1': { state: 'new', copiedKey: null },
          'PROJ-2': { state: 'new', copiedKey: null },
        });
      if (cmd === 'get_fetch_config')
        return Promise.resolve({
          jqlPreset: 'assigned',
          jqlCustom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        });
      if (cmd === 'fetch_tickets')
        return Promise.resolve({
          issues: mockTickets,
          total: 2,
          triageMap: {
            'PROJ-1': { state: 'new', copiedKey: null },
            'PROJ-2': { state: 'new', copiedKey: null },
          },
        });
      return Promise.resolve(undefined);
    });

    render(<TicketListPage />);
    fireEvent.click(screen.getByText('Fetch Tickets'));

    await waitFor(() => {
      expect(screen.getByText('PROJ-1')).toBeInTheDocument();
    });

    // Click on the first ticket card
    fireEvent.click(screen.getByText('First ticket summary'));

    await waitFor(() => {
      expect(useTicketStore.getState().selectedTicketKey).toBe('PROJ-1');
    });
  });

  it('shows error state when fetch fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_triage_state') return Promise.resolve({});
      if (cmd === 'get_fetch_config')
        return Promise.resolve({
          jqlPreset: 'assigned',
          jqlCustom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        });
      if (cmd === 'fetch_tickets') return Promise.reject(new Error('401 Unauthorized'));
      return Promise.resolve(undefined);
    });

    render(<TicketListPage />);
    fireEvent.click(screen.getByText('Fetch Tickets'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
