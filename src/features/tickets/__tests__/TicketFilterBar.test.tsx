import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketFilterBar } from '../TicketFilterBar';
import { TicketListPage } from '../TicketListPage';
import { useTicketStore } from '../ticketStore';
import type { JiraTicket } from '../types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

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
  jqlPreset: 'assigned' as const,
  jqlCustom: null,
  watchedUsers: [],
};

// ---------------------------------------------------------------------------
// TicketFilterBar unit tests
// ---------------------------------------------------------------------------

describe('TicketFilterBar', () => {
  it('renders key search input with placeholder text', () => {
    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={vi.fn()}
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
        sortDirection="desc"
        onToggleSort={vi.fn()}
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
        sortDirection="desc"
        onToggleSort={vi.fn()}
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
        sortDirection="desc"
        onToggleSort={vi.fn()}
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
        sortDirection="desc"
        onToggleSort={vi.fn()}
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
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={2}
      />,
    );
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('calls onToggleSort when sort button is clicked', () => {
    const onToggleSort = vi.fn();
    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={onToggleSort}
        resultCount={5}
      />,
    );
    fireEvent.click(screen.getByText('Updated'));
    expect(onToggleSort).toHaveBeenCalled();
  });

  it('displays resultCount in the shown text', () => {
    render(
      <TicketFilterBar
        searchText=""
        onSearchChange={vi.fn()}
        assigneeFilter=""
        onAssigneeChange={vi.fn()}
        sortDirection="desc"
        onToggleSort={vi.fn()}
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
        sortDirection="desc"
        onToggleSort={vi.fn()}
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
        sortDirection="desc"
        onToggleSort={vi.fn()}
        resultCount={2}
      />,
    );
    fireEvent.click(screen.getByLabelText('Clear assignee filter'));
    expect(onAssigneeChange).toHaveBeenCalledWith('');
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
          preset: 'assigned',
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

    // Click sort toggle to switch to asc
    fireEvent.click(screen.getByText('Updated'));
    const summariesAfter = screen.getAllByText(/Summary for (PROJ|OTHER)/);
    // Asc: oldest first — OTHER-1 (April) should be first
    expect(summariesAfter[0].textContent).toBe('Summary for OTHER-1');
  });
});
