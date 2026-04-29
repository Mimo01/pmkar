import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConnectionStore } from '../../connections/connectionStore';
import { TicketFilterBar } from '../TicketFilterBar';
import { TicketListPage } from '../TicketListPage';
import { useTicketStore } from '../ticketStore';
import type { JiraTicket, JiraUser } from '../types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTicket = (
  key: string,
  assigneeName: string | null = null,
  updated = '2024-01-01T00:00:00.000Z',
): JiraTicket => ({
  id: key,
  key,
  fields: {
    summary: `Summary for ${key}`,
    status: { name: 'Open' },
    priority: { name: 'Medium', id: '3' },
    assignee: assigneeName ? { displayName: assigneeName } : null,
    created: updated,
    updated,
  },
});

const defaultStoreState = {
  tickets: [],
  triageMap: {},
  selectedTicketKey: null,
  fetchStatus: 'idle' as const,
  fetchError: null,
  lastFetchedAt: null,
  totalCount: 0,
  newCount: 0,
  jqlPreset: 'mine' as const,
  jqlCustom: null,
  watchedUsers: [],
};

// ---------------------------------------------------------------------------
// TicketFilterBar unit tests
// ---------------------------------------------------------------------------

describe('TicketFilterBar', () => {
  const defaultSortProps = {
    sortField: 'updated' as const,
    onSortFieldChange: vi.fn(),
    sortDirection: 'desc' as const,
    onToggleSort: vi.fn(),
  };

  it('renders key search input with placeholder text', () => {
    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        {...defaultSortProps}
        resultCount={5}
      />,
    );
    expect(screen.getByPlaceholderText('Filter by key...')).toBeInTheDocument();
  });

  it('renders assignee autocomplete input with placeholder text', () => {
    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        {...defaultSortProps}
        resultCount={5}
      />,
    );
    expect(screen.getByPlaceholderText('Filter by assignee...')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing in the key search input', () => {
    const onSearchChange = vi.fn();
    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={onSearchChange}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        {...defaultSortProps}
        resultCount={5}
      />,
    );
    const input = screen.getByPlaceholderText('Filter by key...');
    fireEvent.change(input, { target: { value: 'PROJ-1' } });
    expect(onSearchChange).toHaveBeenCalledWith('PROJ-1');
  });

  it('does not show clear button when searchText is empty', () => {
    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        {...defaultSortProps}
        resultCount={5}
      />,
    );
    expect(screen.queryByLabelText('Clear search')).toBeNull();
  });

  it('shows clear button when searchText is non-empty', () => {
    render(
      <TicketFilterBar
        searchText="PROJ"
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        {...defaultSortProps}
        resultCount={2}
      />,
    );
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('calls onSearchChange with empty string when clear button is clicked', () => {
    const onSearchChange = vi.fn();
    render(
      <TicketFilterBar
        searchText="PROJ"
        onSearchChange={onSearchChange}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        {...defaultSortProps}
        resultCount={2}
      />,
    );
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('calls onToggleSort when sort direction button is clicked', () => {
    const onToggleSort = vi.fn();
    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortField="updated"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={onToggleSort}
        resultCount={5}
      />,
    );
    fireEvent.click(screen.getByLabelText('Sort ascending'));
    expect(onToggleSort).toHaveBeenCalled();
  });

  it('calls onSortFieldChange when sort field select changes', () => {
    const onSortFieldChange = vi.fn();
    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortField="updated"
        onSortFieldChange={onSortFieldChange}
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={5}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('Updated'), { target: { value: 'key' } });
    expect(onSortFieldChange).toHaveBeenCalledWith('key');
  });

  it('displays resultCount in the shown text', () => {
    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        {...defaultSortProps}
        resultCount={7}
      />,
    );
    expect(screen.getByText('7 shown')).toBeInTheDocument();
  });

  it('shows assignee chip when assigneeFilter is set', () => {
    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter="Alice"
        onAssigneeChange={vi.fn()}
        {...defaultSortProps}
        resultCount={2}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByLabelText('Clear assignee filter')).toBeInTheDocument();
  });

  it('calls onAssigneeChange with empty string when assignee chip X is clicked', () => {
    const onAssigneeChange = vi.fn();
    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter="Alice"
        onAssigneeChange={onAssigneeChange}
        {...defaultSortProps}
        resultCount={2}
      />,
    );
    fireEvent.click(screen.getByLabelText('Clear assignee filter'));
    expect(onAssigneeChange).toHaveBeenCalledWith('');
  });
});

// ---------------------------------------------------------------------------
// TicketFilterBar — Assignee autocomplete
// ---------------------------------------------------------------------------

describe('TicketFilterBar — Assignee autocomplete', () => {
  const mockUsers: JiraUser[] = [
    { displayName: 'Alice Smith', accountId: 'user-1' },
    { displayName: 'Bob Jones', accountId: 'user-2' },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    mockInvoke.mockReset();
    useConnectionStore.setState({
      serverConnection: {
        baseUrl: 'https://jira.example.com',
        username: 'jdoe',
        serverVersion: '8.20.0',
        lastTestedAt: new Date().toISOString(),
        status: 'ok',
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers invoke search_jira_users after debounce when typing', async () => {
    mockInvoke.mockResolvedValue(mockUsers);

    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortField="updated"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={5}
      />,
    );

    const input = screen.getByPlaceholderText('Filter by assignee...');
    fireEvent.change(input, { target: { value: 'ali' } });

    // Before debounce fires — no invoke yet
    expect(mockInvoke).not.toHaveBeenCalledWith('search_jira_users', expect.anything());

    // Advance timers past 250ms debounce AND flush microtasks (promise callbacks)
    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(mockInvoke).toHaveBeenCalledWith('search_jira_users', {
      baseUrl: 'https://jira.example.com',
      query: 'ali',
    });
  });

  it('shows suggestion dropdown after users returned', async () => {
    mockInvoke.mockResolvedValue(mockUsers);

    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortField="updated"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={5}
      />,
    );

    const input = screen.getByPlaceholderText('Filter by assignee...');
    fireEvent.change(input, { target: { value: 'ali' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('shows "no users found" when search returns empty array', async () => {
    mockInvoke.mockResolvedValue([]);

    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortField="updated"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={5}
      />,
    );

    const input = screen.getByPlaceholderText('Filter by assignee...');
    fireEvent.change(input, { target: { value: 'xyz' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/no users found/i)).toBeInTheDocument();
  });

  it('selecting user via click calls onAssigneeChange with displayName', async () => {
    mockInvoke.mockResolvedValue(mockUsers);
    const onAssigneeChange = vi.fn();

    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={onAssigneeChange}
        sortField="updated"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={5}
      />,
    );

    const input = screen.getByPlaceholderText('Filter by assignee...');
    fireEvent.change(input, { target: { value: 'ali' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('Alice Smith').closest('button')!);
    expect(onAssigneeChange).toHaveBeenCalledWith('Alice Smith');
  });

  it('ArrowDown key navigates down in suggestions', async () => {
    mockInvoke.mockResolvedValue(mockUsers);

    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortField="updated"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={5}
      />,
    );

    const input = screen.getByPlaceholderText('Filter by assignee...');
    fireEvent.change(input, { target: { value: 'ali' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();

    // Press ArrowDown to select first item
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const firstOption = screen.getByRole('option', { name: /alice smith/i });
    expect(firstOption).toHaveAttribute('aria-selected', 'true');
  });

  it('Escape key closes suggestions dropdown', async () => {
    mockInvoke.mockResolvedValue(mockUsers);

    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortField="updated"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={5}
      />,
    );

    const input = screen.getByPlaceholderText('Filter by assignee...');
    fireEvent.change(input, { target: { value: 'ali' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Enter key selects highlighted suggestion', async () => {
    mockInvoke.mockResolvedValue(mockUsers);
    const onAssigneeChange = vi.fn();

    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={onAssigneeChange}
        sortField="updated"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={5}
      />,
    );

    const input = screen.getByPlaceholderText('Filter by assignee...');
    fireEvent.change(input, { target: { value: 'ali' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();

    // Navigate to first item and select
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAssigneeChange).toHaveBeenCalledWith('Alice Smith');
  });

  it('clears suggestions when query is empty', async () => {
    mockInvoke.mockResolvedValue(mockUsers);

    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortField="updated"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={5}
      />,
    );

    const input = screen.getByPlaceholderText('Filter by assignee...');
    fireEvent.change(input, { target: { value: 'ali' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();

    // Clear the input
    fireEvent.change(input, { target: { value: '' } });

    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
  });

  it('does not invoke when serverConnection is null', async () => {
    useConnectionStore.setState({ serverConnection: null });
    mockInvoke.mockResolvedValue(mockUsers);

    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortField="updated"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={5}
      />,
    );

    const input = screen.getByPlaceholderText('Filter by assignee...');
    fireEvent.change(input, { target: { value: 'ali' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    expect(mockInvoke).not.toHaveBeenCalledWith('search_jira_users', expect.anything());
  });

  it('handles invoke error gracefully — closes dropdown', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'));

    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortField="updated"
        onSortFieldChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={5}
      />,
    );

    const input = screen.getByPlaceholderText('Filter by assignee...');
    fireEvent.change(input, { target: { value: 'ali' } });

    await act(async () => {
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();
    });

    // After error, suggestions dropdown should not be visible
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// TicketListPage filter integration tests
// ---------------------------------------------------------------------------

describe('TicketListPage filter integration', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    // Return empty triage map and fetch config with no lastFetchedAt
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_triage_state') return Promise.resolve({});
      if (cmd === 'get_fetch_config')
        return Promise.resolve({
          preset: 'mine',
          custom: null,
          watchedUsers: [],
          lastFetchedAt: null,
        });
      return Promise.resolve(null);
    });

    useTicketStore.setState({
      ...defaultStoreState,
      fetchStatus: 'idle',
      lastFetchedAt: '2024-01-01T00:00:00.000Z', // mark as previously fetched to show cards
      tickets: [
        makeTicket('PROJ-1', 'Alice', '2024-06-01T00:00:00.000Z'),
        makeTicket('PROJ-2', 'Bob', '2024-05-01T00:00:00.000Z'),
        makeTicket('OTHER-1', 'Alice', '2024-04-01T00:00:00.000Z'),
      ],
      triageMap: {
        'PROJ-1': { state: 'new', copiedKey: null },
        'PROJ-2': { state: 'new', copiedKey: null },
        'OTHER-1': { state: 'new', copiedKey: null },
      },
    });
  });

  it('shows all tickets initially (no filter applied)', () => {
    render(<TicketListPage />);
    expect(screen.getByText('Summary for PROJ-1')).toBeInTheDocument();
    expect(screen.getByText('Summary for PROJ-2')).toBeInTheDocument();
    expect(screen.getByText('Summary for OTHER-1')).toBeInTheDocument();
  });

  it('filters to matching ticket key when typing in key search', () => {
    render(<TicketListPage />);
    const input = screen.getByPlaceholderText('Filter by key...');
    fireEvent.change(input, { target: { value: 'PROJ-1' } });

    expect(screen.getByText('Summary for PROJ-1')).toBeInTheDocument();
    expect(screen.queryByText('Summary for PROJ-2')).toBeNull();
    expect(screen.queryByText('Summary for OTHER-1')).toBeNull();
  });

  it('shows all tickets again after clearing search', () => {
    render(<TicketListPage />);
    const input = screen.getByPlaceholderText('Filter by key...');
    fireEvent.change(input, { target: { value: 'PROJ-1' } });
    // Only PROJ-1 visible
    expect(screen.queryByText('Summary for PROJ-2')).toBeNull();

    // Clear via clear button
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByText('Summary for PROJ-1')).toBeInTheDocument();
    expect(screen.getByText('Summary for PROJ-2')).toBeInTheDocument();
    expect(screen.getByText('Summary for OTHER-1')).toBeInTheDocument();
  });

  it('reverses sort order when sort toggle is clicked', () => {
    render(<TicketListPage />);
    // Default is desc — PROJ-1 (June) first
    const summariesBefore = screen.getAllByText(/Summary for (PROJ|OTHER)/);
    expect(summariesBefore[0].textContent).toBe('Summary for PROJ-1');

    // Click sort direction button to switch to asc
    fireEvent.click(screen.getByLabelText('Sort ascending'));
    const summariesAfter = screen.getAllByText(/Summary for (PROJ|OTHER)/);
    // Asc: oldest first — OTHER-1 (April) should be first
    expect(summariesAfter[0].textContent).toBe('Summary for OTHER-1');
  });
});
