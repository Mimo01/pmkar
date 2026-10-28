import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { useConnectionStore } from './features/connections/connectionStore';
import { useSearchStore } from './features/search/searchStore';
import { useCopyStore } from './features/tickets/copyStore';
import { useTicketStore } from './features/tickets/ticketStore';
import type { JiraTicket, TriageEntry } from './features/tickets/types';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === 'ping_mock_servers') return Promise.resolve({ server_v2: true, cloud_v3: true });
    if (cmd === 'ping_keychain') return Promise.resolve(true);
    if (cmd === 'get_triage_state') return Promise.resolve({});
    if (cmd === 'get_fetch_config')
      return Promise.resolve({
        jqlPreset: 'mine',
        jqlCustom: null,
        watchedUsers: [],
        lastFetchedAt: null,
      });
    if (cmd === 'get_all_connection_meta') return Promise.resolve([]);
    if (cmd === 'fetch_server_projects' || cmd === 'fetch_cloud_projects')
      return Promise.resolve([]);
    return Promise.resolve(null);
  }),
}));

function mk(key: string, summary: string): JiraTicket {
  return {
    id: key,
    key,
    fields: {
      summary,
      status: { name: 'Open', statusCategory: { key: 'indeterminate' } },
      priority: { name: 'High', id: '2' },
      assignee: null,
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
    },
  } as unknown as JiraTicket;
}

function setupConnections() {
  const meta = {
    baseUrl: 'http://localhost:8080',
    username: 'admin',
    serverVersion: '8.0',
    lastTestedAt: new Date().toISOString(),
    status: 'ok' as const,
  };
  useConnectionStore.setState({
    serverConnection: meta,
    cloudConnection: { ...meta, baseUrl: 'http://localhost:8081' },
  });
}

function seedTickets(triageMap: Record<string, TriageEntry> = {}) {
  act(() => {
    useTicketStore.setState({
      tickets: [mk('ABC-1', 'Timeout on login page'), mk('ABC-2', 'Unrelated other thing')],
      triageMap,
      selectedTicketKey: null,
      lastFetchedAt: '2026-01-01T00:00:00.000Z',
    });
  });
}

function searchDialog(): HTMLElement | null {
  return document.querySelector('[role="dialog"][data-search-dialog]');
}

async function openSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Search tickets' }));
  const dialog = await waitFor(() => {
    const el = searchDialog();
    expect(el).not.toBeNull();
    return el as HTMLElement;
  });
  const box = within(dialog).getByRole('combobox', { name: 'Search all tickets' });
  return box as HTMLInputElement;
}

async function searchFor(user: ReturnType<typeof userEvent.setup>, text: string) {
  const box = await openSearch(user);
  await user.clear(box);
  await user.type(box, text);
  await screen.findByRole('listbox');
  return box;
}

describe('App global search', () => {
  beforeEach(() => {
    useConnectionStore.setState({ serverConnection: null, cloudConnection: null });
    useSearchStore.setState({ query: '' });
    useCopyStore.getState().reset?.();
    useCopyStore.setState({ phase: 'idle' });
    useTicketStore.setState({ tickets: [], triageMap: {}, selectedTicketKey: null });
  });

  it('shows the search button and opens a dialog with the combobox', async () => {
    setupConnections();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Fetch Tickets');
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Search all tickets' })).not.toBeInTheDocument();
    const box = await openSearch(user);
    expect(searchDialog()).toContainElement(box);
    expect(document.activeElement).toBe(box);
  });

  it('shows no search in the setup wizard', async () => {
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Fetch Tickets')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Search tickets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Search all tickets' })).not.toBeInTheDocument();
  });

  it('opens the detail view of the selected hit on Enter', async () => {
    setupConnections();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Fetch Tickets');
    seedTickets();
    const box = await searchFor(user, 'login timeout');
    await user.type(box, '{Enter}');
    await waitFor(() => expect(useTicketStore.getState().selectedTicketKey).toBe('ABC-1'));
    await waitFor(() => expect(screen.queryByRole('navigation')).not.toBeInTheDocument());
  });

  it('opens detail from Settings', async () => {
    setupConnections();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Fetch Tickets');
    seedTickets();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await waitFor(() => expect(screen.queryByText('Fetch Tickets')).not.toBeInTheDocument());
    const box = await searchFor(user, 'login timeout');
    await user.type(box, '{Enter}');
    await waitFor(() => expect(useTicketStore.getState().selectedTicketKey).toBe('ABC-1'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Back to tickets/ })).toBeVisible(),
    );
  });

  it('opens detail from the audit log', async () => {
    setupConnections();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Fetch Tickets');
    seedTickets();
    await user.click(screen.getByRole('button', { name: 'Open audit log' }));
    await waitFor(() => expect(screen.queryByText('Fetch Tickets')).not.toBeInTheDocument());
    const box = await searchFor(user, 'login timeout');
    await user.type(box, '{Enter}');
    await waitFor(() => expect(useTicketStore.getState().selectedTicketKey).toBe('ABC-1'));
  });

  it('switches from the detail of one ticket to another', async () => {
    setupConnections();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Fetch Tickets');
    seedTickets();
    act(() => {
      useTicketStore.getState().selectTicket('ABC-2');
    });
    await waitFor(() => expect(screen.queryByText('Fetch Tickets')).not.toBeInTheDocument());
    const box = await searchFor(user, 'login timeout');
    await user.type(box, '{Enter}');
    await waitFor(() => expect(useTicketStore.getState().selectedTicketKey).toBe('ABC-1'));
  });

  it('returns to the originating tab on Back and keeps the query', async () => {
    setupConnections();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Fetch Tickets');
    seedTickets({ 'ABC-1': { state: 'ignored', copiedKey: null } });
    await user.click(document.querySelector('[data-tab-id="not-mine"]') as HTMLElement);
    const box = await searchFor(user, 'login timeout');
    await user.type(box, '{Enter}');
    await waitFor(() => expect(useTicketStore.getState().selectedTicketKey).toBe('ABC-1'));
    await waitFor(() => expect(document.querySelector('[data-tab-id="not-mine"]')).toBeNull());

    await user.click(await screen.findByRole('button', { name: /Back to tickets/ }));
    await waitFor(() => expect(useTicketStore.getState().selectedTicketKey).toBeNull());
    const tab = await waitFor(() => {
      const el = document.querySelector('[data-tab-id="not-mine"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(tab.getAttribute('aria-current')).toBe('page');
    const again = await openSearch(user);
    expect(again.value).toBe('login timeout');
    expect(within(searchDialog() as HTMLElement).getByRole('listbox')).toBeInTheDocument();
  });

  it('Esc closes the search dialog and does not leave detail', async () => {
    setupConnections();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Fetch Tickets');
    seedTickets();
    act(() => {
      useTicketStore.getState().selectTicket('ABC-2');
    });
    await waitFor(() => expect(screen.queryByText('Fetch Tickets')).not.toBeInTheDocument());
    await searchFor(user, 'login timeout');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(searchDialog()).toBeNull());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(useTicketStore.getState().selectedTicketKey).toBe('ABC-2');
    expect(screen.getByRole('button', { name: /Back to tickets/ })).toBeInTheDocument();
    expect(useSearchStore.getState().query).toBe('login timeout');
  });

  it('does nothing while a copy flow is active and keeps the search dialog open', async () => {
    setupConnections();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Fetch Tickets');
    seedTickets();
    const box = await searchFor(user, 'login timeout');
    act(() => {
      useCopyStore.setState({ phase: 'previewing' });
    });
    await user.type(box, '{Enter}');
    expect(useTicketStore.getState().selectedTicketKey).toBeNull();
    expect(searchDialog()).not.toBeNull();
    expect(within(searchDialog() as HTMLElement).getByRole('listbox')).toBeInTheDocument();
  });
});
